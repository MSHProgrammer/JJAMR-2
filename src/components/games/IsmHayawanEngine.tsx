import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
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
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ListChecks,
  UserCheck,
  Loader2,
} from 'lucide-react';
import {
  IsmFieldEvaluation,
  IsmFieldKey,
  IsmPlayerAnswers,
  RoomState,
} from '../../types/jamr';
import { ARABIC_LETTERS } from '../../data/huroofBank';
import { computeIsmScores, pickUnusedArabicLetter } from '../../shared/roomEngine';
import { SoundFX } from '../../utils/soundFx';
import { CharacterAvatar } from '../CharacterAvatar';
import { useCharacterReaction } from '../../context/CharacterReactionContext';

interface IsmHayawanEngineProps {
  mode: 'offline' | 'online';
  playerName: string;
  room?: RoomState | null;
  localPlayerId?: string;
  onSendAction?: (payload: Record<string, unknown>) => void;
  onExit: () => void;
}

const FIELDS: Array<{ key: IsmFieldKey; label: string; emoji: string; placeholder: string }> = [
  { key: 'name', label: 'اسم', emoji: '👤', placeholder: 'اسم إنسان...' },
  { key: 'animal', label: 'حيوان', emoji: '🦁', placeholder: 'حيوان أو طائر...' },
  { key: 'plant', label: 'نبات', emoji: '🌿', placeholder: 'نبات أو فاكهة...' },
  { key: 'object', label: 'جماد', emoji: '🪑', placeholder: 'شيء جامد...' },
  { key: 'country', label: 'بلاد', emoji: '🌍', placeholder: 'دولة أو مدينة...' },
];

const EMPTY_ANSWERS: IsmPlayerAnswers = {
  name: '',
  animal: '',
  plant: '',
  object: '',
  country: '',
};

