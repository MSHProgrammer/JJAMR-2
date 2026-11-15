import React, { useEffect, useRef, useState } from 'react';
import {
  Crown,
  Copy,
  Check,
  Send,
  UserX,
  ArrowLeft,
  Gavel,
  Play,
  Globe,
  MessageSquare,
  Wrench,
} from 'lucide-react';
import { BarrahCategory, GameConfig, RoomState } from '../types/jamr';
import { getOrCreateSessionPlayerId, JamrSocketClient, SocketStatus } from '../network/socketClient';
import { SoundFX } from '../utils/soundFx';
import { BrokenTvEngine } from './games/BrokenTvEngine';
import { IsmHayawanEngine } from './games/IsmHayawanEngine';
import { BarrahSalfaEngine } from './games/BarrahSalfaEngine';
import { MafiaNoHakamEngine } from './games/MafiaNoHakamEngine';
import { SmartDetectiveEngine } from './games/SmartDetectiveEngine';
import {
  AVATAR_BG_PRESETS,
  CHARACTER_AVATARS,
  DEFAULT_AVATAR_BG,
  DEFAULT_AVATAR_ID,
  sanitizeAvatarBg,
  sanitizeAvatarId,
} from '../data/characterAvatars';
import { PUBLIC_DETECTIVE_CASES } from '../data/detectivePublicCases';
import { CharacterAvatar } from './CharacterAvatar';
import { useCharacterReaction } from '../context/CharacterReactionContext';

interface OnlineGameViewProps {
  initialTab: 'create' | 'join';
  initialGameId?: string;
  initialRoomCode?: string;
  playerName: string;
  playerAvatar?: string;
  playerAvatarBg?: string;
  onUpdatePlayerAvatar?: (avatarId: string) => void;
  onUpdatePlayerAvatarBg?: (bg: string) => void;
  games: GameConfig[];
  barrahCategories: BarrahCategory[];
  onMatchStateChange?: (active: boolean) => void;
  onExit: () => void;
}

const QUICK_EMOJIS = ['😂', '🔥', '👏', '😱', '🤔', '🎉'];

