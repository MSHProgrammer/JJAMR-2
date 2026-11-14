import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import {
  Dice5,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  QrCode,
  Copy,
  Check,
  UserPlus,
  X,
  HelpCircle,
  Trophy,
  ArrowLeft,
  Tv,
  Sparkles,
} from 'lucide-react';
import {
  BrokenTvChain,
  BrokenTvPhase,
  BrokenTvReactionType,
  RoomState,
} from '../../types/jamr';
import {
  BROKEN_TV_BRUSH_SIZES,
  BROKEN_TV_COLORS,
  BROKEN_TV_REACTIONS,
  BROKEN_TV_STARTER_PROMPTS,
} from '../../data/brokenTvPrompts';
import { SoundFX } from '../../utils/soundFx';

interface BrokenTvEngineProps {
  mode: 'offline' | 'online';
  playerName: string;
  room?: RoomState | null;
  localPlayerId?: string;
  onSendAction?: (payload: Record<string, unknown>) => void;
  onJoinOnlineRoom?: (code: string, name: string) => void;
  onCreateOnlineRoom?: (name: string) => void;
  onExit: () => void;
}

const RetroTvLogo: React.FC<{ size?: number }> = ({ size = 76 }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
    {/* Dual Antennas */}
    <path d="M46 32 L28 10" stroke="#24141D" strokeWidth="5" strokeLinecap="round" />
    <path d="M74 32 L92 10" stroke="#24141D" strokeWidth="5" strokeLinecap="round" />
    <circle cx="28" cy="10" r="5" fill="#E62E1B" stroke="#24141D" strokeWidth="3" />
    <circle cx="92" cy="10" r="5" fill="#FFB703" stroke="#24141D" strokeWidth="3" />
    {/* TV Box harmonized with JAMR Logo Ember Orange */}
    <rect x="14" y="30" width="92" height="72" rx="18" fill="#FF6B00" stroke="#24141D" strokeWidth="5" />
    {/* Screen */}
    <rect x="24" y="42" width="54" height="48" rx="10" fill="#0D9488" stroke="#24141D" strokeWidth="4" />
    {/* Screen Scanlines & Glare */}
    <path d="M30 52 L44 52 M30 60 L58 60 M30 68 L48 68" stroke="#CCFBF1" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    <path d="M36 78 C42 84, 58 84, 66 76" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    {/* Channel Dials */}
    <circle cx="92" cy="54" r="7" fill="#FFFBF5" stroke="#24141D" strokeWidth="3" />
    <circle cx="92" cy="74" r="7" fill="#FFB703" stroke="#24141D" strokeWidth="3" />
    {/* TV Legs */}
    <path d="M34 102 L26 114 M86 102 L94 114" stroke="#24141D" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

function formatRoomCode(code: string): string {
  const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length === 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return clean;
}

export const BrokenTvEngine: React.FC<BrokenTvEngineProps> = ({
  mode,
  playerName,
  room,
  localPlayerId,
  onSendAction,
  onJoinOnlineRoom,
  onCreateOnlineRoom,
  onExit,
}) => {
  const isOnline = mode === 'online' && Boolean(room);
  const bt = room?.brokenTv;

  // Offline local state
  const [offlinePhase, setOfflinePhase] = useState<BrokenTvPhase>('home');
  const [homeSubview, setHomeSubview] = useState<'menu' | 'start_name' | 'join_input'>('menu');
  const [tempName, setTempName] = useState(playerName || 'لاعب');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [offlineRoomCode] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  });
  const [offlinePlayers, setOfflinePlayers] = useState<Array<{ id: string; name: string }>>([
    { id: 'loc_1', name: playerName || 'اللاعب 1' },
    { id: 'loc_2', name: 'اللاعب 2' },
    { id: 'loc_3', name: 'اللاعب 3' },
  ]);
  const [newFriendName, setNewFriendName] = useState('');
  const [paceSeconds, setPaceSeconds] = useState<40 | 60 | 90>(60);
  const [offlineChains, setOfflineChains] = useState<BrokenTvChain[]>([]);
  const [offlineStep, setOfflineStep] = useState(0);
  const [offlinePlayerTurn, setOfflinePlayerTurn] = useState(0);
  const [offlinePassReady, setOfflinePassReady] = useState(false);
  const [offlineRevealChain, setOfflineRevealChain] = useState(0);
  const [offlineRevealStep, setOfflineRevealStep] = useState(0);

  // Modals & UI helpers
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Write & Guess inputs
  const [promptInput, setPromptInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);

  // Drawing canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [brushColor, setBrushColor] = useState('#24141D');
  const [brushSize, setBrushSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const activePhase: BrokenTvPhase = isOnline && bt ? bt.phase : offlinePhase;
  const displayRoomCode = formatRoomCode(isOnline && room ? room.code : offlineRoomCode);
  const activePace = isOnline && bt ? bt.paceSeconds : paceSeconds;

  const isHost = isOnline ? room?.hostId === localPlayerId : true;
  const activePlayers = isOnline && room
    ? room.players.filter((p) => !p.isJudge)
    : offlinePlayers;

  // Countdown Timer
  useEffect(() => {
    if (!['write', 'draw', 'guess'].includes(activePhase)) return;
    if (mode === 'offline' && !offlinePassReady) return;
    setTimeLeft(activePace);
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        if (prev <= 6) SoundFX.playTick(true);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activePhase, activePace, offlineStep, offlinePlayerTurn, offlinePassReady, mode]);

  // Welcome transition screen -> write
  useEffect(() => {
    if (offlinePhase !== 'welcome') return;
    const t = window.setTimeout(() => {
      setOfflinePhase('write');
      setOfflinePassReady(false);
    }, 1800);
    return () => clearTimeout(t);
  }, [offlinePhase]);

  // Initialize Canvas on draw screen
  useEffect(() => {
    if (activePhase !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const initial = canvas.toDataURL('image/png');
    setHistoryStack([initial]);
    setRedoStack([]);
  }, [activePhase, offlineStep, offlinePlayerTurn, offlinePassReady]);

  // Confetti on Podium
  useEffect(() => {
    if (activePhase === 'podium') {
      SoundFX.playVictory();
      void confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
    }
  }, [activePhase]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isEraser ? '#FFFFFF' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(pos.x + 0.01, pos.y + 0.01);
    ctx.stroke();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snap = canvas.toDataURL('image/png');
    setHistoryStack((prev) => [...prev.slice(-24), snap]);
    setRedoStack([]);
  };

  const restoreSnapshot = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  const handleUndo = () => {
    if (historyStack.length <= 1) return;
    SoundFX.playClick();
    const current = historyStack[historyStack.length - 1];
    const nextHist = historyStack.slice(0, -1);
    setHistoryStack(nextHist);
    setRedoStack((r) => [...r, current]);
    restoreSnapshot(nextHist[nextHist.length - 1]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    SoundFX.playClick();
    const last = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistoryStack((h) => [...h, last]);
    restoreSnapshot(last);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    SoundFX.playClick();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHistoryStack((prev) => [...prev.slice(-24), canvas.toDataURL('image/png')]);
    setRedoStack([]);
  };

  const startOfflineGame = () => {
    if (offlinePlayers.length < 3) return;
    SoundFX.playTileSelect();
    const chains: BrokenTvChain[] = offlinePlayers.map((p) => ({
      ownerId: p.id,
      ownerName: p.name,
      steps: [],
    }));
    setOfflineChains(chains);
    setOfflineStep(0);
    setOfflinePlayerTurn(0);
    setOfflinePassReady(false);
    setPromptInput('');
    setGuessInput('');
    setOfflinePhase('welcome');
  };

  const submitOfflineTurn = (content: string) => {
    SoundFX.playCorrect();
    const n = offlinePlayers.length;
    const chainIdx = (offlinePlayerTurn - offlineStep + n * 10) % n;
    const player = offlinePlayers[offlinePlayerTurn];
    const stepType: 'write' | 'draw' | 'guess' =
      offlineStep === 0 ? 'write' : offlineStep % 2 === 1 ? 'draw' : 'guess';

    const updated = offlineChains.map((ch, idx) => {
      if (idx !== chainIdx) return ch;
      return {
        ...ch,
        steps: [
          ...ch.steps,
          {
            stepIndex: offlineStep,
            type: stepType,
            authorId: player.id,
            authorName: player.name,
            content,
            reactions: { funny: [], shock: [], art: [], confuse: [] },
          },
        ],
      };
    });
    setOfflineChains(updated);
    setPromptInput('');
    setGuessInput('');

    if (offlinePlayerTurn + 1 < n) {
      setOfflinePlayerTurn(offlinePlayerTurn + 1);
      setOfflinePassReady(false);
    } else if (offlineStep + 1 < n) {
      const nextStep = offlineStep + 1;
      setOfflineStep(nextStep);
      setOfflinePlayerTurn(0);
      setOfflinePassReady(false);
      setOfflinePhase(nextStep % 2 === 1 ? 'draw' : 'guess');
    } else {
      setOfflineRevealChain(0);
      setOfflineRevealStep(0);
      setOfflinePhase('reveal');
    }
  };

  const handleToggleOfflineReaction = (
    chainIdx: number,
    stepIdx: number,
    reaction: BrokenTvReactionType
  ) => {
    SoundFX.playClick();
    const actor = 'local_voter';
    setOfflineChains((prev) =>
      prev.map((ch, cIdx) => {
        if (cIdx !== chainIdx) return ch;
        return {
          ...ch,
          steps: ch.steps.map((st) => {
            if (st.stepIndex !== stepIdx) return st;
            const list = st.reactions[reaction] || [];
            const exists = list.includes(actor);
            return {
              ...st,
              reactions: {
                ...st.reactions,
                [reaction]: exists ? list.filter((x) => x !== actor) : [...list, actor],
              },
            };
          }),
        };
      })
    );
  };

  // Current chain data for Online or Offline
  const currentChains: BrokenTvChain[] = isOnline && bt ? bt.chains : offlineChains;
  const myOnlineIdx = isOnline && room
    ? activePlayers.findIndex((p) => p.id === localPlayerId)
    : offlinePlayerTurn;
  const activeStepNum = isOnline && bt ? bt.currentStep : offlineStep;
  const targetChainIdx =
    activePlayers.length > 0 && myOnlineIdx >= 0
      ? (myOnlineIdx - activeStepNum + activePlayers.length * 10) % activePlayers.length
      : 0;
  const targetChain = currentChains[targetChainIdx];
  const previousStep = targetChain?.steps[activeStepNum - 1];
  const onlineAlreadySubmitted = isOnline && bt && localPlayerId
    ? bt.submittedPlayerIds.includes(localPlayerId)
    : false;

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}?room=${displayRoomCode.replace('-', '')}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=24141D&bgcolor=FFFBF5&data=${encodeURIComponent(inviteUrl)}`;

  const copyInvite = () => {
    SoundFX.playClick();
    void navigator.clipboard?.writeText(inviteUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  // Compute Podium Winners across the 4 comic reactions
  const computePodium = () => {
    const totals: Record<string, Record<BrokenTvReactionType, number>> = {};
    const names: Record<string, string> = {};
    currentChains.forEach((ch) => {
      ch.steps.forEach((st) => {
        names[st.authorId] = st.authorName;
        if (!totals[st.authorId]) {
          totals[st.authorId] = { funny: 0, shock: 0, art: 0, confuse: 0 };
        }
        (Object.keys(st.reactions) as BrokenTvReactionType[]).forEach((rk) => {
          totals[st.authorId][rk] += st.reactions[rk]?.length || 0;
        });
      });
    });

    return BROKEN_TV_REACTIONS.map((rx) => {
      let bestId = '';
      let bestScore = -1;
      Object.entries(totals).forEach(([pid, scores]) => {
        if (scores[rx.key] > bestScore) {
          bestScore = scores[rx.key];
          bestId = pid;
        }
      });
      return {
        ...rx,
        winnerName: bestId ? names[bestId] : activePlayers[0]?.name || 'النجم',
        score: Math.max(0, bestScore),
      };
    });
  };

  return (
    <div className="min-h-[calc(100vh-70px)] bg-gradient-to-b from-[#FFFBF5] via-[#FFF6EA] to-[#FFEFD8] text-[#24141D] py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Bar inside Broken TV */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-[3px] border-[#24141D] rounded-2xl px-4 py-3 shadow-[4px_5px_0px_#24141D]">
          <div className="flex items-center gap-3">
            <RetroTvLogo size={46} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#24141D]">تلفزيون خربان</h1>
                <span className="text-xs font-black text-[#0D9488]">مجانية بالكامل</span>
              </div>
              <p className="text-xs font-bold text-[#24141D]/70">
                {isOnline ? 'غرفة أونلاين مباشرة' : 'وضع الجلسة على جهاز واحد'} · غرفة {displayRoomCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                SoundFX.playClick();
                setShowHowToPlay(true);
              }}
              className="px-3 py-2 rounded-xl bg-[#FFB703] hover:bg-[#f5ad00] text-[#24141D] font-black text-xs border-2 border-[#24141D] shadow-[2px_3px_0px_#24141D] cursor-pointer flex items-center gap-1"
            >
              <HelpCircle className="w-4 h-4" />
              <span>طريقة اللعب</span>
            </button>
            <button
              onClick={() => {
                SoundFX.playClick();
                onExit();
              }}
              className="px-3 py-2 rounded-xl bg-[#FFF8EE] hover:bg-rose-50 text-[#24141D] font-black text-xs border-2 border-[#24141D] shadow-[2px_3px_0px_#24141D] cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* SCREEN 1: HOME */}
        {activePhase === 'home' && (
          <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-6 sm:p-8 shadow-[6px_7px_0px_#24141D] text-center space-y-6">
            <div className="flex justify-center">
              <RetroTvLogo size={110} />
            </div>

            {homeSubview === 'menu' && (
              <>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-[#24141D]">ولّع الضحك مع تلفزيون خربان!</h2>
                  <p className="text-sm font-bold text-[#24141D]/75 max-w-md mx-auto">
                    لعبة الرسم والتخمين الكوميدية مجانية بالكامل 100% — من جملة خيالية إلى رسمة مضحكة إلى تخمين غير متوقع!
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-lg mx-auto">
                  <button
                    onClick={() => {
                      SoundFX.playTileSelect();
                      setHomeSubview('start_name');
                    }}
                    className="flex-1 py-4 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#e85d00] text-white font-black text-lg border-[3px] border-[#24141D] shadow-[4px_5px_0px_#24141D] active:translate-y-0.5 cursor-pointer"
                  >
                    ابدأ لعبة
                  </button>
                  <button
                    onClick={() => {
                      SoundFX.playTileSelect();
                      setHomeSubview('join_input');
                    }}
                    className="flex-1 py-4 px-6 rounded-2xl bg-[#FFB703] hover:bg-[#f0a800] text-[#24141D] font-black text-lg border-[3px] border-[#24141D] shadow-[4px_5px_0px_#24141D] active:translate-y-0.5 cursor-pointer"
                  >
                    انضم للعبة
                  </button>
                </div>
              </>
            )}

            {homeSubview === 'start_name' && (
              <div className="max-w-md mx-auto space-y-4">
                <h3 className="text-xl font-black">اكتب اسمك لإنشاء الغرفة</h3>
                <input
                  type="text"
                  maxLength={15}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full rounded-xl border-[3px] border-[#24141D] px-4 py-3 text-base font-black bg-[#FFF8EE]"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      SoundFX.playClick();
                      if (onCreateOnlineRoom) {
                        onCreateOnlineRoom(tempName.trim() || playerName);
                      } else {
                        setOfflinePlayers((prev) => [
                          { id: 'loc_1', name: tempName.trim() || playerName },
                          ...prev.slice(1),
                        ]);
                        setOfflinePhase('lobby');
                      }
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#0D9488] text-white font-black border-[3px] border-[#24141D] shadow-[3px_4px_0px_#24141D] cursor-pointer"
                  >
                    إنشاء الآن
                  </button>
                  <button
                    onClick={() => setHomeSubview('menu')}
                    className="px-4 py-3 rounded-xl bg-white font-black border-[3px] border-[#24141D] cursor-pointer"
                  >
                    رجوع
                  </button>
                </div>
              </div>
            )}

            {homeSubview === 'join_input' && (
              <div className="max-w-md mx-auto space-y-4">
                <h3 className="text-xl font-black">انضم برمز الغرفة</h3>
                <input
                  type="text"
                  maxLength={15}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="اسمك"
                  className="w-full rounded-xl border-[3px] border-[#24141D] px-4 py-3 text-base font-black bg-[#FFF8EE]"
                />
                <input
                  type="text"
                  maxLength={8}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="رمز الغرفة (مثال: ABC-123)"
                  className="w-full rounded-xl border-[3px] border-[#24141D] px-4 py-3 text-base font-black bg-[#FFF8EE] text-center tracking-widest uppercase"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      SoundFX.playClick();
                      onJoinOnlineRoom?.(joinCodeInput.replace(/[^A-Z0-9]/g, ''), tempName.trim() || playerName);
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#FF6B00] text-white font-black border-[3px] border-[#24141D] shadow-[3px_4px_0px_#24141D] cursor-pointer"
                  >
                    دخول الغرفة
                  </button>
                  <button
                    onClick={() => setHomeSubview('menu')}
                    className="px-4 py-3 rounded-xl bg-white font-black border-[3px] border-[#24141D] cursor-pointer"
                  >
                    رجوع
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 2: LOBBY */}
        {activePhase === 'lobby' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Room Code + QR + Pace */}
            <div className="md:col-span-5 bg-white border-[3px] border-[#24141D] rounded-3xl p-5 shadow-[5px_6px_0px_#24141D] space-y-4">
              <div className="text-center p-4 rounded-2xl bg-[#FFF8EE] border-2 border-[#24141D]">
                <div className="text-xs font-black text-[#24141D]/70 mb-1">رمز الغرفة</div>
                <div className="text-3xl font-black tracking-widest text-[#E62E1B] tabular-nums">
                  {displayRoomCode}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={copyInvite}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#FFB703] text-[#24141D] font-black text-xs border-2 border-[#24141D] shadow-[2px_3px_0px_#24141D] cursor-pointer"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                </button>
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    setShowQrModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#0D9488] text-white font-black text-xs border-2 border-[#24141D] shadow-[2px_3px_0px_#24141D] cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>باركود QR</span>
                </button>
              </div>

              {/* Time Pace Selector */}
              <div className="space-y-2 pt-2 border-t-2 border-[#24141D]/15">
                <div className="text-xs font-black text-[#24141D]">سرعة الجولة (الوقت لكل خطوة):</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { sec: 40 as const, label: 'سريعة', sub: '40ث' },
                    { sec: 60 as const, label: 'عادية', sub: '60ث' },
                    { sec: 90 as const, label: 'رايقة', sub: '90ث' },
                  ].map((opt) => (
                    <button
                      key={opt.sec}
                      disabled={!isHost}
                      onClick={() => {
                        SoundFX.playClick();
                        setPaceSeconds(opt.sec);
                      }}
                      className={`py-2 px-2 rounded-xl border-2 border-[#24141D] font-black text-xs cursor-pointer transition-all ${
                        paceSeconds === opt.sec
                          ? 'bg-[#FF6B00] text-white shadow-[2px_3px_0px_#24141D]'
                          : 'bg-[#FFF8EE] text-[#24141D]'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[11px] opacity-85 tabular-nums">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#0D9488]/10 border-2 border-[#0D9488] p-3 text-xs font-bold text-[#24141D]">
                💡 نصيحة: كل ما زاد عدد اللاعبين زادت فوضى الإشارة والضحك! الحد الأدنى 3 لاعبين.
              </div>
            </div>

            {/* Players List */}
            <div className="md:col-span-7 bg-white border-[3px] border-[#24141D] rounded-3xl p-5 shadow-[5px_6px_0px_#24141D] flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black">اللاعبون ({activePlayers.length}/12)</h3>
                  {activePlayers.length < 3 && (
                    <span className="text-xs font-black text-[#E62E1B]">
                      مطلوب 3 لاعبين على الأقل
                    </span>
                  )}
                </div>

                {!isOnline && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={15}
                      value={newFriendName}
                      onChange={(e) => setNewFriendName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newFriendName.trim() && offlinePlayers.length < 12) {
                          SoundFX.playClick();
                          setOfflinePlayers((p) => [
                            ...p,
                            { id: `loc_${Date.now()}`, name: newFriendName.trim() },
                          ]);
                          setNewFriendName('');
                        }
                      }}
                      placeholder="اسم صديق جديد..."
                      className="flex-1 rounded-xl border-2 border-[#24141D] px-3 py-2 text-sm font-bold bg-[#FFF8EE]"
                    />
                    <button
                      onClick={() => {
                        if (!newFriendName.trim() || offlinePlayers.length >= 12) return;
                        SoundFX.playClick();
                        setOfflinePlayers((p) => [
                          ...p,
                          { id: `loc_${Date.now()}`, name: newFriendName.trim() },
                        ]);
                        setNewFriendName('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#0D9488] text-white font-black text-xs border-2 border-[#24141D] shadow-[2px_3px_0px_#24141D] cursor-pointer flex items-center gap-1"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ أضف صديق</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {activePlayers.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-[#FFF8EE] border-2 border-[#24141D] rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-2 font-black text-sm">
                        <span className="w-6 h-6 rounded-lg bg-[#FFB703] border border-[#24141D] flex items-center justify-center text-xs tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[140px]">{p.name}</span>
                      </div>
                      {isHost && activePlayers.length > 1 && idx > 0 && (
                        <button
                          onClick={() => {
                            SoundFX.playClick();
                            if (isOnline) {
                              onSendAction?.({ type: 'kick_player', targetId: p.id });
                            } else {
                              setOfflinePlayers((prev) => prev.filter((x) => x.id !== p.id));
                            }
                          }}
                          className="p-1 text-[#E62E1B] hover:bg-rose-100 rounded-lg cursor-pointer"
                          title="إزالة"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isHost ? (
                <button
                  disabled={activePlayers.length < 3}
                  onClick={() => {
                    if (isOnline) {
                      SoundFX.playTileSelect();
                      onSendAction?.({ type: 'start_game', paceSeconds });
                    } else {
                      startOfflineGame();
                    }
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#E62E1B] hover:opacity-95 disabled:opacity-45 text-white font-black text-lg border-[3px] border-[#24141D] shadow-[4px_5px_0px_#24141D] cursor-pointer"
                >
                  {activePlayers.length < 3
                    ? `أضف ${3 - activePlayers.length} لاعبين للبدء`
                    : 'ابدأ البث الآن 📺'}
                </button>
              ) : (
                <div className="text-center py-3 rounded-xl bg-[#FFF8EE] border-2 border-[#24141D] font-black text-sm">
                  بانتظار المضيف لبدء اللعبة...
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 3: WELCOME */}
        {activePhase === 'welcome' && (
          <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-10 shadow-[6px_7px_0px_#24141D] text-center space-y-6">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="flex justify-center"
            >
              <RetroTvLogo size={110} />
            </motion.div>
            <h2 className="text-3xl font-black text-[#FF6B00]">حياكم الله في تلفزيون خربان! 📺</h2>
            <p className="text-base font-bold text-[#24141D]/80">
              استعدوا لكتابة أغرب الجمل وتحويلها إلى رسومات أسطورية...
            </p>
            <div className="w-full max-w-md mx-auto h-4 rounded-full bg-[#FFF8EE] border-2 border-[#24141D] overflow-hidden">
              <motion.div
                initial={{ width: '10%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.7, ease: 'easeOut' }}
                className="h-full bg-gradient-to-l from-[#FFB703] via-[#FF6B00] to-[#0D9488]"
              />
            </div>
          </div>
        )}

        {/* OFFLINE PASS-THE-PHONE INTERSTITIAL */}
        {!isOnline && ['write', 'draw', 'guess'].includes(activePhase) && !offlinePassReady && (
          <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-8 shadow-[6px_7px_0px_#24141D] text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#FFB703] border-2 border-[#24141D] font-black text-sm">
              <span>الجولة {offlineStep + 1} من {offlinePlayers.length}</span>
            </div>
            <h2 className="text-3xl font-black text-[#24141D]">
              سلّم الجهاز الآن إلى: <span className="text-[#FF6B00]">{offlinePlayers[offlinePlayerTurn]?.name}</span>
            </h2>
            <p className="text-sm font-bold text-[#24141D]/70">
              تأكد أن البقية ما يشوفون الشاشة قبل ما تضغط جاهز!
            </p>
            <button
              onClick={() => {
                SoundFX.playClick();
                setOfflinePassReady(true);
              }}
              className="px-10 py-4 rounded-2xl bg-[#0D9488] text-white font-black text-lg border-[3px] border-[#24141D] shadow-[4px_5px_0px_#24141D] cursor-pointer"
            >
              أنا {offlinePlayers[offlinePlayerTurn]?.name} — جاهز! 👀
            </button>
          </div>
        )}

        {/* SCREEN 4: WRITE */}
        {activePhase === 'write' && (isOnline || offlinePassReady) && (
          <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-6 shadow-[6px_7px_0px_#24141D] space-y-5">
            {/* Timer Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-black">
                <span>اكتب جملة كوميدية أو مشهد خيالي!</span>
                <span className="tabular-nums text-[#E62E1B]">{timeLeft} ثانية</span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-[#FFF8EE] border-2 border-[#24141D] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-[#FFB703] to-[#FF6B00] transition-all duration-500"
                  style={{ width: `${(timeLeft / activePace) * 100}%` }}
                />
              </div>
            </div>

            {onlineAlreadySubmitted ? (
              <div className="py-12 text-center space-y-3">
                <div className="text-4xl">✅</div>
                <h3 className="text-xl font-black">تم استلام جملتك!</h3>
                <p className="text-sm font-bold text-[#24141D]/70">
                  بانتظار بقية اللاعبين ({bt?.submittedPlayerIds.length}/{activePlayers.length})...
                </p>
              </div>
            ) : (
              <>
                <textarea
                  rows={3}
                  maxLength={100}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="مثال: بطريق يدرس رياضيات لسلحفاة نائمة..."
                  className="w-full rounded-2xl border-[3px] border-[#24141D] bg-[#FFF8EE] p-4 text-lg font-black focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      SoundFX.playClick();
                      const random =
                        BROKEN_TV_STARTER_PROMPTS[
                          Math.floor(Math.random() * BROKEN_TV_STARTER_PROMPTS.length)
                        ];
                      setPromptInput(random);
                    }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#FFB703] text-[#24141D] font-black text-sm border-2 border-[#24141D] shadow-[3px_3px_0px_#24141D] cursor-pointer"
                  >
                    <Dice5 className="w-5 h-5" />
                    <span>جملة عشوائية 🎲</span>
                  </button>

                  <span className="text-xs font-black text-[#24141D]/60 tabular-nums">
                    {promptInput.length}/100
                  </span>

                  <button
                    disabled={!promptInput.trim()}
                    onClick={() => {
                      const val = promptInput.trim();
                      if (!val) return;
                      if (isOnline) {
                        SoundFX.playCorrect();
                        onSendAction?.({ type: 'broken_tv_submit', content: val });
                        setPromptInput('');
                      } else {
                        submitOfflineTurn(val);
                      }
                    }}
                    className="px-8 py-3 rounded-xl bg-[#0D9488] disabled:opacity-45 text-white font-black text-base border-[3px] border-[#24141D] shadow-[3px_4px_0px_#24141D] cursor-pointer"
                  >
                    إرسال الجملة 🚀
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* SCREEN 5: DRAW */}
        {activePhase === 'draw' && (isOnline || offlinePassReady) && (
          <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-5 sm:p-6 shadow-[6px_7px_0px_#24141D] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="bg-[#FFB703]/20 border-2 border-[#24141D] rounded-xl px-4 py-2">
                <span className="text-xs font-black text-[#E62E1B] block">ارسم هذه الجملة:</span>
                <span className="text-base sm:text-lg font-black text-[#24141D]">
                  {previousStep?.content || 'ارسم مشهداً مضحكاً!'}
                </span>
              </div>
              <div className="text-sm font-black text-[#E62E1B] tabular-nums bg-[#FFF8EE] border-2 border-[#24141D] px-3 py-1.5 rounded-xl">
                ⏱️ {timeLeft}ث
              </div>
            </div>

            {onlineAlreadySubmitted ? (
              <div className="py-16 text-center space-y-3">
                <div className="text-4xl">🎨</div>
                <h3 className="text-xl font-black">تم إرسال تحفتك الفنية!</h3>
                <p className="text-sm font-bold text-[#24141D]/70">
                  بانتظار بقية الرسامين ({bt?.submittedPlayerIds.length}/{activePlayers.length})...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Square 400x400 Canvas */}
                <div className="md:col-span-7 flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={400}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="w-full max-w-[400px] aspect-square bg-white border-[3px] border-[#24141D] rounded-2xl shadow-[4px_5px_0px_#24141D] touch-none cursor-crosshair"
                  />
                </div>

                {/* Drawing Toolbar */}
                <div className="md:col-span-5 space-y-4 bg-[#FFF8EE] border-2 border-[#24141D] rounded-2xl p-4">
                  <div>
                    <div className="text-xs font-black mb-2">لوحة الألوان (15 لون):</div>
                    <div className="grid grid-cols-5 gap-2">
                      {BROKEN_TV_COLORS.map((col) => (
                        <button
                          key={col}
                          onClick={() => {
                            setIsEraser(false);
                            setBrushColor(col);
                          }}
                          className={`w-8 h-8 rounded-lg border-2 cursor-pointer transition-transform ${
                            !isEraser && brushColor === col
                              ? 'border-[#24141D] scale-110 ring-2 ring-[#FF6B00]'
                              : 'border-[#24141D]/40'
                          }`}
                          style={{ backgroundColor: col }}
                          aria-label={`لون ${col}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-black mb-2">حجم الفرشاة:</div>
                    <div className="grid grid-cols-4 gap-2">
                      {BROKEN_TV_BRUSH_SIZES.map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setBrushSize(sz)}
                          className={`py-2 rounded-xl border-2 border-[#24141D] flex items-center justify-center cursor-pointer ${
                            brushSize === sz ? 'bg-[#FFB703]' : 'bg-white'
                          }`}
                        >
                          <span
                            className="rounded-full bg-[#24141D] block"
                            style={{ width: Math.min(22, sz), height: Math.min(22, sz) }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setIsEraser(!isEraser)}
                      className={`py-2 px-3 rounded-xl border-2 border-[#24141D] font-black text-xs flex items-center justify-center gap-1 cursor-pointer ${
                        isEraser ? 'bg-[#FF6B00] text-white' : 'bg-white'
                      }`}
                    >
                      <Eraser className="w-4 h-4" />
                      <span>ممحاة</span>
                    </button>
                    <button
                      onClick={handleClearCanvas}
                      className="py-2 px-3 rounded-xl border-2 border-[#24141D] bg-white font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-[#E62E1B]" />
                      <span>مسح الكل</span>
                    </button>
                    <button
                      onClick={handleUndo}
                      className="py-2 px-3 rounded-xl border-2 border-[#24141D] bg-white font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Undo2 className="w-4 h-4" />
                      <span>تراجع</span>
                    </button>
                    <button
                      onClick={handleRedo}
                      className="py-2 px-3 rounded-xl border-2 border-[#24141D] bg-white font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Redo2 className="w-4 h-4" />
                      <span>إعادة</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const dataUrl = canvasRef.current?.toDataURL('image/png') || '';
                      if (isOnline) {
                        SoundFX.playCorrect();
                        onSendAction?.({ type: 'broken_tv_submit', content: dataUrl });
                      } else {
                        submitOfflineTurn(dataUrl);
                      }
                    }}
                    className="w-full py-3.5 rounded-xl bg-[#0D9488] text-white font-black text-base border-[3px] border-[#24141D] shadow-[3px_4px_0px_#24141D] cursor-pointer"
                  >
                    تسليم الرسمة ✅
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 6: GUESS */}
        {activePhase === 'guess' && (isOnline || offlinePassReady) && (
          <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-6 shadow-[6px_7px_0px_#24141D] space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">وش تتوقع هالرسمة تعني؟ 🤔</h3>
              <span className="text-sm font-black text-[#E62E1B] tabular-nums bg-[#FFF8EE] border-2 border-[#24141D] px-3 py-1.5 rounded-xl">
                ⏱️ {timeLeft}ث
              </span>
            </div>

            {onlineAlreadySubmitted ? (
              <div className="py-12 text-center space-y-3">
                <div className="text-4xl">🕵️</div>
                <h3 className="text-xl font-black">تم تسجيل تخمينك!</h3>
                <p className="text-sm font-bold text-[#24141D]/70">
                  بانتظار البقية ({bt?.submittedPlayerIds.length}/{activePlayers.length})...
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  {previousStep?.content?.startsWith('data:image') ? (
                    <img
                      src={previousStep.content}
                      alt="رسمة للتخمين"
                      className="w-72 h-72 sm:w-80 sm:h-80 object-contain bg-white border-[3px] border-[#24141D] rounded-2xl shadow-[4px_5px_0px_#24141D]"
                    />
                  ) : (
                    <div className="w-72 h-72 flex items-center justify-center bg-[#FFF8EE] border-2 border-[#24141D] rounded-2xl font-black">
                      لا توجد رسمة
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    maxLength={100}
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder="اكتب تخمينك هنا..."
                    className="flex-1 rounded-xl border-[3px] border-[#24141D] bg-[#FFF8EE] px-4 py-3 text-base font-black"
                  />
                  <button
                    disabled={!guessInput.trim()}
                    onClick={() => {
                      const val = guessInput.trim();
                      if (!val) return;
                      if (isOnline) {
                        SoundFX.playCorrect();
                        onSendAction?.({ type: 'broken_tv_submit', content: val });
                        setGuessInput('');
                      } else {
                        submitOfflineTurn(val);
                      }
                    }}
                    className="px-7 py-3 rounded-xl bg-[#FF6B00] disabled:opacity-45 text-white font-black border-[3px] border-[#24141D] shadow-[3px_4px_0px_#24141D] cursor-pointer"
                  >
                    اعتمد التخمين 🎯
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* SCREEN 7: REVEAL (Progression button travels downward below the chain!) */}
        {activePhase === 'reveal' && (
          <div className="space-y-5">
            {(() => {
              const chainIdx = isOnline && bt ? bt.revealChainIndex : offlineRevealChain;
              const stepIdx = isOnline && bt ? bt.revealStepIndex : offlineRevealStep;
              const chain = currentChains[chainIdx];
              const visibleSteps = chain ? chain.steps.slice(0, stepIdx + 1) : [];

              const hasMoreStepsInChain = Boolean(chain && stepIdx + 1 < chain.steps.length);
              const hasMoreChains = chainIdx + 1 < currentChains.length;
              const nextChainButtonText = hasMoreStepsInChain
                ? 'اكشف الخطوة التالية ⬇️'
                : hasMoreChains
                  ? chainIdx === 0
                    ? 'السلسلة الثانية ⏭️'
                    : `السلسلة التالية (${chainIdx + 2}) ⏭️`
                  : 'إلى منصة الجوائز 🏆';

              return (
                <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-6 shadow-[6px_7px_0px_#24141D] space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#24141D]/15 pb-4">
                    <div>
                      <span className="text-xs font-black text-[#0D9488] tabular-nums">
                        السلسلة {chainIdx + 1} من {currentChains.length}
                      </span>
                      <h2 className="text-2xl font-black text-[#24141D]">
                        📺 سلسلة: {chain?.ownerName}
                      </h2>
                    </div>
                    <span className="text-xs font-black text-[#FF6B00] tabular-nums">
                      الخطوة {visibleSteps.length} من {chain?.steps.length || 0}
                    </span>
                  </div>

                  {/* Steps connected by curved fiery ember cable wire */}
                  <div className="space-y-2">
                    {visibleSteps.map((st, idx) => (
                      <React.Fragment key={st.stepIndex}>
                        {idx > 0 && (
                          <div className="flex justify-center -my-1" aria-hidden="true">
                            <svg width="80" height="36" viewBox="0 0 80 36" fill="none">
                              <path
                                d="M40 0 C15 10, 65 26, 40 36"
                                stroke="#FF6B00"
                                strokeWidth="4"
                                strokeLinecap="round"
                              />
                              <circle cx="40" cy="4" r="4" fill="#24141D" />
                              <circle cx="40" cy="32" r="4" fill="#24141D" />
                            </svg>
                          </div>
                        )}

                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28 }}
                          className="bg-[#FFF8EE] border-2 border-[#24141D] rounded-2xl p-4 shadow-[3px_4px_0px_#24141D] space-y-3"
                        >
                          <div className="flex items-center justify-between text-xs font-black">
                            <span className="px-2.5 py-1 rounded-lg bg-[#FFB703] border border-[#24141D] text-[#24141D]">
                              {st.type === 'write'
                                ? '✍️ الجملة الأصلية'
                                : st.type === 'draw'
                                  ? '🎨 الرسمة'
                                  : '🤔 التخمين'}
                            </span>
                            <span className="text-[#0D9488]">بواسطة: {st.authorName}</span>
                          </div>

                          {st.type === 'draw' && st.content.startsWith('data:image') ? (
                            <div className="flex justify-center">
                              <img
                                src={st.content}
                                alt={`رسمة ${st.authorName}`}
                                className="w-60 h-60 object-contain bg-white border-2 border-[#24141D] rounded-xl"
                              />
                            </div>
                          ) : (
                            <p className="text-lg sm:text-xl font-black text-center text-[#24141D] py-2">
                              "{st.content}"
                            </p>
                          )}

                          {/* 4 Live Comic Reaction Buttons */}
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[#24141D]/15">
                            {BROKEN_TV_REACTIONS.map((rx) => {
                              const count = st.reactions[rx.key]?.length || 0;
                              return (
                                <button
                                  key={rx.key}
                                  onClick={() => {
                                    if (isOnline) {
                                      SoundFX.playClick();
                                      onSendAction?.({
                                        type: 'broken_tv_react',
                                        chainIndex: chainIdx,
                                        stepIndex: st.stepIndex,
                                        reaction: rx.key,
                                      });
                                    } else {
                                      handleToggleOfflineReaction(chainIdx, st.stepIndex, rx.key);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFB703]/25 border-2 border-[#24141D] text-xs font-black flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>{rx.emoji}</span>
                                  <span>{rx.label}</span>
                                  <span className="tabular-nums text-[#E62E1B]">({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Bottom Sticky Progression Control: moves downward alongside the growing chain */}
                  {isHost ? (
                    <div className="pt-4 border-t-2 border-dashed border-[#24141D]/20 sticky bottom-3 z-10">
                      <button
                        onClick={() => {
                          SoundFX.playTileSelect();
                          if (isOnline) {
                            onSendAction?.({ type: 'broken_tv_advance_reveal' });
                          } else {
                            if (chain && offlineRevealStep + 1 < chain.steps.length) {
                              setOfflineRevealStep(offlineRevealStep + 1);
                            } else if (offlineRevealChain + 1 < currentChains.length) {
                              setOfflineRevealChain(offlineRevealChain + 1);
                              setOfflineRevealStep(0);
                            } else {
                              setOfflinePhase('podium');
                            }
                          }
                        }}
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#E62E1B] hover:opacity-95 text-white font-black text-base border-[3px] border-[#24141D] shadow-[4px_5px_0px_#24141D] active:translate-y-0.5 transition-all cursor-pointer"
                      >
                        {nextChainButtonText}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-3 rounded-2xl bg-[#FFF8EE] border-2 border-[#24141D]/25 text-xs font-black text-[#24141D]/75">
                      يتحكم منشئ الغرفة بكشف الخطوات والسلاسل التالية 👑
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* SCREEN 8: PODIUM */}
        {activePhase === 'podium' && (
          <div className="bg-white border-[3px] border-[#24141D] rounded-3xl p-6 sm:p-8 shadow-[6px_7px_0px_#24141D] text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#FFB703] border-2 border-[#24141D] font-black text-sm">
              <Trophy className="w-4 h-4" />
              <span>تتويج نجوم تلفزيون خربان</span>
            </div>
            <h2 className="text-3xl font-black text-[#24141D]">منصة التتويج والجوائز 🏆</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {computePodium().map((award) => (
                <div
                  key={award.key}
                  className="bg-[#FFF8EE] border-[3px] border-[#24141D] rounded-2xl p-5 shadow-[4px_5px_0px_#24141D] space-y-2"
                >
                  <div className="text-4xl">{award.emoji}</div>
                  <div className="text-xs font-black text-[#0D9488]">جائزة {award.label} · {award.awardTitle}</div>
                  <div className="text-xl font-black text-[#24141D]">{award.winnerName}</div>
                  <div className="text-xs font-bold text-[#E62E1B] tabular-nums">
                    {award.score} تفاعل
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                SoundFX.playTileSelect();
                if (isOnline) {
                  onSendAction?.({ type: 'return_to_lobby' });
                } else {
                  setOfflinePhase('lobby');
                }
              }}
              className="px-10 py-4 rounded-2xl bg-gradient-to-l from-[#FF6B00] to-[#E62E1B] text-white font-black text-lg border-[3px] border-[#24141D] shadow-[4px_5px_0px_#24141D] cursor-pointer"
            >
              لعبة جديدة 📺
            </button>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#24141D]/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#FFFBF5] text-[#24141D] border-[3px] border-[#24141D] rounded-3xl p-6 shadow-[6px_7px_0px_#24141D] text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">اعزم مجموعتك 📲</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1.5 rounded-xl bg-white border-2 border-[#24141D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-2xl border-2 border-[#24141D] inline-block mx-auto">
              <img src={qrSrc} alt="QR Code" width={180} height={180} />
            </div>
            <p className="text-xs font-bold">
              امسح الباركود بكاميرا الجوال أو انسخ الرابط للدخول الفوري لغرفة {displayRoomCode}
            </p>
            <button
              onClick={copyInvite}
              className="w-full py-3 rounded-xl bg-[#0D9488] text-white font-black text-sm border-2 border-[#24141D] shadow-[2px_3px_0px_#24141D] cursor-pointer"
            >
              {copiedLink ? 'تم نسخ الرابط ✅' : 'مشاركة رابط الدعوة 🔗'}
            </button>
          </div>
        </div>
      )}

      {/* How To Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#24141D]/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#FFFBF5] text-[#24141D] border-[3px] border-[#24141D] rounded-3xl p-6 shadow-[6px_7px_0px_#24141D] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="text-xl font-black">طريقة لعب تلفزيون خربان</h3>
              </div>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="p-1.5 rounded-xl bg-white border-2 border-[#24141D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2.5 text-sm font-bold">
              <li className="bg-white p-3 rounded-xl border-2 border-[#24141D]">1. يكتب كل لاعب جملة خيالية مضحكة (أو يختار جملة جاهزة بالنرد).</li>
              <li className="bg-white p-3 rounded-xl border-2 border-[#24141D]">2. تنتقل جملتك للاعب التالي ليرسمها بالألوان والفرشاة.</li>
              <li className="bg-white p-3 rounded-xl border-2 border-[#24141D]">3. يشاهد اللاعب الثالث الرسمة فقط ويحاول تخمين الجملة!</li>
              <li className="bg-white p-3 rounded-xl border-2 border-[#24141D]">4. في العرض النهائي تضحكون على الإشارة وتتوجون الفائزين بـ 4 ألقاب.</li>
            </ol>
            <div className="flex items-center gap-2 text-xs font-black text-[#0D9488]">
              <Sparkles className="w-4 h-4" />
              <span>اللعبة مجانية بالكامل 100% للجميع بدون اشتراكات!</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
