import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ChatMessage } from './types';

const typewriterDelayMs = 18;

export function useAssistantTypewriter(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
) {
  const [typingMessageId, setTypingMessageId] = useState('');
  const [thinkingMessageId, setThinkingMessageId] = useState('');
  const [typedAssistantContent, setTypedAssistantContent] = useState('');
  const activeAssistantMessageIdRef = useRef('');
  const pendingCharactersRef = useRef<string[]>([]);
  const typedAssistantContentRef = useRef('');
  const streamDoneRef = useRef(false);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function resetTypewriter() {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }

    activeAssistantMessageIdRef.current = '';
    pendingCharactersRef.current = [];
    typedAssistantContentRef.current = '';
    streamDoneRef.current = false;
    setTypedAssistantContent('');
  }

  function commitAssistantMessage() {
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
  }

  function startTypewriter() {
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
  }

  function beginAssistantTyping(assistantMessageId: string) {
    resetTypewriter();
    activeAssistantMessageIdRef.current = assistantMessageId;
    setTypingMessageId(assistantMessageId);
    setThinkingMessageId(assistantMessageId);
  }

  function writeAssistantDelta(delta: string) {
    setThinkingMessageId('');
    pendingCharactersRef.current.push(...Array.from(delta));
    startTypewriter();
  }

  function finishAssistantTyping() {
    streamDoneRef.current = true;
    startTypewriter();
  }

  function clearAssistantTyping() {
    setTypingMessageId('');
    setThinkingMessageId('');
    resetTypewriter();
  }

  useEffect(() => {
    return () => {
      if (typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
      }
    };
  }, []);

  return {
    beginAssistantTyping,
    clearAssistantTyping,
    finishAssistantTyping,
    thinkingMessageId,
    typedAssistantContent,
    typingMessageId,
    writeAssistantDelta,
  };
}