export const OnlineGameView: React.FC<OnlineGameViewProps> = ({
  initialTab,
  initialGameId,
  initialRoomCode,
  playerName,
  playerAvatar,
  playerAvatarBg,
  onUpdatePlayerAvatar,
  onUpdatePlayerAvatarBg,
  games,
  barrahCategories,
  onMatchStateChange,
  onExit,
}) => {
  const onlineGames = games.filter((g) => g.supportsOnline && g.isActive && !g.underMaintenance);
  const { triggerReaction, setTypingActive } = useCharacterReaction();

  const [tab, setTab] = useState<'create' | 'join'>(initialTab);
  const [guestName, setGuestName] = useState(playerName || 'لاعب جَمْر');
  const [avatar, setAvatar] = useState(() => {
    if (playerAvatar) return sanitizeAvatarId(playerAvatar);
    try {
      return sanitizeAvatarId(window.localStorage.getItem('jamr_player_avatar'));
    } catch {
      return DEFAULT_AVATAR_ID;
    }
  });
  const [avatarBg, setAvatarBg] = useState(() => {
    if (playerAvatarBg) return sanitizeAvatarBg(playerAvatarBg);
    try {
      return sanitizeAvatarBg(window.localStorage.getItem('jamr_player_avatar_bg'));
    } catch {
      return DEFAULT_AVATAR_BG;
    }
  });
  const [selectedGameId, setSelectedGameId] = useState<string>(
    initialGameId && onlineGames.some((g) => g.id === initialGameId)
      ? initialGameId
      : onlineGames[0]?.id || 'broken_tv'
  );
  const [selectedDetectiveCaseId, setSelectedDetectiveCaseId] = useState<string>(
    PUBLIC_DETECTIVE_CASES[0].id
  );
  const [joinCode, setJoinCode] = useState((initialRoomCode || '').toUpperCase());

  // Ism Hayawan room creation configs
  const [ismRounds, setIsmRounds] = useState(5);
  const [isJudgeRoom, setIsJudgeRoom] = useState(false);

  // Room & Socket state
  const [room, setRoom] = useState<RoomState | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [isP2P, setIsP2P] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showFloatingChat, setShowFloatingChat] = useState(false);

  // Start options inside lobby
  const [brokenTvPace, setBrokenTvPace] = useState<40 | 60 | 90>(60);

  const [localPlayerId] = useState<string>(() => getOrCreateSessionPlayerId());
  const clientRef = useRef<JamrSocketClient | null>(null);
  const autoJoinedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const client = new JamrSocketClient({
      onRoomState: (r) => {
        setRoom(r);
        setErrorMsg('');
        setIsBusy(false);
        onMatchStateChange?.(r.status === 'playing');
      },
      onStatusChange: (status, p2pFlag) => {
        setSocketStatus(status);
        setIsP2P(p2pFlag);
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setIsBusy(false);
      },
      onKicked: () => {
        setRoom(null);
        setIsBusy(false);
        setErrorMsg('قام المضيف بإخراجك من الغرفة.');
        onMatchStateChange?.(false);
      },
    });
    client.setCategories(barrahCategories);
    clientRef.current = client;
    void client.connect();

    return () => {
      onMatchStateChange?.(false);
      client.destroy();
    };
  }, []);

  useEffect(() => {
    clientRef.current?.setCategories(barrahCategories);
  }, [barrahCategories]);

  useEffect(() => {
    if (playerName && playerName.trim()) {
      setGuestName(playerName);
    }
  }, [playerName]);

  useEffect(() => {
    if (playerAvatar) {
      setAvatar(sanitizeAvatarId(playerAvatar));
    }
  }, [playerAvatar]);

  useEffect(() => {
    if (playerAvatarBg) {
      setAvatarBg(sanitizeAvatarBg(playerAvatarBg));
    }
  }, [playerAvatarBg]);

  // Auto-join when user opens an invite link (?room=CODE) and has a name ready
  useEffect(() => {
    const cleanCode = (initialRoomCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanName = (playerName || '').trim();
    if (!cleanCode || cleanCode.length < 4 || !cleanName || room) return;
    if (autoJoinedCodeRef.current === cleanCode) return;
    autoJoinedCodeRef.current = cleanCode;
    setTab('join');
    setJoinCode(cleanCode);
    setIsBusy(true);
    void clientRef.current?.joinRoom({
      roomCode: cleanCode,
      playerName: cleanName,
      avatar,
      avatarBg,
    });
  }, [initialRoomCode, playerName, avatar, avatarBg, room]);

  const isHost = room ? room.hostId === localPlayerId : false;

  const saveAvatar = (av: string) => {
    const clean = sanitizeAvatarId(av);
    setAvatar(clean);
    onUpdatePlayerAvatar?.(clean);
    triggerReaction('excited', 'شخصية رهيبة! ✨', 1800);
    try {
      window.localStorage.setItem('jamr_player_avatar', clean);
    } catch {
      // ignore
    }
  };

  const saveAvatarBg = (bg: string) => {
    const clean = sanitizeAvatarBg(bg);
    setAvatarBg(clean);
    onUpdatePlayerAvatarBg?.(clean);
    try {
      window.localStorage.setItem('jamr_player_avatar_bg', clean);
    } catch {
      // ignore
    }
  };

  const handleCreateRoom = async () => {
    if (isBusy) return;
    const cleanName = guestName.trim() || playerName || 'مضيف';
    const target = games.find((g) => g.id === selectedGameId);
    if (target && (target.underMaintenance || !target.isActive)) {
      setErrorMsg('هذه اللعبة حالياً تحت التعديل والصيانة.');
      return;
    }
    SoundFX.playTileSelect();
    triggerReaction('picking_game', 'فتحنا الغرفة! 🚀', 2200);
    setErrorMsg('');
    setIsBusy(true);
    await clientRef.current?.createRoom({
      playerName: cleanName,
      avatar,
      avatarBg,
      gameId: selectedGameId,
      totalRounds: ismRounds,
      isJudgeRoom: selectedGameId === 'ism_hayawan' ? isJudgeRoom : false,
      selectedCaseId: selectedGameId === 'smart_detective' ? selectedDetectiveCaseId : undefined,
    });
    setIsBusy(false);
  };

  const handleJoinRoom = async () => {
    if (isBusy) return;
    const cleanName = guestName.trim() || playerName || 'ضيف';
    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 4) {
      setErrorMsg('أدخل رمز الغرفة الصحيح.');
      return;
    }
    SoundFX.playTileSelect();
    triggerReaction('excited', 'دخول سريع! ⚡', 2000);
    setErrorMsg('');
    setIsBusy(true);
    await clientRef.current?.joinRoom({
      roomCode: cleanCode,
      playerName: cleanName,
      avatar,
      avatarBg,
    });
    setIsBusy(false);
  };

  const handleChatInputChange = (val: string) => {
    setChatInput(val);
    setTypingActive(val.trim().length > 0);
  };

  const sendChat = (textToSend?: string) => {
    const txt = (textToSend ?? chatInput).trim();
    if (!txt) return;
    SoundFX.playClick();
    setTypingActive(false);
    triggerReaction('chat_sent', txt.length <= 4 ? txt : 'تم الإرسال! 💬', 1600);
    clientRef.current?.send({ type: 'chat_message', text: txt });
    if (!textToSend) setChatInput('');
  };

  const copyInviteLink = () => {
    if (!room) return;
    SoundFX.playClick();
    const url = `${window.location.origin}?room=${room.code}`;
    void navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const copyRoomCode = () => {
    if (!room) return;
    SoundFX.playClick();
    void navigator.clipboard?.writeText(room.code);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  // Maintenance Guard on active room game
  if (room) {
    const activeGame = games.find((g) => g.id === room.gameId);
    if (activeGame && (activeGame.underMaintenance || !activeGame.isActive)) {
      return (
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5">
          <Wrench className="w-14 h-14 text-amber-600 mx-auto" />
          <h2 className="text-2xl font-black text-[#23140E]">هذه اللعبة تحت التعديل والصيانة</h2>
          <button
            onClick={() => {
              clientRef.current?.leaveRoom();
              onExit();
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 text-white font-black cursor-pointer shadow-sm"
          >
            العودة للرئيسية
          </button>
        </div>
      );
    }
  }

  // PLAYING STATE: Render the specific Online Game Engine
  if (room && room.status === 'playing') {
    const sendAction = (payload: Record<string, unknown>) => clientRef.current?.send(payload);
    const exitMatch = () => {
      clientRef.current?.leaveRoom();
      setRoom(null);
      onExit();
    };

    return (
      <div className="relative">
        {room.gameId === 'broken_tv' && (
          <BrokenTvEngine
            mode="online"
            playerName={guestName}
            room={room}
            localPlayerId={localPlayerId}
            onSendAction={sendAction}
            onExit={exitMatch}
          />
        )}
        {room.gameId === 'ism_hayawan' && (
          <IsmHayawanEngine
            mode="online"
            playerName={guestName}
            room={room}
            localPlayerId={localPlayerId}
            onSendAction={sendAction}
            onExit={exitMatch}
          />
        )}
        {room.gameId === 'barrah_salfa' && (
          <BarrahSalfaEngine
            mode="online"
            playerName={guestName}
            categories={barrahCategories}
            room={room}
            localPlayerId={localPlayerId}
            onSendAction={sendAction}
            onExit={exitMatch}
          />
        )}
        {room.gameId === 'mafia_no_hakam' && (
          <MafiaNoHakamEngine
            mode="online"
            playerName={guestName}
            room={room}
            localPlayerId={localPlayerId}
            onSendAction={sendAction}
            onExit={exitMatch}
          />
        )}
        {room.gameId === 'smart_detective' && room.detective && (
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
            <SmartDetectiveEngine
              mode="online"
              onBack={exitMatch}
              onlineState={room.detective}
              players={room.players}
              currentPlayerId={localPlayerId}
              isHost={room.hostId === localPlayerId}
              onOnlineAction={(action, payload) => sendAction({ type: action, ...(payload || {}) })}
            />
          </div>
        )}

        {/* Floating Live Chat Drawer */}
        <button
          onClick={() => setShowFloatingChat(!showFloatingChat)}
          className="fixed bottom-5 left-5 z-50 px-4 py-3 rounded-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-xs shadow-xl flex items-center gap-2 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>دردشة الغرفة ({room.messages.length})</span>
        </button>

        {showFloatingChat && (
          <div className="fixed bottom-20 left-5 z-50 w-80 max-w-[90vw] rounded-2xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden flex flex-col max-h-96">
            <div className="px-4 py-2.5 bg-[#FFF8EE] border-b border-amber-200 flex items-center justify-between text-xs font-black text-[#23140E]">
              <span>دردشة غرفة {room.code}</span>
              <button onClick={() => setShowFloatingChat(false)} className="cursor-pointer text-[#5A3E32]">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs bg-[#FFFDF9]">
              {room.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${
                    m.isSystem ? 'text-orange-700 font-bold bg-amber-50 p-1.5 rounded-lg' : 'text-[#23140E]'
                  }`}
                >
                  {m.isSystem ? (
                    <span className="shrink-0">🔥</span>
                  ) : (
                    <CharacterAvatar
                      avatarId={m.senderAvatar}
                      backgroundColor={m.senderAvatarBg}
                      size={24}
                      interactive={false}
                    />
                  )}
                  <div className="min-w-0">
                    <span className="font-black">{m.senderName}: </span>
                    <span className="break-words">{m.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-amber-200 bg-white flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => handleChatInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="اكتب رسالة..."
                className="flex-1 rounded-lg bg-[#FFF8EE] border border-amber-200 px-2.5 py-1.5 text-xs text-[#23140E]"
              />
              <button
                onClick={() => sendChat()}
                className="px-3 py-1.5 rounded-lg bg-orange-500 text-white font-black text-xs cursor-pointer"
              >
                إرسال
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LOBBY STATE (Inside a Room)
  if (room) {
    const currentGame = games.find((g) => g.id === room.gameId);
    const minNeeded =
      room.gameId === 'smart_detective'
        ? 1
        : room.gameId === 'broken_tv' || room.gameId === 'barrah_salfa' || room.gameId === 'mafia_no_hakam'
          ? 3
          : 2;
    const activePlayersCount = room.players.filter((p) => !p.isJudge).length;

    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] border border-amber-200 flex items-center justify-center text-4xl">
              {currentGame?.icon || '🌐'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#23140E]">{currentGame?.title || 'غرفة أونلاين'}</h1>
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 border border-orange-200 tabular-nums">
                  كود: {room.code}
                </span>
              </div>
              <p className="text-xs font-bold text-[#6B4E40] mt-1">
                {isP2P ? 'اتصال مباشر P2P' : 'متصل بالخادم الفوري'} · اللاعبون: {room.players.length}/{room.maxPlayers}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={copyRoomCode}
              className="px-4 py-2.5 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-300 text-[#23140E] font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-orange-500" />}
              <span>{copiedCode ? 'تم نسخ الرمز!' : `نسخ الرمز: ${room.code}`}</span>
            </button>
            <button
              onClick={copyInviteLink}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'تم نسخ رابط الدعوة!' : 'نسخ رابط الدعوة'}</span>
            </button>
            <button
              onClick={() => {
                SoundFX.playClick();
                clientRef.current?.leaveRoom();
                setRoom(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>مغادرة الغرفة</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Players + Host Game Switcher */}
          <div className="lg:col-span-7 rounded-3xl bg-white border-2 border-amber-200 shadow-sm p-5 space-y-5">
            {isHost && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#FFF8EE] border border-amber-200">
                <div>
                  <label className="block text-xs font-black text-orange-700 mb-1.5">تبديل اللعبة داخل الغرفة:</label>
                  <select
                    value={room.gameId}
                    onChange={(e) => {
                      SoundFX.playClick();
                      clientRef.current?.send({ type: 'change_game', gameId: e.target.value });
                    }}
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
                  >
                    {onlineGames.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.icon} {g.title}
                      </option>
                    ))}
                  </select>
                </div>

                {room.gameId === 'barrah_salfa' && (
                  <div className="flex items-center rounded-xl bg-white border border-teal-200 px-3.5 py-2.5 text-xs font-bold text-teal-800">
                    🗳️ سيصوّت الجميع لاختيار موضوع السالفة فور الدخول للعبة!
                  </div>
                )}

                {room.gameId === 'broken_tv' && (
                  <div>
                    <label className="block text-xs font-black text-rose-700 mb-1.5">سرعة الجولة:</label>
                    <select
                      value={brokenTvPace}
                      onChange={(e) => setBrokenTvPace(Number(e.target.value) as 40 | 60 | 90)}
                      className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
                    >
                      <option value={40}>سريعة (40 ثانية)</option>
                      <option value={60}>عادية (60 ثانية)</option>
                      <option value={90}>رايقة (90 ثانية)</option>
                    </select>
                  </div>
                )}

                {room.gameId === 'smart_detective' && (
                  <div>
                    <label className="block text-xs font-black text-[#7A1219] mb-1.5">ملف القضية المختار:</label>
                    <select
                      value={room.selectedCaseId || selectedDetectiveCaseId}
                      onChange={(e) => {
                        setSelectedDetectiveCaseId(e.target.value);
                        clientRef.current?.send({ type: 'detective_set_case', caseId: e.target.value });
                      }}
                      className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
                    >
                      {PUBLIC_DETECTIVE_CASES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.caseNumber} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-[#23140E]">المتواجدون في الغرفة ({room.players.length})</h2>
                {activePlayersCount < minNeeded && (
                  <span className="text-xs font-black text-orange-700 bg-orange-100 px-2.5 py-1 rounded-lg">
                    مطلوب {minNeeded} لاعبين للبدء
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#FFF8EE] border border-amber-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CharacterAvatar
                        avatarId={p.avatar}
                        backgroundColor={p.avatarBg}
                        size={38}
                        mood={p.id === localPlayerId ? 'excited' : 'idle'}
                        interactive={false}
                      />
                      <div className="truncate">
                        <div className="text-sm font-black text-[#23140E] flex items-center gap-1.5">
                          <span className="truncate">{p.name}</span>
                          {p.isHost && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                          {p.isJudge && <Gavel className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                        </div>
                      </div>
                    </div>

                    {isHost && p.id !== localPlayerId && (
                      <button
                        onClick={() => {
                          SoundFX.playClick();
                          clientRef.current?.send({ type: 'kick_player', targetId: p.id });
                        }}
                        className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 cursor-pointer"
                        title="طرد من الغرفة"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button
                disabled={activePlayersCount < minNeeded}
                onClick={() => {
                  SoundFX.playTileSelect();
                  clientRef.current?.send({
                    type: 'start_game',
                    paceSeconds: brokenTvPace,
                    totalRounds: ismRounds,
                    selectedCaseId: room.selectedCaseId || selectedDetectiveCaseId,
                  });
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-l from-orange-500 via-red-500 to-amber-500 disabled:opacity-45 text-white font-black text-lg flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {activePlayersCount < minNeeded
                    ? `بانتظار ${minNeeded - activePlayersCount} لاعبين إضافيين`
                    : 'ابدأ اللعب الآن 🔥'}
                </span>
              </button>
            ) : (
              <div className="py-3.5 rounded-2xl bg-[#FFF8EE] border border-amber-200 text-center text-sm font-bold text-[#5A3E32]">
                بانتظار المضيف لبدء المباراة...
              </div>
            )}
          </div>

          {/* Live Text Chat */}
          <div className="lg:col-span-5 rounded-3xl bg-white border-2 border-amber-200 shadow-sm p-5 flex flex-col h-[430px]">
            <h3 className="text-base font-black text-[#23140E] mb-3">الدردشة المباشرة 💬</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {room.messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-xl flex items-start gap-2.5 ${
                    m.isSystem
                      ? 'bg-amber-50 border border-amber-200 text-orange-800 font-bold'
                      : 'bg-[#FFF8EE] border border-amber-100 text-[#23140E]'
                  }`}
                >
                  {m.isSystem ? (
                    <span className="text-base shrink-0">🔥</span>
                  ) : (
                    <CharacterAvatar
                      avatarId={m.senderAvatar}
                      backgroundColor={m.senderAvatarBg}
                      size={28}
                      interactive={false}
                    />
                  )}
                  <div className="min-w-0">
                    <span className="font-black text-[#23140E]">{m.senderName}: </span>
                    <span className="break-words">{m.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 py-2 overflow-x-auto">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => sendChat(em)}
                  className="px-2.5 py-1 rounded-lg bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-sm cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => handleChatInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="اكتب رسالة للغرفة..."
                className="flex-1 rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E] focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={() => sendChat()}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ENTRY SCREEN: Guest Profile + Create or Join Room
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Globe className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-black text-[#23140E]">اللعب أونلاين</h1>
        </div>
        <button
          onClick={onExit}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-xs font-black text-[#23140E] flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>رجوع</span>
        </button>
      </div>

      {/* Guest Profile */}
      <div className="rounded-3xl bg-white border-2 border-amber-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-black text-orange-700">بطاقتك كلاعب:</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#5A3E32] mb-1.5">الاسم المستعار</label>
            <input
              type="text"
              maxLength={15}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3.5 py-2.5 text-sm font-bold text-[#23140E]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#5A3E32] mb-1.5">اختر شخصيتك الكرتونية ({CHARACTER_AVATARS.length})</label>
            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
              {CHARACTER_AVATARS.map((char) => {
                const active = avatar === char.id;
                const cleanLabel = char.name.trim();
                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => {
                      SoundFX.playTileSelect();
                      saveAvatar(char.id);
                    }}
                    title={cleanLabel ? `${cleanLabel} (${char.tagline})` : char.tagline}
                    className={`p-1 rounded-xl flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                      active
                        ? 'bg-amber-50 ring-2 ring-orange-500 shadow-sm scale-105'
                        : 'bg-[#FFF8EE] border border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    <CharacterAvatar
                      avatarId={char.id}
                      backgroundColor={avatarBg}
                      size={36}
                      mood={active ? 'excited' : 'idle'}
                      interactive={false}
                    />
                    {cleanLabel && (
                      <span className="text-[9px] font-black text-[#23140E] truncate max-w-full">
                        {cleanLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#5A3E32]">خلفية الصورة:</span>
              {AVATAR_BG_PRESETS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    saveAvatarBg(bg.id);
                  }}
                  title={bg.label}
                  style={{ background: bg.background }}
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer transition ${
                    avatarBg === bg.id ? 'border-[#23140E] scale-110 shadow' : 'border-white shadow-xs'
                  }`}
                />
              ))}
              <input
                type="color"
                value={avatarBg.startsWith('#') ? avatarBg : '#8B5CF6'}
                onChange={(e) => saveAvatarBg(e.target.value)}
                title="اختر لون خلفية مخصص"
                className="w-6 h-6 rounded-full overflow-hidden border border-amber-300 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Create / Join Tabs */}
      <div className="rounded-3xl bg-white border-2 border-amber-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#FFF8EE] border border-amber-200">
          <button
            onClick={() => setTab('create')}
            className={`py-2.5 rounded-xl text-sm font-black cursor-pointer ${
              tab === 'create' ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-sm' : 'text-[#5A3E32]'
            }`}
          >
            إنشاء غرفة جديدة
          </button>
          <button
            onClick={() => setTab('join')}
            className={`py-2.5 rounded-xl text-sm font-black cursor-pointer ${
              tab === 'join' ? 'bg-gradient-to-l from-teal-500 to-emerald-500 text-white shadow-sm' : 'text-[#5A3E32]'
            }`}
          >
            الانضمام برمز الدعوة
          </button>
        </div>

        {tab === 'create' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5A3E32] mb-2">اختر اللعبة الأونلاين:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {onlineGames.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      SoundFX.playClick();
                      setSelectedGameId(g.id);
                      triggerReaction('picking_game', `${g.title}! 🎮`, 1800);
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-right flex items-center gap-3 cursor-pointer ${
                      selectedGameId === g.id
                        ? 'bg-amber-50 border-orange-400 text-[#23140E] shadow-xs'
                        : 'bg-[#FFFDF9] border-amber-100 text-[#5A3E32] hover:border-amber-300'
                    }`}
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <div>
                      <div className="font-black text-sm">{g.title}</div>
                      <div className="text-[11px] opacity-80">حتى {g.maxPlayers} لاعب</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedGameId === 'ism_hayawan' && (
              <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-4 space-y-3">
                <div>
                  <label className="block text-xs font-black text-orange-700 mb-1.5 tabular-nums">
                    عدد الجولات: {ismRounds} جولة (1–50)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={ismRounds}
                    onChange={(e) => setIsmRounds(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setIsJudgeRoom(!isJudgeRoom);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-black cursor-pointer ${
                    isJudgeRoom
                      ? 'bg-amber-100 border-amber-400 text-amber-900'
                      : 'bg-white border-amber-200 text-[#5A3E32]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-orange-500" />
                    <span>{'{بكون حكم!}'} — سأدير النقاط والاعتراضات بنفسي</span>
                  </span>
                  <span>{isJudgeRoom ? 'نعم ✅' : 'لا'}</span>
                </button>
              </div>
            )}

            {selectedGameId === 'smart_detective' && (
              <div className="rounded-2xl bg-[#131217] border border-[#C89B3C]/40 p-4 space-y-2 text-[#F3EFE6]">
                <label className="block text-xs font-black text-[#E5C16C]">
                  🔍 اختر القضية الأولية للغرفة:
                </label>
                <select
                  value={selectedDetectiveCaseId}
                  onChange={(e) => setSelectedDetectiveCaseId(e.target.value)}
                  className="w-full rounded-xl bg-[#09080A] border border-[#C89B3C]/35 px-3 py-2.5 text-xs font-bold text-[#F3EFE6]"
                >
                  {PUBLIC_DETECTIVE_CASES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumber} — {c.title} ({c.categoryLabel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              disabled={isBusy}
              onClick={() => void handleCreateRoom()}
              className="w-full py-4 rounded-2xl bg-gradient-to-l from-orange-500 via-red-500 to-amber-500 disabled:opacity-60 text-white font-black text-base cursor-pointer shadow-md"
            >
              {isBusy ? 'جاري فتح الغرفة والدخول...' : 'أنشئ الغرفة وخذ رمز الدعوة 🚀'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5A3E32] mb-1.5">رمز الغرفة (6 خانات):</label>
              <input
                type="text"
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && void handleJoinRoom()}
                placeholder="مثال: K7M9P2"
                className="w-full rounded-xl bg-[#FFF8EE] border-2 border-amber-200 px-4 py-3.5 text-center text-2xl font-black tracking-widest text-orange-600 uppercase focus:outline-none focus:border-teal-500"
              />
            </div>
            <button
              disabled={isBusy}
              onClick={() => void handleJoinRoom()}
              className="w-full py-4 rounded-2xl bg-gradient-to-l from-teal-500 to-emerald-500 disabled:opacity-60 text-white font-black text-base cursor-pointer shadow-md"
            >
              {isBusy ? 'جاري الدخول للغرفة...' : 'ادخل الغرفة الآن ⚡'}
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 text-center">
            {errorMsg}
          </div>
        )}

        <div className="text-center text-[11px] font-bold text-[#7C5D4F]">
          {socketStatus === 'p2p'
            ? 'الوضع المباشر P2P جاهز'
            : socketStatus === 'connected'
              ? 'الخادم الفوري متصل ⚡'
              : 'اتصال الخادم جاهز'}
        </div>
      </div>
    </div>
  );
};
