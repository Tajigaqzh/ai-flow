import { renderToStaticMarkup } from 'react-dom/server';
import {
  ChatPage,
  buildChatRequest,
  getPersistableChatMessages,
  normalizePersistedChatMessages,
  readChatStream,
} from '@/pages/chat';

describe('ChatPage', () => {
  // 正常场景：页面首次渲染应展示 AI 聊天标题、说明、欢迎消息和输入入口。
  it('renders the initial chat experience', () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toContain('AI 聊天');
    expect(html).toContain('通过后端 Nest API 调用 OpenAI Responses API');
    expect(html).toContain('你好，我是项目内置 AI 助手。');
    expect(html).toContain('输入你想让 AI 帮你处理的问题');
    expect(html).toMatch(/发\s*送/);
  });

  // 正常场景：构造请求时应保留 2-3 条代表性上下文，并追加当前用户输入。
  it('builds a chat request with existing context and the next user message', () => {
    const request = buildChatRequest(
      [
        { id: 'assistant-1', role: 'assistant', content: '你好' },
        { id: 'user-1', role: 'user', content: '介绍项目' },
      ],
      '  继续说明测试策略  ',
    );

    expect(request.messages).toHaveLength(3);
    expect(request.payload.messages).toEqual([
      { role: 'assistant', content: '你好' },
      { role: 'user', content: '介绍项目' },
      { role: 'user', content: '继续说明测试策略' },
    ]);
  });

  // 边界场景：空白输入应被裁剪，确保发送给 API 的内容不会包含首尾空白。
  it('trims the next user message before creating the API payload', () => {
    const request = buildChatRequest([], '\n  hello ai  \n');

    expect(request.payload.messages).toEqual([
      { role: 'user', content: 'hello ai' },
    ]);
  });

  // 边界场景：持久化聊天记录时应过滤正在生成中的空 AI 占位消息，避免刷新后展示半成品回复。
  it('filters empty assistant placeholders before persistence', () => {
    expect(
      getPersistableChatMessages([
        { id: 'user-1', role: 'user', content: '你好' },
        { id: 'assistant-pending', role: 'assistant', content: '' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '你好，有什么可以帮你？',
        },
      ]),
    ).toEqual([
      { id: 'user-1', role: 'user', content: '你好' },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '你好，有什么可以帮你？',
      },
    ]);
  });

  // 异常场景：IndexedDB 中的异常记录应被忽略，避免污染当前页面消息状态。
  it('rejects invalid persisted chat messages', () => {
    expect(normalizePersistedChatMessages(null)).toBeNull();
    expect(
      normalizePersistedChatMessages([
        { id: 'user-1', role: 'system', content: '非法角色' },
      ]),
    ).toBeNull();
    expect(
      normalizePersistedChatMessages([
        { id: 'user-1', role: 'user', content: '有效消息' },
      ]),
    ).toEqual([{ id: 'user-1', role: 'user', content: '有效消息' }]);
  });

  // 正常场景：SSE 流式响应应按 delta 事件逐段输出，形成前端打字机效果。
  it('reads server-sent chat deltas in order', async () => {
    const deltas: string[] = [];
    const response = new Response(
      [
        'event: delta\n',
        'data: "你"\n\n',
        'event: delta\n',
        'data: "好"\n\n',
        'event: done\n',
        'data: {}\n\n',
      ].join(''),
      { status: 200 },
    );

    await readChatStream(response, (delta) => deltas.push(delta));

    expect(deltas).toEqual(['你', '好']);
  });

  // 正常场景：SSE 数据分批到达时，第一段完整 delta 应立即触发回调，不需要等待整个响应结束。
  it('emits each complete stream delta before the full response is done', async () => {
    const deltas: string[] = [];
    const encoder = new TextEncoder();
    let resolveController: (
      controller: ReadableStreamDefaultController<Uint8Array>,
    ) => void = () => undefined;
    const controllerPromise = new Promise<
      ReadableStreamDefaultController<Uint8Array>
    >((resolve) => {
      resolveController = resolve;
    });
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(streamController) {
          resolveController(streamController);
        },
      }),
      { status: 200 },
    );
    const readPromise = readChatStream(response, (delta) => deltas.push(delta));
    const controller = await controllerPromise;

    controller.enqueue(
      encoder.encode(['event: delta\n', 'data: "先"\n\n'].join('')),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deltas).toEqual(['先']);

    controller.enqueue(
      encoder.encode(['event: delta\n', 'data: "后"\n\n'].join('')),
    );
    controller.close();
    await readPromise;

    expect(deltas).toEqual(['先', '后']);
  });

  // 异常场景：SSE error 事件应转成前端异常，避免继续展示未完成的 AI 消息。
  it('throws when the chat stream emits an error event', async () => {
    const response = new Response(
      ['event: error\n', 'data: "upstream failed"\n\n'].join(''),
      { status: 200 },
    );

    await expect(readChatStream(response, () => undefined)).rejects.toThrow(
      'upstream failed',
    );
  });

  // 边界场景：HTTP 非 2xx 或缺少 body 时应直接失败，避免读取空流造成假成功。
  it('rejects failed stream responses before reading deltas', async () => {
    const response = new Response(null, { status: 500 });

    await expect(readChatStream(response, () => undefined)).rejects.toThrow(
      'chat stream request failed',
    );
  });
});
