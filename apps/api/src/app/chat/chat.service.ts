import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';

export type ChatRole = 'user' | 'assistant';

export type ChatMessageDto = {
  role: ChatRole;
  content: string;
};

export type ChatRequestDto = {
  messages: ChatMessageDto[];
};

type OpenAiStreamEvent = {
  delta?: unknown;
  eventStream?: unknown;
  type?: string;
};

type OpenAiResponsesCreateParams = {
  input: string;
  max_output_tokens?: number;
  model: string;
  reasoning?: {
    effort: string;
  };
  store?: boolean;
  stream?: true;
};

type OpenAiResponsesClient = {
  responses: {
    create: (
      params: OpenAiResponsesCreateParams,
    ) => PromiseLike<AsyncIterable<OpenAiStreamEvent>>;
  };
};

const defaultModel = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const defaultReasoningEffort = process.env.OPENAI_REASONING_EFFORT;
const defaultContextMessageLimit = parsePositiveInteger(
  process.env.OPENAI_CHAT_CONTEXT_LIMIT,
  12,
);
const defaultMaxContextCharacters = parsePositiveInteger(
  process.env.OPENAI_CHAT_CONTEXT_MAX_CHARS,
  12000,
);
const defaultContextCacheSize = parseNonNegativeInteger(
  process.env.OPENAI_CHAT_CONTEXT_CACHE_SIZE,
  100,
);
const defaultResponseCacheSize = parseNonNegativeInteger(
  process.env.OPENAI_CHAT_RESPONSE_CACHE_SIZE,
  50,
);
const cachedResponseChunkSize = parsePositiveInteger(
  process.env.OPENAI_CHAT_RESPONSE_CHUNK_SIZE,
  32,
);
const defaultMaxOutputTokens = parseOptionalPositiveInteger(
  process.env.OPENAI_MAX_OUTPUT_TOKENS,
);

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue >= 0
    ? parsedValue
    : fallback;
}

function parseOptionalPositiveInteger(value: string | undefined) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : undefined;
}

/**
 * 规范化聊天消息：校验请求体中的 messages 是否存在且每条消息都具备合法角色和非空内容。
 *
 * 内部实现逻辑：先裁剪每条消息的 content，再查找角色非法或内容为空的消息；发现异常时抛出
 * BadRequestException，全部合法时返回清洗后的消息数组。
 *
 * 提供的功能：为后续 OpenAI 请求提供可信的聊天上下文输入。
 */
export function normalizeChatMessages(
  request: ChatRequestDto,
): ChatMessageDto[] {
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new BadRequestException('messages must contain at least one item');
  }

  const messages = request.messages.map((message) => ({
    role: message.role,
    content: message.content?.trim() ?? '',
  }));

  const invalidMessage = messages.find(
    (message) =>
      !['user', 'assistant'].includes(message.role) || message.content === '',
  );

  if (invalidMessage) {
    throw new BadRequestException(
      'each message must have a user or assistant role and non-empty content',
    );
  }

  return messages;
}

/**
 * 压缩聊天上下文：只保留最近的对话消息，并在字符预算内尽量保留最新内容。
 *
 * 内部实现逻辑：先按 contextMessageLimit 截取最近消息，再从后向前累计 content 长度，超过预算的旧消息会被丢弃；
 * 如果最新一条消息本身超过预算，则保留其尾部内容，确保用户最新问题仍能传给模型。
 *
 * 提供的功能：减少每次发送给 OpenAI 的上下文长度，降低模型读取历史的成本和首 token 等待时间。
 */
