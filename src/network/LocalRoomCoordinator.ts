import Peer, { DataConnection } from 'peerjs';
import {
  BarrahCategory,
  BrokenTvReactionType,
  IsmFieldKey,
  IsmPlayerAnswers,
  Player,
  RoomState,
} from '../types/jamr';
import {
  appendSystemChat,
  applyBrokenTvReaction,
  applyBrokenTvStepSubmission,
  computeIsmScores,
  createInitialBrokenTvState,
  createInitialIsmState,
  generateRoomCode,
  pickUnusedArabicLetter,
  startBarrahOnlineRound,
  startMafiaOnlineRound,
} from '../shared/roomEngine';
import { DEFAULT_BARRAH_CATEGORIES } from '../data/barrahSalfaCategories';

type MessageListener = (payload: Record<string, unknown>) => void;

export class LocalRoomCoordinator {
  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private clientConns: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private room: RoomState | null = null;
  private localPlayerId: string = '';
  private listener: MessageListener;
  private categories: BarrahCategory[] = DEFAULT_BARRAH_CATEGORIES;

  constructor(listener: MessageListener) {
    this.listener = listener;
  }

  public setCategories(categories: BarrahCategory[]) {
    if (categories.length > 0) this.categories = categories;
  }

  public createRoom(params: {
    playerId: string;
    playerName: string;
    avatar: string;
    gameId: string;
    totalRounds?: number;
    isJudgeRoom?: boolean;
  }) {
    this.localPlayerId = params.playerId;
    const code = generateRoomCode();
    const maxPlayers = params.gameId === 'ism_hayawan' ? 100 : 16;

    const hostPlayer: Player = {
      id: params.playerId,
      name: params.playerName,
      avatar: params.avatar,
      isHost: true,
      isReady: true,
      team: null,
      score: 0,
      connected: true,
      isJudge: Boolean(params.isJudgeRoom),
    };

    const room: RoomState = {
      code,
      hostId: params.playerId,
      gameId: params.gameId,
      status: 'lobby',
      maxPlayers,
      players: [hostPlayer],
      messages: [],
      createdAt: Date.now(),
      isJudgeRoom: Boolean(params.isJudgeRoom),
      totalRounds: params.totalRounds || 5,
    };
    room.messages = appendSystemChat(room, `أنشأ ${params.playerName} الغرفة بنجاح (وضع P2P المباشر).`);
    this.room = room;

    this.setupHostTransport(code);
    this.emitRoomUpdate();
  }

  public joinRoom(params: {
    roomCode: string;
    playerId: string;
    playerName: string;
    avatar: string;
  }) {
    this.localPlayerId = params.playerId;
    const code = params.roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    try {
      this.broadcastChannel = new BroadcastChannel(`jamr_p2p_${code}`);
      this.broadcastChannel.onmessage = (ev) => {
        const data = ev.data;
        if (!data) return;
        if (data.type === 'room_state') {
          this.room = data.room;
          this.listener({ type: 'room_state', room: data.room });
        } else if (data.type === 'kicked' && data.targetId === this.localPlayerId) {
          this.listener({ type: 'kicked' });
          this.cleanup();
        }
      };
      this.broadcastChannel.postMessage({
        type: 'p2p_action',
        action: {
          type: 'join_room',
          roomCode: code,
          playerId: params.playerId,
          playerName: params.playerName,
          avatar: params.avatar,
        },
      });
    } catch {
      // BroadcastChannel unsupported
    }

    try {
      this.peer = new Peer();
      this.peer.on('open', () => {
        if (!this.peer) return;
        const conn = this.peer.connect(`jamr-room-${code}`);
        this.hostConn = conn;
        conn.on('open', () => {
          conn.send({
            type: 'join_room',
            roomCode: code,
            playerId: params.playerId,
            playerName: params.playerName,
            avatar: params.avatar,
          });
        });
        conn.on('data', (raw) => {
          const data = raw as Record<string, unknown>;
          if (data?.type === 'room_state') {
            this.room = data.room as RoomState;
            this.listener(data);
          } else if (data?.type === 'kicked') {
            this.listener({ type: 'kicked' });
            this.cleanup();
          } else if (data?.type === 'error') {
            this.listener(data);
          }
        });
      });
      this.peer.on('error', () => {
        if (!this.room) {
          this.listener({ type: 'error', message: 'تعذّر العثور على الغرفة برمزها عبر شبكة P2P.' });
        }
      });
    } catch {
      this.listener({ type: 'error', message: 'تعذّر بدء الاتصال المباشر.' });
    }
  }

