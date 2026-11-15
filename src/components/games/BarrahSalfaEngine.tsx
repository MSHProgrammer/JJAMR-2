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
import { CharacterAvatar } from '../CharacterAvatar';

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
    'setup' | 'category_vote' | 'reveal_cards' | 'questions_stage' | 'voting_pass' | 'final_chance' | 'results'
  >('setup');
  const [offlinePlayers, setOfflinePlayers] = useState<Array<{ id: string; name: string; avatar?: string; avatarBg?: string }>>([
    { id: 'b1', name: playerName || 'اللاعب 1', avatar: 'char_01', avatarBg: 'lavender' },
    { id: 'b2', name: 'اللاعب 2', avatar: 'char_11', avatarBg: 'mint' },
    { id: 'b3', name: 'اللاعب 3', avatar: 'char_02', avatarBg: 'sunset' },
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [voteCatTurnIdx, setVoteCatTurnIdx] = useState(0);
  const [offlineCategoryVotes, setOfflineCategoryVotes] = useState<Record<string, string>>({});
  const [catVoteSecondsLeft, setCatVoteSecondsLeft] = useState(10);

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

  // Live 10-second category voting countdown (Online server-synced deadline + Offline 10s turn/round timer)
  useEffect(() => {
    if (activePhase !== 'category_vote') return;
    if (isOnline) {
      const deadline = br?.categoryVoteDeadline || (Date.now() + 10_000);
      let finalized = false;
      const update = () => {
        const rem = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setCatVoteSecondsLeft(rem);
        if (rem <= 0 && !finalized) {
          finalized = true;
          onSendAction?.({ type: 'barrah_finalize_category' });
        }
      };
      update();
      const iv = window.setInterval(update, 250);
      return () => clearInterval(iv);
    } else {
      setCatVoteSecondsLeft(10);
      const iv = window.setInterval(() => {
        setCatVoteSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(iv);
            const tally: Record<string, number> = {};
            Object.values(offlineCategoryVotes).forEach((id) => {
              tally[id] = (tally[id] || 0) + 1;
            });
            const entries = Object.entries(tally);
            let winId = 'random_all';
            if (entries.length > 0) {
              const mx = Math.max(...entries.map(([, c]) => c));
              const tied = entries.filter(([, c]) => c === mx).map(([id]) => id);
              winId = tied[Math.floor(Math.random() * tied.length)] || 'random_all';
            }
            startOfflineWithCategory(winId);
            return 0;
          }
          if (prev <= 4) SoundFX.playTick(true);
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [activePhase, isOnline, br?.categoryVoteDeadline]);

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

  const startOfflineWithCategory = (chosenCatId: string) => {
    if (offlinePlayers.length < 3 || categories.length === 0) return;
    SoundFX.playTileSelect();
    const pool =
      chosenCatId === 'random_all'
        ? categories
        : categories.filter((c) => c.id === chosenCatId);
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

  const castOfflineCategoryVote = (catId: string) => {
    SoundFX.playClick();
    const voter = offlinePlayers[voteCatTurnIdx];
    const nextVotes = voter ? { ...offlineCategoryVotes, [voter.id]: catId } : { ...offlineCategoryVotes };
    setOfflineCategoryVotes(nextVotes);
    if (voteCatTurnIdx + 1 < offlinePlayers.length) {
      setVoteCatTurnIdx(voteCatTurnIdx + 1);
      return;
    }
    const tally: Record<string, number> = {};
    Object.values(nextVotes).forEach((id) => {
      tally[id] = (tally[id] || 0) + 1;
    });
    const maxCount = Math.max(0, ...Object.values(tally));
    const tiedTop = Object.entries(tally)
      .filter(([, count]) => count === maxCount)
      .map(([id]) => id);
    const winningCatId =
      tiedTop.length > 0 ? tiedTop[Math.floor(Math.random() * tiedTop.length)] : 'random_all';
    startOfflineWithCategory(winningCatId);
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
                        {
                          id: `b_${Date.now()}`,
                          name: newPlayerName.trim(),
                          avatar: `char_${String((p.length % 15) + 1).padStart(2, '0')}`,
                        },
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
                      {
                        id: `b_${Date.now()}`,
                        name: newPlayerName.trim(),
                        avatar: `char_${String((p.length % 15) + 1).padStart(2, '0')}`,
                      },
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
                    <CharacterAvatar avatarId={p.avatar} backgroundColor={p.avatarBg} size={22} interactive={false} />
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

          <div className="p-4 rounded-2xl bg-[#FFF8EE] border border-amber-200 text-xs sm:text-sm font-bold text-[#5C4350]">
            🗳️ بعد الدخول للعبة سيصوّت جميع اللاعبين خلال 10 ثوانٍ على موضوع السالفة مباشرة أمام الجميع!
          </div>

          <button
            disabled={offlinePlayers.length < 3}
            onClick={() => {
              SoundFX.playTileSelect();
              setOfflineCategoryVotes({});
              setVoteCatTurnIdx(0);
              setOfflinePhase('category_vote');
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] hover:opacity-95 disabled:opacity-45 text-white font-black text-lg shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            دخول اللعبة والتصويت على السالفة 🕵️
          </button>
        </div>
      )}

      {/* PHASE 1.5: LIVE CATEGORY VOTE WITH 10s TIMER & VOTER AVATARS */}
      {activePhase === 'category_vote' && (
        <div className="rounded-3xl bg-white border-2 border-amber-200 p-6 sm:p-8 space-y-5 shadow-[0_12px_32px_rgba(255,107,0,0.1)]">
          {(() => {
            const votesMap: Record<string, string> = isOnline
              ? (br?.categoryVotesByVoter || {})
              : offlineCategoryVotes;
            const myVote = isOnline ? votesMap[localPlayerId || ''] : undefined;
            const activeOnlineCount = isOnline
              ? Math.max(1, displayPlayers.filter((p) => ('connected' in p ? p.connected : true)).length || displayPlayers.length)
              : offlinePlayers.length;
            const totalVoted = Object.keys(votesMap).length;

            // Map categoryId -> Array of Voter Player objects
            const votersByCat: Record<string, Array<{ id: string; name: string; avatar?: string; avatarBg?: string }>> = {};
            Object.entries(votesMap).forEach(([pid, catId]) => {
              const pObj = displayPlayers.find((p) => p.id === pid);
              if (!pObj) return;
              votersByCat[catId] = [...(votersByCat[catId] || []), pObj];
            });

            // Determine current highest voted category
            const maxVotes = Math.max(0, ...Object.values(votersByCat).map((arr) => arr.length));
            const catLabel = (cid: string) =>
              cid === 'random_all'
                ? '🎲 عشوائي من جميع الأقسام'
                : categories.find((c) => c.id === cid)?.name || cid;

            return (
              <>
                {/* Countdown Timer & Live Progress */}
                <div className="space-y-3 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border text-xs font-black tabular-nums ${
                        catVoteSecondsLeft <= 3
                          ? 'bg-rose-50 border-rose-400 text-rose-700 animate-pulse'
                          : 'bg-amber-50 border-[#FFB703] text-[#B45309]'
                      }`}
                    >
                      <span>⏱️</span>
                      <span>{catVoteSecondsLeft} ثانية متبقية</span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#FFF3DF] border border-[#FFB703] text-[#B45309] text-xs font-black">
                      <Vote className="w-4 h-4 text-[#FF6B00]" />
                      <span>
                        {isOnline
                          ? `صوّت ${totalVoted} من ${activeOnlineCount} لاعبين`
                          : `تصويت ${voteCatTurnIdx + 1} من ${offlinePlayers.length}`}
                      </span>
                    </div>
                  </div>

                  {/* 10s Progress Bar */}
                  <div className="w-full max-w-md mx-auto h-2.5 rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        catVoteSecondsLeft <= 3 ? 'bg-rose-500' : 'bg-gradient-to-l from-[#FF6B00] to-[#FFB703]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, (catVoteSecondsLeft / 10) * 100))}%` }}
                    />
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-[#24141D]">
                    {isOnline ? (
                      'صوّتوا لاختيار موضوع السالفة! 🗳️'
                    ) : (
                      <>
                        دور اختيار السالفة لـ:{' '}
                        <span className="text-[#FF6B00]">{offlinePlayers[voteCatTurnIdx]?.name}</span>
                      </>
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6B4F5E] font-readex">
                    يظهر تصويت كل لاعب مباشرة بالصورة والاسم — الموضوع الأكثر تصويتا تبدأ به الجولة فوراً عند اكتمال الأصوات أو انتهاء الـ 10 ثوانٍ!
                  </p>
                </div>

                {/* Live Voter Ticker (Who voted for what with CharacterAvatar + Name) */}
                <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-[#5C4350]">
                    <span>📊 البث المباشر للتصويت (صورة واسم كل لاعب)</span>
                    <span className="text-[#D9480F]">{totalVoted}/{displayPlayers.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displayPlayers.map((p) => {
                      const votedCatId = votesMap[p.id];
                      return (
                        <div
                          key={p.id}
                          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                            votedCatId
                              ? 'bg-white border-orange-300 shadow-xs'
                              : 'bg-amber-50/50 border-amber-200/70 opacity-75'
                          }`}
                        >
                          <CharacterAvatar
                            avatarId={p.avatar}
                            backgroundColor={'avatarBg' in p ? p.avatarBg : undefined}
                            size={24}
                            mood={votedCatId ? 'excited' : 'idle'}
                            interactive={false}
                          />
                          <span className="font-black text-[#24141D]">{p.name}</span>
                          <span className="text-[11px] font-bold text-[#D9480F]">
                            {votedCatId ? `➔ ${catLabel(votedCatId)}` : '· بانتظاره ⏳'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Random All Option */}
                {(() => {
                  const randomVoters = votersByCat['random_all'] || [];
                  const isMyChoice = myVote === 'random_all';
                  const isLeading = maxVotes > 0 && randomVoters.length === maxVotes;
                  return (
                    <button
                      onClick={() => {
                        if (isOnline) {
                          SoundFX.playClick();
                          onSendAction?.({ type: 'barrah_vote_category', categoryId: 'random_all' });
                        } else {
                          castOfflineCategoryVote('random_all');
                        }
                      }}
                      className={`w-full p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isMyChoice
                          ? 'bg-[#FFF3DF] border-[#FF6B00] ring-2 ring-[#FF6B00]/30 shadow-sm'
                          : isLeading
                            ? 'bg-[#FFF8EE] border-[#FFB703]'
                            : 'bg-[#FFFBF5] border-amber-200/80 hover:border-[#FF6B00]'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base text-[#24141D]">🎲 عشوائي من جميع الأقسام</span>
                          {isLeading && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#FF6B00] text-white">
                              الأكثر تصويتاً 🔥
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6B4F5E] font-readex">
                          يختار النظام قسماً وكلمة سرية مفاجئة مع 10 خيارات من نفس القسم
                        </div>
                        {randomVoters.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {randomVoters.map((v) => (
                              <span
                                key={v.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-[11px] font-black text-[#24141D]"
                              >
                                <CharacterAvatar
                                  avatarId={v.avatar}
                                  backgroundColor={v.avatarBg}
                                  size={18}
                                  interactive={false}
                                />
                                <span>{v.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="px-3 py-1 rounded-xl bg-white border border-amber-200 text-xs font-black text-[#FF6B00] shrink-0">
                        {isMyChoice ? 'تصويتك ✅' : `${randomVoters.length} صوت`}
                      </span>
                    </button>
                  );
                })()}

                {/* Category Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const voters = votersByCat[cat.id] || [];
                    const isMyChoice = myVote === cat.id;
                    const isLeading = maxVotes > 0 && voters.length === maxVotes;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (isOnline) {
                            SoundFX.playClick();
                            onSendAction?.({ type: 'barrah_vote_category', categoryId: cat.id });
                          } else {
                            castOfflineCategoryVote(cat.id);
                          }
                        }}
                        className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isMyChoice
                            ? 'bg-[#FFF3DF] border-[#FF6B00] ring-2 ring-[#FF6B00]/30 shadow-sm'
                            : isLeading
                              ? 'bg-[#FFF8EE] border-[#FFB703] shadow-xs'
                              : voters.length > 0
                                ? 'bg-[#FFF8EE] border-amber-300'
                                : 'bg-[#FFFBF5] border-amber-200/70 hover:bg-[#FFF8EE] hover:border-amber-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-black text-sm text-[#24141D] flex items-center gap-2 min-w-0">
                              <span className="text-lg shrink-0">{cat.icon}</span>
                              <span className="truncate">{cat.name}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-[11px] font-black text-[#D9480F] tabular-nums shrink-0">
                              {voters.length}
                            </span>
                          </div>
                          {isLeading && (
                            <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-[#FF6B00] text-white">
                              الأكثر تصويتاً 🔥
                            </span>
                          )}
                          <p className="text-[11px] text-[#6B4F5E] font-readex mt-1">{cat.description}</p>
                        </div>
                        {(isMyChoice || voters.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-amber-200/60">
                            {voters.map((v) => (
                              <span
                                key={v.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white border border-amber-200 text-[10px] font-black text-[#24141D]"
                              >
                                <CharacterAvatar
                                  avatarId={v.avatar}
                                  backgroundColor={v.avatarBg}
                                  size={16}
                                  interactive={false}
                                />
                                <span>{v.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Controls Footer */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {isOnline ? (
                    isHost ? (
                      <button
                        onClick={() => {
                          SoundFX.playTileSelect();
                          onSendAction?.({ type: 'barrah_finalize_category' });
                        }}
                        className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black text-base shadow-lg shadow-orange-500/20 cursor-pointer"
                      >
                        اعتماد الأعلى تصويتاً وبدء البطاقات الآن 🕵️
                      </button>
                    ) : (
                      <div className="px-5 py-3 rounded-2xl bg-[#FFF8EE] border border-amber-200 text-xs font-black text-[#5C4350]">
                        {myVote
                          ? 'تم تسجيل صوتك! يمكنك تغييره قبل انتهاء العداد أو اكتمال الأصوات...'
                          : 'اضغط على القسم الذي تفضله للتصويت 👆'}
                      </div>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => startOfflineWithCategory('random_all')}
                        className="px-6 py-3 rounded-2xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-300 text-[#24141D] font-black text-xs cursor-pointer"
                      >
                        🎲 اختيار عشوائي فوري وتخطي التصويت
                      </button>
                      <button
                        onClick={() => setOfflinePhase('setup')}
                        className="px-5 py-3 rounded-2xl bg-white hover:bg-amber-50 border border-amber-200 text-[#6B4F5E] font-black text-xs cursor-pointer"
                      >
                        تعديل اللاعبين
                      </button>
                    </>
                  )}
                </div>
              </>
            );
          })()}
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
          <div className="flex flex-wrap items-center justify-center gap-3">
            {(!isOnline || isHost) && (
              <button
                onClick={() => {
                  SoundFX.playClick();
                  if (isOnline) {
                    onSendAction?.({ type: 'barrah_restart_vote' });
                  } else {
                    setOfflineCategoryVotes({});
                    setVoteCatTurnIdx(0);
                    setOfflinePhase('category_vote');
                  }
                }}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black inline-flex items-center gap-2 shadow-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>جولة جديدة (تصويت السالفة)</span>
              </button>
            )}
            {isOnline && (
              <button
                onClick={() => {
                  SoundFX.playClick();
                  onSendAction?.({ type: 'return_to_lobby' });
                }}
                className="px-6 py-3.5 rounded-2xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-[#24141D] font-black text-sm cursor-pointer"
              >
                العودة للوبي الغرفة
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
