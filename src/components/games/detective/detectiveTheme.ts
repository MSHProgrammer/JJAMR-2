import type {
  DetectiveCasePublic,
  DetectiveCaseStatus,
  DetectiveDifficulty,
  DetectivePlayerCaseProgress,
  DetectiveProfileStats,
} from '../../../types/detective.ts';
import { DIFFICULTY_LEVELS } from '../../../data/detectivePublicCases.ts';

export const DETECTIVE_STORAGE_KEY = 'jamr_detective_profile_v1';

export const NOIR_COLORS = {
  bg: '#09080A',
  surface: '#131217',
  surfaceElevated: '#1A181F',
  leather: '#1E1714',
  crimson: '#7A1219',
  crimsonBright: '#A81D27',
  brass: '#C89B3C',
  brassSoft: '#E5C16C',
  parchment: '#E8DEC8',
  parchmentInk: '#251B12',
  cream: '#F3EFE6',
  muted: '#9FA3AE',
};

export function getDifficultyMeta(difficulty: DetectiveDifficulty) {
  return DIFFICULTY_LEVELS.find((d) => d.id === difficulty) || DIFFICULTY_LEVELS[0];
}

export function getCaseStatusBadge(status: DetectiveCaseStatus) {
  switch (status) {
    case 'closed':
      return {
        label: 'تم إغلاق القضية',
        className: 'bg-[#17281C] text-[#8DE098] border-[#386B43]',
        stamp: 'CASE CLOSED',
      };
    case 'in_progress':
      return {
        label: 'قيد التحقيق',
        className: 'bg-[#2B2212] text-[#E5C16C] border-[#C89B3C]/50',
        stamp: 'IN PROGRESS',
      };
    case 'unsolved':
      return {
        label: 'قضية لم يتم حلها',
        className: 'bg-[#2C1317] text-[#F18B93] border-[#7A1219]',
        stamp: 'UNSOLVED',
      };
    default:
      return {
        label: 'قضية مفتوحة',
        className: 'bg-[#1D1B22] text-[#D2CEC4] border-[#524E59]',
        stamp: 'OPEN FILE',
      };
  }
}

export function createInitialCaseProgress(caseItem: DetectiveCasePublic): DetectivePlayerCaseProgress {
  const initialEvidenceIds = caseItem.evidence
    .filter((e) => e.initiallyAvailable)
    .map((e) => e.id);

  // Seed a clean starter corkboard with initial facts/evidence so the board feels alive immediately
  const starterNodes = initialEvidenceIds.slice(0, 2).map((evId, idx) => {
    const ev = caseItem.evidence.find((e) => e.id === evId)!;
    return {
      id: `node_${ev.id}`,
      kind: 'evidence' as const,
      refId: ev.id,
      title: ev.title,
      subtitle: ev.typeLabel,
      x: 18 + idx * 34,
      y: 22 + idx * 14,
    };
  });

  return {
    caseId: caseItem.id,
    status: 'open',
    discoveredHotspotIds: [],
    savedEvidenceIds: initialEvidenceIds,
    reviewedSuspectIds: [],
    askedQuestionsBySuspect: {},
    usedHintTiers: [],
    personalNotes: '',
    hotspotNotes: {},
    boardNodes: starterNodes,
    boardLinks: [],
    wrongAccusations: 0,
    scoreEarned: 0,
    lastUpdatedAt: Date.now(),
  };
}

export function loadDetectiveProfile(): DetectiveProfileStats {
  try {
    const raw = localStorage.getItem(DETECTIVE_STORAGE_KEY);
    if (!raw) {
      return {
        totalPoints: 0,
        solvedCaseIds: [],
        attemptedCaseIds: [],
        progressByCase: {},
      };
    }
    const parsed = JSON.parse(raw) as DetectiveProfileStats;
    return {
      totalPoints: Number(parsed.totalPoints) || 0,
      solvedCaseIds: Array.isArray(parsed.solvedCaseIds) ? parsed.solvedCaseIds : [],
      attemptedCaseIds: Array.isArray(parsed.attemptedCaseIds) ? parsed.attemptedCaseIds : [],
      progressByCase: parsed.progressByCase || {},
    };
  } catch {
    return {
      totalPoints: 0,
      solvedCaseIds: [],
      attemptedCaseIds: [],
      progressByCase: {},
    };
  }
}

export function saveDetectiveProfile(stats: DetectiveProfileStats) {
  try {
    localStorage.setItem(DETECTIVE_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage quota errors
  }
}
