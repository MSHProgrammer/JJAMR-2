import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type CharacterMood =
  | 'idle'
  | 'picking_game'
  | 'typing'
  | 'chat_sent'
  | 'excited'
  | 'win'
  | 'lose'
  | 'shocked';

interface CharacterReactionContextValue {
  mood: CharacterMood;
  bubbleText: string | null;
  reactionKey: number;
  triggerReaction: (mood: CharacterMood, bubbleText?: string, durationMs?: number) => void;
  setTypingActive: (active: boolean) => void;
}

const CharacterReactionContext = createContext<CharacterReactionContextValue>({
  mood: 'idle',
  bubbleText: null,
  reactionKey: 0,
  triggerReaction: () => {},
  setTypingActive: () => {},
});

const DEFAULT_BUBBLES: Partial<Record<CharacterMood, string>> = {
  win: 'كفوو! 🎉',
  lose: 'معوّضة! 😅',
  picking_game: 'يلا نلعب! 🎮',
  typing: 'يكتب...',
  chat_sent: 'تم الإرسال! 💬',
  excited: 'حماااس! 🔥',
  shocked: 'يا ساتر! 😮',
};

export const CharacterReactionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mood, setMood] = useState<CharacterMood>('idle');
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [reactionKey, setReactionKey] = useState(0);
  const timerRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const triggerReaction = useCallback(
    (nextMood: CharacterMood, customBubble?: string, durationMs = 2600) => {
      clearTimers();
      setMood(nextMood);
      setBubbleText(customBubble ?? DEFAULT_BUBBLES[nextMood] ?? null);
      setReactionKey((k) => k + 1);

      if (nextMood !== 'idle') {
        timerRef.current = window.setTimeout(() => {
          setMood('idle');
          setBubbleText(null);
        }, durationMs);
      }
    },
    [clearTimers]
  );

  const setTypingActive = useCallback(
    (active: boolean) => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (active) {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setMood('typing');
        setBubbleText('يكتب... ✍️');
        typingTimerRef.current = window.setTimeout(() => {
          setMood((prev) => (prev === 'typing' ? 'idle' : prev));
          setBubbleText((prev) => (prev === 'يكتب... ✍️' ? null : prev));
        }, 1900);
      } else {
        setMood((prev) => (prev === 'typing' ? 'idle' : prev));
        setBubbleText((prev) => (prev === 'يكتب... ✍️' ? null : prev));
      }
    },
    []
  );

  return (
    <CharacterReactionContext.Provider
      value={{ mood, bubbleText, reactionKey, triggerReaction, setTypingActive }}
    >
      {children}
    </CharacterReactionContext.Provider>
  );
};

export function useCharacterReaction() {
  return useContext(CharacterReactionContext);
}
