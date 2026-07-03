/**
 * AI 聊天页面：负责组合聊天状态、消息发送和展示子组件。
 *
 * 当前文件依赖项：React 状态、聊天请求工具、聊天记录 hook、AI 打字机 hook 和页面展示组件。
 *
 * 当前文件提供的功能：构造用户消息、调用 `/api/chat/stream`，并把流式回复交给子模块渲染。
 */
import { useState } from 'react';
import { ChatMarkdown } from './chat-markdown';
import {
  buildChatRequest,
  getPersistableChatMessages,
  initialMessages,
  normalizePersistedChatMessages,
  readChatStream,
} from './chat-model';
import { ChatPageView } from './chat-view';
import { useAssistantTypewriter } from './use-assistant-typewriter';
import { useChatHistory } from './use-chat-history';
import type { ChatMessage } from './types';

export {
  ChatMarkdown,
  buildChatRequest,
  getPersistableChatMessages,
  normalizePersistedChatMessages,
  readChatStream,
};

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    beginAssistantTyping,
    clearAssistantTyping,
    finishAssistantTyping,
    thinkingMessageId,
    typedAssistantContent,
    typingMessageId,
    writeAssistantDelta,
  } = useAssistantTypewriter(setMessages);

  useChatHistory(messages, setMessages);

  const sendMessage = async () => {
    const content = draft.trim();

    if (!content || loading) {
      return;
    }

    const request = buildChatRequest(messages, content);
    const assistantMessageId = `assistant-${Date.now()}`;

    setMessages(request.messages);
    setDraft('');
    setLoading(true);
    setError('');

    try {
      beginAssistantTyping(assistantMessageId);
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
      clearAssistantTyping();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChatPageView
      draft={draft}
      error={error}
      loading={loading}
      messages={messages}
      onDraftChange={setDraft}
      onSend={() => void sendMessage()}
      thinkingMessageId={thinkingMessageId}
      typedAssistantContent={typedAssistantContent}
      typingMessageId={typingMessageId}
    />
  );
}
