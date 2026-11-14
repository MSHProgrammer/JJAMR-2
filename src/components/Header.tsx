import React, { useState } from 'react';
import {
  Flame,
  Pencil,
  Check,
  RotateCcw,
  Home,
  BookOpen,
  Volume2,
  VolumeX,
  Shield,
} from 'lucide-react';
import { SoundFX } from '../utils/soundFx';

interface HeaderProps {
  playerName: string;
  onUpdatePlayerName: (name: string) => void;
  isInMatch: boolean;
  isHome: boolean;
  onGoHome: () => void;
  onResetMatch: () => void;
  onOpenRules: () => void;
  onOpenAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  playerName,
  onUpdatePlayerName,
  isInMatch,
  isHome,
  onGoHome,
  onResetMatch,
  onOpenRules,
  onOpenAdmin,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(playerName);
  const [soundOn, setSoundOn] = useState(() => SoundFX.isEnabled());

  const saveName = () => {
    const cleaned = draftName.trim().slice(0, 15);
    if (cleaned.length >= 2) {
      onUpdatePlayerName(cleaned);
    } else {
      setDraftName(playerName);
    }
    setEditingName(false);
    SoundFX.playClick();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0c0716]/90 backdrop-blur-xl border-b border-amber-500/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Right Zone: Brand */}
        <button
          onClick={() => {
            SoundFX.playClick();
            onGoHome();
          }}
          className="flex items-center gap-2.5 text-right shrink-0 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 flex items-center justify-center shadow-md shadow-orange-600/30 group-hover:scale-105 transition-transform">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-xl font-black text-white whitespace-nowrap">جَمْر</span>
              <span className="text-[11px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                JAMR
              </span>
            </div>
            <span className="text-[11px] text-orange-300/90 font-bold whitespace-nowrap hidden sm:block">
              ولّع جمعتكم 🔥
            </span>
          </div>
        </button>

        {/* Center Zone: Active Match Indicator or Editable Name */}
        <div className="flex items-center justify-center min-w-0">
          {isInMatch ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs sm:text-sm font-black whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>مباراة جارية 🔥</span>
            </div>
          ) : editingName ? (
            <div className="flex items-center gap-1.5 bg-white/10 border border-orange-500/40 rounded-full px-3 py-1">
              <input
                type="text"
                maxLength={15}
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                className="w-28 sm:w-36 bg-transparent text-white text-xs sm:text-sm font-bold focus:outline-none"
              />
              <button
                onClick={saveName}
                className="p-1 rounded-full bg-emerald-500 text-slate-950 cursor-pointer"
                title="حفظ"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setDraftName(playerName);
                setEditingName(true);
                SoundFX.playClick();
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs sm:text-sm font-bold text-slate-200 whitespace-nowrap cursor-pointer"
              title="تعديل الاسم"
            >
              <span className="truncate max-w-[120px] sm:max-w-[180px]">{playerName || 'لاعب جَمْر'}</span>
              <Pencil className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </button>
          )}
        </div>

        {/* Left Zone: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isInMatch && (
            <button
              onClick={() => {
                SoundFX.playClick();
                onResetMatch();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">إعادة</span>
            </button>
          )}

          {!isHome && (
            <button
              onClick={() => {
                SoundFX.playClick();
                onGoHome();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>
          )}

          <button
            onClick={() => {
              SoundFX.playClick();
              onOpenRules();
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">القواعد</span>
          </button>

          <button
            onClick={() => {
              const next = SoundFX.toggle();
              setSoundOn(next);
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 cursor-pointer"
            title={soundOn ? 'كتم الصوت' : 'تفعيل الصوت'}
            aria-label="تبديل الصوت"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            onClick={() => {
              SoundFX.playClick();
              onOpenAdmin();
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden md:inline">الإدارة</span>
          </button>
        </div>
      </div>
    </header>
  );
};
