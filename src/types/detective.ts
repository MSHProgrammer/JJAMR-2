export type DetectiveDifficulty = 'beginner' | 'detective' | 'expert' | 'genius' | 'legendary';

export type DetectiveCategory =
  | 'mysterious'
  | 'disappearance'
  | 'family_secrets'
  | 'theft'
  | 'deception';

export type DetectiveCaseStatus = 'open' | 'in_progress' | 'closed' | 'unsolved';

export interface SceneHotspot {
  id: string;
  title: string;
  xPercent: number;
  yPercent: number;
  icon: string;
  description: string;
  relatedInfo: string;
  unlocksEvidenceId?: string;
}

export interface DetectiveSuspect {
  id: string;
  name: string;
  age: number;
  role: string;
  relationToCase: string;
  monogram: string;
  accentTone: string;
  bio: string;
  initialStatement: string;
  alibiClaim: string;
  motiveClue: string;
  relationships: Array<{ targetName: string; relation: string }>;
  interrogationQuestions: Array<{
    id: string;
    question: string;
    category: 'alibi' | 'motive' | 'evidence' | 'relation';
    answer: string;
    revealsContradiction?: string;
    unlocksEvidenceId?: string;
  }>;
}

export interface DetectiveEvidence {
  id: string;
  title: string;
  type: 'document' | 'photo' | 'letter' | 'note' | 'log' | 'record' | 'testimony' | 'physical';
  typeLabel: string;
  foundAt: string;
  summary: string;
  documentText: string;
  keyDetail: string;
  initiallyAvailable: boolean;
  linkedSuspectIds?: string[];
}

export interface DetectiveTimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  isUncertain?: boolean;
  contradictionNote?: string;
  involvedPeople: string[];
}

export interface DetectiveHint {
  tier: 1 | 2 | 3;
  title: string;
  costPoints: number;
  text: string;
}

export interface DetectiveCaseSolution {
  culpritId: string;
  culpritName: string;
  motive: string;
  method: string;
  timelineTruth: string[];
  proofEvidenceIds: string[];
  keyContradictions: string[];
  whyOthersAreInnocent: Array<{
    suspectId: string;
    suspectName: string;
    reason: string;
  }>;
  closingNarrative: string;
}

export interface DetectiveCasePublic {
  id: string;
  caseNumber: string;
  orderIndex: number;
  title: string;
  subtitle: string;
  difficulty: DetectiveDifficulty;
  category: DetectiveCategory;
  categoryLabel: string;
  location: string;
  inStoryDate: string;
  inStoryTime: string;
  coverImage: string;
  sceneImage: string;
  teaser: string;
  briefingNarrative: string;
  initialFacts: string[];
  estimatedMinutes: number;
  baseRewardPoints: number;
  hotspots: SceneHotspot[];
  suspects: DetectiveSuspect[];
  evidence: DetectiveEvidence[];
  timeline: DetectiveTimelineEvent[];
  hints: DetectiveHint[];
  generalInterrogationResponses: Record<string, string>;
}

export interface DetectiveCaseFull extends DetectiveCasePublic {
  solution: DetectiveCaseSolution;
}

export interface DetectiveBoardNode {
  id: string;
  kind: 'suspect' | 'evidence' | 'note' | 'timeline';
  refId: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
}

export interface DetectiveBoardLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}

export interface DetectivePlayerCaseProgress {
  caseId: string;
  status: DetectiveCaseStatus;
  discoveredHotspotIds: string[];
  savedEvidenceIds: string[];
  reviewedSuspectIds: string[];
  askedQuestionsBySuspect: Record<string, string[]>;
  usedHintTiers: number[];
  personalNotes: string;
  hotspotNotes: Record<string, string>;
  boardNodes: DetectiveBoardNode[];
  boardLinks: DetectiveBoardLink[];
  wrongAccusations: number;
  scoreEarned: number;
  solvedAt?: string;
  lastUpdatedAt: number;
}

export interface DetectiveProfileStats {
  totalPoints: number;
  solvedCaseIds: string[];
  attemptedCaseIds: string[];
  progressByCase: Record<string, DetectivePlayerCaseProgress>;
}

export type DetectiveRoomPhase =
  | 'briefing'
  | 'exploration'
  | 'investigation'
  | 'discussion'
  | 'accusation'
  | 'case_closed';

export interface DetectiveRoomPlayerProgress {
  cluesFoundCount: number;
  suspectsReviewedCount: number;
  hintsUsed: number;
  readyForNext: boolean;
}

export interface DetectivePlayerAccusation {
  suspectId: string;
  reason: string;
  submittedAt: number;
}

export interface DetectivePlayerRoundResult {
  playerId: string;
  playerName: string;
  avatar: string;
  avatarBg?: string;
  accusedSuspectId: string | null;
  accusedSuspectName: string;
  isCorrect: boolean;
  pointsDelta: number;
  cluesFoundCount: number;
  hintsUsed: number;
}

export interface DetectiveOnlineState {
  caseId: string;
  phase: DetectiveRoomPhase;
  phaseDeadline: number | null;
  progressByPlayer: Record<string, DetectiveRoomPlayerProgress>;
  // Masked in transit until phase === 'case_closed'
  submittedAccuserIds: string[];
  accusationsByPlayer?: Record<string, DetectivePlayerAccusation>;
  revealedSolution?: DetectiveCaseSolution | null;
  resultsByPlayer?: DetectivePlayerRoundResult[];
}
