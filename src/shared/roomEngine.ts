import type {
  BarrahCategory,
  BrokenTvChain,
  BrokenTvReactionType,
  BrokenTvState,
  ChatMessage,
  IsmFieldEvaluation,
  IsmFieldKey,
  IsmHayawanState,
  IsmPlayerAnswers,
  Player,
  RoomState,
} from '../types/jamr.ts';
import { ARABIC_LETTERS } from '../data/huroofBank.ts';
import { DEFAULT_BARRAH_CATEGORIES } from '../data/barrahSalfaCategories.ts';
import { checkArabicSaudiDictionary } from '../data/arabicSaudiDictionary.ts';
import { normalizeArabic, wordStartsWithLetter } from '../utils/arabicNormalize.ts';

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createInitialBrokenTvState(players: Player[], paceSeconds: 40 | 60 | 90 = 60): BrokenTvState {
  const active = players.filter((p) => !p.isJudge);
  const totalSteps = Math.max(3, active.length);
  const chains: BrokenTvChain[] = active.map((p) => ({
    ownerId: p.id,
    ownerName: p.name,
    steps: [],
  }));
  return {
    phase: 'lobby',
    paceSeconds,
    currentStep: 0,
    totalSteps,
    chains,
    submittedPlayerIds: [],
    revealChainIndex: 0,
    revealStepIndex: 0,
    roundDeadline: null,
  };
}

export function createInitialIsmState(
  totalRounds = 5,
  isJudgeRoom = false,
  judgeId: string | null = null
): IsmHayawanState {
  return {
    phase: 'lobby',
    currentRound: 1,
    totalRounds: Math.max(1, Math.min(50, totalRounds)),
    currentLetter: 'أ',
    usedLetters: [],
    stoppedByPlayerName: null,
    answersByPlayer: {},
    fieldScoresByPlayer: {},
    roundTotalsByPlayer: {},
    reasonsByPlayer: {},
    analyzedBy: 'saudi_arabic_index',
    disputes: [],
    isJudgeRoom,
    judgeId,
  };
}

export function areAllIsmFieldsFilled(answers?: Partial<IsmPlayerAnswers> | null): boolean {
  if (!answers) return false;
  const fields: IsmFieldKey[] = ['name', 'animal', 'plant', 'object', 'country'];
  return fields.every((f) => typeof answers[f] === 'string' && answers[f]!.trim().length > 0);
}

export function computeIsmScores(state: IsmHayawanState, players: Player[]): {
  fieldScoresByPlayer: Record<string, Record<IsmFieldKey, number>>;
  roundTotalsByPlayer: Record<string, number>;
  reasonsByPlayer: Record<string, Record<IsmFieldKey, IsmFieldEvaluation>>;
} {
  const fields: IsmFieldKey[] = ['name', 'animal', 'plant', 'object', 'country'];
  const activePlayers = players.filter((p) => !p.isJudge);
  const fieldScoresByPlayer: Record<string, Record<IsmFieldKey, number>> = {};
  const roundTotalsByPlayer: Record<string, number> = {};
  const reasonsByPlayer: Record<string, Record<IsmFieldKey, IsmFieldEvaluation>> = {};

  for (const p of activePlayers) {
    fieldScoresByPlayer[p.id] = { name: 0, animal: 0, plant: 0, object: 0, country: 0 };
    roundTotalsByPlayer[p.id] = 0;
    reasonsByPlayer[p.id] = {
      name: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      animal: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      plant: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      object: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      country: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
    };
  }

  for (const field of fields) {
    const normalizedCounts: Record<string, number> = {};
    const validByPlayer: Record<string, string> = {};

    for (const p of activePlayers) {
      const raw = state.answersByPlayer[p.id]?.[field] || '';
      const trimmed = raw.trim();
      if (!trimmed) continue;

      const check = checkArabicSaudiDictionary(trimmed, state.currentLetter, field);
      if (check.validStart || wordStartsWithLetter(trimmed, state.currentLetter)) {
        const norm = normalizeArabic(trimmed);
        validByPlayer[p.id] = norm;
        normalizedCounts[norm] = (normalizedCounts[norm] || 0) + 1;

        reasonsByPlayer[p.id][field] = check.knownInIndex
          ? {
              valid: true,
              source: check.source === 'saudi' ? 'saudi' : 'fusha',
              reason: check.source === 'saudi' ? 'موثقة في فهرس اللهجة السعودية' : 'موثقة في الفهرس العربي',
            }
          : {
              valid: true,
              source: 'fusha',
              reason: 'تبدأ بالحرف المطلوب',
            };
      } else {
        reasonsByPlayer[p.id][field] = {
          valid: false,
          source: 'rejected',
          reason: `لا تبدأ بحرف (${state.currentLetter})`,
        };
      }
    }

    for (const p of activePlayers) {
      const norm = validByPlayer[p.id];
      if (!norm) {
        fieldScoresByPlayer[p.id][field] = 0;
      } else {
        const pts = normalizedCounts[norm] > 1 ? 5 : 10;
        fieldScoresByPlayer[p.id][field] = pts;
        roundTotalsByPlayer[p.id] += pts;
      }
    }
  }

  return { fieldScoresByPlayer, roundTotalsByPlayer, reasonsByPlayer };
}