export function compactChatMessages(
  messages: ChatMessageDto[],
  contextMessageLimit = defaultContextMessageLimit,
  maxContextCharacters = defaultMaxContextCharacters,
): ChatMessageDto[] {
  const recentMessages = messages.slice(-contextMessageLimit);
  const compactedMessages: ChatMessageDto[] = [];
  let usedCharacters = 0;

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];
    const remainingCharacters = maxContextCharacters - usedCharacters;

    if (remainingCharacters <= 0) {
      break;
    }

    if (message.content.length <= remainingCharacters) {
      compactedMessages.unshift(message);
      usedCharacters += message.content.length;
      continue;
    }

    if (compactedMessages.length === 0) {
      compactedMessages.unshift({
        ...message,
        content: message.content.slice(-remainingCharacters),
      });
    }

    break;
  }

  return compactedMessages;
}

/**
 * 提取 OpenAI 流式事件中的文本增量：兼容直接 delta 事件和嵌套 eventStream 事件。
 *
 * 内部实现逻辑：如果事件包含 eventStream 数组，则递归提取并拼接其中所有文本增量；如果当前事件类型为
 * response.output_text.delta 且 delta 是字符串，则返回该增量，否则返回空字符串。
 *
 * 提供的功能：把 OpenAI Responses API 的流式事件统一转换成前端 SSE 可以消费的文本片段。
 */
export function extractOutputTextDelta(event: OpenAiStreamEvent): string {
  if (Array.isArray(event.eventStream)) {
    return event.eventStream
      .map((streamEvent) =>
        extractOutputTextDelta(streamEvent as OpenAiStreamEvent),
      )
      .join('');
  }

  if (
    event.type === 'response.output_text.delta' &&
    typeof event.delta === 'string'
  ) {
    return event.delta;
  }

  return '';
}

@Injectable()
export class ChatService {
  private client: OpenAiResponsesClient | null;
  private contextCacheSize: number;
  private contextInputCache = new Map<string, string>();
  private contextMessageLimit: number;
  private maxContextCharacters: number;
  private maxOutputTokens: number | undefined;
  private model: string;
  private reasoningEffort: string | undefined;
  private responseCache = new Map<string, string>();
  private responseCacheSize: number;
  private storeResponses: boolean;

  /**
   * 初始化聊天服务：读取环境变量配置并尝试创建 OpenAI Responses API 客户端。
   *
   * 内部实现逻辑：使用默认模型、推理强度、响应存储开关、上下文窗口、上下文缓存大小、回复缓存大小
   * 和最大输出 token 初始化实例字段，再根据 OPENAI_API_KEY 是否存在决定是否创建真实 OpenAI 客户端。
   *
   * 提供的功能：让运行时服务在启动后具备可复用的模型配置、上下文优化配置和客户端实例。
   */
  constructor() {
    this.contextCacheSize = defaultContextCacheSize;
    this.contextMessageLimit = defaultContextMessageLimit;
    this.maxContextCharacters = defaultMaxContextCharacters;
    this.maxOutputTokens = defaultMaxOutputTokens;
    this.model = defaultModel;
    this.reasoningEffort = defaultReasoningEffort;
    this.responseCacheSize = defaultResponseCacheSize;
    this.storeResponses =
      process.env.OPENAI_DISABLE_RESPONSE_STORAGE !== 'true';
    this.client = this.createOpenAiClient();
  }

  /**
   * 创建测试用聊天服务：允许测试注入模拟客户端和覆盖运行时配置。
   *
   * 内部实现逻辑：先创建默认 ChatService 实例，再用传入参数覆盖 client、model、reasoningEffort
   * storeResponses、上下文优化配置和最大输出 token 字段。
   *
   * 提供的功能：避免单元测试依赖真实环境变量或真实 OpenAI 网络请求。
   */
  static createForTest(
    client: OpenAiResponsesClient | null,
    model = defaultModel,
    reasoningEffort = defaultReasoningEffort,
    storeResponses = process.env.OPENAI_DISABLE_RESPONSE_STORAGE !== 'true',
    contextMessageLimit = defaultContextMessageLimit,
    maxContextCharacters = defaultMaxContextCharacters,
    contextCacheSize = defaultContextCacheSize,
    maxOutputTokens = defaultMaxOutputTokens,
    responseCacheSize = defaultResponseCacheSize,
  ): ChatService {
    const service = new ChatService();

    service.client = client;
    service.contextCacheSize = contextCacheSize;
    service.contextMessageLimit = contextMessageLimit;
    service.maxContextCharacters = maxContextCharacters;
    service.maxOutputTokens = maxOutputTokens;
    service.model = model;
    service.reasoningEffort = reasoningEffort;
    service.responseCacheSize = responseCacheSize;
    service.storeResponses = storeResponses;

    return service;
  }

