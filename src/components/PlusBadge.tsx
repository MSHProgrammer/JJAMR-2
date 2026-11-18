import React from 'react';
import { PlusGlowConfig } from '../types/jamr';
import { getGlowStyleForPlayer } from '../utils/plusManager';

interface PlusBadgeProps {
  compact?: boolean;
  className?: string;
}

/**
 * Golden Crown + PLUS obsidian emblem modeled cleanly after the user's gold PLUS badge reference
 * so it sits crisply beside any subscriber's name on both light and dark surfaces.
 */
export const PlusCrownBadge: React.FC<PlusBadgeProps> = ({ compact = false, className = '' }) => {
  return (
    <span
      title="مشترك جَمْر بلس 👑"
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-l from-[#1C140A] via-[#0F0B07] to-[#1D1508] border border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.42)] select-none shrink-0 ${
        compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
      } ${className}`}
    >
      <svg
        viewBox="0 0 28 24"
        className={compact ? 'w-3.5 h-3' : 'w-4 h-3.5'}
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="plusCrownGold" x1="2" y1="2" x2="26" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFE17D" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
        <path
          d="M4 18L2 8L8.5 12.5L14 4L19.5 12.5L26 8L24 18H4Z"
          fill="url(#plusCrownGold)"
          stroke="#FEF3C7"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <rect x="4" y="19" width="20" height="2.6" rx="1.2" fill="url(#plusCrownGold)" />
        <circle cx="2" cy="6.8" r="1.5" fill="#FDE68A" />
        <circle cx="14" cy="3" r="1.7" fill="#FEF08A" />
        <circle cx="26" cy="6.8" r="1.5" fill="#FDE68A" />
      </svg>
      <span
        className={`font-black italic tracking-wider bg-gradient-to-b from-[#FFE89C] via-[#FBBF24] to-[#D97706] bg-clip-text text-transparent leading-none ${
          compact ? 'text-[9px]' : 'text-[10px]'
        }`}
      >
        PLUS
      </span>
    </span>
  );
};

interface PlayerNameWithPlusProps {
  name: string;
  isPlus?: boolean;
  plusGlow?: PlusGlowConfig;
  compact?: boolean;
  nameClassName?: string;
}

export const PlayerNameWithPlus: React.FC<PlayerNameWithPlusProps> = ({
  name,
  isPlus,
  plusGlow,
  compact = false,
  nameClassName = '',
}) => {
  const glowStyle = getGlowStyleForPlayer(isPlus, plusGlow);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        style={glowStyle ? { textShadow: glowStyle.textShadow } : undefined}
        className={`truncate ${isPlus && plusGlow?.enabled ? 'plus-glow-animate' : ''} ${nameClassName}`}
      >
        {name}
      </span>
      {isPlus && <PlusCrownBadge compact={compact} />}
    </span>
  );
};
