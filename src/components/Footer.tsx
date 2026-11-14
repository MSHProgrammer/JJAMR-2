import React from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';
import { JamrFlameLogo } from './FestiveDecor';

interface FooterProps {
  onOpenReport: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenReport }) => {
  return (
    <footer className="w-full border-t border-amber-200/80 bg-[#FFF4E4] py-6 px-4 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm text-[#5A3E32] font-bold">
          <JamrFlameLogo size={26} />
          <span>منصة جَمْر | JAMR — ألعاب جماعية مجانية بالكامل 100% للأبد</span>
          <Sparkles className="w-4 h-4 text-amber-500 hidden sm:inline" />
        </div>

        <button
          onClick={() => {
            SoundFX.playClick();
            onOpenReport();
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-black shadow-xs transition-colors cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>الإبلاغ عن خلل أو مشكلة</span>
        </button>
      </div>
    </footer>
  );
};
