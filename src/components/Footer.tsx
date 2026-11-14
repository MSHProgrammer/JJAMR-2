import React from 'react';
import { AlertTriangle, Flame } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';

interface FooterProps {
  onOpenReport: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenReport }) => {
  return (
    <footer className="w-full border-t border-white/10 bg-[#07030c] py-6 px-4 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm text-slate-400">
          <Flame className="w-4 h-4 text-orange-500" />
          <span>منصة جَمْر | JAMR — ألعاب جماعية مجانية بالكامل 100% للأبد</span>
        </div>

        <button
          onClick={() => {
            SoundFX.playClick();
            onOpenReport();
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs sm:text-sm font-black transition-colors cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>الإبلاغ عن خلل أو مشكلة</span>
        </button>
      </div>
    </footer>
  );
};
