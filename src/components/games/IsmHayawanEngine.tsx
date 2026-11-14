import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Gavel,
  Hand,
  OctagonAlert,
  Plus,
  RotateCcw,
  Trophy,
  ArrowLeft,
  Check,
  X,
  UserPlus,
} from 'lucide-react';
import { IsmFieldKey, IsmPlayerAnswers, RoomState } from '../../types/jamr';
import { ARABIC_LETTERS } from '../../data/huroofBank';
import { computeIsmScores, pickUnusedArabicLetter } from '../../shared/roomEngine';
import { SoundFX } from '../../utils/soundFx';

interface IsmHayawanEngineProps {
  mode: 'offline' | 'online';
  playerName: string;
  room?: RoomState | null;
  localPlayerId?: string;
  onSendAction?: (payload: Record<string, unknown>) => void;
  onExit: () => void;
}

const FIELDS: Array<{ key: IsmFieldKey; label: string; placeholder: string }> = [
  { key: 'name', label: 'اسم', placeholder: 'اسم إنسان...' },
  { key: 'animal', label: 'حيوان', placeholder: 'حيوان أو طائر...' },
  { key: 'plant', label: 'نبات', placeholder: 'نبات أو فاكهة...' },
  { key: 'object', label: 'جماد', placeholder: 'شيء جامد...' },
  { key: 'country', label: 'بلاد', placeholder: 'دولة أو مدينة...' },
];

const EMPTY_ANSWERS: IsmPlayerAnswers = {
  name: '',
  animal: '',
  plant: '',
  object: '',
  country: '',
};

