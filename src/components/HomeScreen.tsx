import React, { useState } from 'react';
import {
  Flame,
  Smartphone,
  Globe,
  KeyRound,
  Users,
  Clock,
  Wrench,
  Pencil,
  Check,
  Play,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { GameConfig } from '../types/jamr';
import { SoundFX } from '../utils/soundFx';
import { FestiveHeroArtwork } from './FestiveDecor';
import { CharacterAvatar } from './CharacterAvatar';
import { useCharacterReaction } from '../context/CharacterReactionContext';
import { CHARACTER_AVATARS, resolveCharacterAvatar } from '../data/characterAvatars';

interface HomeScreenProps {
  games: GameConfig[];
  playerName: string;
  playerAvatar: string;
  onUpdatePlayerName: (name: string) => void;
  onUpdatePlayerAvatar: (avatarId: string) => void;
  onSelectOfflineGame: (game: GameConfig) => void;
  onSelectOnlineCreate: (gameId?: string) => void;
  onSelectOnlineJoin: () => void;
  onShowMaintenance: (game: GameConfig) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  games,
  playerName,
  playerAvatar,
  onUpdatePlayerName,
  onUpdatePlayerAvatar,
  onSelectOfflineGame,
  onSelectOnlineCreate,
  onSelectOnlineJoin,
  onShowMaintenance,
}) => {
  const [filter, setFilter] = useState<'all' | 'offline' | 'online'>('all');
  const [editingHeroName, setEditingHeroName] = useState(false);
  const [showAvatarDrawer, setShowAvatarDrawer] = useState(false);
  const [draftName, setDraftName] = useState(playerName);
  const [modePickerGame, setModePickerGame] = useState<GameConfig | null>(null);

  const { mood, bubbleText, reactionKey, triggerReaction } = useCharacterReaction();
  const avatarInfo = resolveCharacterAvatar(playerAvatar);

  const filteredGames = games.filter((g) => {
    if (filter === 'offline') return g.supportsOffline;
    if (filter === 'online') return g.supportsOnline;
    return true;
  });

  const handleCardClick = (game: GameConfig) => {
    SoundFX.playClick();
    if (game.underMaintenance || !game.isActive) {
      triggerReaction('shocked', 'تحت الصيانة 🔧', 2000);
      onShowMaintenance(game);
      return;
    }
    triggerReaction('picking_game', `اخترنا ${game.title}! 🎮`, 2400);
    if (game.supportsOffline && game.supportsOnline) {
      setModePickerGame(game);
      return;
    }
    if (game.supportsOffline) {
      onSelectOfflineGame(game);
    } else if (game.supportsOnline) {
      onSelectOnlineCreate(game.id);
    }
  };

  const commitHeroName = () => {
    const cleaned = draftName.trim().slice(0, 15);
    if (cleaned.length >= 2) {
      onUpdatePlayerName(cleaned);
      triggerReaction('excited', `حياك يا ${cleaned}! 🔥`, 2200);
    } else {
      setDraftName(playerName);
    }
    setEditingHeroName(false);
    SoundFX.playClick();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-10">
      {/* Joyful Festive Hero Banner */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-bl from-[#FFF1D6] via-[#FFF9EE] to-[#FFE7D4] border-2 border-amber-200/90 p-6 sm:p-10 shadow-[0_18px_45px_-20px_rgba(249,115,22,0.3)]">
        <div className="absolute -left-20 -top-20 w-72 h-72 rounded-full bg-amber-300/25 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-24 w-80 h-80 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/85 border border-orange-200 text-xs sm:text-sm font-black text-orange-700 shadow-xs">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>مجانية بالكامل 100% · بدون تسجيل · أونلاين وأوفلاين</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  SoundFX.playTileSelect();
                  setShowAvatarDrawer((v) => !v);
                  triggerReaction('excited', `${avatarInfo.name} جاهز! ✨`, 1800);
                }}
                title="اضغط لتغيير شخصيتك"
                className="cursor-pointer shrink-0 focus:outline-none"
              >
                <CharacterAvatar
                  avatarId={playerAvatar}
                  size={74}
                  mood={mood}
                  reactionKey={reactionKey}
                  bubbleText={bubbleText}
                  showBubble
                />
              </button>
              <h1 className="text-3xl sm:text-5xl font-black text-[#23140E] leading-tight [text-wrap:balance]">
                حيّاك يا{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-l from-orange-600 via-red-500 to-amber-500">
                  {playerName}
                </span>
                ، جاهز تولّع جمعتكم؟
              </h1>
            </div>

            <p className="text-sm sm:text-base text-[#5A3E32] font-readex leading-relaxed">
              منصة جَمْر تجمع أمتع الألعاب الجماعية العربية في مكان واحد بأجواء احتفالية — سواء كنتم حول جهاز واحد في المجلس أو كل واحد من جواله أونلاين!
            </p>

            {/* Quick Name & Character Editor + Festive Stats */}
            <div className="pt-1 flex flex-wrap items-center gap-3">
              {editingHeroName ? (
                <div className="flex items-center gap-2 bg-white border-2 border-orange-400 rounded-xl px-3 py-1.5 shadow-sm">
                  <input
                    type="text"
                    maxLength={15}
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitHeroName()}
                    className="bg-transparent text-[#23140E] text-sm font-bold focus:outline-none w-36"
                  />
                  <button
                    onClick={commitHeroName}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDraftName(playerName);
                    setEditingHeroName(true);
                    SoundFX.playClick();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-xs sm:text-sm font-extrabold text-[#23140E] cursor-pointer shadow-xs transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-orange-500" />
                  <span>تغيير اسمك: {playerName}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setShowAvatarDrawer((v) => !v);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-xs sm:text-sm font-extrabold text-orange-700 cursor-pointer shadow-xs transition-colors"
              >
                <CharacterAvatar avatarId={playerAvatar} size={24} interactive={false} />
                <span>شخصيتك: {avatarInfo.name}</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-2 rounded-xl bg-white/80 border border-amber-200 text-xs font-black text-orange-700">
                  🎯 7 ألعاب جماعية
                </span>
                <span className="px-3 py-2 rounded-xl bg-white/80 border border-amber-200 text-xs font-black text-amber-700">
                  📚 1,200+ سؤال موثّق
                </span>
                <span className="px-3 py-2 rounded-xl bg-white/80 border border-emerald-200 text-xs font-black text-emerald-700">
                  👥 حتى 100 لاعب بالغرفة
                </span>
              </div>
            </div>

            {showAvatarDrawer && (
              <div className="p-3.5 rounded-2xl bg-white/95 border-2 border-amber-300 shadow-lg grid grid-cols-5 sm:grid-cols-10 gap-2">
                {CHARACTER_AVATARS.map((char) => (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => {
                      SoundFX.playTileSelect();
                      onUpdatePlayerAvatar(char.id);
                      setShowAvatarDrawer(false);
                      triggerReaction('excited', `تم اختيار ${char.name}! 🎉`, 2200);
                    }}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-xl cursor-pointer transition-all ${
                      playerAvatar === char.id
                        ? 'bg-amber-50 ring-2 ring-orange-500 scale-105'
                        : 'hover:bg-[#FFF8EE]'
                    }`}
                  >
                    <CharacterAvatar avatarId={char.id} size={40} interactive={false} />
                    <span className="text-[10px] font-black text-[#23140E] truncate max-w-full">
                      {char.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Festive Hero SVG Illustration */}
          <div className="shrink-0">
            <FestiveHeroArtwork />
          </div>
        </div>
      </section>

      {/* 3 Mode Selector Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            SoundFX.playTileSelect();
            triggerReaction('picking_game', 'يلا أوفلاين! 📱', 2200);
            setFilter('offline');
            const firstOffline = games.find((g) => g.supportsOffline && g.isActive && !g.underMaintenance);
            if (firstOffline) onSelectOfflineGame(firstOffline);
          }}
          className="text-right group rounded-2xl bg-white hover:bg-[#FFFDF9] border-2 border-amber-200/80 hover:border-amber-400 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#23140E]">اللعب أوفلاين (جهاز واحد)</h2>
              <p className="text-xs text-[#6B4E40] font-readex mt-1">مرّر الجوال أو اعرض الشاشة في المجلس</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-amber-400 group-hover:text-orange-600 transition-colors shrink-0" />
        </motion.button>

        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            SoundFX.playTileSelect();
            triggerReaction('picking_game', 'غرفة أونلاين! 🌐', 2200);
            onSelectOnlineCreate('broken_tv');
          }}
          className="text-right group rounded-2xl bg-white hover:bg-[#FFFDF9] border-2 border-orange-200/80 hover:border-orange-400 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#23140E]">إنشاء غرفة أونلاين</h2>
              <p className="text-xs text-[#6B4E40] font-readex mt-1">أنشئ غرفة فورية وشارك الرابط مع ربعك</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-orange-400 group-hover:text-red-600 transition-colors shrink-0" />
        </motion.button>

        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            SoundFX.playTileSelect();
            triggerReaction('excited', 'ندخل برمز الدعوة! 🔑', 2200);
            onSelectOnlineJoin();
          }}
          className="text-right group rounded-2xl bg-white hover:bg-[#FFFDF9] border-2 border-teal-200/80 hover:border-teal-400 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#23140E]">الانضمام لغرفة برمز الدعوة</h2>
              <p className="text-xs text-[#6B4E40] font-readex mt-1">أدخل كود الـ 6 خانات وادخل الجلسة فوراً</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-teal-400 group-hover:text-teal-600 transition-colors shrink-0" />
        </motion.button>
      </section>

      {/* Filter Tabs + Games Grid */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[#23140E]">اختر لعبتك وابدأ التحدي 🎉</h2>
            <p className="text-xs sm:text-sm text-[#6B4E40] font-readex mt-1">
              جميع الألعاب متاحة مجاناً بدون إعلانات أو حدود زمنية
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white border border-amber-200 shadow-xs">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'offline', label: 'أوفلاين' },
              { id: 'online', label: 'أونلاين' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  SoundFX.playClick();
                  setFilter(tab.id as 'all' | 'offline' | 'online');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
                  filter === tab.id
                    ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-sm'
                    : 'text-[#5A3E32] hover:bg-amber-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGames.map((game) => {
            const locked = game.underMaintenance || !game.isActive;
            return (
              <motion.div
                key={game.id}
                whileHover={locked ? undefined : { y: -4 }}
                onClick={() => handleCardClick(game)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(game)}
                className={`group relative rounded-3xl bg-white border-2 transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer ${
                  locked
                    ? 'border-amber-200 opacity-85 hover:border-amber-400 shadow-sm'
                    : 'border-amber-200/80 hover:border-orange-400 shadow-[0_12px_30px_-16px_rgba(249,115,22,0.28)] hover:shadow-[0_18px_40px_-14px_rgba(249,115,22,0.38)]'
                }`}
              >
                {/* Visual Top Header */}
                <div className={`relative h-36 bg-[#FFF4E0] p-5 flex items-center justify-between overflow-hidden`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${game.bgGradient} opacity-75 pointer-events-none`} />
                  <div className="relative z-10 w-20 h-20 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
                    {game.imageUrl ? (
                      <img
                        src={game.imageUrl}
                        alt={game.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl select-none">{game.icon}</span>
                    )}
                  </div>

                  <div className="relative z-10 flex flex-col items-end gap-2">
                    {locked ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400 text-[#23140E] text-xs font-black shadow">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>🔧 تحت التعديل والصيانة</span>
                      </span>
                    ) : (
                      <span className="text-xs font-black text-[#23140E] bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs">
                        {game.tags[0] || game.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-black text-[#23140E] group-hover:text-orange-600 transition-colors">
                        {game.title}
                      </h3>
                      <span className="text-xs font-bold text-[#7C5D4F] bg-[#FFF7ED] px-2.5 py-1 rounded-lg border border-amber-100">
                        {game.category}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-orange-600">{game.subtitle}</p>
                    <p className="text-xs sm:text-sm text-[#5A3E32] font-readex leading-relaxed line-clamp-2">
                      {game.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-amber-100 space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#6B4E40]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-orange-500" />
                        <span className="tabular-nums">{game.minPlayers}–{game.maxPlayers}</span> لاعب
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        {game.duration}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{game.difficulty}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-[#7C5D4F]">
                        {game.supportsOffline && game.supportsOnline
                          ? 'أوفلاين + أونلاين'
                          : game.supportsOffline
                            ? 'أوفلاين (جهاز واحد)'
                            : game.supportsOnline
                              ? 'أونلاين فقط'
                              : 'مغلقة للصيانة'}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-xl shadow-xs transition-all ${
                          locked
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-gradient-to-l from-orange-500 to-amber-500 text-white group-hover:from-red-500 group-hover:to-orange-500 shadow-orange-500/20'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{locked ? 'قريباً' : 'العب الآن'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Mode Choice Modal for dual-mode games */}
      {modePickerGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="text-5xl">{modePickerGame.icon}</div>
              <h3 className="text-2xl font-black text-[#23140E]">{modePickerGame.title}</h3>
              <p className="text-sm text-[#5A3E32] font-readex">كيف تحبون تلعبون هذه اللعبة الآن؟</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const g = modePickerGame;
                  setModePickerGame(null);
                  SoundFX.playTileSelect();
                  onSelectOfflineGame(g);
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black cursor-pointer shadow-md"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5" />
                  <div className="text-right">
                    <div className="text-base">أوفلاين على هذا الجهاز</div>
                    <div className="text-xs font-bold text-amber-100">مثالية للجلسة والمجلس</div>
                  </div>
                </div>
                <ArrowLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  const gid = modePickerGame.id;
                  setModePickerGame(null);
                  SoundFX.playTileSelect();
                  onSelectOnlineCreate(gid);
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#FFF8EE] hover:bg-amber-50 border-2 border-amber-200 text-[#23140E] font-black cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-orange-500" />
                  <div className="text-right">
                    <div className="text-base">إنشاء غرفة أونلاين</div>
                    <div className="text-xs text-[#6B4E40] font-normal">كل لاعب من جواله برابط دعوة</div>
                  </div>
                </div>
                <ArrowLeft className="w-5 h-5 text-orange-500" />
              </button>
            </div>

            <button
              onClick={() => setModePickerGame(null)}
              className="w-full py-2.5 text-xs font-bold text-[#7C5D4F] hover:text-[#23140E] cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