export function startBarrahCategoryVote(room: RoomState): RoomState {
  return {
    ...room,
    status: 'playing',
    barrah: {
      phase: 'category_vote',
      categoryId: '',
      categoryName: '',
      categoryVotesByVoter: {},
      secretWord: '',
      distractorWords: [],
      spyId: '',
      askerId: '',
      answererId: '',
      votesByVoter: {},
      revealedPlayerIds: [],
      spyGuess: null,
      spyGuessDeadline: null,
      winner: null,
    },
  };
}

export function startBarrahOnlineRound(
  room: RoomState,
  categoryId: string,
  categories: BarrahCategory[] = DEFAULT_BARRAH_CATEGORIES
): RoomState {
  const pool =
    !categoryId || categoryId === 'random_all'
      ? categories
      : categories.filter((c) => c.id === categoryId);
  const chosenCat =
    pool[Math.floor(Math.random() * pool.length)] || categories[0];
  const uniqueCategoryWords = Array.from(new Set(chosenCat.words.map((w) => w.trim()).filter(Boolean)));
  const shuffledCategoryWords = [...uniqueCategoryWords].sort(() => Math.random() - 0.5);
  const secretWord = shuffledCategoryWords[0] || 'قهوة عربية';
  const sameTopicDistractors = shuffledCategoryWords.filter((w) => w !== secretWord).slice(0, 9);

  const fallbackAllWords =
    sameTopicDistractors.length < 9
      ? Array.from(
          new Set(
            categories
              .flatMap((c) => c.words)
              .filter((w) => w !== secretWord && !sameTopicDistractors.includes(w))
          )
        ).sort(() => Math.random() - 0.5)
      : [];

  const distractorWords = Array.from(
    new Set([secretWord, ...sameTopicDistractors, ...fallbackAllWords])
  )
    .slice(0, 10)
    .sort(() => Math.random() - 0.5);

  const connectedPlayers = room.players.filter((p) => p.connected);
  const players = connectedPlayers.length > 0 ? connectedPlayers : room.players;
  const spy = players[Math.floor(Math.random() * players.length)] || room.players[0];
  const pair = [...players].sort(() => Math.random() - 0.5);
  const asker = pair[0] || spy;
  const answerer = pair[1] || spy;

  return {
    ...room,
    status: 'playing',
    barrah: {
      phase: 'reveal_cards',
      categoryId: chosenCat.id,
      categoryName: chosenCat.name,
      categoryVotesByVoter: room.barrah?.categoryVotesByVoter || {},
      secretWord,
      distractorWords,
      spyId: spy.id,
      askerId: asker.id,
      answererId: answerer.id,
      votesByVoter: {},
      revealedPlayerIds: [],
      spyGuess: null,
      spyGuessDeadline: null,
      winner: null,
    },
  };
}

export function finalizeBarrahCategoryVote(
  room: RoomState,
  categories: BarrahCategory[] = DEFAULT_BARRAH_CATEGORIES
): RoomState {
  if (!room.barrah) return room;
  const votes = room.barrah.categoryVotesByVoter || {};
  const counts: Record<string, number> = {};
  Object.values(votes).forEach((catId) => {
    if (catId) counts[catId] = (counts[catId] || 0) + 1;
  });
  const entries = Object.entries(counts);
  let winningCategoryId = 'random_all';
  if (entries.length > 0) {
    const maxCount = Math.max(...entries.map(([, c]) => c));
    const tied = entries.filter(([, c]) => c === maxCount).map(([id]) => id);
    winningCategoryId = tied[Math.floor(Math.random() * tied.length)] || 'random_all';
  }
  return startBarrahOnlineRound(room, winningCategoryId, categories);
}

export function applyBarrahCategoryVote(
  room: RoomState,
  playerId: string,
  categoryId: string,
  categories: BarrahCategory[] = DEFAULT_BARRAH_CATEGORIES
): RoomState {
  if (!room.barrah || room.barrah.phase !== 'category_vote') return room;
  const validCat = categoryId === 'random_all' || categories.some((c) => c.id === categoryId);
  if (!validCat) return room;

  const categoryVotesByVoter = {
    ...(room.barrah.categoryVotesByVoter || {}),
    [playerId]: categoryId,
  };
  const updatedRoom: RoomState = {
    ...room,
    barrah: {
      ...room.barrah,
      categoryVotesByVoter,
    },
  };

  const activePlayers = room.players.filter((p) => p.connected);
  const needed = Math.max(1, activePlayers.length || room.players.length);
  if (Object.keys(categoryVotesByVoter).length >= needed) {
    return finalizeBarrahCategoryVote(updatedRoom, categories);
  }
  return updatedRoom;
}

