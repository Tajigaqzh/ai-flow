import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ChatService,
  compactChatMessages,
  extractOutputTextDelta,
  normalizeChatMessages,
} from './chat.service';

async function* createTextStream() {
  yield { delta: '你', type: 'response.output_text.delta' };
  yield { type: 'response.created' };
  yield { delta: '好', type: 'response.output_text.delta' };
}

async function* createEventStreamWrappedTextStream() {
  yield {
    eventStream: [
      { delta: '流', type: 'response.output_text.delta' },
      { type: 'response.in_progress' },
      { delta: '式', type: 'response.output_text.delta' },
    ],
  };
}

describe('ChatService', () => {
  // 正常场景：消息内容首尾空格应被清理，避免把空白噪音传给模型。
  it('normalizes message content before validation', () => {
    expect(
      normalizeChatMessages({
        messages: [{ role: 'user', content: '  介绍这个项目  ' }],
      }),
    ).toEqual([{ role: 'user', content: '介绍这个项目' }]);
  });

  // 正常场景：流式回复应只透出 OpenAI output_text delta，忽略 created 等非文本事件。
  it('streams output text deltas from OpenAI events', async () => {
    const create = jest.fn(async () => createTextStream());
    const service = ChatService.createForTest(
      {
        responses: {
          create,
        },
      },
      'test-model',
      'medium',
      false,
    );
    const deltas: string[] = [];

    for await (const delta of service.streamReply({
      messages: [{ role: 'user', content: '你好' }],
    })) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(['你', '好']);
    expect(create).toHaveBeenCalledWith({
      input: 'user: 你好',
      model: 'test-model',
      reasoning: { effort: 'medium' },
      store: false,
      stream: true,
    });
  });

  // 正常场景：请求 OpenAI 前应只保留最近上下文，减少模型读取历史导致的首 token 等待。
  it('sends compacted recent context to OpenAI', async () => {
    const create = jest.fn(async () => createTextStream());
    const service = ChatService.createForTest(
      {
        responses: {
          create,
        },
      },
      'test-model',
      '',
      false,
      2,
      100,
    );

    for await (const delta of service.streamReply({
      messages: [
        { role: 'user', content: '第一轮问题' },
        { role: 'assistant', content: '第一轮回答' },
        { role: 'user', content: '第二轮问题' },
      ],
    })) {
      void delta;
    }

    expect(create).toHaveBeenCalledWith({
      input: 'assistant: 第一轮回答\nuser: 第二轮问题',
      model: 'test-model',
      reasoning: undefined,
      store: false,
      stream: true,
    });
  });

  // 正常场景：配置最大输出 token 时应透传给 OpenAI，限制回复长度以降低长答案等待时间。
  it('passes max output tokens to OpenAI when configured', async () => {
    const create = jest.fn(async () => createTextStream());
    const service = ChatService.createForTest(
      {
        responses: {
          create,
        },
      },
      'test-model',
      '',
      false,
      12,
      12000,
      100,
      64,
    );

    for await (const delta of service.streamReply({
      messages: [{ role: 'user', content: '简短回答' }],
    })) {
      void delta;
    }

    expect(create).toHaveBeenCalledWith({
      input: 'user: 简短回答',
      max_output_tokens: 64,
      model: 'test-model',
      reasoning: undefined,
      store: false,
      stream: true,
    });
  });

  // 正常场景：相同压缩上下文重复请求时应命中回复缓存，避免再次调用 OpenAI。
  it('reuses cached responses for repeated compacted context', async () => {
    const create = jest.fn(async () => createTextStream());
    const service = ChatService.createForTest(
      {
        responses: {
          create,
        },
      },
      'test-model',
      '',
      false,
      12,
      12000,
      100,
      undefined,
      10,
    );
    const firstDeltas: string[] = [];
    const secondDeltas: string[] = [];
    const request = {
      messages: [{ role: 'user' as const, content: '你好' }],
    };

    for await (const delta of service.streamReply(request)) {
      firstDeltas.push(delta);
    }

    for await (const delta of service.streamReply(request)) {
      secondDeltas.push(delta);
    }

    expect(firstDeltas).toEqual(['你', '好']);
    expect(secondDeltas).toEqual(['你好']);
    expect(create).toHaveBeenCalledTimes(1);
  });

  // 正常场景：部分兼容 OpenAI 的服务会把增量事件包在 eventStream 字段中，也应生成打字机文本。
  it('streams output text deltas from eventStream wrapped events', async () => {
    const create = jest.fn(async () => createEventStreamWrappedTextStream());
    const service = ChatService.createForTest({
      responses: {
        create,
      },
    });
    const deltas: string[] = [];

    for await (const delta of service.streamReply({
      messages: [{ role: 'user', content: '测试流式' }],
    })) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(['流式']);
  });

  // 边界场景：只有 output_text delta 事件能生成打字机文本，空 delta 和其他事件都应忽略。
  it('extracts text only from output delta events', () => {
    expect(
      extractOutputTextDelta({
        delta: 'hello',
        type: 'response.output_text.delta',
      }),
    ).toBe('hello');
    expect(
      extractOutputTextDelta({
        delta: '',
        type: 'response.output_text.delta',
      }),
    ).toBe('');
    expect(
      extractOutputTextDelta({
        delta: 'ignored',
        type: 'response.created',
      }),
    ).toBe('');
    expect(
      extractOutputTextDelta({
        eventStream: [
          { delta: '嵌', type: 'response.output_text.delta' },
          { type: 'response.created' },
          { delta: '套', type: 'response.output_text.delta' },
        ],
      }),
    ).toBe('嵌套');
  });

  // 边界场景：上下文压缩应优先保留最近消息，并在字符预算不足时截断最新问题的前半部分。
  it('compacts messages by recent window and character budget', () => {
    expect(
      compactChatMessages(
        [
          { role: 'user', content: '旧问题' },
          { role: 'assistant', content: '旧回答' },
          { role: 'user', content: '最新问题' },
        ],
        2,
        100,
      ),
    ).toEqual([
      { role: 'assistant', content: '旧回答' },
      { role: 'user', content: '最新问题' },
    ]);

    expect(
      compactChatMessages(
        [{ role: 'user', content: '这是一条很长的问题' }],
        5,
        4,
      ),
    ).toEqual([{ role: 'user', content: '长的问题' }]);
  });

  // 异常场景：消息数组为空时应拒绝请求，避免向模型发送无意义输入。
  it('rejects an empty message list', () => {
    expect(() => normalizeChatMessages({ messages: [] })).toThrow(
      BadRequestException,
    );
  });

  // 异常场景：非法 role 或空内容都应被拒绝，覆盖请求体边界校验。
  it('rejects invalid roles and blank content', () => {
    expect(() =>
      normalizeChatMessages({
        messages: [{ role: 'system' as 'user', content: 'hello' }],
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      normalizeChatMessages({
        messages: [{ role: 'user', content: '   ' }],
      }),
    ).toThrow(BadRequestException);
  });

  // 异常场景：未配置 API Key 时流式接口应返回服务不可用，避免后端启动后才出现不明确错误。
  it('rejects stream calls when OpenAI client is unavailable', async () => {
    const service = ChatService.createForTest(null, 'test-model');

    await expect(async () => {
      for await (const delta of service.streamReply({
        messages: [{ role: 'user', content: '你好' }],
      })) {
        void delta;
      }
    }).rejects.toThrow(ServiceUnavailableException);
  });
});
