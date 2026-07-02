/**
 * AI 聊天页面：负责展示用户与 AI 的对话、提交聊天请求，并把后端 SSE 增量回复渲染成打字机效果。
 *
 * 当前文件依赖项：React 状态与 ref、浏览器 IndexedDB、Ant Design 基础组件、页面 Less Module 样式。
 *
 * 当前文件提供的功能：构造聊天请求、解析 Server-Sent Events 流、持久化聊天消息、展示输入框与 AI 回复。
 *
 * 核心逻辑流程：页面加载时从 IndexedDB 恢复聊天记录；用户提交输入后先追加用户消息和空 AI 消息，
 * 再请求 `/api/chat/stream`，每个 delta 进入本地打字队列逐字展示，流结束且队列消费完后把完整回复同步回 React state。
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space, Typography } from 'antd';
import { IndexedDbStoreClient } from '@/utils/indexed-db';
import styles from './index.module.less';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

const typewriterDelayMs = 18;
const chatHistoryDatabaseName = 'ai-flow-chat';
const chatHistoryDatabaseVersion = 1;
const chatHistoryKey = 'default-chat';
const chatHistoryStoreName = 'chat-history';
const chatHistoryStore = new IndexedDbStoreClient({
  databaseName: chatHistoryDatabaseName,
  storeName: chatHistoryStoreName,
  version: chatHistoryDatabaseVersion,
});

const initialMessages: ChatMessage[] = [
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

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typingMessageId, setTypingMessageId] = useState('');
  const [thinkingMessageId, setThinkingMessageId] = useState('');
  const [typedAssistantContent, setTypedAssistantContent] = useState('');
  const activeAssistantMessageIdRef = useRef('');
  const pendingCharactersRef = useRef<string[]>([]);
  const typedAssistantContentRef = useRef('');
  const streamDoneRef = useRef(false);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatHistoryLoadedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    void loadPersistedChatMessages().then((persistedMessages) => {
      if (!isMounted) {
        return;
      }

      if (persistedMessages) {
        setMessages(persistedMessages);
      }

      chatHistoryLoadedRef.current = true;
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!chatHistoryLoadedRef.current) {
      return;
    }

    void savePersistedChatMessages(messages);
  }, [messages]);

  const resetTypewriter = () => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }

    activeAssistantMessageIdRef.current = '';
    pendingCharactersRef.current = [];
    typedAssistantContentRef.current = '';
    streamDoneRef.current = false;
    setTypedAssistantContent('');
  };

  const commitAssistantMessage = () => {
    const assistantMessageId = activeAssistantMessageIdRef.current;
    const assistantContent = typedAssistantContentRef.current;

    if (!assistantMessageId) {
      return;
    }

    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === assistantMessageId
          ? { ...message, content: assistantContent }
          : message,
      ),
    );
    setTypingMessageId('');
    setThinkingMessageId('');
    resetTypewriter();
  };

  const startTypewriter = () => {
    if (typeTimerRef.current) {
      return;
    }

    typeTimerRef.current = setInterval(() => {
      const nextCharacter = pendingCharactersRef.current.shift();

      if (nextCharacter) {
        typedAssistantContentRef.current += nextCharacter;
        setTypedAssistantContent(typedAssistantContentRef.current);
        return;
      }

      if (streamDoneRef.current) {
        if (typeTimerRef.current) {
          clearInterval(typeTimerRef.current);
          typeTimerRef.current = null;
        }

        commitAssistantMessage();
        return;
      }

      if (typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
      }
    }, typewriterDelayMs);
  };

  const writeAssistantDelta = (delta: string) => {
    setThinkingMessageId('');
    pendingCharactersRef.current.push(...Array.from(delta));
    startTypewriter();
  };

  const finishAssistantTyping = () => {
    streamDoneRef.current = true;
    startTypewriter();
  };

  const sendMessage = async () => {
    const content = draft.trim();

    if (!content || loading) {
      return;
    }

    const request = buildChatRequest(messages, content);

    setMessages(request.messages);
    setDraft('');
    setLoading(true);
    setError('');
    const assistantMessageId = `assistant-${Date.now()}`;

    try {
      resetTypewriter();
      activeAssistantMessageIdRef.current = assistantMessageId;
      setTypingMessageId(assistantMessageId);
      setThinkingMessageId(assistantMessageId);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
        },
      ]);

      const response = await fetch('/api/chat/stream', {
        body: JSON.stringify(request.payload),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      });

      await readChatStream(response, (delta) => {
        writeAssistantDelta(delta);
      });
      finishAssistantTyping();
    } catch {
      setError('AI 回复失败，请确认后端已启动并配置 OPENAI_API_KEY。');
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== assistantMessageId),
      );
      setTypingMessageId('');
      setThinkingMessageId('');
      resetTypewriter();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space orientation="vertical" size={24} className={styles.pageStack}>
      <div>
        <Typography.Title level={2}>AI 聊天</Typography.Title>
        <Typography.Paragraph type="secondary">
          通过后端 Nest API 调用 OpenAI Responses API，前端不会暴露 API Key。
        </Typography.Paragraph>
      </div>

      <Card title="对话">
        <div className={styles.chatShell}>
          {error ? <Alert type="error" title={error} showIcon /> : null}
          <div className={styles.messageList}>
            {messages.map((message) => (
              <div
                className={`${styles.message} ${
                  message.role === 'user'
                    ? styles.userMessage
                    : styles.assistantMessage
                }`}
                key={message.id}
              >
                <span className={styles.messageRole}>
                  {message.role === 'user' ? '你' : 'AI'}
                </span>
                {message.id === thinkingMessageId ? (
                  <span className={styles.thinkingIndicator}>思考中...</span>
                ) : null}
                {message.id === typingMessageId ? (
                  <span className={styles.typedMessage}>
                    {typedAssistantContent}
                  </span>
                ) : (
                  message.content
                )}
              </div>
            ))}
          </div>

          <div className={styles.composer}>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="输入你想让 AI 帮你处理的问题"
              value={draft}
            />
            <div className={styles.actions}>
              <Button
                disabled={!draft.trim()}
                loading={loading}
                onClick={() => void sendMessage()}
                type="primary"
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </Space>
  );
}
