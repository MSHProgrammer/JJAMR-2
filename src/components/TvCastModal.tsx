import React, { useEffect, useRef, useState } from 'react';
import {
  Cast,
  CheckCircle2,
  Crown,
  Lock,
  Mail,
  Monitor,
  Play,
  QrCode,
  Sparkles,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { RoomState, TvCastSession } from '../types/jamr';
import { apiFetchJson } from '../utils/apiClient';
import { buildTvPairUrl, generateLuxuryGoldQrDataUrl } from '../utils/qrHelper';
import { AccountSessionState, isPlusActive } from '../utils/plusManager';
import { JamrPlusStatus } from '../types/jamr';
import { SoundFX } from '../utils/soundFx';
import { CharacterAvatar } from './CharacterAvatar';
import { PlayerNameWithPlus } from './PlusBadge';
import { getWebSocketUrl } from '../network/socketClient';

interface TvCastModalProps {
  mode?: 'tv_screen' | 'pair_from_phone';
  initialPairTvCode?: string;
  activeRoomCode?: string | null;
  accountSession: AccountSessionState | null;
  plusStatus: JamrPlusStatus;
  playerName: string;
  username?: string;
  onOpenPlusModal: () => void;
  onClose: () => void;
}

export const TvCastModal: React.FC<TvCastModalProps> = ({
  mode = 'tv_screen',
  initialPairTvCode = '',
  activeRoomCode,
  accountSession,
  plusStatus,
  playerName,
  username,
  onOpenPlusModal,
  onClose,
}) => {
  const hasPlus = isPlusActive(plusStatus);
  const [tab, setTab] = useState<'tv_display' | 'remote_cast'>(
    mode === 'pair_from_phone' || activeRoomCode ? 'remote_cast' : 'tv_display'
  );

  // TV screen state
  const [tvSession, setTvSession] = useState<TvCastSession | null>(null);
  const [liveRoom, setLiveRoom] = useState<RoomState | null>(null);
  const [luxuryQrUrl, setLuxuryQrUrl] = useState<string>('');
  const [tvAuthEmail, setTvAuthEmail] = useState(accountSession?.email || '');
  const [tvAuthPassword, setTvAuthPassword] = useState('');
  const [tvAuthSignedIn, setTvAuthSignedIn] = useState(Boolean(accountSession));
  const [tvAuthError, setTvAuthError] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);

  // Mobile/Caster control state
  const [remoteTvCode, setRemoteTvCode] = useState(initialPairTvCode);
  const [remoteRoomCode, setRemoteRoomCode] = useState(activeRoomCode || '');
  const [castMsg, setCastMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [castingBusy, setCastingBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const createTvSession = async () => {
    setLoadingCreate(true);
    const res = await apiFetchJson<{ ok?: boolean; session?: TvCastSession }>(
      '/api/tv/create',
      {
        method: 'POST',
        headers: accountSession?.token
          ? { Authorization: `Bearer ${accountSession.token}` }
          : undefined,
        body: JSON.stringify({ accountToken: accountSession?.token }),
      },
      { unlockStorageOnGesture: true }
    );
    setLoadingCreate(false);
    if (res.ok && res.data?.session) {
      setTvSession(res.data.session);
      setRemoteTvCode((prev) => prev || res.data!.session!.tvCode);
      const qr = await generateLuxuryGoldQrDataUrl(buildTvPairUrl(res.data.session.tvCode), 420);
      setLuxuryQrUrl(qr);
    } else {
      // Offline / local fallback code & QR preview
      const fallbackCode = `TV${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      setTvSession({
        tvCode: fallbackCode,
        roomCode: null,
        castingActive: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const qr = await generateLuxuryGoldQrDataUrl(buildTvPairUrl(fallbackCode), 420);
      setLuxuryQrUrl(qr);
    }
  };

  useEffect(() => {
    if (tab === 'tv_display' && !tvSession) {
      void createTvSession();
    }
  }, [tab]);

  // Listen in real-time via WebSocket + polling fallback when displaying TV screen
  useEffect(() => {
    if (tab !== 'tv_display' || !tvSession?.tvCode) return;

    let cancelled = false;
    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'watch_tv', tvCode: tvSession.tvCode }));
      };
      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(String(evt.data));
          if (msg.type === 'tv_state') {
            if (msg.session) setTvSession(msg.session as TvCastSession);
            setLiveRoom((msg.room as RoomState | null) || null);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore WS failure
    }

    const poll = window.setInterval(async () => {
      if (cancelled) return;
      const res = await apiFetchJson<{ ok?: boolean; session?: TvCastSession; room?: RoomState | null }>(
        `/api/tv/status/${encodeURIComponent(tvSession.tvCode)}`
      );
      if (res.ok && res.data?.session) {
        setTvSession(res.data.session);
        setLiveRoom(res.data.room || null);
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(poll);
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, [tab, tvSession?.tvCode]);

  const handleTvScreenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTvAuthError('');
    const res = await apiFetchJson<{ ok?: boolean; error?: string; token?: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: tvAuthEmail.trim().toLowerCase(), password: tvAuthPassword }),
      },
      { unlockStorageOnGesture: true }
    );
    if (res.ok && res.data?.ok) {
      SoundFX.playCorrect();
      setTvAuthSignedIn(true);
      if (tvSession?.tvCode) {
        await apiFetchJson('/api/tv/pair', {
          method: 'POST',
          body: JSON.stringify({
            tvCode: tvSession.tvCode,
            email: tvAuthEmail.trim().toLowerCase(),
            accountToken: res.data.token,
          }),
        });
      }
    } else {
      SoundFX.playWrong();
      setTvAuthError(String(res.data?.error || 'تأكد من البريد الإلكتروني وكلمة السر.'));
    }
  };

  const handleStartBroadcast = async (active: boolean) => {
    const cleanTv = remoteTvCode.trim().toUpperCase();
    const cleanRoom = remoteRoomCode.trim().toUpperCase();
    if (!cleanTv) {
      setCastMsg({ ok: false, text: 'أدخل كود الشاشة الظاهر على التلفاز (مثل TVXXXX).' });
      return;
    }
    if (active && !cleanRoom) {
      setCastMsg({ ok: false, text: 'أدخل كود الغرفة التي تريد بثها على الشاشة.' });
      return;
    }

    setCastingBusy(true);
    setCastMsg(null);
    await apiFetchJson(
      '/api/tv/pair',
      {
        method: 'POST',
        body: JSON.stringify({
          tvCode: cleanTv,
          accountToken: accountSession?.token,
          username,
          displayName: playerName,
          roomCode: cleanRoom,
          startCast: active,
        }),
      },
      { unlockStorageOnGesture: true }
    );

    const castRes = await apiFetchJson<{ ok?: boolean; error?: string; session?: TvCastSession }>(
      '/api/tv/cast',
      {
        method: 'POST',
        body: JSON.stringify({
          tvCode: cleanTv,
          roomCode: cleanRoom,
          displayName: playerName,
          active,
        }),
      },
      { unlockStorageOnGesture: true }
    );
    setCastingBusy(false);

    if (castRes.ok && castRes.data?.ok) {
      SoundFX.playCorrect();
      setCastMsg({
        ok: true,
        text: active
          ? `تم تشغيل البث المباشر على الشاشة (${cleanTv}) لغرفة ${cleanRoom}! 📺🔥`
          : 'تم إيقاف البث على الشاشة.',
      });
    } else {
      SoundFX.playWrong();
      setCastMsg({ ok: false, text: String(castRes.data?.error || 'تعذر ربط الشاشة الآن.') });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl rounded-3xl bg-[#0D0A07] border-2 border-amber-400/60 text-amber-50 shadow-[0_0_50px_rgba(251,191,36,0.28)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Luxury Obsidian & Gold Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/25 bg-gradient-to-l from-[#1A130A] via-[#0E0B07] to-[#1A130A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-[#120D06] shadow-lg shadow-amber-500/30">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-amber-300">وضع العرض على شاشة التلفاز 📺</h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-[#140E07]">
                  PLUS VIP
                </span>
              </div>
              <p className="text-[11px] text-amber-200/75">
                اعرض ألعاب المجلس ونتائج الغرفة مباشرة بدقة فائقة على التلفاز الذكي
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-amber-500/30 text-amber-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-[#14100A] border-b border-amber-500/20">
          <button
            type="button"
            onClick={() => setTab('tv_display')}
            className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition ${
              tab === 'tv_display'
                ? 'bg-gradient-to-l from-amber-400 to-yellow-500 text-[#140D05] shadow-md'
                : 'bg-white/5 text-amber-200 hover:bg-white/10'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>وضع شاشة التلفاز (عرض الباركود)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('remote_cast')}
            className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition ${
              tab === 'remote_cast'
                ? 'bg-gradient-to-l from-amber-400 to-yellow-500 text-[#140D05] shadow-md'
                : 'bg-white/5 text-amber-200 hover:bg-white/10'
            }`}
          >
            <Cast className="w-4 h-4" />
            <span>التحكم من جوالي والضغط على «بث»</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {!hasPlus && (
            <div className="rounded-2xl bg-gradient-to-l from-amber-500/20 to-orange-500/15 border border-amber-400/50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-100">
                <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  بث الألعاب على شاشة التلفاز من مزايا <span className="font-black text-amber-300">جَمْر بلس</span> (ريالان فقط لسنة كاملة). يمكنك فتحه الآن!
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPlusModal();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-l from-amber-400 to-orange-500 text-[#140D05] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>اشترك في جَمْر بلس (٢ ريال)</span>
              </button>
            </div>
          )}

          {tab === 'tv_display' ? (
            liveRoom && tvSession?.castingActive ? (
              /* LIVE TV BROADCAST CANVAS */
              <div className="space-y-5">
                <div className="rounded-3xl bg-gradient-to-br from-[#1C1409] via-[#120D06] to-[#1A1108] border-2 border-amber-400/70 p-6 space-y-5 shadow-[0_0_40px_rgba(251,191,36,0.2)]">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/25 pb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 text-xs font-black text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>بث مباشر على الشاشة · {tvSession.tvCode}</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                        غرفة: {liveRoom.code} — {liveRoom.status === 'playing' ? 'مباراة مشتعلة 🔥' : 'بانتظار انطلاق الجولة'}
                      </h3>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-xs font-black text-amber-200">
                      عدد اللاعبين: {liveRoom.players.length}
                    </div>
                  </div>

                  {/* Live Scoreboard */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...liveRoom.players]
                      .sort((a, b) => b.score - a.score)
                      .map((p, idx) => (
                        <div
                          key={p.id}
                          className="rounded-2xl bg-black/50 border border-amber-500/30 p-3.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-black text-amber-400 w-5 text-center">#{idx + 1}</span>
                            <CharacterAvatar
                              avatarId={p.avatar}
                              backgroundColor={p.avatarBg}
                              size={44}
                              isPlus={p.isPlus}
                              plusGlow={p.plusGlow}
                              plusFrame={p.plusFrame}
                              interactive={false}
                            />
                            <div className="min-w-0">
                              <PlayerNameWithPlus
                                name={p.name}
                                isPlus={p.isPlus}
                                plusGlow={p.plusGlow}
                                nameClassName="text-sm font-black text-amber-50"
                              />
                              <div className="text-[11px] text-amber-200/70">
                                {p.isHost ? 'مضيف الغرفة' : p.connected ? 'متصل' : 'غير متصل'}
                              </div>
                            </div>
                          </div>
                          <div className="text-lg font-black font-mono text-amber-400 shrink-0">
                            {p.score}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Live Room Chat Ticker */}
                  {liveRoom.messages.length > 0 && (
                    <div className="rounded-2xl bg-black/45 border border-amber-500/20 p-4 space-y-2">
                      <div className="text-xs font-black text-amber-400">آخر أحداث ورسائل الغرفة:</div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {liveRoom.messages.slice(-6).map((m) => (
                          <div key={m.id} className="text-xs text-amber-100/90">
                            <span className="font-black text-amber-300">{m.senderName}: </span>
                            <span>{m.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TV PAIRING SCREEN: Luxury Dark-Gold QR + Optional Email/Password Login on TV */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Luxury Gold QR Display */}
                <div className="lg:col-span-6 rounded-3xl bg-gradient-to-br from-[#181209] via-[#0B0906] to-[#1D1408] border-2 border-amber-400/75 p-6 text-center space-y-4 shadow-[0_0_45px_rgba(251,191,36,0.24)]">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>باركود جَمْر الفاخر للشاشة</span>
                  </div>

                  <div className="mx-auto w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-[#0C0906] p-3 border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.38)] flex items-center justify-center">
                    {luxuryQrUrl ? (
                      <img src={luxuryQrUrl} alt="TV Luxury QR" className="w-full h-full rounded-2xl" />
                    ) : (
                      <QrCode className="w-20 h-20 text-amber-400 animate-pulse" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-amber-200/80">كود ربط الشاشة السريع:</div>
                    <div className="text-3xl font-mono font-black tracking-[0.22em] text-amber-400">
                      {loadingCreate ? '...' : tvSession?.tvCode || '------'}
                    </div>
                    <p className="text-[11px] text-amber-100/75 leading-relaxed">
                      امسح الباركود الذهبي بجوالك لدخول الموقع، ثم اضغط زر <span className="font-black text-amber-300">«بث»</span> ليظهر اللعب هنا مباشرة!
                    </p>
                  </div>
                </div>

                {/* TV Account Sign-In Panel */}
                <div className="lg:col-span-6 rounded-3xl bg-[#15110B] border border-amber-500/30 p-6 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-amber-300">تسجيل الدخول من الشاشة</h3>
                    <p className="text-xs text-amber-100/75 leading-relaxed">
                      أدخل إيميلك وكلمة السر على شاشة التلفاز أو امسح الباركود الفخم بجوالك للربط الفوري.
                    </p>
                  </div>

                  {tvAuthSignedIn ? (
                    <div className="rounded-2xl bg-emerald-950/60 border border-emerald-500/40 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>تم تسجيل حسابك على الشاشة!</span>
                      </div>
                      <p className="text-xs text-emerald-100/80">
                        الآن من جوالك اضغط «بث» (من تبويب التحكم أو أي غرفة أونلاين) وسيبدأ العرض الفوري هنا.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleTvScreenLogin} className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-amber-200 block mb-1">البريد الإلكتروني</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            required
                            dir="ltr"
                            value={tvAuthEmail}
                            onChange={(e) => setTvAuthEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full rounded-xl bg-black/50 border border-amber-500/35 pr-9 pl-3 py-2.5 text-sm font-bold text-amber-50 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-amber-200 block mb-1">كلمة السر</label>
                        <input
                          type="password"
                          required
                          dir="ltr"
                          value={tvAuthPassword}
                          onChange={(e) => setTvAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl bg-black/50 border border-amber-500/35 px-3 py-2.5 text-sm font-bold text-amber-50 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      {tvAuthError && <p className="text-xs font-bold text-rose-400">{tvAuthError}</p>}
                      <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-gradient-to-l from-amber-400 to-orange-500 text-[#140D05] font-black text-xs cursor-pointer shadow-md"
                      >
                        تأكيد الدخول وربط الشاشة
                      </button>
                    </form>
                  )}

                  {tvSession?.username && (
                    <div className="text-xs text-amber-300 font-bold">
                      الحساب المربوط: @{tvSession.username} {tvSession.roomCode ? `· غرفة ${tvSession.roomCode}` : ''}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* PHONE / CONTROLLER "بث" PANEL */
            <div className="max-w-lg mx-auto rounded-3xl bg-[#16110B] border-2 border-amber-400/50 p-6 space-y-5">
              <div className="text-center space-y-1.5">
                <Users className="w-8 h-8 text-amber-400 mx-auto" />
                <h3 className="text-lg font-black text-amber-300">ربط جوالك بالشاشة والضغط على «بث»</h3>
                <p className="text-xs text-amber-100/75">
                  أدخل كود الشاشة الظاهر أسفل الباركود الذهبي وكود غرفتك ثم اضغط زر بث لعرض لعبكم مباشرة!
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black text-amber-200 block mb-1">كود شاشة التلفاز (مثل TV4F8K)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={remoteTvCode}
                    onChange={(e) => setRemoteTvCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="TVXXXX"
                    className="w-full rounded-xl bg-black/50 border border-amber-500/40 px-4 py-3 text-center text-lg font-mono font-black tracking-widest text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-amber-200 block mb-1">كود الغرفة المراد بثها</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={remoteRoomCode}
                    onChange={(e) => setRemoteRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="مثال: ABC123"
                    className="w-full rounded-xl bg-black/50 border border-amber-500/40 px-4 py-3 text-center text-lg font-mono font-black tracking-widest text-amber-50 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {castMsg && (
                <div
                  className={`rounded-xl px-4 py-3 text-xs font-black ${
                    castMsg.ok
                      ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/70 border border-rose-500/50 text-rose-300'
                  }`}
                >
                  {castMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={castingBusy || !hasPlus}
                  onClick={() => void handleStartBroadcast(true)}
                  className="py-3.5 rounded-xl bg-gradient-to-l from-amber-400 via-yellow-500 to-orange-500 text-[#140D05] font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-45"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>بث على الشاشة الآن 📺</span>
                </button>
                <button
                  type="button"
                  disabled={castingBusy}
                  onClick={() => void handleStartBroadcast(false)}
                  className="py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-amber-500/30 text-amber-200 font-black text-xs cursor-pointer"
                >
                  إيقاف البث
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
