import React, { useState } from 'react';
import {
  Pencil,
  Check,
  RotateCcw,
  Home,
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  Users,
  Bell,
  KeyRound,
  AlertTriangle,
  Camera,
  QrCode,
  Crown,
  LogIn,
  Tv,
  Lock,
} from 'lucide-react';
import { SoundFX } from '../utils/soundFx';
import { JamrFlameLogo, FestiveGarlandStrip } from './FestiveDecor';
import { CharacterAvatar } from './CharacterAvatar';
import { useCharacterReaction } from '../context/CharacterReactionContext';
import {
  AVATAR_BG_PRESETS,
  CHARACTER_AVATARS,
  resolveCharacterAvatar,
} from '../data/characterAvatars';
import { JamrPlusStatus } from '../types/jamr';
import { AccountSessionState, isPlusActive } from '../utils/plusManager';
import { PlayerNameWithPlus } from './PlusBadge';

interface HeaderProps {
  playerName: string;
  playerAvatar: string;
  playerAvatarBg: string;
  username?: string;
  plusStatus: JamrPlusStatus;
  accountSession: AccountSessionState | null;
  unreadNotifications?: number;
  activeCheatsCount?: number;
  onUpdatePlayerName: (name: string) => void;
  onUpdatePlayerAvatar: (avatarId: string) => void;
  onUpdatePlayerAvatarBg: (bg: string) => void;
  onOpenAvatarCropper: () => void;
  isInMatch: boolean;
  isHome: boolean;
  onGoHome: () => void;
  onResetMatch: () => void;
  onOpenRules: () => void;
  onOpenFriends: () => void;
  onOpenNotifications: () => void;
  onOpenPlusModal: () => void;
  onOpenAuthModal: () => void;
  onOpenTvCast: () => void;
  onOpenSecretCodes: () => void;
  onOpenQrGenerator: () => void;
  onOpenReport: () => void;
}

const ThreeStackedArrowsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="7 5 12 9 17 5" />
    <polyline points="7 11 12 15 17 11" />
    <polyline points="7 17 12 21 17 17" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({
  playerName,
  playerAvatar,
  playerAvatarBg,
  username,
  plusStatus,
  accountSession,
  unreadNotifications = 0,
  activeCheatsCount = 0,
  onUpdatePlayerName,
  onUpdatePlayerAvatar,
  onUpdatePlayerAvatarBg,
  onOpenAvatarCropper,
  isInMatch,
  isHome,
  onGoHome,
  onResetMatch,
  onOpenRules,
  onOpenFriends,
  onOpenNotifications,
  onOpenPlusModal,
  onOpenAuthModal,
  onOpenTvCast,
  onOpenSecretCodes,
  onOpenQrGenerator,
  onOpenReport,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [draftName, setDraftName] = useState(playerName);
  const [soundOn, setSoundOn] = useState(() => SoundFX.isEnabled());

  const { mood, bubbleText, reactionKey, triggerReaction } = useCharacterReaction();
  const avatarInfo = resolveCharacterAvatar(playerAvatar);
  const hasPlus = isPlusActive(plusStatus);

  const saveName = () => {
    const cleaned = draftName.trim().slice(0, 15);
    if (cleaned.length >= 1) {
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
          type="button"
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
              {activeCheatsCount > 0 && (
                <span
                  title="أكواد سرية مفعلة"
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-[#23140E]"
                >
                  ✨
                </span>
              )}
            </div>
            <span className="text-[11px] text-orange-600 font-extrabold whitespace-nowrap hidden sm:block">
              ولّع جمعتكم 🔥
            </span>
          </div>
        </button>

        {/* Center Zone: Reactive Character Companion + Plus Badge + Match / Name */}
        <div className="relative flex items-center justify-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              SoundFX.playClick();
              setShowAvatarMenu((s) => !s);
            }}
            title={`شخصيتك (${avatarInfo.tagline}) — اضغط للتغيير`}
            className="cursor-pointer rounded-full focus:outline-none"
          >
            <CharacterAvatar
              avatarId={playerAvatar}
              backgroundColor={playerAvatarBg}
              size={40}
              mood={mood}
              reactionKey={reactionKey}
              bubbleText={bubbleText}
              showBubble
              isPlus={hasPlus}
              plusGlow={hasPlus ? plusStatus.glow : undefined}
              plusFrame={hasPlus ? plusStatus.avatarFrame : undefined}
              plusAnimation={hasPlus ? plusStatus.avatarAnimation : undefined}
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
                type="button"
                onClick={saveName}
                className="p-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer"
                title="حفظ"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(playerName);
                setEditingName(true);
                SoundFX.playClick();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 border border-amber-200 text-xs sm:text-sm font-bold text-[#23140E] whitespace-nowrap cursor-pointer shadow-xs transition-colors"
              title="تعديل الاسم"
            >
              <PlayerNameWithPlus
                name={playerName || 'لاعب جَمْر'}
                isPlus={hasPlus}
                plusGlow={hasPlus ? plusStatus.glow : undefined}
                compact
                nameClassName="max-w-[95px] sm:max-w-[150px]"
              />
              <Pencil className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            </button>
          )}

          {/* Quick Character Popover (Studio Upload ONLY for Plus subscribers) */}
          {showAvatarMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAvatarMenu(false)} />
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-80 max-w-[92vw] rounded-2xl bg-white border-2 border-amber-300 shadow-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-black text-[#23140E]">
                  <span>اختر شخصيتك 🎨</span>
                  <span className="text-orange-600">{avatarInfo.tagline}</span>
                </div>

                {hasPlus && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAvatarMenu(false);
                      onOpenAvatarCropper();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-4 h-4" />
                    <span>إضافة صورة من الاستوديو (قص دائري) 📸</span>
                  </button>
                )}

                <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
                  {CHARACTER_AVATARS.map((char) => {
                    const locked = Boolean(char.isPlusOnly && !hasPlus);
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          if (locked) {
                            SoundFX.playClick();
                            setShowAvatarMenu(false);
                            onOpenPlusModal();
                            return;
                          }
                          SoundFX.playTileSelect();
                          onUpdatePlayerAvatar(char.id);
                          triggerReaction('excited', `${char.tagline}! 🔥`, 2000);
                        }}
                        title={locked ? `${char.tagline} (حصري لجَمْر بلس 👑)` : char.tagline}
                        className={`relative p-1 rounded-xl flex items-center justify-center cursor-pointer transition-all ${
                          playerAvatar === char.id
                            ? 'bg-amber-50 ring-2 ring-orange-500 scale-105'
                            : 'hover:bg-[#FFF8EE]'
                        } ${locked ? 'opacity-65' : ''}`}
                      >
                        <CharacterAvatar
                          avatarId={char.id}
                          backgroundColor={playerAvatarBg}
                          size={40}
                          interactive={false}
                        />
                        {locked && (
                          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[#1C140A] text-amber-300 flex items-center justify-center">
                            <Lock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-amber-100 space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[#5A3E32]">خلفية الصورة:</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {AVATAR_BG_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          SoundFX.playClick();
                          onUpdatePlayerAvatarBg(preset.id);
                        }}
                        title={preset.label}
                        style={{ background: preset.background }}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                          playerAvatarBg === preset.id
                            ? 'border-[#23140E] scale-115 ring-2 ring-orange-400'
                            : 'border-white shadow-xs hover:scale-110'
                        }`}
                      />
                    ))}
                    <label
                      title="لون مخصص"
                      className="w-6 h-6 rounded-full border-2 border-amber-300 bg-white flex items-center justify-center text-[10px] font-black cursor-pointer"
                    >
                      +
                      <input
                        type="color"
                        value={playerAvatarBg.startsWith('#') ? playerAvatarBg : '#F97316'}
                        onChange={(e) => onUpdatePlayerAvatarBg(e.target.value)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Left Zone: Consolidated "المزيد" Button (3 stacked arrows) */}
        <div className="relative flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isInMatch && (
            <button
              type="button"
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
              type="button"
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

          {/* Single Unified "المزيد" Menu Trigger */}
          <button
            type="button"
            onClick={() => {
              SoundFX.playClick();
              setShowMoreMenu((v) => !v);
            }}
            aria-expanded={showMoreMenu}
            className="relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-l from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 border-2 border-orange-300 text-orange-950 text-xs sm:text-sm font-black whitespace-nowrap cursor-pointer shadow-xs transition"
          >
            <ThreeStackedArrowsIcon className="w-4 h-4 text-orange-600" />
            <span>المزيد</span>
            {unreadNotifications > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
                {unreadNotifications}
              </span>
            )}
          </button>

          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute left-0 top-12 z-50 w-68 rounded-2xl bg-white border-2 border-amber-300 shadow-2xl p-2 space-y-1">
                {/* Jamr Plus VIP Entry */}
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenPlusModal();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-l from-[#1E1409] to-[#110C06] text-amber-300 text-xs font-black cursor-pointer shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>جَمْر بلس 👑</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-[#140D05] font-black">
                    {hasPlus ? 'مفعّل ✅' : '٢ ريال / سنة'}
                  </span>
                </button>

                {/* Optional Account Login / Register */}
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenAuthModal();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4 text-emerald-600" />
                    <span>{accountSession ? 'حسابي' : 'تسجيل الدخول (اختياري)'}</span>
                  </span>
                  <span className="text-[10px] text-[#6B4E40] truncate max-w-[100px]">
                    {accountSession ? accountSession.email : 'لحفظ أموالك'}
                  </span>
                </button>

                {/* TV Cast Screen */}
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenTvCast();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-amber-600" />
                    <span>العرض على التلفاز 📺</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    PLUS
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenFriends();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span>الأصدقاء</span>
                  </span>
                  {username ? (
                    <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      @{username}
                    </span>
                  ) : (
                    <span className="text-[10px] text-orange-600">أنشئ @يوزر</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenNotifications();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-orange-500" />
                    <span>الإشعارات</span>
                  </span>
                  {unreadNotifications > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                      {unreadNotifications} جديد
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenSecretCodes();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>أكواد سرية 🔐</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenQrGenerator();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-orange-500" />
                  <span>منشئ QR للغرف 📱</span>
                </button>

                <div className="border-t border-amber-100 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenRules();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-orange-500" />
                  <span>القواعد</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = SoundFX.toggle();
                    setSoundOn(next);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#FFF8EE] text-[#23140E] text-xs font-black cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {soundOn ? (
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                    <span>المؤثرات الصوتية</span>
                  </span>
                  <span className="text-[11px] font-bold text-[#6B4E40]">
                    {soundOn ? 'مفعّل' : 'مكتوم'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setShowMoreMenu(false);
                    onOpenReport();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-rose-50 text-rose-700 text-xs font-black cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>الإبلاغ عن خلل</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-amber-100/80 bg-[#FFF8EC]/80">
        <FestiveGarlandStrip />
      </div>
    </header>
  );
};
