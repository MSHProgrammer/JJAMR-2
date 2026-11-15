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
import { CharacterAvatar } from './CharacterAvatar';
import { useCharacterReaction } from '../context/CharacterReactionContext';
import { CHARACTER_AVATARS, resolveCharacterAvatar } from '../data/characterAvatars';

interface HeaderProps {
  playerName: string;
  playerAvatar: string;
  onUpdatePlayerName: (name: string) => void;
  onUpdatePlayerAvatar: (avatarId: string) => void;
  isInMatch: boolean;
  isHome: boolean;
  onGoHome: () => void;
  onResetMatch: () => void;
  onOpenRules: () => void;
  onOpenAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  playerName,
  playerAvatar,
  onUpdatePlayerName,
  onUpdatePlayerAvatar,
  isInMatch,
  isHome,
  onGoHome,
  onResetMatch,
  onOpenRules,
  onOpenAdmin,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [draftName, setDraftName] = useState(playerName);
  const [soundOn, setSoundOn] = useState(() => SoundFX.isEnabled());

  const { mood, bubbleText, reactionKey, triggerReaction } = useCharacterReaction();
  const avatarInfo = resolveCharacterAvatar(playerAvatar);

  const saveName = () => {
    const cleaned = draftName.trim().slice(0, 15);
    if (cleaned.length >= 2) {
      onUpdatePlayerName(cleaned);
      triggerReaction('excited', `عاشت الأسامي يا ${cleaned}! ✨`, 2000);
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

        {/* Center Zone: Reactive Character Companion + Match / Name */}
        <div className="relative flex items-center justify-center gap-2 min-w-0">
          {/* Interactive Reactive Character */}
          <button
            type="button"
            onClick={() => {
              SoundFX.playClick();
              setShowAvatarMenu((s) => !s);
            }}
            title={
              avatarInfo.name.trim()
                ? `شخصيتك: ${avatarInfo.name.trim()} — اضغط للتغيير`
                : `شخصيتك (${avatarInfo.tagline}) — اضغط للتغيير`
            }
            className="cursor-pointer rounded-full focus:outline-none"
          >
            <CharacterAvatar
              avatarId={playerAvatar}
              size={40}
              mood={mood}
              reactionKey={reactionKey}
              bubbleText={bubbleText}
              showBubble
            />
          </button>

          {isInMatch ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs sm:text-sm font-black whitespace-nowrap shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="hidden xs:inline">مباراة جارية 🔥</span>
              <span className="xs:hidden">مباراة 🔥</span>
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
                className="w-24 sm:w-36 bg-transparent text-[#23140E] text-xs sm:text-sm font-bold focus:outline-none"
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 border border-amber-200 text-xs sm:text-sm font-bold text-[#23140E] whitespace-nowrap cursor-pointer shadow-xs transition-colors"
              title="تعديل الاسم"
            >
              <span className="truncate max-w-[100px] sm:max-w-[160px]">{playerName || 'لاعب جَمْر'}</span>
              <Pencil className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            </button>
          )}

          {/* Quick Character Switcher Popover */}
          {showAvatarMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAvatarMenu(false)}
              />
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-72 rounded-2xl bg-white border-2 border-amber-300 shadow-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black text-[#23140E]">
                  <span>اختر شخصيتك 🎨</span>
                  <span className="text-orange-600">{avatarInfo.name.trim() || avatarInfo.tagline}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {CHARACTER_AVATARS.map((char) => {
                    const cleanLabel = char.name.trim();
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          SoundFX.playTileSelect();
                          onUpdatePlayerAvatar(char.id);
                          setShowAvatarMenu(false);
                          triggerReaction(
                            'excited',
                            cleanLabel ? `أهلاً أنا ${cleanLabel}! 🔥` : `${char.tagline}! 🔥`,
                            2000
                          );
                        }}
                        title={cleanLabel || char.tagline}
                        className={`p-1 rounded-xl flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                          playerAvatar === char.id
                            ? 'bg-amber-50 ring-2 ring-orange-500 scale-105'
                            : 'hover:bg-[#FFF8EE]'
                        }`}
                      >
                        <CharacterAvatar avatarId={char.id} size={40} interactive={false} />
                        {cleanLabel && (
                          <span className="text-[9px] font-black text-[#23140E] truncate max-w-full">
                            {cleanLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
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