  private setupHostTransport(code: string) {
    try {
      this.broadcastChannel = new BroadcastChannel(`jamr_p2p_${code}`);
      this.broadcastChannel.onmessage = (ev) => {
        const data = ev.data;
        if (data?.type === 'p2p_action' && data.action) {
          this.handleAction(data.action);
        }
      };
    } catch {
      // ignore
    }

    try {
      this.peer = new Peer(`jamr-room-${code}`);
      this.peer.on('connection', (conn) => {
        conn.on('data', (raw) => {
          const action = raw as Record<string, unknown>;
          if (action?.playerId) {
            this.clientConns.set(String(action.playerId), conn);
          }
          this.handleAction(action);
        });
        conn.on('open', () => {
          if (this.room) {
            conn.send({ type: 'room_state', room: this.room });
          }
        });
      });
    } catch {
      // ignore peer init errors
    }
  }

  public sendAction(action: Record<string, unknown>) {
    if (this.room && this.room.hostId === this.localPlayerId) {
      this.handleAction({ ...action, playerId: action.playerId || this.localPlayerId });
      return;
    }
    if (this.hostConn?.open) {
      this.hostConn.send({ ...action, playerId: this.localPlayerId });
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'p2p_action',
        action: { ...action, playerId: this.localPlayerId },
      });
    }
  }

  private emitRoomUpdate() {
    if (!this.room) return;
    this.listener({ type: 'room_state', room: this.room });
    this.clientConns.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'room_state', room: this.room });
      }
    });
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'room_state', room: this.room });
    }
  }

  private handleAction(action: Record<string, unknown>) {
    if (!this.room) return;
    const type = String(action.type || '');
    const pid = String(action.playerId || '');
    let room = this.room;

    switch (type) {
      case 'join_room': {
        const exists = room.players.some((p) => p.id === pid);
        if (!exists && room.players.length < room.maxPlayers) {
          const newPlayer: Player = {
            id: pid,
            name: String(action.playerName || 'لاعب'),
            avatar: String(action.avatar || '🔥'),
            isHost: false,
            isReady: false,
            team: null,
            score: 0,
            connected: true,
          };
          room = {
            ...room,
            players: [...room.players, newPlayer],
            messages: appendSystemChat(room, `انضم ${newPlayer.name} إلى الغرفة.`),
          };
        }
        break;
      }
      case 'toggle_ready': {
        room = {
          ...room,
          players: room.players.map((p) => (p.id === pid ? { ...p, isReady: !p.isReady } : p)),
        };
        break;
      }
      case 'set_team': {
        room = {
          ...room,
          players: room.players.map((p) =>
            p.id === pid ? { ...p, team: (action.team as 'A' | 'B' | null) || null } : p
          ),
        };
        break;
      }
      case 'change_game': {
        if (pid === room.hostId) {
          const newGameId = String(action.gameId || room.gameId);
          room = {
            ...room,
            gameId: newGameId,
            status: 'lobby',
            maxPlayers: newGameId === 'ism_hayawan' ? 100 : 16,
            brokenTv: undefined,
            ismHayawan: undefined,
            barrah: undefined,
            mafia: undefined,
            messages: appendSystemChat(room, 'قام المضيف بتغيير اللعبة داخل الغرفة.'),
          };
        }
        break;
      }
      case 'kick_player': {
        if (pid === room.hostId) {
          const targetId = String(action.targetId || '');
          const conn = this.clientConns.get(targetId);
          if (conn?.open) conn.send({ type: 'kicked' });
          this.broadcastChannel?.postMessage({ type: 'kicked', targetId });
          room = {
            ...room,
            players: room.players.filter((p) => p.id !== targetId),
          };
        }
        break;
      }
      case 'send_chat':
      case 'chat_message': {
        const sender = room.players.find((p) => p.id === pid);
        const text = String(action.text || '').trim().slice(0, 240);
        if (sender && text) {
          room = {
            ...room,
            messages: [
              ...room.messages,
              {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                senderId: sender.id,
                senderName: sender.name,
                senderAvatar: sender.avatar,
                text,
                timestamp: Date.now(),
              },
            ].slice(-80),
          };
        }
        break;
      }
      case 'return_to_lobby': {
        room = {
          ...room,
          status: 'lobby',
          brokenTv: undefined,
          ismHayawan: undefined,
          barrah: undefined,
          mafia: undefined,
        };
        break;
      }
      case 'start_game': {
        if (pid !== room.hostId) break;
        if (room.gameId === 'broken_tv') {
          const pace = (Number(action.paceSeconds) || 60) as 40 | 60 | 90;
          const bt = createInitialBrokenTvState(room.players, pace);
          bt.phase = 'write';
          bt.roundDeadline = Date.now() + pace * 1000;
          room = { ...room, status: 'playing', brokenTv: bt };
        } else if (room.gameId === 'ism_hayawan') {
          const rounds = Number(action.totalRounds || room.totalRounds || 5);
          const ism = createInitialIsmState(rounds, Boolean(room.isJudgeRoom), room.isJudgeRoom ? room.hostId : null);
          ism.phase = 'letter_spin';
          room = { ...room, status: 'playing', ismHayawan: ism };
        } else if (room.gameId === 'barrah_salfa') {
          room = startBarrahOnlineRound(room, String(action.categoryId || 'random_all'), this.categories);
        } else if (room.gameId === 'mafia_no_hakam') {
          room = startMafiaOnlineRound(room);
        }
        break;
      }
      case 'broken_tv_submit': {
        room = applyBrokenTvStepSubmission(room, pid, String(action.content || ''));
        break;
      }
      case 'broken_tv_react': {
        room = applyBrokenTvReaction(
          room,
          Number(action.chainIndex || 0),
          Number(action.stepIndex || 0),
          action.reaction as BrokenTvReactionType,
          pid
        );
        break;
      }
      case 'broken_tv_advance_reveal': {
        if (room.brokenTv) {
          const bt = room.brokenTv;
          const chain = bt.chains[bt.revealChainIndex];
          if (chain && bt.revealStepIndex + 1 < chain.steps.length) {
            room = { ...room, brokenTv: { ...bt, revealStepIndex: bt.revealStepIndex + 1 } };
          } else if (bt.revealChainIndex + 1 < bt.chains.length) {
            room = { ...room, brokenTv: { ...bt, revealChainIndex: bt.revealChainIndex + 1, revealStepIndex: 0 } };
          } else {
            room = { ...room, brokenTv: { ...bt, phase: 'podium' } };
          }
        }
        break;
      }
      case 'ism_hayawan_set_letter': {
        if (room.ismHayawan) {
          const letter = String(action.letter || pickUnusedArabicLetter(room.ismHayawan.usedLetters));
          room = {
            ...room,
            ismHayawan: {
              ...room.ismHayawan,
              currentLetter: letter,
              usedLetters: [...room.ismHayawan.usedLetters, letter],
              phase: 'writing',
              stoppedByPlayerName: null,
              answersByPlayer: {},
              disputes: [],
            },
          };
        }
        break;
      }
      case 'ism_hayawan_sync_answers': {
        if (room.ismHayawan) {
          room = {
            ...room,
            ismHayawan: {
              ...room.ismHayawan,
              answersByPlayer: {
                ...room.ismHayawan.answersByPlayer,
                [pid]: action.answers as IsmPlayerAnswers,
              },
            },
          };
        }
        break;
      }
      case 'ism_hayawan_stop': {
        if (room.ismHayawan && room.ismHayawan.phase === 'writing') {
          const stopper = room.players.find((p) => p.id === pid);
          const mergedAnswers = {
            ...room.ismHayawan.answersByPlayer,
            ...(action.answers ? { [pid]: action.answers as IsmPlayerAnswers } : {}),
          };
          const updatedIsm: NonNullable<RoomState['ismHayawan']> = {
            ...room.ismHayawan,
            phase: 'scoring',
            stoppedByPlayerName: stopper?.name || 'أحد اللاعبين',
            answersByPlayer: mergedAnswers,
          };
          const { fieldScoresByPlayer, roundTotalsByPlayer } = computeIsmScores(updatedIsm, room.players);
          updatedIsm.fieldScoresByPlayer = fieldScoresByPlayer;
          updatedIsm.roundTotalsByPlayer = roundTotalsByPlayer;
          room = {
            ...room,
            ismHayawan: updatedIsm,
            players: room.players.map((p) => ({
              ...p,
              score: p.score + (roundTotalsByPlayer[p.id] || 0),
            })),
          };
        }
        break;
      }
      case 'ism_hayawan_judge_score_adjust': {
        if (room.ismHayawan && pid === room.hostId) {
          const targetId = String(action.targetPlayerId || '');
          const delta = Number(action.delta || 0);
          room = {
            ...room,
            players: room.players.map((p) =>
              p.id === targetId ? { ...p, score: Math.max(0, p.score + delta) } : p
            ),
            ismHayawan: {
              ...room.ismHayawan,
              roundTotalsByPlayer: {
                ...room.ismHayawan.roundTotalsByPlayer,
                [targetId]: Math.max(0, (room.ismHayawan.roundTotalsByPlayer[targetId] || 0) + delta),
              },
            },
          };
        }
        break;
      }
      case 'ism_hayawan_dispute': {
        if (room.ismHayawan) {
          const challenger = room.players.find((p) => p.id === pid);
          const targetId = String(action.targetPlayerId || '');
          const target = room.players.find((p) => p.id === targetId);
          const field = action.field as IsmFieldKey;
          const word = String(action.word || '');
          const reviewer = room.ismHayawan.isJudgeRoom && room.ismHayawan.judgeId
            ? room.ismHayawan.judgeId
            : (room.players.find((p) => p.id !== pid && p.id !== targetId)?.id || room.hostId);
          room = {
            ...room,
            ismHayawan: {
              ...room.ismHayawan,
              disputes: [
                ...room.ismHayawan.disputes,
                {
                  id: `dsp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                  targetPlayerId: targetId,
                  targetPlayerName: target?.name || 'لاعب',
                  field,
                  word,
                  challengerId: pid,
                  challengerName: challenger?.name || 'لاعب',
                  assignedReviewerId: reviewer,
                  status: 'pending',
                },
              ],
            },
          };
        }
        break;
      }
      case 'ism_hayawan_resolve_dispute': {
        if (room.ismHayawan) {
          const disputeId = String(action.disputeId || '');
          const approved = Boolean(action.approved);
          const d = room.ismHayawan.disputes.find((x) => x.id === disputeId);
          if (d && d.status === 'pending') {
            const oldScore = room.ismHayawan.fieldScoresByPlayer[d.targetPlayerId]?.[d.field] || 0;
            const newScore = approved ? 10 : 0;
            const diff = newScore - oldScore;
            room = {
              ...room,
              players: room.players.map((p) =>
                p.id === d.targetPlayerId ? { ...p, score: Math.max(0, p.score + diff) } : p
              ),
              ismHayawan: {
                ...room.ismHayawan,
                disputes: room.ismHayawan.disputes.map((x) =>
                  x.id === disputeId ? { ...x, status: approved ? 'approved' : 'rejected' } : x
                ),
                fieldScoresByPlayer: {
                  ...room.ismHayawan.fieldScoresByPlayer,
                  [d.targetPlayerId]: {
                    ...(room.ismHayawan.fieldScoresByPlayer[d.targetPlayerId] || { name: 0, animal: 0, plant: 0, object: 0, country: 0 }),
                    [d.field]: newScore,
                  },
                },
                roundTotalsByPlayer: {
                  ...room.ismHayawan.roundTotalsByPlayer,
                  [d.targetPlayerId]: Math.max(0, (room.ismHayawan.roundTotalsByPlayer[d.targetPlayerId] || 0) + diff),
                },
              },
            };
          }
        }
        break;
      }
      case 'ism_hayawan_next_round': {
        if (room.ismHayawan && pid === room.hostId) {
          if (room.ismHayawan.currentRound >= room.ismHayawan.totalRounds) {
            room = { ...room, ismHayawan: { ...room.ismHayawan, phase: 'game_over' } };
          } else {
            room = {
              ...room,
              ismHayawan: {
                ...room.ismHayawan,
                currentRound: room.ismHayawan.currentRound + 1,
                phase: 'letter_spin',
                stoppedByPlayerName: null,
                answersByPlayer: {},
                disputes: [],
              },
            };
          }
        }
        break;
      }
      case 'barrah_mark_revealed': {
        if (room.barrah && !room.barrah.revealedPlayerIds.includes(pid)) {
          const revealedPlayerIds = [...room.barrah.revealedPlayerIds, pid];
          const allReady = revealedPlayerIds.length >= room.players.length;
          room = {
            ...room,
            barrah: {
              ...room.barrah,
              revealedPlayerIds,
              phase: allReady ? 'questions_stage' : room.barrah.phase,
            },
          };
        }
        break;
      }
      case 'barrah_next_pair': {
        if (room.barrah) {
          const pair = [...room.players].sort(() => Math.random() - 0.5);
          room = {
            ...room,
            barrah: {
              ...room.barrah,
              askerId: pair[0]?.id || room.barrah.askerId,
              answererId: pair[1]?.id || room.barrah.answererId,
            },
          };
        }
        break;
      }
      case 'barrah_start_voting': {
        if (room.barrah && pid === room.hostId) {
          room = { ...room, barrah: { ...room.barrah, phase: 'voting_pass' } };
        }
        break;
      }
      case 'barrah_vote': {
        if (room.barrah) {
          const targetId = String(action.targetId || '');
          if (targetId && targetId !== pid) {
            const votesByVoter = { ...room.barrah.votesByVoter, [pid]: targetId };
            const allVoted = Object.keys(votesByVoter).length >= room.players.length;
            if (!allVoted) {
              room = { ...room, barrah: { ...room.barrah, votesByVoter } };
            } else {
              const tally: Record<string, number> = {};
              Object.values(votesByVoter).forEach((v) => { tally[v] = (tally[v] || 0) + 1; });
              const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
              const topSuspect = sorted[0]?.[0];
              const caught = topSuspect === room.barrah.spyId;
              room = {
                ...room,
                barrah: {
                  ...room.barrah,
                  votesByVoter,
                  phase: caught ? 'final_chance' : 'results',
                  spyGuessDeadline: caught ? Date.now() + 25000 : null,
                  winner: caught ? null : 'spy',
                },
              };
            }
          }
        }
        break;
      }
      case 'barrah_spy_guess': {
        if (room.barrah && pid === room.barrah.spyId) {
          const guess = String(action.word || '');
          const won = guess === room.barrah.secretWord;
          room = {
            ...room,
            barrah: {
              ...room.barrah,
              spyGuess: guess,
              phase: 'results',
              winner: won ? 'spy' : 'insiders',
            },
          };
        }
        break;
      }
      case 'mafia_mark_revealed': {
        if (room.mafia && !room.mafia.revealedIds.includes(pid)) {
          const revealedIds = [...room.mafia.revealedIds, pid];
          const all = revealedIds.length >= room.players.length;
          room = {
            ...room,
            mafia: { ...room.mafia, revealedIds, phase: all ? 'night' : 'role_reveal' },
          };
        }
        break;
      }
      case 'mafia_night_action': {
        if (room.mafia && room.mafia.phase === 'night') {
          const role = room.mafia.rolesByPlayer[pid];
          const targetId = String(action.targetId || '');
          const nc = { ...room.mafia.nightChoices };
          if (role === 'mafia') nc.mafiaTarget = targetId;
          if (role === 'doctor') nc.doctorSave = targetId;
          if (role === 'detective') nc.detectiveCheck = targetId;

          const aliveRoles = room.mafia.aliveIds.map((id) => room.mafia!.rolesByPlayer[id]);
          const needMafia = aliveRoles.includes('mafia');
          const needDoc = aliveRoles.includes('doctor');
          const needDet = aliveRoles.includes('detective');
          const done =
            (!needMafia || Boolean(nc.mafiaTarget)) &&
            (!needDoc || Boolean(nc.doctorSave)) &&
            (!needDet || Boolean(nc.detectiveCheck));

          if (!done) {
            room = { ...room, mafia: { ...room.mafia, nightChoices: nc } };
          } else {
            const victimId = nc.mafiaTarget;
            const saved = victimId && victimId === nc.doctorSave;
            let aliveIds = [...room.mafia.aliveIds];
            let summary = 'انقضت الليلة بسلام! نجح الطبيب في إنقاذ الضحية.';
            if (victimId && !saved) {
              aliveIds = aliveIds.filter((id) => id !== victimId);
              const vName = room.players.find((p) => p.id === victimId)?.name || 'لاعب';
              summary = `مع الأسف! استيقظت المدينة على إقصاء ${vName} ليلاً.`;
            }
            const aliveMafia = aliveIds.filter((id) => room.mafia!.rolesByPlayer[id] === 'mafia').length;
            const aliveCitizens = aliveIds.length - aliveMafia;
            const winner = aliveMafia === 0 ? 'citizens' : aliveMafia >= aliveCitizens ? 'mafia' : null;
            room = {
              ...room,
              mafia: {
                ...room.mafia,
                nightChoices: nc,
                aliveIds,
                lastNightSummary: summary,
                phase: winner ? 'game_over' : 'day_announcement',
                winner,
              },
            };
          }
        }
        break;
      }
      case 'mafia_next_phase': {
        if (room.mafia && pid === room.hostId) {
          if (room.mafia.phase === 'day_announcement') {
            room = { ...room, mafia: { ...room.mafia, phase: 'day_discussion' } };
          } else if (room.mafia.phase === 'day_discussion') {
            room = { ...room, mafia: { ...room.mafia, phase: 'day_voting', dayVotes: {} } };
          }
        }
        break;
      }
      case 'mafia_day_vote': {
        if (room.mafia && room.mafia.phase === 'day_voting' && room.mafia.aliveIds.includes(pid)) {
          const targetId = String(action.targetId || '');
          const dayVotes = { ...room.mafia.dayVotes, [pid]: targetId };
          if (Object.keys(dayVotes).length < room.mafia.aliveIds.length) {
            room = { ...room, mafia: { ...room.mafia, dayVotes } };
          } else {
            const counts: Record<string, number> = {};
            Object.values(dayVotes).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
            const eliminatedId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
            const aliveIds = eliminatedId
              ? room.mafia.aliveIds.filter((id) => id !== eliminatedId)
              : room.mafia.aliveIds;
            const aliveMafia = aliveIds.filter((id) => room.mafia!.rolesByPlayer[id] === 'mafia').length;
            const aliveCitizens = aliveIds.length - aliveMafia;
            const winner = aliveMafia === 0 ? 'citizens' : aliveMafia >= aliveCitizens ? 'mafia' : null;
            room = {
              ...room,
              mafia: {
                ...room.mafia,
                dayVotes,
                aliveIds,
                dayNumber: room.mafia.dayNumber + 1,
                nightChoices: {},
                phase: winner ? 'game_over' : 'night',
                winner,
              },
            };
          }
        }
        break;
      }
      default:
        break;
    }

    this.room = room;
    this.emitRoomUpdate();
  }

  public cleanup() {
    try {
      this.hostConn?.close();
    } catch {
      // ignore
    }
    this.clientConns.forEach((c) => {
      try {
        c.close();
      } catch {
        // ignore
      }
    });
    this.clientConns.clear();
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    try {
      this.broadcastChannel?.close();
    } catch {
      // ignore
    }
    this.peer = null;
    this.hostConn = null;
    this.broadcastChannel = null;
    this.room = null;
  }
}
