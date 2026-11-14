import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
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
} from 'lucide-react';
import { BarrahCategory, RoomState } from '../../types/jamr';
import { SoundFX } from '../../utils/soundFx';

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

  const [voteTurnIdx, setVoteTurnIdx] = useState(0);
  const [offlineVotes, setOfflineVotes] = useState<Record<string, string>>({});
  const [offlineWinner, setOfflineWinner] = useState<'insiders' | 'spy' | null>(null);
  const [spyGuessWord, setSpyGuessWord] = useState<string | null>(null);
  const [finalTimer, setFinalTimer] = useState(25);

  const activePhase = isOnline && br ? br.phase : offlinePhase;
  const isHost = isOnline ? room?.hostId === localPlayerId : true;

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
    if (activePhase === 'results') {
      SoundFX.playVictory();
      void confetti({ particleCount: 85, spread: 75, origin: { y: 0.6 } });
    }
  }, [activePhase]);

  const startOfflineGame = () => {
    if (offlinePlayers.length < 3 || categories.length === 0) return;
    SoundFX.playTileSelect();
    const pool =
      selectedCatId === 'random_all'
        ? categories
        : categories.filter((c) => c.id === selectedCatId);
    const chosenCat = pool[Math.floor(Math.random() * pool.length)] || categories[0];
    const shuffledWords = [...chosenCat.words].sort(() => Math.random() - 0.5);
    const word = shuffledWords[0] || 'قهوة عربية';
    const otherWords = Array.from(
      new Set(categories.flatMap((c) => c.words).filter((w) => w !== word))
    ).sort(() => Math.random() - 0.5);
    const eightOptions = Array.from(new Set([word, ...shuffledWords.slice(1, 8), ...otherWords]))
      .slice(0, 8)
      .sort(() => Math.random() - 0.5);

    const spy = offlinePlayers[Math.floor(Math.random() * offlinePlayers.length)];
    setCategoryName(chosenCat.name);
    setSecretWord(word);
    setDistractors(eightOptions);
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
    SoundFX.playClick();
    const pair = [...offlinePlayers].sort(() => Math.random() - 0.5);
    setAskerName(pair[0]?.name || '');
    setAnswererName(pair[1]?.name || '');
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

  const displayPlayers = isOnline && room ? room.players : offlinePlayers;
  const activeSpyId = isOnline && br ? br.spyId : spyId;
  const activeSpyName = displayPlayers.find((p) => p.id === activeSpyId)?.name || 'الجاسوس';
  const activeWord = isOnline && br ? br.secretWord : secretWord;
  const activeCatName = isOnline && br ? br.categoryName : categoryName;
  const activeOptions = isOnline && br ? br.distractorWords : distractors;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between rounded-2xl bg-[#130b22] border border-cyan-500/30 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center text-2xl">
            🕵️
          </div>
          <div>
            <h1 className="text-xl font-black text-white">برا السالفة</h1>
            <p className="text-xs text-cyan-300 font-bold">
              {activeCatName ? `القسم: ${activeCatName}` : 'اختر القسم وكشف الجاسوس'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            SoundFX.playClick();
            onExit();
          }}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-black text-white flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </div>

      {/* PHASE 1: SETUP */}
      {activePhase === 'setup' && (
        <div className="rounded-3xl bg-[#130b22] border border-white/10 p-6 space-y-6">
          {/* Player Roster */}
          {!isOnline && (
            <div className="space-y-3">
              <h2 className="text-lg font-black text-white">اللاعبون ({offlinePlayers.length}) — الحد الأدنى 3</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={15}
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="أضف اسم لاعب..."
                  className="flex-1 rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-sm text-white"
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
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {offlinePlayers.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-black text-white"
                  >
                    <span>{p.name}</span>
                    {offlinePlayers.length > 3 && (
                      <button
                        onClick={() => setOfflinePlayers((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-rose-400 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 20 Categories Picker */}
          <div className="space-y-3">
            <h2 className="text-lg font-black text-white">اختر القسم ({categories.length} قسم متاح)</h2>
            <button
              onClick={() => {
                SoundFX.playClick();
                setSelectedCatId('random_all');
              }}
              className={`w-full p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                selectedCatId === 'random_all'
                  ? 'bg-cyan-500/20 border-cyan-400 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              <div>
                <div className="font-black text-base">🎲 عشوائي من جميع الأقسام</div>
                <div className="text-xs text-slate-300 font-readex mt-0.5">
                  يختار النظام قسماً وكلمة سرية مفاجئة في كل جولة
                </div>
              </div>
              {selectedCatId === 'random_all' && <span className="text-cyan-300 font-black text-xs">مختار ✅</span>}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    SoundFX.playClick();
                    setSelectedCatId(cat.id);
                  }}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                    selectedCatId === cat.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className="font-black text-sm flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-readex mt-1">{cat.description}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={offlinePlayers.length < 3}
            onClick={startOfflineGame}
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-cyan-400 to-sky-500 text-slate-950 font-black text-lg cursor-pointer"
          >
            ابدأ توزيع البطاقات 🕵️
          </button>
        </div>
      )}

      {/* PHASE 2: REVEAL CARDS */}
      {activePhase === 'reveal_cards' && (
        <div className="rounded-3xl bg-[#130b22] border border-cyan-500/30 p-8 text-center space-y-6">
          {isOnline && br ? (
            <>
              <div className="text-4xl">🤫</div>
              <h2 className="text-2xl font-black text-white">بطاقتك السرية</h2>
              {localPlayerId === br.spyId ? (
                <div className="rounded-2xl bg-rose-500/20 border-2 border-rose-500 p-6 space-y-2 max-w-md mx-auto">
                  <div className="text-xl font-black text-rose-200">
                    أنت برا السالفة فقط! — ما عندك سالفة نهائياً 🤫
                  </div>
                  <p className="text-xs text-rose-200/80 font-readex">
                    التصنيف هو ({br.categoryName}). حاول تفهم الكلمة من أسئلتهم بدون ما ينتبهون!
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 p-6 space-y-2 max-w-md mx-auto">
                  <div className="text-xs font-bold text-emerald-300">التصنيف: {br.categoryName}</div>
                  <div className="text-3xl font-black text-white">{br.secretWord}</div>
                </div>
              )}

              {!br.revealedPlayerIds.includes(localPlayerId || '') ? (
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    onSendAction?.({ type: 'barrah_mark_revealed' });
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-cyan-500 text-slate-950 font-black cursor-pointer"
                >
                  حفظت دوري ✅
                </button>
              ) : (
                <p className="text-sm font-bold text-slate-300">
                  بانتظار البقية ({br.revealedPlayerIds.length}/{displayPlayers.length})...
                </p>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-black text-cyan-300 tabular-nums">
                لاعب {revealIdx + 1} من {offlinePlayers.length}
              </div>
              <h2 className="text-3xl font-black text-white">
                اعطوا الجوال لـ: <span className="text-cyan-400">{offlinePlayers[revealIdx]?.name}</span>
              </h2>

              {!cardFlipped ? (
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    setCardFlipped(true);
                  }}
                  className="px-8 py-4 rounded-2xl bg-cyan-500 text-slate-950 font-black text-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="w-5 h-5" />
                  <span>اكشف بطاقتي</span>
                </button>
              ) : (
                <div className="space-y-5 max-w-md mx-auto">
                  {offlinePlayers[revealIdx]?.id === spyId ? (
                    <div className="rounded-2xl bg-rose-500/20 border-2 border-rose-500 p-6 space-y-2">
                      <div className="text-xl font-black text-rose-200">
                        أنت برا السالفة فقط! — ما عندك سالفة نهائياً 🤫
                      </div>
                      <p className="text-xs text-rose-200/80 font-readex">
                        انتبه: التصنيف ({categoryName}) — لا تفضح نفسك!
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 p-6 space-y-2">
                      <div className="text-xs font-bold text-emerald-300">التصنيف: {categoryName}</div>
                      <div className="text-3xl font-black text-white">{secretWord}</div>
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
                    className="w-full py-3.5 rounded-2xl bg-white/15 hover:bg-white/20 text-white font-black inline-flex items-center justify-center gap-2 cursor-pointer"
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

      {/* PHASE 3: QUESTIONS STAGE */}
      {activePhase === 'questions_stage' && (
        <div className="rounded-3xl bg-[#130b22] border border-cyan-500/30 p-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-black">
            <Sparkles className="w-4 h-4" />
            <span>القاعدة الذهبية: اسأل سؤالاً ذكياً لا يكشف الكلمة للي برا السالفة!</span>
          </div>

          <div className="rounded-2xl bg-black/40 border border-white/15 p-6 max-w-lg mx-auto space-y-3">
            <div className="text-xs font-bold text-slate-400">قرعة الأسئلة العشوائية</div>
            <div className="text-2xl sm:text-3xl font-black text-white flex flex-wrap items-center justify-center gap-3">
              <span className="text-cyan-300">
                السائل 🗣️:{' '}
                {isOnline && br
                  ? displayPlayers.find((p) => p.id === br.askerId)?.name
                  : askerName}
              </span>
              <span>➔</span>
              <span className="text-amber-300">
                المجيب 🎯:{' '}
                {isOnline && br
                  ? displayPlayers.find((p) => p.id === br.answererId)?.name
                  : answererName}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                if (isOnline) {
                  SoundFX.playClick();
                  onSendAction?.({ type: 'barrah_next_pair' });
                } else {
                  spinOfflinePair();
                }
              }}
              className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Shuffle className="w-4 h-4 text-cyan-400" />
              <span>اسحب ثنائي آخر</span>
            </button>

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
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-rose-500 to-orange-500 text-white font-black text-base inline-flex items-center gap-2 cursor-pointer"
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
        <div className="rounded-3xl bg-[#130b22] border border-rose-500/30 p-8 text-center space-y-6">
          {isOnline && br ? (
            br.votesByVoter[localPlayerId || ''] ? (
              <div className="space-y-3 py-6">
                <div className="text-4xl">🗳️</div>
                <h3 className="text-xl font-black text-white">تم تسجيل صوتك بسرية!</h3>
                <p className="text-sm text-slate-300">
                  بانتظار بقية المصوتين ({Object.keys(br.votesByVoter).length}/{displayPlayers.length})...
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white">من تعتقد أنه برا السالفة؟ 🕵️</h2>
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
                        className="p-4 rounded-2xl bg-white/10 hover:bg-rose-500/25 border border-white/15 font-black text-white cursor-pointer"
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              </>
            )
          ) : (
            <>
              <div className="text-xs font-black text-rose-300 tabular-nums">
                تصويت {voteTurnIdx + 1} من {offlinePlayers.length}
              </div>
              <h2 className="text-2xl font-black text-white">
                دور التصويت السري لـ: <span className="text-amber-300">{offlinePlayers[voteTurnIdx]?.name}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {offlinePlayers
                  .filter((p) => p.id !== offlinePlayers[voteTurnIdx]?.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => castOfflineVote(p.id)}
                      className="p-4 rounded-2xl bg-white/10 hover:bg-rose-500/25 border border-white/15 font-black text-white cursor-pointer"
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PHASE 5: FINAL CHANCE (25s + 8 options) */}
      {activePhase === 'final_chance' && (
        <div className="rounded-3xl bg-[#130b22] border-2 border-amber-400/60 p-6 sm:p-8 text-center space-y-6">
          <div className="text-lg font-black text-amber-300 tabular-nums">⏱️ {finalTimer} ثانية</div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            انكشف الجاسوس ({activeSpyName})! — الفرصة الأخيرة لسرقة الفوز 🎯
          </h2>
          <p className="text-sm text-slate-300 font-readex">
            إذا خمّن {activeSpyName} الكلمة السرية الصحيحة من بين الخيارات الـ 8 سيفوز بالجولة!
          </p>

          {(!isOnline || localPlayerId === activeSpyId) ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  className="py-4 px-3 rounded-2xl bg-white/10 hover:bg-amber-500 hover:text-slate-950 border border-white/15 font-black text-sm text-white transition-all cursor-pointer"
                >
                  {word}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-amber-300 font-black">
              بانتظار {activeSpyName} لاختيار الكلمة السرية...
            </div>
          )}
        </div>
      )}

      {/* PHASE 6: RESULTS */}
      {activePhase === 'results' && (
        <div className="rounded-3xl bg-[#130b22] border border-emerald-500/35 p-8 text-center space-y-6">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
          <h2 className="text-3xl font-black text-white">
            {(isOnline && br ? br.winner : offlineWinner) === 'spy'
              ? `فاز اللي برا السالفة (${activeSpyName})! 🕵️🔥`
              : 'فاز أهل السالفة وكشفوا الجاسوس! 🎉'}
          </h2>
          <div className="max-w-md mx-auto rounded-2xl bg-black/40 border border-white/15 p-5 space-y-2 text-sm">
            <div>
              اللي برا السالفة كان: <span className="font-black text-rose-400">{activeSpyName}</span>
            </div>
            <div>
              الكلمة السرية كانت: <span className="font-black text-emerald-400">{activeWord}</span>
            </div>
            {(isOnline ? br?.spyGuess : spyGuessWord) && (
              <div>
                تخمين الجاسوس: <span className="font-black text-amber-300">{isOnline ? br?.spyGuess : spyGuessWord}</span>
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
            className="px-8 py-3.5 rounded-2xl bg-cyan-500 text-slate-950 font-black inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>جولة جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
};
