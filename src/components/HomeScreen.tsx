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
} from 'lucide-react';
import { GameConfig } from '../types/jamr';
import { SoundFX } from '../utils/soundFx';

interface HomeScreenProps {
  games: GameConfig[];
  playerName: string;
  onUpdatePlayerName: (name: string) => void;
  onSelectOfflineGame: (game: GameConfig) => void;
  onSelectOnlineCreate: (gameId?: string) => void;
  onSelectOnlineJoin: () => void;
  onShowMaintenance: (game: GameConfig) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  games,
  playerName,
  onUpdatePlayerName,
  onSelectOfflineGame,
  onSelectOnlineCreate,
  onSelectOnlineJoin,
  onShowMaintenance,
}) => {
  const [filter, setFilter] = useState<'all' | 'offline' | 'online'>('all');
  const [editingHeroName, setEditingHeroName] = useState(false);
  const [draftName, setDraftName] = useState(playerName);
  const [modePickerGame, setModePickerGame] = useState<GameConfig | null>(null);

  const filteredGames = games.filter((g) => {
    if (filter === 'offline') return g.supportsOffline;
    if (filter === 'online') return g.supportsOnline;
    return true;
  });

  const handleCardClick = (game: GameConfig) => {
    SoundFX.playClick();
    if (game.underMaintenance || !game.isActive) {
      onShowMaintenance(game);
      return;
    }
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
    } else {
      setDraftName(playerName);
    }
    setEditingHeroName(false);
    SoundFX.playClick();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-[#221038] via-[#150b24] to-[#1e0d08] border border-amber-500/25 p-6 sm:p-10 shadow-2xl">
        <div className="absolute -left-24 -top-24 w-72 h-72 rounded-full bg-orange-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -right-24 -bottom-24 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-amber-300">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>مجانية بالكامل 100% · بدون تسجيل · أونلاين وأوفلاين</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight [text-wrap:balance]">
              حيّاك يا <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-300 to-orange-500">{playerName}</span>، جاهز تولّع جمعتكم؟
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-readex leading-relaxed">
              منصة جَمْر تجمع أمتع الألعاب الجماعية العربية في مكان واحد — سواء كنتم حول جهاز واحد في المجلس أو كل واحد من جواله أونلاين!
            </p>

            {/* Quick Name Editor */}
            <div className="pt-1 flex flex-wrap items-center gap-3">
              {editingHeroName ? (
                <div className="flex items-center gap-2 bg-black/40 border border-orange-500/50 rounded-xl px-3 py-1.5">
                  <input
                    type="text"
                    maxLength={15}
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitHeroName()}
                    className="bg-transparent text-white text-sm font-bold focus:outline-none w-36"
                  />
                  <button
                    onClick={commitHeroName}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black cursor-pointer flex items-center gap-1"
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs sm:text-sm font-bold text-slate-100 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-400" />
                  <span>تغيير اسمك: {playerName}</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats summary clean panel */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
            <div className="rounded-2xl bg-black/35 border border-white/10 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">7</div>
              <div className="text-xs text-slate-300 mt-1 font-bold">ألعاب جماعية</div>
            </div>
            <div className="rounded-2xl bg-black/35 border border-white/10 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-orange-400 tabular-nums">1,200+</div>
              <div className="text-xs text-slate-300 mt-1 font-bold">سؤال حقيقي موثّق</div>
            </div>
            <div className="rounded-2xl bg-black/35 border border-white/10 p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">100</div>
              <div className="text-xs text-slate-300 mt-1 font-bold">لاعب بالغرفة</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Mode Selector Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => {
            SoundFX.playTileSelect();
            setFilter('offline');
            const firstOffline = games.find((g) => g.supportsOffline && g.isActive && !g.underMaintenance);
            if (firstOffline) onSelectOfflineGame(firstOffline);
          }}
          className="text-right group rounded-2xl bg-[#130b22] hover:bg-[#1a102e] border border-white/10 hover:border-amber-500/45 p-5 transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">اللعب أوفلاين (جهاز واحد)</h2>
              <p className="text-xs text-slate-400 font-readex mt-1">مرّر الجوال أو اعرض الشاشة في المجلس</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
        </button>

        <button
          onClick={() => {
            SoundFX.playTileSelect();
            onSelectOnlineCreate('broken_tv');
          }}
          className="text-right group rounded-2xl bg-[#130b22] hover:bg-[#1a102e] border border-white/10 hover:border-orange-500/45 p-5 transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">إنشاء غرفة أونلاين</h2>
              <p className="text-xs text-slate-400 font-readex mt-1">أنشئ غرفة فورية وشارك الرابط مع ربعك</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-orange-400 transition-colors shrink-0" />
        </button>

        <button
          onClick={() => {
            SoundFX.playTileSelect();
            onSelectOnlineJoin();
          }}
          className="text-right group rounded-2xl bg-[#130b22] hover:bg-[#1a102e] border border-white/10 hover:border-teal-500/45 p-5 transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">الانضمام لغرفة برمز الدعوة</h2>
              <p className="text-xs text-slate-400 font-readex mt-1">أدخل كود الـ 6 خانات وادخل الجلسة فوراً</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0" />
        </button>
      </section>

      {/* Filter Tabs + Games Grid */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">اختر لعبتك وابدأ التحدي</h2>
            <p className="text-xs sm:text-sm text-slate-400 font-readex mt-1">
              جميع الألعاب متاحة مجاناً بدون إعلانات أو حدود زمنية
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#130b22] border border-white/10">
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
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition-colors whitespace-nowrap cursor-pointer ${
                  filter === tab.id
                    ? 'bg-orange-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
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
              <div
                key={game.id}
                onClick={() => handleCardClick(game)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(game)}
                className={`group relative rounded-3xl bg-[#120a20] border transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer ${
                  locked
                    ? 'border-amber-500/30 opacity-85 hover:border-amber-400/60'
                    : 'border-white/10 hover:border-orange-500/50 hover:-translate-y-1 shadow-xl'
                }`}
              >
                {/* Visual Top Header */}
                <div className={`relative h-36 bg-gradient-to-br ${game.bgGradient} p-5 flex items-center justify-between`}>
                  <div className="w-20 h-20 rounded-2xl bg-black/35 border border-white/15 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
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

                  <div className="flex flex-col items-end gap-2">
                    {locked ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-black shadow">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>🔧 تحت التعديل والصيانة</span>
                      </span>
                    ) : (
                      <span className="text-xs font-black text-white/90 bg-black/35 px-3 py-1 rounded-xl border border-white/10">
                        {game.tags[0] || game.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                        {game.title}
                      </h3>
                      <span className="text-xs font-bold text-slate-400">{game.category}</span>
                    </div>
                    <p className="text-xs font-bold text-orange-300/90">{game.subtitle}</p>
                    <p className="text-xs sm:text-sm text-slate-300 font-readex leading-relaxed line-clamp-2">
                      {game.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-orange-400" />
                        <span className="tabular-nums">{game.minPlayers}–{game.maxPlayers}</span> لاعب
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-teal-400" />
                        {game.duration}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{game.difficulty}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-400">
                        {game.supportsOffline && game.supportsOnline
                          ? 'أوفلاين + أونلاين'
                          : game.supportsOffline
                            ? 'أوفلاين (جهاز واحد)'
                            : game.supportsOnline
                              ? 'أونلاين فقط'
                              : 'مغلقة للصيانة'}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl ${
                          locked
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-orange-500 text-slate-950 group-hover:bg-amber-400'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{locked ? 'قريباً' : 'العب الآن'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mode Choice Modal for dual-mode games */}
      {modePickerGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#140b24] border border-orange-500/30 p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="text-5xl">{modePickerGame.icon}</div>
              <h3 className="text-2xl font-black text-white">{modePickerGame.title}</h3>
              <p className="text-sm text-slate-300 font-readex">كيف تحبون تلعبون هذه اللعبة الآن؟</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const g = modePickerGame;
                  setModePickerGame(null);
                  SoundFX.playTileSelect();
                  onSelectOfflineGame(g);
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5" />
                  <div className="text-right">
                    <div className="text-base">أوفلاين على هذا الجهاز</div>
                    <div className="text-xs font-bold opacity-80">مثالية للجلسة والمجلس</div>
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
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-orange-400" />
                  <div className="text-right">
                    <div className="text-base">إنشاء غرفة أونلاين</div>
                    <div className="text-xs text-slate-300 font-normal">كل لاعب من جواله برابط دعوة</div>
                  </div>
                </div>
                <ArrowLeft className="w-5 h-5 text-orange-400" />
              </button>
            </div>

            <button
              onClick={() => setModePickerGame(null)}
              className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
