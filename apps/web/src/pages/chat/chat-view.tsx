import { Alert, Button, Card, Input, Space, Typography } from 'antd';
import { ChatMarkdown } from './chat-markdown';
import type { ChatMessage } from './types';
import styles from './index.module.less';

type ChatMessageListProps = {
  messages: ChatMessage[];
  thinkingMessageId: string;
  typedAssistantContent: string;
  typingMessageId: string;
};

type ChatComposerProps = {
  draft: string;
  loading: boolean;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
};

type ChatConversationProps = ChatMessageListProps &
  ChatComposerProps & {
    error: string;
  };

function ChatHeader() {
  return (
    <div>
      <Typography.Title level={2}>AI 聊天</Typography.Title>
      <Typography.Paragraph type="secondary">
        通过后端 Nest API 调用 OpenAI Responses API，前端不会暴露 API Key。
      </Typography.Paragraph>
    </div>
  );
}

function ChatMessageBubble({
  message,
  thinkingMessageId,
  typedAssistantContent,
  typingMessageId,
}: ChatMessageListProps & { message: ChatMessage }) {
  const isUserMessage = message.role === 'user';

  return (
    <div
      className={`${styles.message} ${
        isUserMessage ? styles.userMessage : styles.assistantMessage
      }`}
    >
      <span className={styles.messageRole}>{isUserMessage ? '你' : 'AI'}</span>
      {message.id === thinkingMessageId ? (
        <span className={styles.thinkingIndicator}>思考中...</span>
      ) : null}
      {message.id === typingMessageId ? (
        <div className={styles.typedMessage}>
          <ChatMarkdown content={typedAssistantContent} />
        </div>
      ) : (
        <ChatMarkdown content={message.content} />
      )}
    </div>
  );
}

function ChatMessageList(props: ChatMessageListProps) {
  return (
    <div className={styles.messageList}>
      {props.messages.map((message) => (
        <ChatMessageBubble key={message.id} {...props} message={message} />
      ))}
    </div>
  );
}

function ChatComposer({
  draft,
  loading,
  onDraftChange,
  onSend,
}: ChatComposerProps) {
  return (
    <div className={styles.composer}>
      <Input.TextArea
        autoSize={{ minRows: 3, maxRows: 6 }}
        onChange={(event) => onDraftChange(event.target.value)}
        onPressEnter={(event) => {
          if (!event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="输入你想让 AI 帮你处理的问题"
        value={draft}
      />
      <div className={styles.actions}>
        <Button
          disabled={!draft.trim()}
          loading={loading}
          onClick={onSend}
          type="primary"
        >
          发送
        </Button>
      </div>
    </div>
  );
}

function ChatConversation({
  error,
  ...conversationProps
}: ChatConversationProps) {
  return (
    <Card title="对话">
      <div className={styles.chatShell}>
        {error ? <Alert type="error" title={error} showIcon /> : null}
        <ChatMessageList {...conversationProps} />
        <ChatComposer {...conversationProps} />
      </div>
    </Card>
  );
}

export function ChatPageView(props: ChatConversationProps) {
  return (
    <Space orientation="vertical" size={24} className={styles.pageStack}>
      <ChatHeader />
      <ChatConversation {...props} />
    </Space>
  );
}