export function startMafiaOnlineRound(room: RoomState): RoomState {
  const players = [...room.players].sort(() => Math.random() - 0.5);
  const count = players.length;
  const mafiaCount = count >= 9 ? 3 : count >= 6 ? 2 : 1;
  const hasDetective = count >= 6;
  const rolesByPlayer: Record<string, 'mafia' | 'doctor' | 'detective' | 'citizen'> = {};

  players.forEach((p, idx) => {
    if (idx < mafiaCount) {
      rolesByPlayer[p.id] = 'mafia';
    } else if (idx === mafiaCount) {
      rolesByPlayer[p.id] = 'doctor';
    } else if (hasDetective && idx === mafiaCount + 1) {
      rolesByPlayer[p.id] = 'detective';
    } else {
      rolesByPlayer[p.id] = 'citizen';
    }
  });

  return {
    ...room,
    status: 'playing',
    mafia: {
      phase: 'role_reveal',
      dayNumber: 1,
      rolesByPlayer,
      aliveIds: players.map((p) => p.id),
      revealedIds: [],
      nightChoices: {},
      detectiveResult: null,
      lastNightSummary: '',
      dayVotes: {},
      winner: null,
    },
  };
}

export function applyBrokenTvStepSubmission(
  room: RoomState,
  playerId: string,
  content: string
): RoomState {
  if (!room.brokenTv) return room;
  const bt = room.brokenTv;
  const players = room.players.filter((p) => !p.isJudge);
  const pIdx = players.findIndex((p) => p.id === playerId);
  if (pIdx === -1) return room;
  if (bt.submittedPlayerIds.includes(playerId)) return room;

  const chainIdx = (pIdx - bt.currentStep + players.length * 10) % players.length;
  const stepType: 'write' | 'draw' | 'guess' =
    bt.currentStep === 0 ? 'write' : bt.currentStep % 2 === 1 ? 'draw' : 'guess';

  const chains = bt.chains.map((ch, idx) => {
    if (idx !== chainIdx) return ch;
    const filtered = ch.steps.filter((s) => s.stepIndex !== bt.currentStep);
    return {
      ...ch,
      steps: [
        ...filtered,
        {
          stepIndex: bt.currentStep,
          type: stepType,
          authorId: playerId,
          authorName: players[pIdx].name,
          content,
          reactions: { funny: [], shock: [], art: [], confuse: [] },
        },
      ].sort((a, b) => a.stepIndex - b.stepIndex),
    };
  });

  const submittedPlayerIds = [...bt.submittedPlayerIds, playerId];
  const allDone = submittedPlayerIds.length >= players.length;

  if (!allDone) {
    return {
      ...room,
      brokenTv: { ...bt, chains, submittedPlayerIds },
    };
  }

  const nextStep = bt.currentStep + 1;
  if (nextStep >= bt.totalSteps) {
    return {
      ...room,
      brokenTv: {
        ...bt,
        chains,
        submittedPlayerIds: [],
        phase: 'reveal',
        revealChainIndex: 0,
        revealStepIndex: 0,
        roundDeadline: null,
      },
    };
  }

  const nextPhase = nextStep % 2 === 1 ? 'draw' : 'guess';
  return {
    ...room,
    brokenTv: {
      ...bt,
      chains,
      currentStep: nextStep,
      phase: nextPhase,
      submittedPlayerIds: [],
      roundDeadline: Date.now() + bt.paceSeconds * 1000,
    },
  };
}

export function applyBrokenTvReaction(
  room: RoomState,
  chainIndex: number,
  stepIndex: number,
  reaction: BrokenTvReactionType,
  playerId: string
): RoomState {
  if (!room.brokenTv) return room;
  const chains = room.brokenTv.chains;
  const updatedChains = chains.map((ch, cIdx) => {
    if (cIdx !== chainIndex) return ch;
    return {
      ...ch,
      steps: ch.steps.map((st) => {
        if (st.stepIndex !== stepIndex) return st;
        const currentList = st.reactions[reaction] || [];
        const exists = currentList.includes(playerId);
        return {
          ...st,
          reactions: {
            ...st.reactions,
            [reaction]: exists
              ? currentList.filter((id) => id !== playerId)
              : [...currentList, playerId],
          },
        };
      }),
    };
  });

  return {
    ...room,
    brokenTv: {
      ...room.brokenTv,
      chains: updatedChains,
    },
  };
}

export function appendSystemChat(room: RoomState, text: string): ChatMessage[] {
  const msg: ChatMessage = {
    id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    senderId: 'system',
    senderName: 'جَمْر',
    senderAvatar: '🔥',
    text,
    timestamp: Date.now(),
    isSystem: true,
  };
  return [...room.messages, msg].slice(-80);
}

export function pickUnusedArabicLetter(used: string[]): string {
  const remaining = ARABIC_LETTERS.filter((l) => !used.includes(l));
  const pool = remaining.length > 0 ? remaining : ARABIC_LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export type { IsmPlayerAnswers };