export const IsmHayawanEngine: React.FC<IsmHayawanEngineProps> = ({
  mode,
  playerName,
  room,
  localPlayerId,
  onSendAction,
  onExit,
}) => {
  const isOnline = mode === 'online' && Boolean(room);
  const ism = room?.ismHayawan;

  // Offline state
  const [offlinePhase, setOfflinePhase] = useState<'lobby' | 'letter_spin' | 'writing' | 'scoring' | 'leaderboard' | 'game_over'>('lobby');
  const [offlineRounds, setOfflineRounds] = useState(5);
  const [offlineCurrentRound, setOfflineCurrentRound] = useState(1);
  const [offlineIsJudge, setOfflineIsJudge] = useState(false);
  const [offlinePlayers, setOfflinePlayers] = useState<Array<{ id: string; name: string; score: number }>>([
    { id: 'p1', name: playerName || 'اللاعب 1', score: 0 },
    { id: 'p2', name: 'اللاعب 2', score: 0 },
  ]);
  const [newOfflinePlayer, setNewOfflinePlayer] = useState('');
  const [offlineLetter, setOfflineLetter] = useState('أ');
  const [usedLetters, setUsedLetters] = useState<string[]>([]);
  const [offlineAnswersByPlayer, setOfflineAnswersByPlayer] = useState<Record<string, IsmPlayerAnswers>>({});
  const [offlineActiveTurnIdx, setOfflineActiveTurnIdx] = useState(0);
  const [offlineFieldScores, setOfflineFieldScores] = useState<Record<string, Record<IsmFieldKey, number>>>({});
  const [offlineRoundTotals, setOfflineRoundTotals] = useState<Record<string, number>>({});

  // Shared UI states
  const [myAnswers, setMyAnswers] = useState<IsmPlayerAnswers>({ ...EMPTY_ANSWERS });
  const [spinPreviewLetter, setSpinPreviewLetter] = useState('أ');
  const [isSpinning, setIsSpinning] = useState(false);

  const phase = isOnline && ism ? ism.phase : offlinePhase;
  const isHost = isOnline ? room?.hostId === localPlayerId : true;
  const isJudgeMode = isOnline && ism ? ism.isJudgeRoom : offlineIsJudge;
  const isLocalJudge = isOnline && ism ? ism.isJudgeRoom && ism.judgeId === localPlayerId : offlineIsJudge;

  // Reset local inputs on round / letter spin
  useEffect(() => {
    if (phase === 'letter_spin') {
      setMyAnswers({ ...EMPTY_ANSWERS });
      setSpinPreviewLetter(ARABIC_LETTERS[0]);
    }
  }, [phase]);

  // Sync typing answers online
  useEffect(() => {
    if (!isOnline || phase !== 'writing' || isLocalJudge) return;
    const t = window.setTimeout(() => {
      onSendAction?.({ type: 'ism_hayawan_sync_answers', answers: myAnswers });
    }, 350);
    return () => clearTimeout(t);
  }, [myAnswers, isOnline, phase, isLocalJudge, onSendAction]);

  // Victory confetti
  useEffect(() => {
    if (phase === 'game_over') {
      SoundFX.playVictory();
      void confetti({ particleCount: 95, spread: 80, origin: { y: 0.6 } });
    }
  }, [phase]);

  const handleSpinWheel = () => {
    if (isSpinning) return;
    SoundFX.playTileSelect();
    setIsSpinning(true);
    let ticks = 0;
    const finalLetter = pickUnusedArabicLetter(isOnline && ism ? ism.usedLetters : usedLetters);
    const interval = window.setInterval(() => {
      ticks += 1;
      setSpinPreviewLetter(ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)]);
      SoundFX.playTick(ticks > 14);
      if (ticks >= 18) {
        clearInterval(interval);
        setSpinPreviewLetter(finalLetter);
        setIsSpinning(false);
        SoundFX.playCorrect();
        if (isOnline) {
          onSendAction?.({ type: 'ism_hayawan_set_letter', letter: finalLetter });
        } else {
          setOfflineLetter(finalLetter);
          setUsedLetters((u) => [...u, finalLetter]);
          setOfflineAnswersByPlayer({});
          setOfflineActiveTurnIdx(0);
          setMyAnswers({ ...EMPTY_ANSWERS });
          setOfflinePhase('writing');
        }
      }
    }, 90);
  };

  const handleOfflineStop = () => {
    SoundFX.playGong();
    const currentPlayer = offlinePlayers[offlineActiveTurnIdx];
    const updatedMap = {
      ...offlineAnswersByPlayer,
      [currentPlayer.id]: myAnswers,
    };
    setOfflineAnswersByPlayer(updatedMap);

    if (offlineActiveTurnIdx + 1 < offlinePlayers.length) {
      setOfflineActiveTurnIdx(offlineActiveTurnIdx + 1);
      setMyAnswers({ ...EMPTY_ANSWERS });
      return;
    }

    const fakeState = {
      phase: 'scoring' as const,
      currentRound: offlineCurrentRound,
      totalRounds: offlineRounds,
      currentLetter: offlineLetter,
      usedLetters,
      stoppedByPlayerName: currentPlayer.name,
      answersByPlayer: updatedMap,
      fieldScoresByPlayer: {},
      roundTotalsByPlayer: {},
      disputes: [],
      isJudgeRoom: offlineIsJudge,
      judgeId: null,
    };
    const fakePlayers = offlinePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: '🔥',
      isHost: false,
      isReady: true,
      score: p.score,
      connected: true,
    }));
    const { fieldScoresByPlayer, roundTotalsByPlayer } = computeIsmScores(fakeState, fakePlayers);
    setOfflineFieldScores(fieldScoresByPlayer);
    setOfflineRoundTotals(roundTotalsByPlayer);
    setOfflinePlayers((prev) =>
      prev.map((p) => ({ ...p, score: p.score + (roundTotalsByPlayer[p.id] || 0) }))
    );
    setOfflinePhase('scoring');
  };

  const adjustOfflineScore = (playerId: string, delta: number) => {
    SoundFX.playClick();
    setOfflinePlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, score: Math.max(0, p.score + delta) } : p))
    );
    setOfflineRoundTotals((prev) => ({
      ...prev,
      [playerId]: Math.max(0, (prev[playerId] || 0) + delta),
    }));
  };

  const displayPlayers = isOnline && room
    ? room.players.filter((p) => !p.isJudge)
    : offlinePlayers;
  const activeLetter = isOnline && ism ? ism.currentLetter : offlineLetter;
  const activeRoundNum = isOnline && ism ? ism.currentRound : offlineCurrentRound;
  const totalRoundsCount = isOnline && ism ? ism.totalRounds : offlineRounds;
  const scoresMap = isOnline && ism ? ism.fieldScoresByPlayer : offlineFieldScores;
  const roundTotalsMap = isOnline && ism ? ism.roundTotalsByPlayer : offlineRoundTotals;
  const answersMap = isOnline && ism ? ism.answersByPlayer : offlineAnswersByPlayer;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#130b22] border border-amber-500/30 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-2xl shadow">
            🔤
          </div>
          <div>
            <h1 className="text-xl font-black text-white">اسم حيوان نبات جماد بلاد</h1>
            <p className="text-xs text-amber-300 font-bold tabular-nums">
              الجولة {activeRoundNum} من {totalRoundsCount} · {displayPlayers.length} لاعب
              {isJudgeMode ? ' · وضع الحكم مفعّل ⚖️' : ''}
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

      {/* PHASE 1: LOBBY (Offline setup or Online pre-spin) */}
      {phase === 'lobby' && (
        <div className="rounded-3xl bg-[#130b22] border border-white/10 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-lg font-black text-white">إعدادات المباراة</h2>
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-2 tabular-nums">
                  عدد الجولات: {offlineRounds} جولة
                </label>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={offlineRounds}
                  onChange={(e) => setOfflineRounds(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-[11px] text-slate-400 tabular-nums mt-1">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setOfflineIsJudge(!offlineIsJudge);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                  offlineIsJudge
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 font-black text-sm">
                  <Gavel className="w-5 h-5 text-amber-400" />
                  <span>{'{بكون حكم!}'} — تحكيم مباشر للجولات</span>
                </div>
                <span className="text-xs font-black">
                  {offlineIsJudge ? 'مفعّل ✅' : 'معطّل'}
                </span>
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-white">اللاعبون ({offlinePlayers.length})</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={15}
                  value={newOfflinePlayer}
                  onChange={(e) => setNewOfflinePlayer(e.target.value)}
                  placeholder="أضف لاعباً..."
                  className="flex-1 rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm text-white"
                />
                <button
                  onClick={() => {
                    if (!newOfflinePlayer.trim()) return;
                    SoundFX.playClick();
                    setOfflinePlayers((p) => [
                      ...p,
                      { id: `p_${Date.now()}`, name: newOfflinePlayer.trim(), score: 0 },
                    ]);
                    setNewOfflinePlayer('');
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {offlinePlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
                  >
                    <span>
                      {idx + 1}. {p.name}
                    </span>
                    {offlinePlayers.length > 2 && (
                      <button
                        onClick={() => setOfflinePlayers((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-rose-400 text-xs cursor-pointer"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              SoundFX.playTileSelect();
              setOfflineCurrentRound(1);
              setUsedLetters([]);
              setOfflinePhase('letter_spin');
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-500 text-slate-950 font-black text-lg cursor-pointer"
          >
            ابدأ التحدي وعجلة الحروف 🎡
          </button>
        </div>
      )}

      {/* PHASE 2: LETTER SPIN */}
      {phase === 'letter_spin' && (
        <div className="rounded-3xl bg-[#130b22] border border-amber-500/30 p-8 text-center space-y-6">
          <h2 className="text-2xl font-black text-white">عجلة الحروف الـ 28 — الجولة {activeRoundNum}</h2>
          <div className="relative w-44 h-44 mx-auto rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 p-1.5 shadow-2xl shadow-orange-500/30">
            <div className="w-full h-full rounded-full bg-[#0d0718] flex items-center justify-center">
              <span className={`text-7xl font-black text-amber-300 ${isSpinning ? 'scale-110' : ''} transition-transform`}>
                {spinPreviewLetter}
              </span>
            </div>
          </div>

          {isHost ? (
            <button
              disabled={isSpinning}
              onClick={handleSpinWheel}
              className="px-10 py-4 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 text-slate-950 font-black text-lg cursor-pointer disabled:opacity-60"
            >
              {isSpinning ? 'جاري السحب...' : 'أدر عجلة الحروف 🎡'}
            </button>
          ) : (
            <p className="text-sm text-slate-300 font-bold">بانتظار المضيف لتدوير عجلة الحروف...</p>
          )}
        </div>
      )}

      {/* PHASE 3: WRITING */}
      {phase === 'writing' && (
        <div className="rounded-3xl bg-[#130b22] border border-orange-500/30 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center text-4xl font-black shadow-lg">
                {activeLetter}
              </div>
              <div>
                <h2 className="text-xl font-black text-white">
                  {isOnline
                    ? `اكتبوا كلمات تبدأ بحرف (${activeLetter})`
                    : `دور اللاعب: ${offlinePlayers[offlineActiveTurnIdx]?.name}`}
                </h2>
                <p className="text-xs text-slate-400 font-readex">
                  أول من ينتهي يضغط ستوب لإيقاف الجولة فوراً!
                </p>
              </div>
            </div>

            {!isLocalJudge && (
              <button
                onClick={() => {
                  if (isOnline) {
                    SoundFX.playGong();
                    onSendAction?.({ type: 'ism_hayawan_stop', answers: myAnswers });
                  } else {
                    handleOfflineStop();
                  }
                }}
                className="px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-lg shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer animate-pulse"
              >
                <OctagonAlert className="w-6 h-6" />
                <span>🛑 ستوب!</span>
              </button>
            )}
          </div>

          {isLocalJudge ? (
            <div className="py-10 text-center space-y-3 rounded-2xl bg-white/5 border border-amber-500/20">
              <Gavel className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-xl font-black text-white">أنت حكم هذه الجولة ⚖️</h3>
              <p className="text-sm text-slate-300 font-readex">
                بانتظار اللاعبين للكتابة والضغط على ستوب لفتح لوحة التحكيم المباشرة...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="block text-xs font-black text-amber-300">{f.label}</label>
                  <input
                    type="text"
                    value={myAnswers[f.key]}
                    onChange={(e) =>
                      setMyAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    placeholder={`${activeLetter}... (${f.placeholder})`}
                    className="w-full rounded-xl bg-black/45 border border-white/15 focus:border-orange-500 px-3.5 py-3 text-white text-sm font-bold focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PHASE 4: SCORING */}
      {phase === 'scoring' && (
        <div className="space-y-5">
          {isOnline && ism?.stoppedByPlayerName && (
            <div className="rounded-2xl bg-rose-500/15 border border-rose-500/35 px-4 py-3 text-sm font-black text-rose-200 text-center">
              🛑 أوقف الجولة اللاعب: {ism.stoppedByPlayerName} — الحرف: ({activeLetter})
            </div>
          )}

          {/* Judge Live Control Bar */}
          {isJudgeMode && (isLocalJudge || !isOnline) && (
            <div className="rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
                <Gavel className="w-5 h-5" />
                <span>لوحة تحكم الحكم المباشرة ⚖️</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {displayPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-black/35 rounded-xl px-3 py-2 border border-white/10"
                  >
                    <span className="text-xs font-black text-white truncate max-w-[110px]">
                      {p.name} ({p.score})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          isOnline
                            ? onSendAction?.({ type: 'ism_hayawan_judge_score_adjust', targetPlayerId: p.id, delta: 5 })
                            : adjustOfflineScore(p.id, 5)
                        }
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-black cursor-pointer"
                      >
                        +5
                      </button>
                      <button
                        onClick={() =>
                          isOnline
                            ? onSendAction?.({ type: 'ism_hayawan_judge_score_adjust', targetPlayerId: p.id, delta: 10 })
                            : adjustOfflineScore(p.id, 10)
                        }
                        className="px-2 py-1 rounded-lg bg-emerald-500/30 text-emerald-200 text-xs font-black cursor-pointer"
                      >
                        +10
                      </button>
                      <button
                        onClick={() =>
                          isOnline
                            ? onSendAction?.({ type: 'ism_hayawan_judge_score_adjust', targetPlayerId: p.id, delta: -5 })
                            : adjustOfflineScore(p.id, -5)
                        }
                        className="px-2 py-1 rounded-lg bg-rose-500/25 text-rose-300 text-xs font-black cursor-pointer"
                      >
                        -5
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disputes Queue */}
          {isOnline && ism && ism.disputes.filter((d) => d.status === 'pending').length > 0 && (
            <div className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-4 space-y-2.5">
              <div className="text-sm font-black text-orange-300">✋ اعتراضات بانتظار التحكيم:</div>
              {ism.disputes
                .filter((d) => d.status === 'pending')
                .map((d) => {
                  const canResolve =
                    d.assignedReviewerId === localPlayerId || isLocalJudge || isHost;
                  return (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-black/35 rounded-xl px-4 py-2.5 border border-white/10 text-xs"
                    >
                      <div>
                        <span className="font-black text-white">{d.challengerName}</span> يعترض على كلمة{' '}
                        <span className="font-black text-amber-300">"{d.word}"</span> للاعب{' '}
                        <span className="font-black text-white">{d.targetPlayerName}</span>
                      </div>
                      {canResolve && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              SoundFX.playCorrect();
                              onSendAction?.({ type: 'ism_hayawan_resolve_dispute', disputeId: d.id, approved: true });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>صحيحة (+10)</span>
                          </button>
                          <button
                            onClick={() => {
                              SoundFX.playWrong();
                              onSendAction?.({ type: 'ism_hayawan_resolve_dispute', disputeId: d.id, approved: false });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>خاطئة (0 نقطة)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Scoring Matrix Table */}
          <div className="rounded-3xl bg-[#130b22] border border-white/10 overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-black/40 text-amber-300 text-xs">
                <tr>
                  <th className="p-3.5">اللاعب</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="p-3.5">{f.label}</th>
                  ))}
                  <th className="p-3.5">نقاط الجولة</th>
                  <th className="p-3.5">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {displayPlayers.map((p) => {
                  const ans = answersMap[p.id] || EMPTY_ANSWERS;
                  const fScores = scoresMap[p.id] || { name: 0, animal: 0, plant: 0, object: 0, country: 0 };
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="p-3.5 font-black text-white">{p.name}</td>
                      {FIELDS.map((f) => {
                        const word = ans[f.key] || '—';
                        const pts = fScores[f.key] || 0;
                        return (
                          <td key={f.key} className="p-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-bold text-slate-200">{word}</div>
                                <div
                                  className={`text-[11px] font-black tabular-nums ${
                                    pts === 10
                                      ? 'text-emerald-400'
                                      : pts === 5
                                        ? 'text-amber-400'
                                        : 'text-rose-400'
                                  }`}
                                >
                                  +{pts}
                                </div>
                              </div>
                              {isOnline && ans[f.key] && (
                                <button
                                  onClick={() => {
                                    SoundFX.playClick();
                                    onSendAction?.({
                                      type: 'ism_hayawan_dispute',
                                      targetPlayerId: p.id,
                                      field: f.key,
                                      word: ans[f.key],
                                    });
                                  }}
                                  title="رفع اعتراض"
                                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-orange-500/20 text-[11px] text-orange-300 cursor-pointer shrink-0 flex items-center gap-1"
                                >
                                  <Hand className="w-3 h-3" />
                                  <span>اعتراض</span>
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-3.5 font-black text-amber-300 tabular-nums">
                        +{roundTotalsMap[p.id] || 0}
                      </td>
                      <td className="p-3.5 font-black text-emerald-400 tabular-nums">{p.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isHost && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  SoundFX.playTileSelect();
                  if (isOnline) {
                    onSendAction?.({ type: 'ism_hayawan_next_round' });
                  } else if (offlineCurrentRound >= offlineRounds) {
                    setOfflinePhase('game_over');
                  } else {
                    setOfflineCurrentRound((r) => r + 1);
                    setOfflinePhase('letter_spin');
                  }
                }}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-500 text-slate-950 font-black text-base flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>
                  {activeRoundNum >= totalRoundsCount ? 'عرض النتائج النهائية 🏆' : 'الجولة التالية ➔'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* PHASE 6: GAME OVER */}
      {phase === 'game_over' && (
        <div className="rounded-3xl bg-[#130b22] border border-amber-500/35 p-8 text-center space-y-6">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
          <h2 className="text-3xl font-black text-white">انتهت المنافسة! الترتيب النهائي 🏆</h2>

          <div className="max-w-lg mx-auto space-y-3">
            {[...displayPlayers]
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border ${
                    idx === 0
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-white/5 border-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 font-black">
                    <span className="text-lg tabular-nums">#{idx + 1}</span>
                    <span>{p.name}</span>
                  </div>
                  <span className="font-black text-lg tabular-nums">{p.score} نقطة</span>
                </div>
              ))}
          </div>

          <button
            onClick={() => {
              SoundFX.playClick();
              if (isOnline) {
                onSendAction?.({ type: 'return_to_lobby' });
              } else {
                setOfflinePlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
                setOfflinePhase('lobby');
              }
            }}
            className="px-8 py-3.5 rounded-2xl bg-orange-500 text-slate-950 font-black text-base inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>العب مرة ثانية</span>
          </button>
        </div>
      )}
    </div>
  );
};
