import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import {
  loadPersistedChatMessages,
  savePersistedChatMessages,
} from './chat-model';
import type { ChatMessage } from './types';

export function useChatHistory(
  messages: ChatMessage[],
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
) {
  const chatHistoryLoadedRef = useRef(false);

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
  }, [setMessages]);

  useEffect(() => {
    if (!chatHistoryLoadedRef.current) {
      return;
    }

    void savePersistedChatMessages(messages);
  }, [messages]);
}