  /**
   * 创建 OpenAI 客户端：根据环境变量决定是否启用真实 Responses API 调用能力。
   *
   * 内部实现逻辑：缺少 OPENAI_API_KEY 时返回 null；存在密钥时使用 OPENAI_API_KEY 和可选的
   * OPENAI_BASE_URL 实例化 OpenAI SDK 客户端。
   *
   * 提供的功能：把外部依赖初始化集中在服务内部，方便运行时配置和测试替换。
   */
  private createOpenAiClient(): OpenAiResponsesClient | null {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }

    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    }) as unknown as OpenAiResponsesClient;
  }

  /**
   * 获取缓存后的 OpenAI input：对规范化后的消息做上下文压缩，并复用相同上下文的序列化结果。
   *
   * 内部实现逻辑：先调用 compactChatMessages 控制历史窗口和字符预算，再用 JSON 字符串作为缓存 key；
   * 命中缓存时刷新 Map 插入顺序以形成 LRU，未命中时序列化为 role/content 文本并在超过容量后淘汰最旧项。
   *
   * 提供的功能：降低重复请求或短时间相同上下文下的后端处理成本，同时避免把过长历史直接发给模型。
   */
  private getCachedChatInput(messages: ChatMessageDto[]): string {
    const compactedMessages = compactChatMessages(
      messages,
      this.contextMessageLimit,
      this.maxContextCharacters,
    );
    const cacheKey = JSON.stringify(compactedMessages);
    const cachedInput = this.contextInputCache.get(cacheKey);

    if (cachedInput !== undefined) {
      this.contextInputCache.delete(cacheKey);
      this.contextInputCache.set(cacheKey, cachedInput);
      return cachedInput;
    }

    const input = compactedMessages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n');

    if (this.contextCacheSize > 0) {
      this.contextInputCache.set(cacheKey, input);

      if (this.contextInputCache.size > this.contextCacheSize) {
        const oldestCacheKey = this.contextInputCache.keys().next().value;

        if (oldestCacheKey) {
          this.contextInputCache.delete(oldestCacheKey);
        }
      }
    }

    return input;
  }

  /**
   * 创建回复缓存 key：把影响模型输出的配置和压缩后的 input 合并成稳定字符串。
   *
   * 内部实现逻辑：只纳入 model、reasoningEffort、maxOutputTokens 和 input，避免不同模型或输出限制复用错误回复。
   *
   * 提供的功能：为进程内 LRU 回复缓存、未来 Redis 缓存或数据库缓存提供统一键值来源。
   */
  private createResponseCacheKey(input: string): string {
    return JSON.stringify({
      input,
      maxOutputTokens: this.maxOutputTokens,
      model: this.model,
      reasoningEffort: this.reasoningEffort,
    });
  }

  /**
   * 读取缓存回复：命中时刷新 Map 插入顺序，让最近使用的回复更晚被淘汰。
   *
   * 内部实现逻辑：根据 cacheKey 从 responseCache 中取值；如果存在，则先删除再写回，实现简单 LRU。
   *
   * 提供的功能：相同上下文重复提问时直接返回已完成回复，避免再次调用 OpenAI。
   */
  private getCachedResponse(cacheKey: string): string | undefined {
    const cachedResponse = this.responseCache.get(cacheKey);

    if (cachedResponse !== undefined) {
      this.responseCache.delete(cacheKey);
      this.responseCache.set(cacheKey, cachedResponse);
    }

    return cachedResponse;
  }

  /**
   * 写入缓存回复：把一次完整流式回复保存到进程内 LRU 缓存。
   *
   * 内部实现逻辑：缓存容量为 0 时跳过；写入后如果超过 responseCacheSize，则删除最早插入的缓存项。
   *
   * 提供的功能：为重复请求提供快速响应，并保留后续替换为 Redis setex 或数据库 upsert 的清晰入口。
   */
  private setCachedResponse(cacheKey: string, response: string) {
    if (this.responseCacheSize <= 0 || response === '') {
      return;
    }

    this.responseCache.set(cacheKey, response);

    if (this.responseCache.size > this.responseCacheSize) {
      const oldestCacheKey = this.responseCache.keys().next().value;

      if (oldestCacheKey) {
        this.responseCache.delete(oldestCacheKey);
      }
    }
  }

  /**
   * 拆分缓存回复：把完整缓存文本切成较小片段重新 yield，保持前端打字机效果。
   *
   * 内部实现逻辑：按固定字符数切片，使用 Array.from 兼容中文和 emoji 等多字节字符。
   *
   * 提供的功能：缓存命中时仍以流式片段返回，避免前端一次性闪现整段回复。
   */
  private splitCachedResponse(response: string): string[] {
    const characters = Array.from(response);
    const chunks: string[] = [];

    for (
      let index = 0;
      index < characters.length;
      index += cachedResponseChunkSize
    ) {
      chunks.push(
        characters.slice(index, index + cachedResponseChunkSize).join(''),
      );
    }

    return chunks;
  }

  /**
   * 流式生成 AI 回复：这是一个 async * 异步生成器方法，会按文本片段逐段返回 AI 回复。
   *
   * 内部实现逻辑：先规范化请求消息并检查客户端是否可用，再获取经过上下文窗口压缩和 LRU 缓存复用的
   * OpenAI input；如果完整回复缓存命中，则直接拆成小片段 yield 给调用方。缓存未命中时，通过 await
   * 获取 OpenAI SDK 返回的 AsyncIterable 流，并使用 for await...of 逐个读取流式事件。每个事件会交给
   * extractOutputTextDelta 提取文本增量，只有拿到非空 delta 时才通过 yield 暂停当前方法并把该片段
   * 交给调用方；下次调用方继续迭代时，方法会从 yield 后继续读取后续事件。流结束后会把完整回复写入缓存。
   *
   * 提供的功能：为聊天控制器提供 AsyncGenerator<string>，控制器可以边迭代边写入 SSE 响应，
   * 前端因此能够按 delta 增量渲染 AI 回复和打字机效果；同时通过减少输入上下文、复用重复回复和可选输出上限降低等待时间。
   */
  async *streamReply(request: ChatRequestDto): AsyncGenerator<string> {
    const messages = normalizeChatMessages(request);

    if (!this.client) {
      throw new ServiceUnavailableException('OPENAI_API_KEY is not configured');
    }

    const input = this.getCachedChatInput(messages);
    const responseCacheKey = this.createResponseCacheKey(input);
    const cachedResponse = this.getCachedResponse(responseCacheKey);

    if (cachedResponse !== undefined) {
      for (const delta of this.splitCachedResponse(cachedResponse)) {
        yield delta;
      }

      return;
    }

    const createParams: OpenAiResponsesCreateParams = {
      model: this.model,
      reasoning: this.reasoningEffort
        ? { effort: this.reasoningEffort }
        : undefined,
      store: this.storeResponses,
      stream: true,
      input,
    };

    if (this.maxOutputTokens) {
      createParams.max_output_tokens = this.maxOutputTokens;
    }

    const stream = await this.client.responses.create(createParams);
    const responseDeltas: string[] = [];

    for await (const event of stream) {
      const delta = extractOutputTextDelta(event);

      if (delta) {
        responseDeltas.push(delta);
        yield delta;
      }
    }

    this.setCachedResponse(responseCacheKey, responseDeltas.join(''));
  }
}
