import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import {
  UserPlus,
  Shuffle,
  ArrowLeft,
  Eye,
  EyeOff,
  RotateCcw,
  Trophy,
  Vote,
  Sparkles,
  Crown,
  MessageCircleQuestion,
} from 'lucide-react';
import { BarrahCategory, RoomState } from '../../types/jamr';
import { SoundFX } from '../../utils/soundFx';
import { useCharacterReaction } from '../../context/CharacterReactionContext';

interface BarrahSalfaEngineProps {
  mode: 'offline' | 'online';
  playerName: string;
  categories: BarrahCategory[];
  room?: RoomState | null;
  localPlayerId?: string;
  onSendAction?: (payload: Record<string, unknown>) => void;
  onExit: () => void;
}

export const BarrahSalfaEngine: React.FC<BarrahSalfaEngineProps> = ({
  mode,
  playerName,
  categories,
  room,
  localPlayerId,
  onSendAction,
  onExit,
}) => {
  const isOnline = mode === 'online' && Boolean(room);
  const br = room?.barrah;
  const { triggerReaction } = useCharacterReaction();

  // Offline setup & states
  const [offlinePhase, setOfflinePhase] = useState<
    'setup' | 'reveal_cards' | 'questions_stage' | 'voting_pass' | 'final_chance' | 'results'
  >('setup');
  const [offlinePlayers, setOfflinePlayers] = useState<Array<{ id: string; name: string }>>([
    { id: 'b1', name: playerName || 'اللاعب 1' },
    { id: 'b2', name: 'اللاعب 2' },
    { id: 'b3', name: 'اللاعب 3' },
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('random_all');

  const [secretWord, setSecretWord] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [distractors, setDistractors] = useState<string[]>([]);
  const [spyId, setSpyId] = useState('');
  const [revealIdx, setRevealIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  const [askerName, setAskerName] = useState('');
  const [answererName, setAnswererName] = useState('');
  const [isShufflingPair, setIsShufflingPair] = useState(false);

  const [voteTurnIdx, setVoteTurnIdx] = useState(0);
  const [offlineVotes, setOfflineVotes] = useState<Record<string, string>>({});
  const [offlineWinner, setOfflineWinner] = useState<'insiders' | 'spy' | null>(null);
  const [spyGuessWord, setSpyGuessWord] = useState<string | null>(null);
  const [finalTimer, setFinalTimer] = useState(25);

  const activePhase = isOnline && br ? br.phase : offlinePhase;
  const isHost = isOnline ? room?.hostId === localPlayerId : true;

  const displayPlayers = isOnline && room ? room.players : offlinePlayers;
  const activeSpyId = isOnline && br ? br.spyId : spyId;
  const activeSpyName = displayPlayers.find((p) => p.id === activeSpyId)?.name || 'الجاسوس';
  const activeWord = isOnline && br ? br.secretWord : secretWord;
  const activeCatName = isOnline && br ? br.categoryName : categoryName;
  const activeOptions = isOnline && br ? br.distractorWords : distractors;

  const displayedAskerName = isOnline && br
    ? displayPlayers.find((p) => p.id === br.askerId)?.name || '—'
    : askerName;
  const displayedAnswererName = isOnline && br
    ? displayPlayers.find((p) => p.id === br.answererId)?.name || '—'
    : answererName;

  // Brief celebratory spin animation whenever online asker/answerer updates
  useEffect(() => {
    if (!isOnline || activePhase !== 'questions_stage' || !br) return;
    setIsShufflingPair(true);
    const t = window.setTimeout(() => setIsShufflingPair(false), 550);
    return () => clearTimeout(t);
  }, [isOnline, activePhase, br?.askerId, br?.answererId]);

  // Final chance 25s timer
  useEffect(() => {
    if (activePhase !== 'final_chance') return;
    setFinalTimer(25);
    const id = window.setInterval(() => {
      setFinalTimer((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (!isOnline) {
            SoundFX.playVictory();
            setOfflineWinner('insiders');
            setOfflinePhase('results');
          }
          return 0;
        }
        if (prev <= 6) SoundFX.playTick(true);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activePhase, isOnline]);

  useEffect(() => {
    if (activePhase === 'final_chance') {
      triggerReaction('shocked', 'انكشف الجاسوس! 🕵️', 2800);
    } else if (activePhase === 'results') {
      SoundFX.playVictory();
      void confetti({ particleCount: 85, spread: 75, origin: { y: 0.6 } });
      const activeWinner = isOnline && br ? br.winner : offlineWinner;
      const amISpy = isOnline && localPlayerId ? activeSpyId === localPlayerId : false;
      if (isOnline && localPlayerId) {
        const iWon = (amISpy && activeWinner === 'spy') || (!amISpy && activeWinner === 'insiders');
        triggerReaction(
          iWon ? 'win' : 'lose',
          iWon ? 'كسبنا السالفة! 🎉' : amISpy ? 'انكشفت 😅' : 'ضحك علينا! 😂',
          3400
        );
      } else {
        triggerReaction(
          activeWinner === 'insiders' ? 'win' : 'shocked',
          activeWinner === 'insiders' ? 'تم القبض على الجاسوس! 🎉' : 'فلت الجاسوس! 🕵️',
          3200
        );
      }
    }
  }, [activePhase, isOnline, br, offlineWinner, activeSpyId, localPlayerId, triggerReaction]);

  const startOfflineGame = () => {
    if (offlinePlayers.length < 3 || categories.length === 0) return;
    SoundFX.playTileSelect();
    const pool =
      selectedCatId === 'random_all'
        ? categories
        : categories.filter((c) => c.id === selectedCatId);
    const chosenCat = pool[Math.floor(Math.random() * pool.length)] || categories[0];

    // Pick strictly from the active category's words (10 related options total)
    const uniqueCatWords = Array.from(new Set(chosenCat.words.map((w) => w.trim()).filter(Boolean)));
    const shuffledWords = [...uniqueCatWords].sort(() => Math.random() - 0.5);
    const word = shuffledWords[0] || 'قهوة عربية';
    const sameCategoryDistractors = shuffledWords.filter((w) => w !== word).slice(0, 9);

    const fallbackWords =
      sameCategoryDistractors.length < 9
        ? Array.from(
            new Set(
              categories
                .flatMap((c) => c.words)
                .filter((w) => w !== word && !sameCategoryDistractors.includes(w))
            )
          ).sort(() => Math.random() - 0.5)
        : [];

    const tenOptions = Array.from(new Set([word, ...sameCategoryDistractors, ...fallbackWords]))
      .slice(0, 10)
      .sort(() => Math.random() - 0.5);

    const spy = offlinePlayers[Math.floor(Math.random() * offlinePlayers.length)];
    setCategoryName(chosenCat.name);
    setSecretWord(word);
    setDistractors(tenOptions);
    setSpyId(spy.id);
    setRevealIdx(0);
    setCardFlipped(false);
    setOfflineVotes({});
    setVoteTurnIdx(0);
    setOfflineWinner(null);
    setSpyGuessWord(null);
    setOfflinePhase('reveal_cards');
  };

  const spinOfflinePair = () => {
    if (offlinePlayers.length < 2) return;
    SoundFX.playTileSelect();
    setIsShufflingPair(true);
    let ticks = 0;
    const iv = window.setInterval(() => {
      ticks += 1;
      const tmp = [...offlinePlayers].sort(() => Math.random() - 0.5);
      setAskerName(tmp[0]?.name || '');
      setAnswererName(tmp[1]?.name || '');
      if (ticks >= 7) {
        clearInterval(iv);
        const finalPair = [...offlinePlayers].sort(() => Math.random() - 0.5);
        setAskerName(finalPair[0]?.name || '');
        setAnswererName(finalPair[1]?.name || '');
        setIsShufflingPair(false);
        SoundFX.playCorrect();
      }
    }, 90);
  };

  const castOfflineVote = (targetId: string) => {
    SoundFX.playClick();
    const voter = offlinePlayers[voteTurnIdx];
    const nextVotes = { ...offlineVotes, [voter.id]: targetId };
    setOfflineVotes(nextVotes);
    if (voteTurnIdx + 1 < offlinePlayers.length) {
      setVoteTurnIdx(voteTurnIdx + 1);
    } else {
      const counts: Record<string, number> = {};
      Object.values(nextVotes).forEach((v) => {
        counts[v] = (counts[v] || 0) + 1;
      });
      const topSuspect = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topSuspect === spyId) {
        SoundFX.playGong();
        setOfflinePhase('final_chance');
      } else {
        setOfflineWinner('spy');
        setOfflinePhase('results');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 text-[#24141D]">
      {/* Joyful Header Strip */}
      <div className="flex items-center justify-between rounded-3xl bg-white border border-amber-200 p-4 shadow-[0_8px_24px_rgba(255,107,0,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFB703] to-[#FF6B00] flex items-center justify-center text-2xl shadow-sm">
            🕵️
          </div>
          <div>
            <h1 className="text-xl font-black text-[#24141D]">برا السالفة</h1>
            <p className="text-xs text-[#D9480F] font-bold">
              {activeCatName ? `القسم: ${activeCatName}` : 'اختر القسم وكشف اللي برا السالفة'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            SoundFX.playClick();
            onExit();
          }}
          className="px-4 py-2.5 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-xs font-black text-[#24141D] flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </div>

      {/* PHASE 1: SETUP */}
      {activePhase === 'setup' && (
        <div className="rounded-3xl bg-white border border-amber-200 p-6 space-y-6 shadow-[0_10px_28px_rgba(36,20,29,0.06)]">
          {/* Player Roster */}
          {!isOnline && (
            <div className="space-y-3">
              <h2 className="text-lg font-black text-[#24141D]">اللاعبون ({offlinePlayers.length}) — الحد الأدنى 3</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={15}
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPlayerName.trim() && offlinePlayers.length < 16) {
                      SoundFX.playClick();
                      setOfflinePlayers((p) => [
                        ...p,
                        { id: `b_${Date.now()}`, name: newPlayerName.trim() },
                      ]);
                      setNewPlayerName('');
                    }
                  }}
                  placeholder="أضف اسم لاعب..."
                  className="flex-1 rounded-xl bg-[#FFF8EE] border border-amber-300 px-3.5 py-2.5 text-sm font-bold text-[#24141D] focus:outline-none focus:border-[#FF6B00]"
                />
                <button
                  onClick={() => {
                    if (!newPlayerName.trim() || offlinePlayers.length >= 16) return;
                    SoundFX.playClick();
                    setOfflinePlayers((p) => [
                      ...p,
                      { id: `b_${Date.now()}`, name: newPlayerName.trim() },
                    ]);
                    setNewPlayerName('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white font-black text-xs flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {offlinePlayers.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FFF8EE] border border-amber-200 text-xs font-black text-[#24141D]"
                  >
                    <span>{p.name}</span>
                    {offlinePlayers.length > 3 && (
                      <button
                        onClick={() => setOfflinePlayers((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-[#E62E1B] hover:text-rose-700 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Categories Picker */}
          <div className="space-y-3">
            <h2 className="text-lg font-black text-[#24141D]">اختر القسم ({categories.length} قسم متاح)</h2>
            <button
              onClick={() => {
                SoundFX.playClick();
                setSelectedCatId('random_all');
              }}
              className={`w-full p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-center justify-between ${
                selectedCatId === 'random_all'
                  ? 'bg-[#FFF3DF] border-[#FF6B00] text-[#24141D]'
                  : 'bg-[#FFFBF5] border-amber-200/80 text-[#5C4350] hover:border-amber-300'
              }`}
            >
              <div>
                <div className="font-black text-base">🎲 عشوائي من جميع الأقسام</div>
                <div className="text-xs text-[#6B4F5E] font-readex mt-0.5">
                  يختار النظام قسماً وكلمة سرية مفاجئة مع 10 خيارات من نفس القسم
                </div>
              </div>
              {selectedCatId === 'random_all' && <span className="text-[#FF6B00] font-black text-xs">مختار ✅</span>}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    SoundFX.playClick();
                    setSelectedCatId(cat.id);
                  }}
                  className={`p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                    selectedCatId === cat.id
                      ? 'bg-[#FFF3DF] border-[#FF6B00] text-[#24141D]'
                      : 'bg-[#FFFBF5] border-amber-200/70 text-[#4A3240] hover:bg-[#FFF8EE]'
                  }`}
                >
                  <div className="font-black text-sm flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </div>
                  <p className="text-[11px] text-[#6B4F5E] font-readex mt-1">{cat.description}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={offlinePlayers.length < 3}
            onClick={startOfflineGame}
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] hover:opacity-95 text-white font-black text-lg shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            ابدأ توزيع البطاقات 🕵️
          </button>
        </div>
      )}

      {/* PHASE 2: REVEAL CARDS */}
      {activePhase === 'reveal_cards' && (
        <div className="rounded-3xl bg-white border border-amber-200 p-8 text-center space-y-6 shadow-[0_10px_28px_rgba(36,20,29,0.06)]">
          {isOnline && br ? (
            <>
              <div className="text-4xl">🤫</div>
              <h2 className="text-2xl font-black text-[#24141D]">بطاقتك السرية</h2>
              {localPlayerId === br.spyId ? (
                <div className="rounded-2xl bg-rose-50 border-2 border-[#E62E1B] p-6 space-y-2 max-w-md mx-auto">
                  <div className="text-xl font-black text-[#B91C1C]">
                    أنت برا السالفة فقط! — ما عندك سالفة نهائياً 🤫
                  </div>
                  <p className="text-xs text-[#7F1D1D] font-readex">
                    التصنيف هو ({br.categoryName}). حاول تفهم الكلمة من أسئلتهم بدون ما ينتبهون!
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border-2 border-[#10B981] p-6 space-y-2 max-w-md mx-auto">
                  <div className="text-xs font-bold text-[#047857]">التصنيف: {br.categoryName}</div>
                  <div className="text-3xl font-black text-[#24141D]">{br.secretWord}</div>
                </div>
              )}

              {!br.revealedPlayerIds.includes(localPlayerId || '') ? (
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    onSendAction?.({ type: 'barrah_mark_revealed' });
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-[#FF6B00] hover:bg-[#e85d00] text-white font-black cursor-pointer"
                >
                  حفظت دوري ✅
                </button>
              ) : (
                <p className="text-sm font-bold text-[#6B4F5E]">
                  بانتظار البقية ({br.revealedPlayerIds.length}/{displayPlayers.length})...
                </p>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-black text-[#D9480F] tabular-nums">
                لاعب {revealIdx + 1} من {offlinePlayers.length}
              </div>
              <h2 className="text-3xl font-black text-[#24141D]">
                اعطوا الجوال لـ: <span className="text-[#FF6B00]">{offlinePlayers[revealIdx]?.name}</span>
              </h2>

              {!cardFlipped ? (
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    setCardFlipped(true);
                  }}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black text-lg inline-flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Eye className="w-5 h-5" />
                  <span>اكشف بطاقتي</span>
                </button>
              ) : (
                <div className="space-y-5 max-w-md mx-auto">
                  {offlinePlayers[revealIdx]?.id === spyId ? (
                    <div className="rounded-2xl bg-rose-50 border-2 border-[#E62E1B] p-6 space-y-2">
                      <div className="text-xl font-black text-[#B91C1C]">
                        أنت برا السالفة فقط! — ما عندك سالفة نهائياً 🤫
                      </div>
                      <p className="text-xs text-[#7F1D1D] font-readex">
                        انتبه: التصنيف ({categoryName}) — لا تفضح نفسك!
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-emerald-50 border-2 border-[#10B981] p-6 space-y-2">
                      <div className="text-xs font-bold text-[#047857]">التصنيف: {categoryName}</div>
                      <div className="text-3xl font-black text-[#24141D]">{secretWord}</div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      SoundFX.playClick();
                      setCardFlipped(false);
                      if (revealIdx + 1 < offlinePlayers.length) {
                        setRevealIdx(revealIdx + 1);
                      } else {
                        spinOfflinePair();
                        setOfflinePhase('questions_stage');
                      }
                    }}
                    className="w-full py-3.5 rounded-2xl bg-[#24141D] hover:bg-[#38212e] text-white font-black inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <EyeOff className="w-4 h-4" />
                    <span>إخفاء والانتقال للتالي</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PHASE 3: LUXURY QUESTIONS STAGE (Host-only Shuffle + Spring Spotlight Cards) */}
      {activePhase === 'questions_stage' && (
        <div className="rounded-3xl bg-white border-2 border-amber-200 p-6 sm:p-8 text-center space-y-6 shadow-[0_14px_38px_rgba(255,107,0,0.12)] relative overflow-hidden">
          {/* Subtle decorative festive corner gradient */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-40 rounded-full bg-gradient-to-r from-[#FFB703]/20 via-[#FF6B00]/15 to-[#0D9488]/20 blur-2xl" />

          <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#FFF3DF] border border-[#FFB703] text-[#B45309] text-xs font-black">
            <Sparkles className="w-4 h-4 text-[#FF6B00]" />
            <span>القاعدة الذهبية: اسأل سؤالاً ذكياً لا يكشف الكلمة للي برا السالفة!</span>
          </div>

          {/* Luxurious Dual Spotlight Cards */}
          <div className="relative max-w-2xl mx-auto">
            <div className="text-xs font-black text-[#6B4F5E] mb-4 flex items-center justify-center gap-1.5">
              <MessageCircleQuestion className="w-4 h-4 text-[#FF6B00]" />
              <span>{isShufflingPair ? 'جاري سحب الثنائي بالقرعة...' : 'مواجهة الأسئلة المباشرة'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
              {/* Asker Card */}
              <motion.div
                key={`asker-${displayedAskerName}-${isShufflingPair ? 'spin' : 'ready'}`}
                initial={{ opacity: 0.4, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                className="rounded-3xl bg-gradient-to-br from-[#FFF9EE] to-[#FFE8CC] border-2 border-[#FF6B00] p-6 shadow-[0_12px_26px_rgba(255,107,0,0.16)] space-y-2"
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#FFB703] to-[#FF6B00] text-white flex items-center justify-center text-3xl shadow-md">
                  🗣️
                </div>
                <div className="text-xs font-black text-[#D9480F]">السائل</div>
                <div className="text-2xl sm:text-3xl font-black text-[#24141D] truncate">
                  {displayedAskerName}
                </div>
                <div className="text-[11px] font-bold text-[#6B4F5E]">يسأل سؤالاً ذكياً الآن</div>
              </motion.div>

              {/* Spark Bridge */}
              <motion.div
                animate={isShufflingPair ? { rotate: 360 } : { scale: [1, 1.08, 1] }}
                transition={
                  isShufflingPair
                    ? { repeat: Infinity, duration: 0.6, ease: 'linear' }
                    : { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }
                }
                className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-[#FFB703] via-[#FF6B00] to-[#E62E1B] text-white flex items-center justify-center text-xl font-black shadow-lg border-4 border-white"
              >
                ⚡
              </motion.div>

              {/* Respondent Card */}
              <motion.div
                key={`answerer-${displayedAnswererName}-${isShufflingPair ? 'spin' : 'ready'}`}
                initial={{ opacity: 0.4, scale: 0.92, y: -12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                className="rounded-3xl bg-gradient-to-br from-[#F0FDFA] to-[#CCFBF1] border-2 border-[#0D9488] p-6 shadow-[0_12px_26px_rgba(13,148,136,0.14)] space-y-2"
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] text-white flex items-center justify-center text-3xl shadow-md">
                  🎯
                </div>
                <div className="text-xs font-black text-[#0F766E]">المسؤول (المجيب)</div>
                <div className="text-2xl sm:text-3xl font-black text-[#24141D] truncate">
                  {displayedAnswererName}
                </div>
                <div className="text-[11px] font-bold text-[#115E59]">يرد بثقة بدون كشف السر</div>
              </motion.div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {/* Strictly ONLY Host / Room Creator can draw another pair */}
            {isHost ? (
              <button
                disabled={isShufflingPair}
                onClick={() => {
                  if (isOnline) {
                    SoundFX.playClick();
                    onSendAction?.({ type: 'barrah_next_pair' });
                  } else {
                    spinOfflinePair();
                  }
                }}
                className="px-6 py-3.5 rounded-2xl bg-[#FFF8EE] hover:bg-amber-100 border-2 border-[#FFB703] text-[#24141D] font-black text-sm inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-55"
              >
                <Shuffle className="w-4 h-4 text-[#FF6B00]" />
                <span>اسحب ثنائي آخر</span>
              </button>
            ) : (
              <div className="px-5 py-3 rounded-2xl bg-[#FFF8EE] border border-amber-200 text-xs font-black text-[#6B4F5E] inline-flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#FFB703]" />
                <span>يتحكم منشئ الغرفة بسحب الثنائي التالي</span>
              </div>
            )}

            {isHost && (
              <button
                onClick={() => {
                  SoundFX.playTileSelect();
                  if (isOnline) {
                    onSendAction?.({ type: 'barrah_start_voting' });
                  } else {
                    setVoteTurnIdx(0);
                    setOfflineVotes({});
                    setOfflinePhase('voting_pass');
                  }
                }}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-[#E62E1B] to-[#FF6B00] text-white font-black text-base inline-flex items-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
              >
                <Vote className="w-5 h-5" />
                <span>ابدأ التصويت السري 🗳️</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* PHASE 4: VOTING PASS */}
      {activePhase === 'voting_pass' && (
        <div className="rounded-3xl bg-white border border-rose-200 p-8 text-center space-y-6 shadow-[0_10px_28px_rgba(230,46,27,0.08)]">
          {isOnline && br ? (
            br.votesByVoter[localPlayerId || ''] ? (
              <div className="space-y-3 py-6">
                <div className="text-4xl">🗳️</div>
                <h3 className="text-xl font-black text-[#24141D]">تم تسجيل صوتك بسرية!</h3>
                <p className="text-sm text-[#6B4F5E] font-bold">
                  بانتظار بقية المصوتين ({Object.keys(br.votesByVoter).length}/{displayPlayers.length})...
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-[#24141D]">من تعتقد أنه برا السالفة؟ 🕵️</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                  {displayPlayers
                    .filter((p) => p.id !== localPlayerId)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          SoundFX.playClick();
                          onSendAction?.({ type: 'barrah_vote', targetId: p.id });
                        }}
                        className="p-4 rounded-2xl bg-[#FFF8EE] hover:bg-rose-50 border-2 border-amber-200 hover:border-[#E62E1B] font-black text-[#24141D] cursor-pointer transition-colors"
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              </>
            )
          ) : (
            <>
              <div className="text-xs font-black text-[#E62E1B] tabular-nums">
                تصويت {voteTurnIdx + 1} من {offlinePlayers.length}
              </div>
              <h2 className="text-2xl font-black text-[#24141D]">
                دور التصويت السري لـ: <span className="text-[#FF6B00]">{offlinePlayers[voteTurnIdx]?.name}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {offlinePlayers
                  .filter((p) => p.id !== offlinePlayers[voteTurnIdx]?.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => castOfflineVote(p.id)}
                      className="p-4 rounded-2xl bg-[#FFF8EE] hover:bg-rose-50 border-2 border-amber-200 hover:border-[#E62E1B] font-black text-[#24141D] cursor-pointer transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PHASE 5: FINAL CHANCE (25s + 10 topic-related options) */}
      {activePhase === 'final_chance' && (
        <div className="rounded-3xl bg-white border-2 border-[#FFB703] p-6 sm:p-8 text-center space-y-6 shadow-[0_12px_32px_rgba(255,183,3,0.16)]">
          <div className="text-lg font-black text-[#E62E1B] tabular-nums">⏱️ {finalTimer} ثانية</div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#24141D]">
            انكشف الجاسوس ({activeSpyName})! — الفرصة الأخيرة لسرقة الفوز 🎯
          </h2>
          <p className="text-sm text-[#5C4350] font-readex">
            إذا خمّن {activeSpyName} السالفة الصحيحة من بين الخيارات الـ {activeOptions.length} المرتبطة بموضوع ({activeCatName}) سيفوز بالجولة!
          </p>

          {(!isOnline || localPlayerId === activeSpyId) ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {activeOptions.map((word) => (
                <button
                  key={word}
                  onClick={() => {
                    if (isOnline) {
                      SoundFX.playTileSelect();
                      onSendAction?.({ type: 'barrah_spy_guess', word });
                    } else {
                      setSpyGuessWord(word);
                      setOfflineWinner(word === secretWord ? 'spy' : 'insiders');
                      setOfflinePhase('results');
                    }
                  }}
                  className="py-4 px-3 rounded-2xl bg-[#FFF8EE] hover:bg-[#FFB703] hover:text-[#24141D] border-2 border-amber-300 hover:border-[#24141D] font-black text-sm text-[#24141D] transition-all cursor-pointer shadow-sm"
                >
                  {word}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-[#D9480F] font-black">
              بانتظار {activeSpyName} لاختيار السالفة من بين الـ {activeOptions.length} خيارات...
            </div>
          )}
        </div>
      )}

      {/* PHASE 6: RESULTS */}
      {activePhase === 'results' && (
        <div className="rounded-3xl bg-white border-2 border-[#10B981] p-8 text-center space-y-6 shadow-[0_12px_32px_rgba(16,185,129,0.12)]">
          <Trophy className="w-16 h-16 text-[#FFB703] mx-auto" />
          <h2 className="text-3xl font-black text-[#24141D]">
            {(isOnline && br ? br.winner : offlineWinner) === 'spy'
              ? `فاز اللي برا السالفة (${activeSpyName})! 🕵️🔥`
              : 'فاز أهل السالفة وكشفوا الجاسوس! 🎉'}
          </h2>
          <div className="max-w-md mx-auto rounded-2xl bg-[#FFF8EE] border border-amber-200 p-5 space-y-2 text-sm">
            <div>
              اللي برا السالفة كان: <span className="font-black text-[#E62E1B]">{activeSpyName}</span>
            </div>
            <div>
              السالفة كانت: <span className="font-black text-[#047857]">{activeWord}</span>
            </div>
            {(isOnline ? br?.spyGuess : spyGuessWord) && (
              <div>
                تخمين الجاسوس: <span className="font-black text-[#D9480F]">{isOnline ? br?.spyGuess : spyGuessWord}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              SoundFX.playClick();
              if (isOnline) {
                onSendAction?.({ type: 'return_to_lobby' });
              } else {
                setOfflinePhase('setup');
              }
            }}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black inline-flex items-center gap-2 shadow-md cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>جولة جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
};
