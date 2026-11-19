import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { resolveAvatarBgCss, resolveCharacterAvatar } from '../data/characterAvatars';
import { CharacterMood } from '../context/CharacterReactionContext';
import { PlusGlowConfig } from '../types/jamr';
import { getGlowStyleForPlayer, PLUS_AVATAR_FRAMES } from '../utils/plusManager';

import { resolvePlusAnimation } from '../data/plusAnimations';

interface CharacterAvatarProps {
  avatarId?: string | null;
  backgroundColor?: string | null;
  size?: number;
  mood?: CharacterMood;
  reactionKey?: number;
  bubbleText?: string | null;
  showBubble?: boolean;
  interactive?: boolean;
  isPlus?: boolean;
  plusGlow?: PlusGlowConfig;
  plusFrame?: string;
  plusAnimation?: string;
  className?: string;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  avatarId,
  backgroundColor,
  size = 44,
  mood = 'idle',
  reactionKey = 0,
  bubbleText,
  showBubble = false,
  interactive = true,
  isPlus = false,
  plusGlow,
  plusFrame,
  plusAnimation,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const info = resolveCharacterAvatar(avatarId);
  const bgCss = resolveAvatarBgCss(backgroundColor);
  const customPlusAnim = isPlus ? resolvePlusAnimation(plusAnimation) : null;

  const getMotionAnimation = () => {
    if (shouldReduceMotion) {
      return {
        animate: { scale: 1, rotate: 0, x: 0, y: 0 },
        transition: { duration: 0.15 },
      };
    }

    if (mood === 'idle' && customPlusAnim) {
      return {
        animate: customPlusAnim.animate,
        transition: customPlusAnim.transition,
      };
    }

    switch (mood) {
      case 'win':
        return {
          animate: {
            y: [0, -10, 0, -7, 0],
            rotate: [0, -9, 9, -5, 0],
            scale: [1, 1.16, 1.06, 1.12, 1],
          },
          transition: { duration: 0.9, repeat: 2, ease: 'easeInOut' as const },
        };
      case 'lose':
        return {
          animate: {
            x: [0, -4, 4, -3, 2, 0],
            rotate: [0, -8, 6, -4, 0],
            y: [0, 3, 2, 0],
            scale: [1, 0.93, 0.96, 1],
          },
          transition: { duration: 0.7, ease: 'easeInOut' as const },
        };
      case 'shocked':
        return {
          animate: {
            x: [0, -3, 3, -3, 2, 0],
            scale: [1, 1.16, 0.94, 1.06, 1],
          },
          transition: { duration: 0.55, ease: 'easeOut' as const },
        };
      case 'picking_game':
        return {
          animate: {
            y: [0, -7, 0, -4, 0],
            rotate: [0, -6, 6, -3, 0],
            scale: [1, 1.1, 1.03, 1],
          },
          transition: { duration: 0.65, ease: 'easeInOut' as const },
        };
      case 'typing':
        return {
          animate: {
            rotate: [-4, 4, -4],
            y: [0, -2, 0],
            scale: [1, 1.05, 1],
          },
          transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'chat_sent':
        return {
          animate: {
            y: [0, -9, 0],
            scale: [1, 1.15, 1],
            rotate: [0, 10, -6, 0],
          },
          transition: { duration: 0.5, ease: 'easeOut' as const },
        };
      case 'excited':
        return {
          animate: {
            y: [0, -6, 0],
            scale: [1, 1.09, 1],
            rotate: [0, 5, -5, 0],
          },
          transition: { duration: 0.6, repeat: 1, ease: 'easeInOut' as const },
        };
      case 'idle':
      default:
        return {
          animate: {
            y: [0, -2.5, 0],
            scale: [1, 1.025, 1],
          },
          transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const },
        };
    }
  };

  const anim = getMotionAnimation();

  const ringClass =
    mood === 'win'
      ? 'ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.65)]'
      : mood === 'lose'
        ? 'ring-2 ring-rose-300 opacity-90'
        : mood === 'typing' || mood === 'chat_sent'
          ? 'ring-2 ring-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.4)]'
          : mood === 'picking_game' || mood === 'excited'
            ? 'ring-2 ring-orange-400 shadow-[0_0_14px_rgba(249,115,22,0.45)]'
            : mood === 'shocked'
              ? 'ring-2 ring-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.45)]'
              : 'ring-1 ring-purple-300/80 shadow-sm';

  const statusEmoji =
    mood === 'win'
      ? '👑'
      : mood === 'lose'
        ? '💫'
        : mood === 'typing'
          ? '✍️'
          : mood === 'chat_sent'
            ? '💬'
            : mood === 'picking_game'
              ? '🎮'
              : mood === 'shocked'
                ? '😮'
                : mood === 'excited'
                  ? '🔥'
                  : null;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Floating Speech / Reaction Bubble */}
      <AnimatePresence>
        {showBubble && bubbleText && mood !== 'idle' && (
          <motion.div
            key={`${mood}_${reactionKey}_${bubbleText}`}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className={`absolute -top-8 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-md border pointer-events-none ${
              mood === 'win'
                ? 'bg-amber-400 text-[#23140E] border-amber-500'
                : mood === 'lose'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : mood === 'typing' || mood === 'chat_sent'
                    ? 'bg-teal-500 text-white border-teal-600'
                    : 'bg-orange-500 text-white border-orange-600'
            }`}
          >
            {bubbleText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Animated Portrait */}
      {(() => {
        const frameMeta = plusFrame ? PLUS_AVATAR_FRAMES.find((f) => f.id === plusFrame) : undefined;
        const glowCss = getGlowStyleForPlayer(isPlus, plusGlow);
        return (
          <motion.div
            key={`${info.id}_${mood}_${reactionKey}_${customPlusAnim?.id || 'std'}`}
            animate={anim.animate}
            transition={anim.transition}
            whileHover={interactive && !shouldReduceMotion ? { scale: 1.12, rotate: -4 } : undefined}
            whileTap={interactive && !shouldReduceMotion ? { scale: 0.94 } : undefined}
            style={{
              background: bgCss,
              ...(glowCss ? { boxShadow: glowCss.boxShadow } : {}),
            }}
            className={`w-full h-full rounded-full overflow-hidden ${
              isPlus && frameMeta && frameMeta.ringCss ? frameMeta.ringCss : ringClass
            }`}
          >
            <img
              src={info.imageUrl}
              alt={info.tagline}
              draggable={false}
              className="w-full h-full object-cover"
            />
          </motion.div>
        );
      })()}

      {/* Corner Reaction Micro-Badge */}
      <AnimatePresence>
        {statusEmoji && size >= 32 && (
          <motion.span
            key={statusEmoji}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -bottom-1 -left-1 z-20 text-[11px] leading-none bg-white rounded-full p-0.5 shadow border border-amber-200 pointer-events-none"
          >
            {statusEmoji}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};