const SOURCE_BADGE: Record<IsmFieldEvaluation['source'], { label: string; cls: string }> = {
  gemini_ai: { label: '🤖 ذكاء اصطناعي موثّق', cls: 'bg-violet-100 text-violet-900 border-violet-300' },
  saudi: { label: '🇸🇦 لهجة سعودية', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  fusha: { label: '📖 فهرس عربي', cls: 'bg-sky-100 text-sky-900 border-sky-300' },
  manual: { label: '⚖️ تقييم يدوي', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  rejected: { label: '❌ غير مقبولة', cls: 'bg-rose-100 text-rose-900 border-rose-300' },
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
  const { triggerReaction } = useCharacterReaction();

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
  const [offlineReasonsByPlayer, setOfflineReasonsByPlayer] = useState<
    Record<string, Record<IsmFieldKey, IsmFieldEvaluation>>
  >({});
  const [offlineAnalyzedBy, setOfflineAnalyzedBy] = useState<'gemini_ai' | 'saudi_arabic_index' | 'manual'>(
    'saudi_arabic_index'
  );

  // Shared UI states
  const [myAnswers, setMyAnswers] = useState<IsmPlayerAnswers>({ ...EMPTY_ANSWERS });
  const [spinPreviewLetter, setSpinPreviewLetter] = useState('أ');
  const [isSpinning, setIsSpinning] = useState(false);

  // Scoring review states (section by section + person by person for <= 7 players)
  const [scoringStepIdx, setScoringStepIdx] = useState(0); // 0..4 => FIELDS, 5 => Round Summary
  const [reviewPlayerIdx, setReviewPlayerIdx] = useState(0);
  const [showSectionTable, setShowSectionTable] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const analyzedKeyRef = useRef<string>('');

  const phase = isOnline && ism ? ism.phase : offlinePhase;
  const isHost = isOnline ? room?.hostId === localPlayerId : true;
  const isJudgeMode = isOnline && ism ? ism.isJudgeRoom : offlineIsJudge;
  const isLocalJudge = isOnline && ism ? ism.isJudgeRoom && ism.judgeId === localPlayerId : offlineIsJudge;

  const displayPlayers = isOnline && room
    ? room.players.filter((p) => !p.isJudge)
    : offlinePlayers;
  const activeLetter = isOnline && ism ? ism.currentLetter : offlineLetter;
  const activeRoundNum = isOnline && ism ? ism.currentRound : offlineCurrentRound;
  const totalRoundsCount = isOnline && ism ? ism.totalRounds : offlineRounds;
  const scoresMap = isOnline && ism ? ism.fieldScoresByPlayer : offlineFieldScores;
  const roundTotalsMap = isOnline && ism ? ism.roundTotalsByPlayer : offlineRoundTotals;
  const answersMap = isOnline && ism ? ism.answersByPlayer : offlineAnswersByPlayer;
  const reasonsMap = (isOnline && ism ? ism.reasonsByPlayer : offlineReasonsByPlayer) || {};
  const analyzedBy = (isOnline && ism ? ism.analyzedBy : offlineAnalyzedBy) || 'saudi_arabic_index';

  const filledFieldsCount = FIELDS.filter((f) => myAnswers[f.key].trim().length > 0).length;
  const allFieldsFilled = filledFieldsCount === FIELDS.length;

  const isSmallGroup = displayPlayers.length <= 7;
  const isLargeAiGroup = displayPlayers.length > 10;

  // Reset local inputs on round / letter spin
  useEffect(() => {
    if (phase === 'letter_spin') {
      setMyAnswers({ ...EMPTY_ANSWERS });
      setSpinPreviewLetter(ARABIC_LETTERS[0]);
      setScoringStepIdx(0);
      setReviewPlayerIdx(0);
      analyzedKeyRef.current = '';
    }
  }, [phase]);

  // Reset scoring step when scoring starts
  useEffect(() => {
    if (phase === 'scoring') {
      setScoringStepIdx(0);
      setReviewPlayerIdx(0);
      setShowSectionTable(displayPlayers.length > 7);
    }
  }, [phase, activeRoundNum, displayPlayers.length]);

  // Automatically invoke real Gemini AI + Saudi/Arabic dictionary analysis when >10 players enter scoring
  useEffect(() => {
    if (phase !== 'scoring') return;
    if (!isLargeAiGroup) return;
    if (isOnline && !isHost) return;

    const sig = `${activeRoundNum}_${activeLetter}_${displayPlayers.length}`;
    if (analyzedKeyRef.current === sig) return;
    analyzedKeyRef.current = sig;

    const runAi = async () => {
      setAiAnalyzing(true);
      try {
        const res = await fetch('/api/ism/analyze-answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            letter: activeLetter,
            players: displayPlayers.map((p) => ({ id: p.id, name: p.name })),
            answersByPlayer: answersMap,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok) {
          if (isOnline) {
            onSendAction?.({
              type: 'ism_hayawan_apply_ai_analysis',
              fieldScoresByPlayer: data.fieldScoresByPlayer,
              roundTotalsByPlayer: data.roundTotalsByPlayer,
              reasonsByPlayer: data.reasonsByPlayer,
              analyzedBy: data.analyzedBy,
            });
          } else {
            const nextTotals = data.roundTotalsByPlayer as Record<string, number>;
            const prevTotals = offlineRoundTotals;
            setOfflineFieldScores(data.fieldScoresByPlayer);
            setOfflineRoundTotals(nextTotals);
            setOfflineReasonsByPlayer(data.reasonsByPlayer || {});
            setOfflineAnalyzedBy(data.analyzedBy || 'gemini_ai');
            setOfflinePlayers((prev) =>
              prev.map((p) => ({
                ...p,
                score: Math.max(0, p.score - (prevTotals[p.id] || 0) + (nextTotals[p.id] || 0)),
              }))
            );
          }
        }
      } catch {
        // Fallback already computed via Saudi/Arabic dictionary index
      } finally {
        setAiAnalyzing(false);
      }
    };

    void runAi();
  }, [phase, isLargeAiGroup, isOnline, isHost, activeRoundNum, activeLetter, displayPlayers, answersMap]);

  // Sync typing answers online
  useEffect(() => {
    if (!isOnline || phase !== 'writing' || isLocalJudge) return;
    const t = window.setTimeout(() => {
      onSendAction?.({ type: 'ism_hayawan_sync_answers', answers: myAnswers });
    }, 320);
    return () => clearTimeout(t);
  }, [myAnswers, isOnline, phase, isLocalJudge, onSendAction]);

  // Scoring & Victory reactions
  useEffect(() => {
    if (phase === 'scoring') {
      if (isOnline && localPlayerId) {
        const myRound = roundTotalsMap[localPlayerId] || 0;
        if (myRound >= 35) {
          triggerReaction('win', `جولة نار! +${myRound} 🔥`, 2800);
        } else if (myRound <= 10) {
          triggerReaction('lose', 'شد حيلك الجاية! 😅', 2400);
        } else {
          triggerReaction('excited', `+${myRound} نقطة! 👏`, 2200);
        }
      } else {
        triggerReaction('excited', 'نتائج الجولة! 📊', 2200);
      }
    } else if (phase === 'game_over') {
      SoundFX.playVictory();
      void confetti({ particleCount: 95, spread: 80, origin: { y: 0.6 } });
      const sorted = [...displayPlayers].sort((a, b) => b.score - a.score);
      const myRank = isOnline && localPlayerId ? sorted.findIndex((p) => p.id === localPlayerId) : 0;
      if (isOnline && localPlayerId && myRank > Math.max(0, Math.floor(sorted.length / 2))) {
        triggerReaction('lose', `المركز #${myRank + 1} معوّضة! 😅`, 3400);
      } else {
        triggerReaction('win', 'أبطال الحروف! 🏆', 3400);
      }
    }
  }, [phase, activeRoundNum]);

  const handleSpinWheel = () => {
    if (isSpinning) return;
    SoundFX.playTileSelect();
    triggerReaction('excited', 'يدور الحرف! 🎡', 1800);
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
        triggerReaction('picking_game', `حرف (${finalLetter})! ✍️`, 2000);
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
    if (!allFieldsFilled) return;
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
    const fakePlayers = offlinePlayers.map((p, i) => ({
      id: p.id,
      name: p.name,
      avatar: `char_${String((i % 10) + 1).padStart(2, '0')}`,
      isHost: false,
      isReady: true,
      score: p.score,
      connected: true,
    }));
    const { fieldScoresByPlayer, roundTotalsByPlayer, reasonsByPlayer } = computeIsmScores(
      fakeState,
      fakePlayers
    );
    setOfflineFieldScores(fieldScoresByPlayer);
    setOfflineRoundTotals(roundTotalsByPlayer);
    setOfflineReasonsByPlayer(reasonsByPlayer);
    setOfflineAnalyzedBy('saudi_arabic_index');
    setOfflinePlayers((prev) =>
      prev.map((p) => ({ ...p, score: p.score + (roundTotalsByPlayer[p.id] || 0) }))
    );
    setOfflinePhase('scoring');
  };

  const setOfflineFieldScore = (playerId: string, field: IsmFieldKey, points: number) => {
    SoundFX.playClick();
    const oldPts = offlineFieldScores[playerId]?.[field] || 0;
    const delta = points - oldPts;

    setOfflineFieldScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || { name: 0, animal: 0, plant: 0, object: 0, country: 0 }),
        [field]: points,
      },
    }));
    setOfflineRoundTotals((prev) => ({
      ...prev,
      [playerId]: Math.max(0, (prev[playerId] || 0) + delta),
    }));
    setOfflinePlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, score: Math.max(0, p.score + delta) } : p))
    );
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

  const updatePlayerFieldPoints = (playerId: string, field: IsmFieldKey, points: 0 | 5 | 10) => {
    if (isOnline) {
      SoundFX.playClick();
      onSendAction?.({
        type: 'ism_hayawan_set_field_score',
        targetPlayerId: playerId,
        field,
        points,
      });
    } else {
      setOfflineFieldScore(playerId, field, points);
    }
  };

  const currentField = FIELDS[scoringStepIdx] || null;
  const activeReviewPlayer = displayPlayers[reviewPlayerIdx] || displayPlayers[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 text-[#24141D]">
      {/* Joyful Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white border border-amber-200 p-4 shadow-[0_8px_24px_rgba(255,107,0,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFB703] to-[#FF6B00] flex items-center justify-center text-2xl shadow-sm">
            🔤
          </div>
          <div>
            <h1 className="text-xl font-black text-[#24141D]">اسم حيوان نبات جماد بلاد</h1>
            <p className="text-xs text-[#D9480F] font-bold tabular-nums">
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
          className="px-4 py-2.5 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-xs font-black text-[#24141D] flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </div>

      {/* PHASE 1: LOBBY (Offline setup) */}
      {phase === 'lobby' && (
        <div className="rounded-3xl bg-white border border-amber-200 p-6 space-y-6 shadow-[0_10px_28px_rgba(36,20,29,0.06)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-lg font-black text-[#24141D]">إعدادات المباراة</h2>
              <div>
                <label className="block text-xs font-bold text-[#D9480F] mb-2 tabular-nums">
                  عدد الجولات: {offlineRounds} جولة
                </label>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={offlineRounds}
                  onChange={(e) => setOfflineRounds(Number(e.target.value))}
                  className="w-full accent-[#FF6B00]"
                />
                <div className="flex justify-between text-[11px] text-[#6B4F5E] tabular-nums mt-1">
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
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  offlineIsJudge
                    ? 'bg-[#FFF3DF] border-[#FFB703] text-[#9A3412]'
                    : 'bg-[#FFFBF5] border-amber-200 text-[#4A3240]'
                }`}
              >
                <div className="flex items-center gap-2.5 font-black text-sm">
                  <Gavel className="w-5 h-5 text-[#FF6B00]" />
                  <span>بكون حكم! — تحكيم مباشر للجولات</span>
                </div>
                <span className="text-xs font-black">
                  {offlineIsJudge ? 'مفعّل ✅' : 'معطّل'}
                </span>
              </button>

              <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-4 text-xs font-bold text-[#5C4350] space-y-1 leading-relaxed">
                <div className="font-black text-[#D9480F]">⚡ تصحيح ذكي حسب حجم المجموعة:</div>
                <div>• حتى 7 لاعبين: عرض قسم قسم وشخص شخص لضحك ومراجعة أدق.</div>
                <div>• 8–10 لاعبين: فهرس عربي وفهرس اللهجة السعودية المدمج.</div>
                <div>• فوق 10 لاعبين: تحليل فوري بالذكاء الاصطناعي الحقيقي + الفهرس السعودي والعربي.</div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black text-[#24141D]">اللاعبون ({offlinePlayers.length})</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={15}
                  value={newOfflinePlayer}
                  onChange={(e) => setNewOfflinePlayer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newOfflinePlayer.trim() && offlinePlayers.length < 100) {
                      SoundFX.playClick();
                      setOfflinePlayers((p) => [
                        ...p,
                        { id: `p_${Date.now()}`, name: newOfflinePlayer.trim(), score: 0 },
                      ]);
                      setNewOfflinePlayer('');
                    }
                  }}
                  placeholder="أضف لاعباً..."
                  className="flex-1 rounded-xl bg-[#FFF8EE] border border-amber-300 px-3 py-2 text-sm font-bold text-[#24141D] focus:outline-none focus:border-[#FF6B00]"
                />
                <button
                  onClick={() => {
                    if (!newOfflinePlayer.trim() || offlinePlayers.length >= 100) return;
                    SoundFX.playClick();
                    setOfflinePlayers((p) => [
                      ...p,
                      { id: `p_${Date.now()}`, name: newOfflinePlayer.trim(), score: 0 },
                    ]);
                    setNewOfflinePlayer('');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e85d00] text-white font-black text-xs flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {offlinePlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFF8EE] border border-amber-200 text-sm font-bold"
                  >
                    <span>
                      {idx + 1}. {p.name}
                    </span>
                    {offlinePlayers.length > 2 && (
                      <button
                        onClick={() => setOfflinePlayers((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-[#E62E1B] text-xs font-black cursor-pointer"
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
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] hover:opacity-95 text-white font-black text-lg shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            ابدأ التحدي وعجلة الحروف 🎡
          </button>
        </div>
      )}

      {/* PHASE 2: LETTER SPIN */}
      {phase === 'letter_spin' && (
        <div className="rounded-3xl bg-white border border-amber-200 p-8 text-center space-y-6 shadow-[0_10px_28px_rgba(36,20,29,0.06)]">
          <h2 className="text-2xl font-black text-[#24141D]">عجلة الحروف الـ 28 — الجولة {activeRoundNum}</h2>
          <div className="relative w-44 h-44 mx-auto rounded-full bg-gradient-to-br from-[#FFB703] via-[#FF6B00] to-[#E62E1B] p-2 shadow-2xl shadow-orange-500/25">
            <div className="w-full h-full rounded-full bg-[#FFFBF5] flex items-center justify-center border-4 border-white">
              <span className={`text-7xl font-black text-[#D9480F] ${isSpinning ? 'scale-110' : ''} transition-transform`}>
                {spinPreviewLetter}
              </span>
            </div>
          </div>

          {isHost ? (
            <button
              disabled={isSpinning}
              onClick={handleSpinWheel}
              className="px-10 py-4 rounded-2xl bg-gradient-to-l from-[#FFB703] to-[#FF6B00] text-white font-black text-lg shadow-lg shadow-orange-500/25 cursor-pointer disabled:opacity-60"
            >
              {isSpinning ? 'جاري السحب...' : 'أدر عجلة الحروف 🎡'}
            </button>
          ) : (
            <p className="text-sm text-[#6B4F5E] font-bold">بانتظار المضيف لتدوير عجلة الحروف...</p>
          )}
        </div>
      )}

      {/* PHASE 3: WRITING (Stop disabled until ALL 5 fields are filled) */}
      {phase === 'writing' && (
        <div className="rounded-3xl bg-white border-2 border-amber-200 p-6 space-y-6 shadow-[0_12px_30px_rgba(255,107,0,0.09)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFB703] to-[#FF6B00] text-white flex items-center justify-center text-4xl font-black shadow-md">
                {activeLetter}
              </div>
              <div>
                <h2 className="text-xl font-black text-[#24141D]">
                  {isOnline
                    ? `اكتبوا كلمات تبدأ بحرف (${activeLetter})`
                    : `دور اللاعب: ${offlinePlayers[offlineActiveTurnIdx]?.name}`}
                </h2>
                <p className="text-xs text-[#6B4F5E] font-readex mt-0.5">
                  لا يمكن الضغط على «ستوب» إلا بعد تعبئة الخانات الخمس جميعها!
                </p>
              </div>
            </div>

            {!isLocalJudge && (
              <div className="flex flex-col items-end gap-1.5">
                <button
                  disabled={!allFieldsFilled}
                  onClick={() => {
                    if (!allFieldsFilled) return;
                    if (isOnline) {
                      SoundFX.playGong();
                      onSendAction?.({ type: 'ism_hayawan_stop', answers: myAnswers });
                    } else {
                      handleOfflineStop();
                    }
                  }}
                  title={
                    allFieldsFilled
                      ? 'اضغط ستوب لإيقاف الجولة'
                      : 'يجب تعبئة جميع الخانات الخمس أولاً لتفعيل زر ستوب'
                  }
                  className={`px-7 py-4 rounded-2xl font-black text-lg flex items-center gap-2 transition-all ${
                    allFieldsFilled
                      ? 'bg-[#E62E1B] hover:bg-[#c81e12] text-white shadow-lg shadow-rose-500/30 cursor-pointer'
                      : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                  }`}
                >
                  <OctagonAlert className="w-6 h-6" />
                  <span>🛑 ستوب!</span>
                </button>
                <span
                  className={`text-xs font-black tabular-nums ${
                    allFieldsFilled ? 'text-[#047857]' : 'text-[#D9480F]'
                  }`}
                >
                  {allFieldsFilled
                    ? 'اكتملت الخانات (5 / 5) — جاهز للستوب ✅'
                    : `اكمل الخانات أولاً (${filledFieldsCount} / 5 خانات مكتملة)`}
                </span>
              </div>
            )}
          </div>

          {isLocalJudge ? (
            <div className="py-10 text-center space-y-3 rounded-2xl bg-[#FFF8EE] border border-amber-200">
              <Gavel className="w-12 h-12 text-[#FF6B00] mx-auto" />
              <h3 className="text-xl font-black text-[#24141D]">أنت حكم هذه الجولة ⚖️</h3>
              <p className="text-sm text-[#6B4F5E] font-readex">
                بانتظار اللاعبين لتعبئة الخانات والضغط على ستوب لفتح لوحة التحكيم المباشرة...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {FIELDS.map((f) => {
                const isFilled = myAnswers[f.key].trim().length > 0;
                return (
                  <div key={f.key} className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-black text-[#24141D]">
                      <span>{f.emoji} {f.label}</span>
                      <span className={isFilled ? 'text-[#047857]' : 'text-[#D9480F]'}>
                        {isFilled ? '✓' : 'مطلوب'}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={myAnswers[f.key]}
                      onChange={(e) =>
                        setMyAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={`${activeLetter}... (${f.placeholder})`}
                      className={`w-full rounded-xl bg-[#FFF8EE] border-2 px-3.5 py-3 text-[#24141D] text-sm font-bold focus:outline-none transition-colors ${
                        isFilled ? 'border-[#10B981]' : 'border-amber-300 focus:border-[#FF6B00]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PHASE 4: SCORING — SECTION BY SECTION (+ Person-by-Person <=7 / AI >10 / Index 8-10) */}
      {phase === 'scoring' && (
        <div className="space-y-5">
          {isOnline && ism?.stoppedByPlayerName && (
            <div className="rounded-2xl bg-rose-50 border border-[#E62E1B]/40 px-4 py-3 text-sm font-black text-[#B91C1C] text-center">
              🛑 أوقف الجولة اللاعب: {ism.stoppedByPlayerName} — الحرف: ({activeLetter})
            </div>
          )}

          {/* Review Engine Banner */}
          <div className="rounded-2xl bg-white border border-amber-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-black shadow-sm">
            <div className="flex items-center gap-2 text-[#24141D]">
              <Sparkles className="w-4 h-4 text-[#FF6B00]" />
              {isSmallGroup && (
                <span>وضع المجموعة الخفيفة ({displayPlayers.length} لاعبين): عرض قسم قسم + شخص شخص</span>
              )}
              {displayPlayers.length > 7 && displayPlayers.length <= 10 && (
                <span>وضع الفهرس العربي وفهرس اللهجة السعودية ({displayPlayers.length} لاعبين): عرض قسم قسم</span>
              )}
              {isLargeAiGroup && (
                <span>
                  {aiAnalyzing
                    ? 'جاري تحليل إجابات اللاعبين بالذكاء الاصطناعي الحقيقي والفهرس السعودي...'
                    : analyzedBy === 'gemini_ai'
                      ? `تحليل الذكاء الاصطناعي الحقيقي + الفهرس العربي والسعودي (${displayPlayers.length} لاعباً)`
                      : `فهرس اللغة العربية واللهجة السعودية (${displayPlayers.length} لاعباً)`}
                </span>
              )}
            </div>
            {aiAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-[#FF6B00]" />}
          </div>

          {/* Section Stepper Tabs (اسم -> حيوان -> نبات -> جماد -> بلاد -> الملخص) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {FIELDS.map((f, idx) => {
              const active = scoringStepIdx === idx;
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    SoundFX.playClick();
                    setScoringStepIdx(idx);
                    setReviewPlayerIdx(0);
                  }}
                  className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-black border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#FF6B00] text-white border-[#24141D] shadow-sm'
                      : 'bg-white text-[#24141D] border-amber-200 hover:bg-[#FFF8EE]'
                  }`}
                >
                  <span>{f.emoji}</span>
                  <span>{idx + 1}. {f.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => {
                SoundFX.playClick();
                setScoringStepIdx(FIELDS.length);
              }}
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-black border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                scoringStepIdx === FIELDS.length
                  ? 'bg-[#0D9488] text-white border-[#24141D] shadow-sm'
                  : 'bg-white text-[#24141D] border-amber-200 hover:bg-[#FFF8EE]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>6. ملخص الجولة</span>
            </button>
          </div>

          {/* Judge Quick Adjustment Bar */}
          {isJudgeMode && (isLocalJudge || !isOnline) && (
            <div className="rounded-2xl bg-[#FFF3DF] border border-[#FFB703] p-4 space-y-3">
              <div className="flex items-center gap-2 text-[#9A3412] font-black text-sm">
                <Gavel className="w-5 h-5 text-[#FF6B00]" />
                <span>لوحة تحكم الحكم المباشرة ⚖️</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {displayPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-200"
                  >
                    <span className="text-xs font-black text-[#24141D] truncate max-w-[115px]">
                      {p.name} ({p.score})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          isOnline
                            ? onSendAction?.({ type: 'ism_hayawan_judge_score_adjust', targetPlayerId: p.id, delta: 5 })
                            : adjustOfflineScore(p.id, 5)
                        }
                        className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black cursor-pointer"
                      >
                        +5
                      </button>
                      <button
                        onClick={() =>
                          isOnline
                            ? onSendAction?.({ type: 'ism_hayawan_judge_score_adjust', targetPlayerId: p.id, delta: 10 })
                            : adjustOfflineScore(p.id, 10)
                        }
                        className="px-2 py-1 rounded-lg bg-emerald-200 text-emerald-900 text-xs font-black cursor-pointer"
                      >
                        +10
                      </button>
                      <button
                        onClick={() =>
                          isOnline
                            ? onSendAction?.({ type: 'ism_hayawan_judge_score_adjust', targetPlayerId: p.id, delta: -5 })
                            : adjustOfflineScore(p.id, -5)
                        }
                        className="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-black cursor-pointer"
                      >
                        -5
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disputes Queue (Online) */}
          {isOnline && ism && ism.disputes.filter((d) => d.status === 'pending').length > 0 && (
            <div className="rounded-2xl bg-orange-50 border border-orange-300 p-4 space-y-2.5">
              <div className="text-sm font-black text-[#D9480F]">✋ اعتراضات بانتظار التحكيم:</div>
              {ism.disputes
                .filter((d) => d.status === 'pending')
                .map((d) => {
                  const canResolve =
                    d.assignedReviewerId === localPlayerId || isLocalJudge || isHost;
                  return (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl px-4 py-2.5 border border-orange-200 text-xs"
                    >
                      <div>
                        <span className="font-black text-[#24141D]">{d.challengerName}</span> يعترض على كلمة{' '}
                        <span className="font-black text-[#D9480F]">"{d.word}"</span> للاعب{' '}
                        <span className="font-black text-[#24141D]">{d.targetPlayerName}</span>
                      </div>
                      {canResolve && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              SoundFX.playCorrect();
                              onSendAction?.({ type: 'ism_hayawan_resolve_dispute', disputeId: d.id, approved: true });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#10B981] text-white font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>صحيحة (+10)</span>
                          </button>
                          <button
                            onClick={() => {
                              SoundFX.playWrong();
                              onSendAction?.({ type: 'ism_hayawan_resolve_dispute', disputeId: d.id, approved: false });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#E62E1B] text-white font-black flex items-center gap-1 cursor-pointer"
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

          {/* ACTIVE SECTION REVIEW */}
          {currentField ? (
            <div className="rounded-3xl bg-white border-2 border-amber-200 p-5 sm:p-6 space-y-5 shadow-[0_10px_28px_rgba(36,20,29,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/70 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-[#FFF3DF] border border-amber-300 flex items-center justify-center text-2xl">
                    {currentField.emoji}
                  </span>
                  <div>
                    <h3 className="text-xl font-black text-[#24141D]">
                      نتائج قسم: {currentField.label} (حرف {activeLetter})
                    </h3>
                    <p className="text-xs font-bold text-[#6B4F5E]">
                      {isSmallGroup && !showSectionTable
                        ? `استعراض شخص بشخص (${reviewPlayerIdx + 1} من ${displayPlayers.length})`
                        : `إجابات جميع اللاعبين (${displayPlayers.length} لاعب) لقسم ${currentField.label}`}
                    </p>
                  </div>
                </div>

                {isSmallGroup && (
                  <button
                    onClick={() => {
                      SoundFX.playClick();
                      setShowSectionTable(!showSectionTable);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-300 text-xs font-black text-[#24141D] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {showSectionTable ? <UserCheck className="w-4 h-4 text-[#FF6B00]" /> : <ListChecks className="w-4 h-4 text-[#0D9488]" />}
                    <span>{showSectionTable ? 'عرض شخص شخص' : 'عرض جميع لاعبي القسم'}</span>
                  </button>
                )}
              </div>

              {/* Person-by-Person Review for <= 7 players */}
              {isSmallGroup && !showSectionTable && activeReviewPlayer ? (
                (() => {
                  const ans = answersMap[activeReviewPlayer.id]?.[currentField.key] || '';
                  const pts = scoresMap[activeReviewPlayer.id]?.[currentField.key] || 0;
                  const ev = reasonsMap[activeReviewPlayer.id]?.[currentField.key];
                  const badge = ev ? SOURCE_BADGE[ev.source] : SOURCE_BADGE.fusha;

                  return (
                    <motion.div
                      key={`${currentField.key}-${activeReviewPlayer.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-xl mx-auto rounded-3xl bg-[#FFF8EE] border-2 border-[#FFB703] p-6 text-center space-y-4"
                    >
                      <div className="text-xs font-black text-[#D9480F] tabular-nums">
                        اللاعب {reviewPlayerIdx + 1} من {displayPlayers.length}
                      </div>
                      <h4 className="text-2xl font-black text-[#24141D]">{activeReviewPlayer.name}</h4>

                      <div className="rounded-2xl bg-white border border-amber-200 py-5 px-4 space-y-2">
                        <div className="text-xs font-bold text-[#6B4F5E]">إجابته في ({currentField.label}):</div>
                        <div className="text-3xl font-black text-[#FF6B00]">
                          {ans || '— لا توجد إجابة —'}
                        </div>
                        {ev && (
                          <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl border text-xs font-black ${badge.cls}`}>
                            <span>{badge.label}</span>
                            <span>· {ev.reason}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="text-xs font-black text-[#6B4F5E]">الدرجة:</span>
                        {([10, 5, 0] as const).map((scoreVal) => (
                          <button
                            key={scoreVal}
                            disabled={!isHost && !isLocalJudge && isOnline}
                            onClick={() => updatePlayerFieldPoints(activeReviewPlayer.id, currentField.key, scoreVal)}
                            className={`px-4 py-2 rounded-xl border-2 text-xs font-black tabular-nums cursor-pointer transition-all ${
                              pts === scoreVal
                                ? scoreVal === 10
                                  ? 'bg-[#10B981] text-white border-[#24141D]'
                                  : scoreVal === 5
                                    ? 'bg-[#FFB703] text-[#24141D] border-[#24141D]'
                                    : 'bg-[#E62E1B] text-white border-[#24141D]'
                                : 'bg-white text-[#24141D] border-amber-200 hover:bg-amber-50'
                            } disabled:opacity-65`}
                          >
                            {scoreVal === 10 ? '+10 (صحيحة وفريدة)' : scoreVal === 5 ? '+5 (مكررة)' : '0 (مرفوضة)'}
                          </button>
                        ))}
                      </div>

                      {isOnline && ans && (
                        <button
                          onClick={() => {
                            SoundFX.playClick();
                            onSendAction?.({
                              type: 'ism_hayawan_dispute',
                              targetPlayerId: activeReviewPlayer.id,
                              field: currentField.key,
                              word: ans,
                            });
                          }}
                          className="px-4 py-2 rounded-xl bg-white border border-orange-300 text-xs font-black text-[#D9480F] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Hand className="w-3.5 h-3.5" />
                          <span>رفع اعتراض على الإجابة</span>
                        </button>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => {
                            SoundFX.playClick();
                            if (reviewPlayerIdx > 0) {
                              setReviewPlayerIdx(reviewPlayerIdx - 1);
                            } else if (scoringStepIdx > 0) {
                              setScoringStepIdx(scoringStepIdx - 1);
                              setReviewPlayerIdx(displayPlayers.length - 1);
                            }
                          }}
                          disabled={scoringStepIdx === 0 && reviewPlayerIdx === 0}
                          className="px-4 py-2.5 rounded-xl bg-white border border-amber-300 disabled:opacity-40 text-xs font-black flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span>السابق</span>
                        </button>

                        <button
                          onClick={() => {
                            SoundFX.playTileSelect();
                            if (reviewPlayerIdx + 1 < displayPlayers.length) {
                              setReviewPlayerIdx(reviewPlayerIdx + 1);
                            } else {
                              setScoringStepIdx(scoringStepIdx + 1);
                              setReviewPlayerIdx(0);
                            }
                          }}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <span>
                            {reviewPlayerIdx + 1 < displayPlayers.length
                              ? 'اللاعب التالي'
                              : scoringStepIdx + 1 < FIELDS.length
                                ? `القسم التالي (${FIELDS[scoringStepIdx + 1].label})`
                                : 'عرض ملخص الجولة 🏆'}
                          </span>
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })()
              ) : (
                /* Full Section Player Cards (Used for 8–10 Arabic/Saudi Index, >10 Gemini AI, or toggled view) */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayPlayers.map((p) => {
                      const ans = answersMap[p.id]?.[currentField.key] || '—';
                      const pts = scoresMap[p.id]?.[currentField.key] || 0;
                      const ev = reasonsMap[p.id]?.[currentField.key];
                      const badge = ev ? SOURCE_BADGE[ev.source] : SOURCE_BADGE.fusha;
                      return (
                        <div
                          key={p.id}
                          className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-4 flex flex-col justify-between gap-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-sm text-[#24141D] truncate">{p.name}</span>
                            <span
                              className={`text-xs font-black px-2.5 py-1 rounded-lg tabular-nums ${
                                pts === 10
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pts === 5
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              +{pts}
                            </span>
                          </div>

                          <div className="text-lg font-black text-[#FF6B00]">{ans}</div>

                          {ev && (
                            <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${badge.cls}`}>
                              {badge.label} — {ev.reason}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-1 pt-1">
                            {(isHost || isLocalJudge || !isOnline) && (
                              <div className="flex items-center gap-1">
                                {([10, 5, 0] as const).map((scoreVal) => (
                                  <button
                                    key={scoreVal}
                                    onClick={() => updatePlayerFieldPoints(p.id, currentField.key, scoreVal)}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer ${
                                      pts === scoreVal
                                        ? 'bg-[#24141D] text-white border-[#24141D]'
                                        : 'bg-white text-[#24141D] border-amber-200'
                                    }`}
                                  >
                                    {scoreVal === 0 ? '0' : `+${scoreVal}`}
                                  </button>
                                ))}
                              </div>
                            )}

                            {isOnline && answersMap[p.id]?.[currentField.key] && (
                              <button
                                onClick={() => {
                                  SoundFX.playClick();
                                  onSendAction?.({
                                    type: 'ism_hayawan_dispute',
                                    targetPlayerId: p.id,
                                    field: currentField.key,
                                    word: answersMap[p.id]?.[currentField.key],
                                  });
                                }}
                                className="px-2 py-1 rounded-lg bg-white border border-orange-200 text-[11px] font-black text-[#D9480F] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Hand className="w-3 h-3" />
                                <span>اعتراض</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      disabled={scoringStepIdx === 0}
                      onClick={() => {
                        SoundFX.playClick();
                        setScoringStepIdx(scoringStepIdx - 1);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#FFF8EE] border border-amber-300 disabled:opacity-40 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>القسم السابق</span>
                    </button>

                    <button
                      onClick={() => {
                        SoundFX.playTileSelect();
                        setScoringStepIdx(scoringStepIdx + 1);
                      }}
                      className="px-6 py-3 rounded-xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span>
                        {scoringStepIdx + 1 < FIELDS.length
                          ? `القسم التالي: ${FIELDS[scoringStepIdx + 1].label} ${FIELDS[scoringStepIdx + 1].emoji}`
                          : 'ملخص الجولة والترتيب 🏆'}
                      </span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* FINAL STEP OF SCORING: ROUND SUMMARY TABLE */
            <div className="rounded-3xl bg-white border-2 border-[#0D9488] p-5 sm:p-6 space-y-5 shadow-[0_10px_28px_rgba(13,148,136,0.1)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-black text-[#24141D]">🏆 ملخص الجولة {activeRoundNum} والترتيب العام</h3>
                <button
                  onClick={() => setScoringStepIdx(FIELDS.length - 1)}
                  className="px-3.5 py-2 rounded-xl bg-[#FFF8EE] border border-amber-300 text-xs font-black cursor-pointer"
                >
                  العودة للأقسام
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-[#FFF8EE] text-[#D9480F] text-xs">
                    <tr>
                      <th className="p-3">اللاعب</th>
                      {FIELDS.map((f) => (
                        <th key={f.key} className="p-3">{f.emoji} {f.label}</th>
                      ))}
                      <th className="p-3">نقاط الجولة</th>
                      <th className="p-3">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {[...displayPlayers]
                      .sort((a, b) => b.score - a.score)
                      .map((p) => {
                        const ans = answersMap[p.id] || EMPTY_ANSWERS;
                        const fScores = scoresMap[p.id] || { name: 0, animal: 0, plant: 0, object: 0, country: 0 };
                        return (
                          <tr key={p.id} className="hover:bg-[#FFFBF5]">
                            <td className="p-3 font-black text-[#24141D]">{p.name}</td>
                            {FIELDS.map((f) => {
                              const pts = fScores[f.key] || 0;
                              return (
                                <td key={f.key} className="p-3">
                                  <div className="font-bold text-[#24141D]">{ans[f.key] || '—'}</div>
                                  <div
                                    className={`text-[11px] font-black tabular-nums ${
                                      pts === 10
                                        ? 'text-[#047857]'
                                        : pts === 5
                                          ? 'text-[#D97706]'
                                          : 'text-[#E62E1B]'
                                    }`}
                                  >
                                    +{pts}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="p-3 font-black text-[#FF6B00] tabular-nums">
                              +{roundTotalsMap[p.id] || 0}
                            </td>
                            <td className="p-3 font-black text-[#0D9488] tabular-nums">{p.score}</td>
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
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black text-base flex items-center gap-2 shadow-md cursor-pointer"
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
        </div>
      )}

      {/* PHASE 6: GAME OVER */}
      {phase === 'game_over' && (
        <div className="rounded-3xl bg-white border-2 border-[#FFB703] p-8 text-center space-y-6 shadow-[0_12px_32px_rgba(255,183,3,0.16)]">
          <Trophy className="w-16 h-16 text-[#FFB703] mx-auto" />
          <h2 className="text-3xl font-black text-[#24141D]">انتهت المنافسة! الترتيب النهائي 🏆</h2>

          <div className="max-w-lg mx-auto space-y-3">
            {[...displayPlayers]
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => {
                const avatarId = 'avatar' in p ? (p as { avatar?: string }).avatar : `char_${String((idx % 10) + 1).padStart(2, '0')}`;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border-2 ${
                      idx === 0
                        ? 'bg-[#FFF3DF] border-[#FFB703] text-[#9A3412]'
                        : 'bg-[#FFFBF5] border-amber-200 text-[#24141D]'
                    }`}
                  >
                    <div className="flex items-center gap-3 font-black">
                      <span className="text-lg tabular-nums">#{idx + 1}</span>
                      <CharacterAvatar
                        avatarId={avatarId}
                        size={38}
                        mood={idx === 0 ? 'win' : 'idle'}
                        interactive={false}
                      />
                      <span>{p.name}</span>
                    </div>
                    <span className="font-black text-lg tabular-nums">{p.score} نقطة</span>
                  </div>
                );
              })}
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
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#FFB703] text-white font-black text-base inline-flex items-center gap-2 shadow-md cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>العب مرة ثانية</span>
          </button>
        </div>
      )}
    </div>
  );
};
