import React, { useState } from 'react';
import {
  Pencil,
  Check,
  RotateCcw,
  Home,
  BookOpen,
  Volume2,
  VolumeX,
  Shield,
  Sparkles,
} from 'lucide-react';
import { SoundFX } from '../utils/soundFx';
import { JamrFlameLogo, FestiveGarlandStrip } from './FestiveDecor';

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
    <header className="sticky top-0 z-40 w-full bg-[#FFFBF5]/92 backdrop-blur-xl border-b border-amber-200/80 shadow-[0_6px_24px_-12px_rgba(249,115,22,0.22)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Right Zone: Brand */}
        <button
          onClick={() => {
            SoundFX.playClick();
            onGoHome();
          }}
          className="flex items-center gap-2.5 text-right shrink-0 cursor-pointer group"
        >
          <div className="rounded-xl shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <JamrFlameLogo size={42} />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-xl font-black text-[#23140E] whitespace-nowrap">جَمْر</span>
              <span className="text-[11px] font-black tracking-wider px-2 py-0.5 rounded-lg bg-gradient-to-l from-amber-100 to-orange-100 text-orange-700 border border-orange-200">
                JAMR
              </span>
            </div>
            <span className="text-[11px] text-orange-600 font-extrabold whitespace-nowrap hidden sm:block">
              ولّع جمعتكم 🔥
            </span>
          </div>
        </button>

        {/* Center Zone: Active Match Indicator or Editable Name */}
        <div className="flex items-center justify-center min-w-0">
          {isInMatch ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs sm:text-sm font-black whitespace-nowrap shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>مباراة جارية 🔥</span>
            </div>
          ) : editingName ? (
            <div className="flex items-center gap-1.5 bg-white border-2 border-orange-400 rounded-full px-3 py-1 shadow-sm">
              <input
                type="text"
                maxLength={15}
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                className="w-28 sm:w-36 bg-transparent text-[#23140E] text-xs sm:text-sm font-bold focus:outline-none"
              />
              <button
                onClick={saveName}
                className="p-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer"
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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-amber-50 border border-amber-200 text-xs sm:text-sm font-bold text-[#23140E] whitespace-nowrap cursor-pointer shadow-xs transition-colors"
              title="تعديل الاسم"
            >
              <span className="truncate max-w-[120px] sm:max-w-[180px]">{playerName || 'لاعب جَمْر'}</span>
              <Pencil className="w-3.5 h-3.5 text-orange-500 shrink-0" />
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-extrabold whitespace-nowrap cursor-pointer transition-colors"
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-[#23140E] text-xs font-extrabold whitespace-nowrap cursor-pointer shadow-xs transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-orange-500" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>
          )}

          <button
            onClick={() => {
              SoundFX.playClick();
              onOpenRules();
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-[#23140E] text-xs font-extrabold whitespace-nowrap cursor-pointer shadow-xs transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-orange-500" />
            <span className="hidden sm:inline">القواعد</span>
          </button>

          <button
            onClick={() => {
              const next = SoundFX.toggle();
              setSoundOn(next);
            }}
            className="p-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-[#23140E] cursor-pointer shadow-xs transition-colors"
            title={soundOn ? 'كتم الصوت' : 'تفعيل الصوت'}
            aria-label="تبديل الصوت"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            onClick={() => {
              SoundFX.playClick();
              onOpenAdmin();
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-gradient-to-l from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 border border-orange-200 text-orange-900 text-xs font-black whitespace-nowrap cursor-pointer transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-orange-600" />
            <span className="hidden md:inline">الإدارة</span>
          </button>
        </div>
      </div>
      <div className="border-t border-amber-100/80 bg-[#FFF8EC]/80">
        <FestiveGarlandStrip />
      </div>
    </header>
  );
};
