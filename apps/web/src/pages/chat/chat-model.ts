import { IndexedDbStoreClient } from '@/utils/indexed-db';
import type { ChatMessage } from './types';

const chatHistoryDatabaseName = 'ai-flow-chat';
const chatHistoryDatabaseVersion = 1;
const chatHistoryKey = 'default-chat';
const chatHistoryStoreName = 'chat-history';
const chatHistoryStore = new IndexedDbStoreClient({
  databaseName: chatHistoryDatabaseName,
  storeName: chatHistoryStoreName,
  version: chatHistoryDatabaseVersion,
});

export const initialMessages: ChatMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content:
      '你好，我是项目内置 AI 助手。可以帮你梳理需求、总结页面或生成实现方案。',
  },
];

/**
 * 构造聊天请求数据：把当前输入追加为用户消息，并同步生成后端接口需要的精简消息 payload。
 *
 * 内部实现逻辑：先基于现有消息列表创建包含本次用户输入的新消息数组，再移除前端展示专用的 id 字段，
 * 仅保留后端聊天接口需要的 role 与 content。
 *
 * 提供的功能：返回可直接写入页面 state 的完整消息列表，以及可传给 `/api/chat/stream` 的请求体。
 */
export function buildChatRequest(messages: ChatMessage[], content: string) {
  const nextMessages = [
    ...messages,
    {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: content.trim(),
    },
  ];

  return {
    messages: nextMessages,
    payload: {
      messages: nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    },
  };
}

export function getPersistableChatMessages(messages: ChatMessage[]) {
  return messages.filter(
    (message) => !(message.role === 'assistant' && message.content === ''),
  );
}

function isChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const candidate = message as ChatMessage;

  return (
    typeof candidate.id === 'string' &&
    ['user', 'assistant'].includes(candidate.role) &&
    typeof candidate.content === 'string'
  );
}

export function normalizePersistedChatMessages(messages: unknown) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  if (!messages.every(isChatMessage)) {
    return null;
  }

  return messages;
}

export async function loadPersistedChatMessages() {
  const record = await chatHistoryStore.get<{
    key: string;
    messages?: unknown;
  }>(chatHistoryKey);

  return normalizePersistedChatMessages(record?.messages);
}

export async function savePersistedChatMessages(messages: ChatMessage[]) {
  await chatHistoryStore.put({
    key: chatHistoryKey,
    messages: getPersistableChatMessages(messages),
  });
}

function parseServerSentEventBlock(block: string) {
  const event = block
    .split('\n')
    .find((line) => line.startsWith('event:'))
    ?.slice('event:'.length)
    .trim();
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('\n');

  return { data, event };
}

export async function readChatStream(
  response: Response,
  onDelta: (delta: string) => void,
) {
  if (!response.ok || !response.body) {
    throw new Error('chat stream request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    buffer += decoder.decode(value, { stream: !done });

    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const { data, event } = parseServerSentEventBlock(block);

      if (event === 'delta') {
        onDelta(JSON.parse(data) as string);
      }

      if (event === 'error') {
        throw new Error(JSON.parse(data) as string);
      }
    }

    if (done) {
      break;
    }
  }
}
