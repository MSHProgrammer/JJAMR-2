import type { DetectiveOnlineState } from './detective.ts';

export type GameId =
  | 'broken_tv'
  | 'ism_hayawan'
  | 'jamrain'
  | 'huroof_jamr'
  | 'barrah_salfa'
  | 'mafia_no_hakam'
  | 'smart_detective'
  | 'sound_mimic';

export interface GameConfig {
  id: GameId | string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  imageUrl?: string;
  category: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  difficulty: 'سهلة' | 'متوسطة' | 'حماسية' | 'تكتيكية' | string;
  tags: string[];
  supportsOffline: boolean;
  supportsOnline: boolean;
  isActive: boolean;
  underMaintenance: boolean;
  maintenanceNote?: string;
  bgGradient: string;
  accentColor: string;
  rules: string[];
  specialMechanic?: string;
  isCustom?: boolean;
}

export interface Section {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export interface Topic {
  id: string;
  name: string;
  category: string;
  sectionId?: string;
  icon?: string;
  customImage?: string;
  coverImage?: string;
  illustrationKey?: string;
  description?: string;
}

export interface Question {
  id: string;
  topicId: string;
  points: 200 | 400 | 600 | number;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
  image?: string;
  video?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  isWebResearched?: boolean;
}

export interface JamrainFactItem {
  q: string;
  a: string;
  hint?: string;
  explanation?: string;
}

export interface JamrainTopicSpec {
  id: string;
  name: string;
  category: string;
  sectionId: string;
  icon: string;
  tier200: JamrainFactItem[];
  tier400: JamrainFactItem[];
  tier600: JamrainFactItem[];
}

export interface BarrahCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  words: string[];
}

export interface MimicSound {
  id: string;
  title: string;
  category: string;
  audioDataUrl?: string;
  durationSec?: number;
  hint?: string;
}

export interface BugReport {
  id: string;
  type: 'خلل تقني' | 'مشكلة في لعبة' | 'اقتراح تحسين' | 'محتوى غير مناسب' | string;
  gameId: string;
  gameTitle: string;
  description: string;
  reporterName: string;
  contact?: string;
  status: 'new' | 'investigating' | 'resolved';
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  avatarBg?: string;
  isHost: boolean;
  isReady: boolean;
  team?: 'A' | 'B' | null;
  score: number;
  connected: boolean;
  isJudge?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderAvatarBg?: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export type BrokenTvPhase =
  | 'home'
  | 'lobby'
  | 'welcome'
  | 'write'
  | 'draw'
  | 'guess'
  | 'reveal'
  | 'podium';

export type BrokenTvReactionType = 'funny' | 'shock' | 'art' | 'confuse';

export interface BrokenTvChainStep {
  stepIndex: number;
  type: 'write' | 'draw' | 'guess';
  authorId: string;
  authorName: string;
  content: string;
  reactions: Record<BrokenTvReactionType, string[]>;
}

export interface BrokenTvChain {
  ownerId: string;
  ownerName: string;
  steps: BrokenTvChainStep[];
}

export interface BrokenTvState {
  phase: BrokenTvPhase;
  paceSeconds: 40 | 60 | 90;
  currentStep: number;
  totalSteps: number;
  chains: BrokenTvChain[];
  submittedPlayerIds: string[];
  revealChainIndex: number;
  revealStepIndex: number;
  roundDeadline: number | null;
}

export type IsmFieldKey = 'name' | 'animal' | 'plant' | 'object' | 'country';

export interface IsmPlayerAnswers {
  name: string;
  animal: string;
  plant: string;
  object: string;
  country: string;
}

export interface IsmDispute {
  id: string;
  targetPlayerId: string;
  targetPlayerName: string;
  field: IsmFieldKey;
  word: string;
  challengerId: string;
  challengerName: string;
  assignedReviewerId: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface IsmFieldEvaluation {
  valid: boolean;
  source: 'gemini_ai' | 'fusha' | 'saudi' | 'manual' | 'rejected';
  reason: string;
}

export interface IsmHayawanState {
  phase: 'lobby' | 'letter_spin' | 'writing' | 'scoring' | 'leaderboard' | 'game_over';
  currentRound: number;
  totalRounds: number;
  currentLetter: string;
  usedLetters: string[];
  stoppedByPlayerName: string | null;
  answersByPlayer: Record<string, IsmPlayerAnswers>;
  fieldScoresByPlayer: Record<string, Record<IsmFieldKey, number>>;
  roundTotalsByPlayer: Record<string, number>;
  reasonsByPlayer?: Record<string, Record<IsmFieldKey, IsmFieldEvaluation>>;
  analyzedBy?: 'gemini_ai' | 'saudi_arabic_index' | 'manual';
  disputes: IsmDispute[];
  isJudgeRoom: boolean;
  judgeId: string | null;
}

export interface BarrahOnlineState {
  phase: 'setup' | 'category_vote' | 'reveal_cards' | 'questions_stage' | 'voting_pass' | 'final_chance' | 'results';
  categoryId: string;
  categoryName: string;
  categoryVotesByVoter?: Record<string, string>;
  categoryVoteDeadline?: number | null;
  secretWord: string;
  distractorWords: string[];
  spyId: string;
  askerId: string;
  answererId: string;
  votesByVoter: Record<string, string>;
  revealedPlayerIds: string[];
  spyGuess: string | null;
  spyGuessDeadline: number | null;
  winner: 'insiders' | 'spy' | null;
}

export interface MafiaOnlineState {
  phase: 'setup' | 'role_reveal' | 'night' | 'day_announcement' | 'day_discussion' | 'day_voting' | 'game_over';
  dayNumber: number;
  rolesByPlayer: Record<string, 'mafia' | 'doctor' | 'detective' | 'citizen'>;
  aliveIds: string[];
  revealedIds: string[];
  nightChoices: {
    mafiaTarget?: string;
    doctorSave?: string;
    detectiveCheck?: string;
  };
  detectiveResult?: { targetName: string; isMafia: boolean } | null;
  lastNightSummary: string;
  dayVotes: Record<string, string>;
  winner: 'citizens' | 'mafia' | null;
}

export interface RoomState {
  code: string;
  hostId: string;
  gameId: GameId | string;
  status: 'lobby' | 'playing' | 'finished';
  maxPlayers: number;
  players: Player[];
  messages: ChatMessage[];
  createdAt: number;
  isJudgeRoom?: boolean;
  totalRounds?: number;
  selectedCaseId?: string;
  brokenTv?: BrokenTvState;
  ismHayawan?: IsmHayawanState;
  barrah?: BarrahOnlineState;
  mafia?: MafiaOnlineState;
  detective?: DetectiveOnlineState;
}

export interface DataStoreSnapshot {
  sections: Section[];
  topics: Topic[];
  questions: Question[];
  games: GameConfig[];
  barrahCategories: BarrahCategory[];
  reports: BugReport[];
  mimicSounds: MimicSound[];
}
