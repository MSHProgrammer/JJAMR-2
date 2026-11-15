import React, { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  ChevronLeft,
  Clock,
  Eye,
  FileSearch,
  FolderOpen,
  Gavel,
  Lightbulb,
  Link2,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type {
  DetectiveBoardLink,
  DetectiveBoardNode,
  DetectiveCasePublic,
  DetectiveCaseSolution,
  DetectiveEvidence,
  DetectiveOnlineState,
  DetectivePlayerCaseProgress,
  DetectiveProfileStats,
  DetectiveRoomPhase,
  DetectiveSuspect,
  DetectiveTimelineEvent,
  SceneHotspot,
} from '../../types/detective.ts';
import type { Player } from '../../types/jamr.ts';
import {
  getDetectiveRank,
  PUBLIC_DETECTIVE_CASES,
} from '../../data/detectivePublicCases.ts';
import {
  createInitialCaseProgress,
  getDifficultyMeta,
  loadDetectiveProfile,
  saveDetectiveProfile,
} from './detective/detectiveTheme.ts';
import { DetectiveHomeAndArchive } from './detective/DetectiveHomeAndArchive.tsx';
import { DetectiveSceneView } from './detective/DetectiveSceneView.tsx';
import { DetectiveSuspectsAndInterrogation } from './detective/DetectiveSuspectsAndInterrogation.tsx';
import { DetectiveEvidenceAndTimeline } from './detective/DetectiveEvidenceAndTimeline.tsx';
import { DetectiveCorkboard } from './detective/DetectiveCorkboard.tsx';
import { DetectiveAccusationAndReveal } from './detective/DetectiveAccusationAndReveal.tsx';

type WorkspaceTab =
  | 'briefing'
  | 'scene'
  | 'suspects'
  | 'interrogation'
  | 'evidence'
  | 'timeline'
  | 'corkboard'
  | 'accusation';

interface SmartDetectiveEngineProps {
  mode: 'offline' | 'online';
  onBack?: () => void;
  // Online props
  onlineState?: DetectiveOnlineState;
  players?: Player[];
  currentPlayerId?: string;
  isHost?: boolean;
  onOnlineAction?: (action: string, payload?: any) => void;
}

const PHASE_LABELS: Record<DetectiveRoomPhase, string> = {
  briefing: '١. ملف القضية والملخص',
  exploration: '٢. استكشاف المسرح',
  investigation: '٣. التحقيق والأدلة',
  discussion: '٤. جلسة النقاش والتحليل',
  accusation: '٥. تقديم الاتهام السري',
  case_closed: '٦. تم إغلاق القضية',
};

export const SmartDetectiveEngine: React.FC<SmartDetectiveEngineProps> = ({
  mode,
  onBack,
  onlineState,
  players = [],
  currentPlayerId = '',
  isHost = false,
  onOnlineAction,
}) => {
  const [cases, setCases] = useState<DetectiveCasePublic[]>(PUBLIC_DETECTIVE_CASES);
  const [profile, setProfile] = useState<DetectiveProfileStats>(() => loadDetectiveProfile());

  // Offline view navigation
  const [screenMode, setScreenMode] = useState<'hub' | 'workspace'>(() =>
    mode === 'online' ? 'workspace' : 'hub'
  );
  const [hubSubView, setHubSubView] = useState<'home' | 'archive' | 'detail' | 'completed'>(
    'home'
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    () => onlineState?.caseId || PUBLIC_DETECTIVE_CASES[0].id
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('briefing');
  const [showHintModal, setShowHintModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Offline verification state
  const [revealedSolution, setRevealedSolution] = useState<DetectiveCaseSolution | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState<{
    correct: boolean;
    message: string;
    pointsDelta: number;
  } | null>(null);

  // Live timer countdown for multiplayer phases
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Fetch authoritative public cases from server
  useEffect(() => {
    let active = true;
    fetch('/api/detective/cases')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.cases && Array.isArray(data.cases) && data.cases.length > 0) {
          setCases(data.cases);
        }
      })
      .catch(() => {
        // Fallback already initialized to PUBLIC_DETECTIVE_CASES
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync selectedCaseId & active tab with online phase
  useEffect(() => {
    if (mode !== 'online' || !onlineState) return;
    if (onlineState.caseId && onlineState.caseId !== selectedCaseId) {
      setSelectedCaseId(onlineState.caseId);
    }
    if (onlineState.phase === 'briefing') setActiveTab('briefing');
    else if (onlineState.phase === 'exploration') setActiveTab('scene');
    else if (onlineState.phase === 'accusation' || onlineState.phase === 'case_closed') {
      setActiveTab('accusation');
    }
  }, [mode, onlineState?.caseId, onlineState?.phase]);

  // Countdown tick for online phase deadlines
  useEffect(() => {
    if (mode !== 'online' || !onlineState?.phaseDeadline) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((onlineState.phaseDeadline! - Date.now()) / 1000));
      setSecondsLeft(rem);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [mode, onlineState?.phaseDeadline]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 2600);
  }, []);

  const currentCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || cases[0],
    [cases, selectedCaseId]
  );

  const currentProgress: DetectivePlayerCaseProgress = useMemo(() => {
    const existing = profile.progressByCase[currentCase.id];
    if (existing) return existing;
    return createInitialCaseProgress(currentCase);
  }, [profile.progressByCase, currentCase]);

  const mutateCaseProgress = useCallback(
    (
      caseId: string,
      updater: (prev: DetectivePlayerCaseProgress) => DetectivePlayerCaseProgress
    ) => {
      setProfile((prevStats) => {
        const targetCase = cases.find((c) => c.id === caseId) || currentCase;
        const baseProg =
          prevStats.progressByCase[caseId] || createInitialCaseProgress(targetCase);
        const nextProg = {
          ...updater(baseProg),
          lastUpdatedAt: Date.now(),
        };
        const attemptedCaseIds = prevStats.attemptedCaseIds.includes(caseId)
          ? prevStats.attemptedCaseIds
          : [...prevStats.attemptedCaseIds, caseId];

        const nextStats: DetectiveProfileStats = {
          ...prevStats,
          attemptedCaseIds,
          progressByCase: {
            ...prevStats.progressByCase,
            [caseId]: nextProg,
          },
        };
        saveDetectiveProfile(nextStats);

        if (mode === 'online' && onOnlineAction) {
          onOnlineAction('detective_update_progress', {
            cluesFoundCount: nextProg.savedEvidenceIds.length,
            suspectsReviewedCount: nextProg.reviewedSuspectIds.length,
            hintsUsed: nextProg.usedHintTiers.length,
          });
        }
        return nextStats;
      });
    },
    [cases, currentCase, mode, onOnlineAction]
  );

  const handleStartInvestigation = (caseId: string) => {
    setSelectedCaseId(caseId);
    setRevealedSolution(null);
    setAttemptFeedback(null);
    mutateCaseProgress(caseId, (p) => ({
      ...p,
      status: p.status === 'open' ? 'in_progress' : p.status,
    }));
    setActiveTab('briefing');
    setScreenMode('workspace');
  };

  const handleResetCaseProgress = (caseId: string) => {
    const target = cases.find((c) => c.id === caseId);
    if (!target) return;
    setProfile((prev) => {
      const next = {
        ...prev,
        progressByCase: {
          ...prev.progressByCase,
          [caseId]: createInitialCaseProgress(target),
        },
      };
      saveDetectiveProfile(next);
      return next;
    });
    setRevealedSolution(null);
    setAttemptFeedback(null);
    showToast('تمت إعادة تهيئة ملف القضية من البداية');
  };

  const handleInspectHotspot = (hs: SceneHotspot) => {
    mutateCaseProgress(currentCase.id, (p) => {
      const discoveredHotspotIds = p.discoveredHotspotIds.includes(hs.id)
        ? p.discoveredHotspotIds
        : [...p.discoveredHotspotIds, hs.id];
      const savedEvidenceIds =
        hs.unlocksEvidenceId && !p.savedEvidenceIds.includes(hs.unlocksEvidenceId)
          ? [...p.savedEvidenceIds, hs.unlocksEvidenceId]
          : p.savedEvidenceIds;
      return {
        ...p,
        status: p.status === 'open' ? 'in_progress' : p.status,
        discoveredHotspotIds,
        savedEvidenceIds,
      };
    });
  };

  const handleAddEvidenceToFile = (evidenceId: string) => {
    mutateCaseProgress(currentCase.id, (p) => ({
      ...p,
      savedEvidenceIds: p.savedEvidenceIds.includes(evidenceId)
        ? p.savedEvidenceIds
        : [...p.savedEvidenceIds, evidenceId],
    }));
    showToast('أُضيف الدليل إلى خزانة الأدلة السرية');
  };

  const handlePinNode = (item: {
    kind: DetectiveBoardNode['kind'];
    refId: string;
    title: string;
    subtitle?: string;
  }) => {
    mutateCaseProgress(currentCase.id, (p) => {
      if (p.boardNodes.some((n) => n.kind === item.kind && n.refId === item.refId)) {
        showToast('هذا العنصر مثبّت بالفعل على اللوحة');
        return p;
      }
      const newNode: DetectiveBoardNode = {
        id: `node_${item.kind}_${item.refId}`,
        kind: item.kind,
        refId: item.refId,
        title: item.title,
        subtitle: item.subtitle,
        x: 18 + ((p.boardNodes.length * 19) % 64),
        y: 22 + ((p.boardNodes.length * 17) % 56),
      };
      showToast(`تم تثبيت «${item.title}» على لوحة التحقيق`);
      return {
        ...p,
        boardNodes: [...p.boardNodes, newNode],
      };
    });
  };

  const handleSubmitSoloAccusation = async (
    suspectId: string,
    reason: string,
    revealEvenIfWrong: boolean
  ) => {
    setVerifying(true);
    try {
      const res = await fetch('/api/detective/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: currentCase.id,
          accusedSuspectId: suspectId,
          reason,
          cluesFoundCount: currentProgress.savedEvidenceIds.length,
          usedHintTiers: currentProgress.usedHintTiers,
          wrongAccusationsBefore: currentProgress.wrongAccusations,
          revealOnWrong: revealEvenIfWrong,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || 'تعذر التحقق من الاتهام');
        return;
      }

      if (data.isCorrect) {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.65 } });
        setRevealedSolution(data.solution);
        setAttemptFeedback({
          correct: true,
          message: 'أحسنت أيها المحقق! استنتاجك دقيق وكشفت المسؤول الحقيقي!',
          pointsDelta: data.pointsEarned || 0,
        });
        setProfile((prev) => {
          const alreadySolved = prev.solvedCaseIds.includes(currentCase.id);
          const addedPoints = alreadySolved ? 0 : Math.max(0, data.pointsEarned || 0);
          const existingProg =
            prev.progressByCase[currentCase.id] || createInitialCaseProgress(currentCase);
          const next: DetectiveProfileStats = {
            ...prev,
            totalPoints: prev.totalPoints + addedPoints,
            solvedCaseIds: alreadySolved
              ? prev.solvedCaseIds
              : [...prev.solvedCaseIds, currentCase.id],
            progressByCase: {
              ...prev.progressByCase,
              [currentCase.id]: {
                ...existingProg,
                status: 'closed',
                scoreEarned: Math.max(existingProg.scoreEarned, data.pointsEarned || 0),
                solvedAt: new Date().toISOString(),
                lastUpdatedAt: Date.now(),
              },
            },
          };
          saveDetectiveProfile(next);
          return next;
        });
      } else {
        setAttemptFeedback({
          correct: false,
          message: 'اتهام غير دقيق! المشتبه به الذي اخترته ليس الفاعل الحقيقي.',
          pointsDelta: data.pointsEarned || -25,
        });
        mutateCaseProgress(currentCase.id, (p) => ({
          ...p,
          wrongAccusations: (p.wrongAccusations || 0) + 1,
          status: revealEvenIfWrong ? 'unsolved' : p.status,
        }));
        if (revealEvenIfWrong && data.solution) {
          setRevealedSolution(data.solution);
        }
      }
    } catch {
      showToast('تعذر الاتصال بخادم التحقق حالياً');
    } finally {
      setVerifying(false);
    }
  };

  const handleUseHint = (tier: 1 | 2 | 3) => {
    mutateCaseProgress(currentCase.id, (p) => ({
      ...p,
      usedHintTiers: p.usedHintTiers.includes(tier) ? p.usedHintTiers : [...p.usedHintTiers, tier],
    }));
  };

  // Update local rank stats when multiplayer closes a case
  useEffect(() => {
    if (mode !== 'online' || onlineState?.phase !== 'case_closed') return;
    const myRes = onlineState.resultsByPlayer?.find((r) => r.playerId === currentPlayerId);
    if (!myRes || !myRes.isCorrect) return;
    setProfile((prev) => {
      if (prev.solvedCaseIds.includes(currentCase.id)) return prev;
      const next: DetectiveProfileStats = {
        ...prev,
        totalPoints: prev.totalPoints + Math.max(0, myRes.pointsDelta),
        solvedCaseIds: [...prev.solvedCaseIds, currentCase.id],
        progressByCase: {
          ...prev.progressByCase,
          [currentCase.id]: {
            ...(prev.progressByCase[currentCase.id] || createInitialCaseProgress(currentCase)),
            status: 'closed',
            scoreEarned: Math.max(0, myRes.pointsDelta),
            solvedAt: new Date().toISOString(),
            lastUpdatedAt: Date.now(),
          },
        },
      };
      saveDetectiveProfile(next);
      return next;
    });
  }, [mode, onlineState?.phase, onlineState?.resultsByPlayer, currentPlayerId, currentCase.id]);

  const diffMeta = getDifficultyMeta(currentCase.difficulty);
  const rankInfo = getDetectiveRank(profile.totalPoints);

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'briefing', label: 'ملف القضية', icon: <FolderOpen size={14} /> },
    {
      id: 'scene',
      label: 'مسرح القضية',
      icon: <Eye size={14} />,
      badge: `${currentProgress.discoveredHotspotIds.length}/${currentCase.hotspots.length}`,
    },
    {
      id: 'suspects',
      label: 'المشتبه بهم',
      icon: <Users size={14} />,
      badge: `${currentCase.suspects.length}`,
    },
    { id: 'interrogation', label: 'الاستجواب', icon: <MessageSquareText size={14} /> },
    {
      id: 'evidence',
      label: 'خزانة الأدلة',
      icon: <FileSearch size={14} />,
      badge: `${currentProgress.savedEvidenceIds.length}/${currentCase.evidence.length}`,
    },
    { id: 'timeline', label: 'الخط الزمني', icon: <Clock size={14} /> },
    {
      id: 'corkboard',
      label: 'لوحة الخيوط',
      icon: <Link2 size={14} />,
      badge: `${currentProgress.boardLinks.length}`,
    },
    {
      id: 'accusation',
      label:
        onlineState?.phase === 'case_closed' || revealedSolution
          ? 'ملف الحقيقة'
          : 'قدّم اتهامك',
      icon: <Gavel size={14} />,
    },
  ];

  // =========================================================================
  // RENDER: DARK LUXURY NOIR SHELL
  // =========================================================================
  return (
    <div
      className="min-h-[75vh] rounded-3xl bg-[#09080A] text-[#F3EFE6] border border-[#C89B3C]/25 p-3 sm:p-5 md:p-6 shadow-2xl space-y-5 relative"
      dir="rtl"
    >
      {/* Floating toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#1E1714] border border-[#C89B3C] text-[#E5C16C] px-4 py-2.5 rounded-xl text-xs font-black shadow-2xl">
          {toast}
        </div>
      )}

      {/* OFFLINE HUB MODE */}
      {mode === 'offline' && screenMode === 'hub' ? (
        <DetectiveHomeAndArchive
          cases={cases}
          profile={profile}
          subView={hubSubView}
          selectedCaseId={selectedCaseId}
          onChangeSubView={setHubSubView}
          onSelectCase={(id, openDetail) => {
            setSelectedCaseId(id);
            if (openDetail) setHubSubView('detail');
          }}
          onStartInvestigation={handleStartInvestigation}
          onResetCaseProgress={handleResetCaseProgress}
          onBackToJamr={onBack}
        />
      ) : (
        /* ACTIVE INVESTIGATION WORKSPACE (SOLO OR MULTIPLAYER) */
        <div className="space-y-4">
          {/* Top Investigation Command Header */}
          <div className="bg-[#131217] border border-[#C89B3C]/30 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {mode === 'offline' ? (
                <button
                  type="button"
                  onClick={() => setScreenMode('hub')}
                  className="bg-[#1E1714] hover:bg-[#2B201C] text-[#E5C16C] border border-[#C89B3C]/35 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <ArrowRight size={14} />
                  الأرشيف
                </button>
              ) : (
                onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="bg-[#1E1714] hover:bg-[#2B201C] text-[#9FA3AE] hover:text-white border border-white/10 px-3 py-2 rounded-xl text-xs font-bold"
                  >
                    خروج
                  </button>
                )
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono bg-[#09080A] border border-[#C89B3C]/40 text-[#E5C16C] px-2 py-0.5 rounded">
                    {currentCase.caseNumber}
                  </span>
                  <h2 className="font-black text-base sm:text-lg text-[#F3EFE6]">
                    {currentCase.title}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${diffMeta.bgClass} ${diffMeta.borderClass}`}
                  >
                    {diffMeta.label}
                  </span>
                </div>
                <p className="text-[11px] text-[#9FA3AE] mt-0.5">
                  {currentCase.location} • {rankInfo.current.badge} {rankInfo.current.title} (
                  {profile.totalPoints} نقطة)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {mode === 'online' && onlineState && (
                <div className="flex items-center gap-2 bg-[#09080A] border border-[#C89B3C]/40 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] font-black text-[#E5C16C]">
                    {PHASE_LABELS[onlineState.phase]}
                  </span>
                  {secondsLeft > 0 && (
                    <span className="font-mono text-xs bg-[#7A1219] text-white px-2 py-0.5 rounded font-black">
                      {secondsLeft}ث
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowHintModal(true)}
                className="bg-[#1E1714] hover:bg-[#2C211C] text-[#E5C16C] border border-[#C89B3C]/45 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5"
              >
                <Lightbulb size={14} />
                تلميح ({currentProgress.usedHintTiers.length}/3)
              </button>

              {mode === 'online' &&
                isHost &&
                onlineState &&
                onlineState.phase !== 'case_closed' && (
                  <button
                    type="button"
                    onClick={() => onOnlineAction?.('detective_next_phase')}
                    className="bg-[#7A1219] hover:bg-[#961820] text-white border border-[#C89B3C]/40 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1"
                  >
                    {onlineState.phase === 'accusation'
                      ? 'إغلاق القضية وكشف الحل'
                      : 'المرحلة التالية'}
                    <ChevronLeft size={14} />
                  </button>
                )}
            </div>
          </div>

          {/* Host quick case switcher in multiplayer briefing */}
          {mode === 'online' && isHost && onlineState?.phase === 'briefing' && (
            <div className="bg-[#131217] border border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#C89B3C] font-bold flex items-center gap-1.5">
                <ShieldAlert size={14} />
                بإمكان المشرف اختيار ملف القضية للمجموعة قبل بدء الاستكشاف:
              </span>
              <select
                value={currentCase.id}
                onChange={(e) => onOnlineAction?.('detective_set_case', { caseId: e.target.value })}
                className="bg-[#09080A] border border-[#C89B3C]/40 rounded-xl px-3 py-1.5 text-xs text-[#F3EFE6] font-bold outline-none"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} — {c.title} ({getDifficultyMeta(c.difficulty).label})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Investigation Workspace Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-black border transition flex items-center gap-1.5 ${
                    active
                      ? t.id === 'accusation'
                        ? 'bg-[#7A1219] text-white border-[#E5C16C]/70 shadow-lg'
                        : 'bg-[#1E1714] text-[#E5C16C] border-[#C89B3C]'
                      : 'bg-[#131217] hover:bg-[#1B1921] text-[#9FA3AE] hover:text-white border-white/10'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.badge && (
                    <span className="text-[10px] font-mono bg-black/45 px-1.5 py-0.5 rounded text-[#D8D3C9]">
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Workspace Tab Content */}
          {activeTab === 'briefing' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#131217] border border-white/10 rounded-3xl p-4 sm:p-6">
              <div className="lg:col-span-5">
                <div className="rounded-2xl overflow-hidden border border-[#C89B3C]/35 bg-black">
                  <img
                    src={currentCase.coverImage}
                    alt={currentCase.title}
                    className="w-full h-60 sm:h-72 object-cover"
                  />
                </div>
              </div>
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <span className="text-xs font-bold text-[#C89B3C]">
                    {currentCase.categoryLabel} • {currentCase.inStoryDate} • {currentCase.inStoryTime}
                  </span>
                  <h3 className="text-2xl font-black text-[#F3EFE6] mt-1">{currentCase.title}</h3>
                  <p className="text-sm text-[#D8D3C9] leading-relaxed mt-2">
                    {currentCase.briefingNarrative}
                  </p>
                </div>

                <div className="bg-[#0D0C10] border border-white/10 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-black text-[#E5C16C]">الحقائق الأولية في المحضر:</p>
                  <ul className="space-y-1.5 text-xs text-[#D2CEC4]">
                    {currentCase.initialFacts.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#C89B3C] font-black">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('scene')}
                    className="bg-[#7A1219] hover:bg-[#961820] text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5"
                  >
                    <Eye size={15} />
                    ابدأ فحص مسرح القضية
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('suspects')}
                    className="bg-[#1E1714] hover:bg-[#2A201B] text-[#E5C16C] border border-[#C89B3C]/35 px-4 py-2.5 rounded-xl text-xs font-bold"
                  >
                    مراجعة ملفات المشتبه بهم
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scene' && (
            <DetectiveSceneView
              caseData={currentCase}
              progress={currentProgress}
              onInspectHotspot={handleInspectHotspot}
              onAddEvidenceToFile={handleAddEvidenceToFile}
              onUpdateHotspotNote={(hotspotId, note) =>
                mutateCaseProgress(currentCase.id, (p) => ({
                  ...p,
                  hotspotNotes: { ...p.hotspotNotes, [hotspotId]: note },
                }))
              }
              onPinToBoard={(item) => handlePinNode(item)}
            />
          )}

          {(activeTab === 'suspects' || activeTab === 'interrogation') && (
            <DetectiveSuspectsAndInterrogation
              caseData={currentCase}
              progress={currentProgress}
              mode={activeTab}
              onReviewSuspect={(suspectId) =>
                mutateCaseProgress(currentCase.id, (p) => ({
                  ...p,
                  reviewedSuspectIds: p.reviewedSuspectIds.includes(suspectId)
                    ? p.reviewedSuspectIds
                    : [...p.reviewedSuspectIds, suspectId],
                }))
              }
              onAskQuestion={(suspectId, questionId, unlocksEvidenceId) =>
                mutateCaseProgress(currentCase.id, (p) => {
                  const prevQs = p.askedQuestionsBySuspect[suspectId] || [];
                  const nextQs = prevQs.includes(questionId)
                    ? prevQs
                    : [...prevQs, questionId];
                  const nextEv =
                    unlocksEvidenceId && !p.savedEvidenceIds.includes(unlocksEvidenceId)
                      ? [...p.savedEvidenceIds, unlocksEvidenceId]
                      : p.savedEvidenceIds;
                  if (unlocksEvidenceId && !p.savedEvidenceIds.includes(unlocksEvidenceId)) {
                    showToast('تم فتح دليل جديد من الاستجواب!');
                  }
                  return {
                    ...p,
                    reviewedSuspectIds: p.reviewedSuspectIds.includes(suspectId)
                      ? p.reviewedSuspectIds
                      : [...p.reviewedSuspectIds, suspectId],
                    askedQuestionsBySuspect: {
                      ...p.askedQuestionsBySuspect,
                      [suspectId]: nextQs,
                    },
                    savedEvidenceIds: nextEv,
                  };
                })
              }
              onPinSuspectToBoard={(s: DetectiveSuspect) =>
                handlePinNode({
                  kind: 'suspect',
                  refId: s.id,
                  title: s.name,
                  subtitle: s.role,
                })
              }
              onGoToInterrogation={() => setActiveTab('interrogation')}
            />
          )}

          {(activeTab === 'evidence' || activeTab === 'timeline') && (
            <DetectiveEvidenceAndTimeline
              caseData={currentCase}
              progress={currentProgress}
              mode={activeTab}
              onPinEvidenceToBoard={(ev: DetectiveEvidence) =>
                handlePinNode({
                  kind: 'evidence',
                  refId: ev.id,
                  title: ev.title,
                  subtitle: ev.typeLabel,
                })
              }
              onPinTimelineToBoard={(evt: DetectiveTimelineEvent) =>
                handlePinNode({
                  kind: 'timeline',
                  refId: evt.id,
                  title: `${evt.time} — ${evt.title}`,
                  subtitle: evt.isUncertain ? 'توقيت متناقض' : 'الخط الزمني',
                })
              }
            />
          )}

          {activeTab === 'corkboard' && (
            <DetectiveCorkboard
              caseData={currentCase}
              progress={currentProgress}
              onUpdateBoard={(nodes: DetectiveBoardNode[], links: DetectiveBoardLink[]) =>
                mutateCaseProgress(currentCase.id, (p) => ({
                  ...p,
                  boardNodes: nodes,
                  boardLinks: links,
                }))
              }
              onUpdateNotes={(notes: string) =>
                mutateCaseProgress(currentCase.id, (p) => ({
                  ...p,
                  personalNotes: notes,
                }))
              }
            />
          )}

          {activeTab === 'accusation' && (
            <DetectiveAccusationAndReveal
              caseData={currentCase}
              progress={currentProgress}
              mode={mode}
              revealedSolution={revealedSolution}
              verifying={verifying}
              lastAttemptFeedback={attemptFeedback}
              onSubmitSoloAccusation={handleSubmitSoloAccusation}
              onReturnToArchive={() => {
                setHubSubView('archive');
                setScreenMode('hub');
              }}
              onlineState={onlineState}
              players={players}
              currentPlayerId={currentPlayerId}
              isHost={isHost}
              onSubmitOnlineAccusation={(suspectId, reason) =>
                onOnlineAction?.('detective_submit_accusation', { suspectId, reason })
              }
              onHostCloseCase={() => onOnlineAction?.('detective_close_case')}
              onHostNextCase={() => onOnlineAction?.('detective_next_case')}
            />
          )}
        </div>
      )}

      {/* Optional 3-Tier Hint System Modal */}
      {showHintModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131217] border border-[#C89B3C]/45 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[86vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-base text-[#E5C16C] flex items-center gap-2">
                <Sparkles size={18} />
                نظام التلميحات المتدرج (اختياري)
              </h3>
              <button
                type="button"
                onClick={() => setShowHintModal(false)}
                className="text-[#9FA3AE] hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#9FA3AE]">
              التلميحات لا تفسد الحل ما لم تطلب فتح التلميح القوي، وكل تلميح تفتحه يخصم من مكافأة القضية فقط عند الحساب النهائي.
            </p>

            <div className="space-y-3">
              {currentCase.hints.map((h) => {
                const unlocked = currentProgress.usedHintTiers.includes(h.tier);
                return (
                  <div
                    key={h.tier}
                    className={`rounded-xl p-3.5 border ${
                      unlocked
                        ? 'bg-[#1E1714] border-[#C89B3C]/45'
                        : 'bg-[#0D0C10] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-black text-[#F3EFE6]">{h.title}</span>
                      <span className="text-[10px] font-bold text-[#F08088]">
                        -{h.costPoints} نقطة
                      </span>
                    </div>
                    {unlocked ? (
                      <p className="text-xs text-[#E5C16C] leading-relaxed">{h.text}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUseHint(h.tier)}
                        className="mt-1 bg-[#7A1219] hover:bg-[#961820] text-white px-3 py-1.5 rounded-lg text-[11px] font-black"
                      >
                        كشف هذا التلميح
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
