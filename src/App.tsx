import React, { useCallback, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AppNotification,
  BarrahCategory,
  DubMicScene,
  GameConfig,
  JamrPlusStatus,
  Question,
  Section,
  Topic,
} from './types/jamr';
import { DEFAULT_GAMES, DEFAULT_SECTIONS } from './data/defaultGames';
import { buildDefault6000Questions, DEFAULT_100_TOPICS } from './data/jamrain100Topics';
import { DEFAULT_BARRAH_CATEGORIES } from './data/barrahSalfaCategories';
import { DEFAULT_DUB_SCENES } from './data/dubMicScenes';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeScreen } from './components/HomeScreen';
import { NameOnboardingModal } from './components/NameOnboardingModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { BugReportModal } from './components/BugReportModal';
import { MaintenanceModal } from './components/MaintenanceModal';
import { OfflineGameRunner } from './components/OfflineGameRunner';
import { OnlineGameView } from './components/OnlineGameView';
import { JamrPlusModal } from './components/JamrPlusModal';
import { AuthModal } from './components/AuthModal';
import { TvCastModal } from './components/TvCastModal';
import { AvatarCropperModal } from './components/AvatarCropperModal';
import { ActiveCheatEntry, loadActiveCheats, SecretCodesModal } from './components/SecretCodesModal';
import { FriendsAndNotificationsModal } from './components/FriendsAndNotificationsModal';
import { RoomQrModal } from './components/RoomQrModal';
import { CharacterReactionProvider } from './context/CharacterReactionContext';
import { applyThemeConfig, DEFAULT_THEME, loadThemeConfig } from './utils/themeManager';
import {
  AccountSessionState,
  createDefaultPlusStatus,
  isPlusActive,
  loadAccountSession,
  loadPlusStatus,
  ONE_YEAR_MS,
  saveAccountSession,
  savePlusStatus,
} from './utils/plusManager';
import { getOrCreateSessionPlayerId } from './network/socketClient';
import { apiFetchJson } from './utils/apiClient';
import { loadLocalStoreSnapshot } from './utils/localFallbackStore';
import { SoundFX } from './utils/soundFx';
import {
  DEFAULT_AVATAR_BG,
  DEFAULT_AVATAR_ID,
  sanitizeAvatarBg,
  sanitizeAvatarId,
} from './data/characterAvatars';

const ADMIN_PORTAL_URL = 'https://aledara-jamr.vercel.app';

type ViewMode =
  | { kind: 'home' }
  | { kind: 'offline'; game: GameConfig; matchKey: number }
  | { kind: 'online'; tab: 'create' | 'join'; gameId?: string; roomCode?: string; matchKey: number };

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return window.localStorage.getItem('jamr_player_name') || '';
    } catch {
      return '';
    }
  });

  const [playerAvatar, setPlayerAvatar] = useState<string>(() => {
    try {
      return sanitizeAvatarId(window.localStorage.getItem('jamr_player_avatar'));
    } catch {
      return DEFAULT_AVATAR_ID;
    }
  });

  const [playerAvatarBg, setPlayerAvatarBg] = useState<string>(() => {
    try {
      return sanitizeAvatarBg(window.localStorage.getItem('jamr_player_avatar_bg'));
    } catch {
      return DEFAULT_AVATAR_BG;
    }
  });

  const [username, setUsername] = useState<string>(() => {
    try {
      return window.localStorage.getItem('jamr_username') || '';
    } catch {
      return '';
    }
  });

  const [plusStatus, setPlusStatus] = useState<JamrPlusStatus>(() => loadPlusStatus());
  const [accountSession, setAccountSession] = useState<AccountSessionState | null>(() =>
    loadAccountSession()
  );

  const [games, setGames] = useState<GameConfig[]>(DEFAULT_GAMES);
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [topics, setTopics] = useState<Topic[]>(DEFAULT_100_TOPICS);
  const [questions, setQuestions] = useState<Question[]>(() => buildDefault6000Questions());
  const [barrahCategories, setBarrahCategories] = useState<BarrahCategory[]>(DEFAULT_BARRAH_CATEGORIES);
  const [dubScenes, setDubScenes] = useState<DubMicScene[]>(DEFAULT_DUB_SCENES);

  const [view, setView] = useState<ViewMode>({ kind: 'home' });
  const [onlineMatchActive, setOnlineMatchActive] = useState(false);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);

  // Notifications & Cheats
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [liveToastNotif, setLiveToastNotif] = useState<AppNotification | null>(null);
  const [activeCheats, setActiveCheats] = useState<ActiveCheatEntry[]>(() => loadActiveCheats());

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPlusModal, setShowPlusModal] = useState(false);
  const [plusPromoReason, setPlusPromoReason] = useState<string | undefined>(undefined);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [tvCastState, setTvCastState] = useState<{
    mode: 'tv_screen' | 'pair_from_phone';
    initialPairTvCode?: string;
    roomCode?: string;
  } | null>(null);
  const [showSecretCodesModal, setShowSecretCodesModal] = useState(false);
  const [showAvatarCropperModal, setShowAvatarCropperModal] = useState(false);
  const [showQrGeneratorModal, setShowQrGeneratorModal] = useState(false);
  const [friendsModalTab, setFriendsModalTab] = useState<'friends' | 'notifications' | null>(null);
  const [maintenanceGame, setMaintenanceGame] = useState<GameConfig | null>(null);

  const hasPlus = isPlusActive(plusStatus);

  // Apply custom CSS colors ONLY while Jamr Plus is active (otherwise keep classic JAMR palette)
  useEffect(() => {
    if (hasPlus) {
      applyThemeConfig(loadThemeConfig());
    } else {
      applyThemeConfig(DEFAULT_THEME);
    }
  }, [hasPlus]);

  // Periodically sync account token & 1-year Plus expiration
  useEffect(() => {
    if (!accountSession?.token) return;
    let cancelled = false;
    void apiFetchJson<{
      ok?: boolean;
      account?: {
        email: string;
        displayName?: string;
        username?: string;
        plus?: JamrPlusStatus;
      };
    }>('/api/auth/me', {
      headers: { Authorization: `Bearer ${accountSession.token}` },
    }).then((res) => {
      if (cancelled || !res.ok || !res.data?.ok || !res.data.account) return;
      const acct = res.data.account;
      if (acct.username && !username) {
        handleSaveUsername(acct.username);
      }
      if (acct.plus) {
        const saved = savePlusStatus(acct.plus);
        setPlusStatus(saved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountSession?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCatalogData = useCallback(async () => {
    const [catRes, jamRes] = await Promise.all([
      apiFetchJson<{
        games?: GameConfig[];
        barrahCategories?: BarrahCategory[];
        dubScenes?: DubMicScene[];
      }>('/api/catalog'),
      apiFetchJson<{
        sections?: Section[];
        topics?: Topic[];
        questions?: Question[];
      }>('/api/jamrain/data'),
    ]);

    if (catRes.ok && catRes.data) {
      if (Array.isArray(catRes.data.games) && catRes.data.games.length > 0) setGames(catRes.data.games);
      if (Array.isArray(catRes.data.barrahCategories) && catRes.data.barrahCategories.length > 0) {
        setBarrahCategories(catRes.data.barrahCategories);
      }
      if (Array.isArray(catRes.data.dubScenes) && catRes.data.dubScenes.length > 0) {
        setDubScenes(catRes.data.dubScenes);
      }
    } else if (catRes.isHtmlOrStatic || catRes.networkError) {
      const localSnap = loadLocalStoreSnapshot();
      if (localSnap.games.length > 0) setGames(localSnap.games);
      if (localSnap.barrahCategories.length > 0) setBarrahCategories(localSnap.barrahCategories);
      if (Array.isArray(localSnap.dubScenes) && localSnap.dubScenes.length > 0) {
        setDubScenes(localSnap.dubScenes);
      }
    }

    if (jamRes.ok && jamRes.data) {
      if (Array.isArray(jamRes.data.sections) && jamRes.data.sections.length > 0) {
        setSections(jamRes.data.sections);
      }
      if (Array.isArray(jamRes.data.topics) && jamRes.data.topics.length > 0) {
        setTopics(jamRes.data.topics);
      }
      if (Array.isArray(jamRes.data.questions) && jamRes.data.questions.length > 0) {
        setQuestions(jamRes.data.questions);
      }
    } else if (jamRes.isHtmlOrStatic || jamRes.networkError) {
      const localSnap = loadLocalStoreSnapshot();
      if (localSnap.sections.length > 0) setSections(localSnap.sections);
    }
  }, []);

  useEffect(() => {
    void fetchCatalogData();
  }, [fetchCatalogData]);

  // Sync user presence & pull unread notifications periodically when @username is registered
  const syncUserPresence = useCallback(async () => {
    if (!username) return;
    await apiFetchJson('/api/users/sync-presence', {
      method: 'POST',
      body: JSON.stringify({
        username,
        playerId: getOrCreateSessionPlayerId(),
        displayName: playerName || 'لاعب جَمْر',
        avatar: playerAvatar,
        avatarBg: playerAvatarBg,
        roomCode: activeRoomCode,
        isPlus: hasPlus,
        plusGlow: hasPlus ? plusStatus.glow : undefined,
        plusTitle: hasPlus ? plusStatus.profileTitle : undefined,
        plusFrame: hasPlus ? plusStatus.avatarFrame : undefined,
      }),
    });
    const res = await apiFetchJson<{ ok?: boolean; notifications?: AppNotification[] }>(
      `/api/friends/state?username=${encodeURIComponent(username)}`
    );
    if (res.ok && res.data?.ok && Array.isArray(res.data.notifications)) {
      setNotifications(res.data.notifications);
    }
  }, [username, playerName, playerAvatar, playerAvatarBg, activeRoomCode, hasPlus, plusStatus]);

  useEffect(() => {
    if (!username) return;
    void syncUserPresence();
    const timer = window.setInterval(() => {
      void syncUserPresence();
    }, 15_000);
    return () => clearInterval(timer);
  }, [username, syncUserPresence]);

  const handleSaveName = (name: string) => {
    setPlayerName(name);
    try {
      window.localStorage.setItem('jamr_player_name', name);
    } catch {
      // ignore
    }
  };

  const handleSaveAvatar = (avatarId: string) => {
    const clean = sanitizeAvatarId(avatarId);
    setPlayerAvatar(clean);
    try {
      window.localStorage.setItem('jamr_player_avatar', clean);
    } catch {
      // ignore
    }
  };

  const handleSaveAvatarBg = (bg: string) => {
    const clean = sanitizeAvatarBg(bg);
    setPlayerAvatarBg(clean);
    try {
      window.localStorage.setItem('jamr_player_avatar_bg', clean);
    } catch {
      // ignore
    }
  };

  const handleSaveUsername = (uname: string) => {
    setUsername(uname);
    try {
      window.localStorage.setItem('jamr_username', uname);
    } catch {
      // ignore
    }
  };

  const handleIncomingNotification = useCallback((notif: AppNotification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === notif.id)) return prev;
      return [notif, ...prev].slice(0, 40);
    });
    setLiveToastNotif(notif);
    window.setTimeout(() => {
      setLiveToastNotif((curr) => (curr?.id === notif.id ? null : curr));
    }, 5500);
  }, []);

  const handleClaimAdminUsername = useCallback(
    async (rawUname: string) => {
      const cleanUname = rawUname.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
      if (!cleanUname) return;

      const res = await apiFetchJson<{
        ok?: boolean;
        error?: string;
        user?: {
          username: string;
          displayName?: string;
          avatar?: string;
          avatarBg?: string;
          isPlus?: boolean;
        };
      }>(
        '/api/users/claim-admin-qr',
        {
          method: 'POST',
          body: JSON.stringify({
            username: cleanUname,
            playerId: getOrCreateSessionPlayerId(),
            displayName: playerName || cleanUname,
            avatar: playerAvatar,
            avatarBg: playerAvatarBg,
          }),
        },
        { unlockStorageOnGesture: true }
      );

      if (res.ok && res.data?.ok && res.data.user) {
        const u = res.data.user;
        handleSaveUsername(u.username);
        if (u.displayName && !playerName) handleSaveName(u.displayName);
        if (u.avatar) handleSaveAvatar(u.avatar);
        if (u.avatarBg) handleSaveAvatarBg(u.avatarBg);
        if (u.isPlus && !isPlusActive(plusStatus)) {
          const now = Date.now();
          const upgraded = savePlusStatus({
            ...plusStatus,
            isActive: true,
            startedAt: now,
            expiresAt: now + ONE_YEAR_MS,
            activatedVia: 'admin',
            priceSar: 0,
            planLabel: 'جَمْر بلس — سنة كاملة',
          });
          setPlusStatus(upgraded);
        }
        SoundFX.playCorrect();
        handleIncomingNotification({
          id: `admin_claim_${Date.now()}`,
          type: 'system',
          title: 'تم استلام اليوزر نيم ✅',
          body: `تم ربط حسابك باليوزر نيم @${u.username} بنجاح.`,
          createdAt: Date.now(),
          read: false,
        });
      } else if (res.isHtmlOrStatic || res.networkError) {
        handleSaveUsername(cleanUname);
        SoundFX.playCorrect();
        handleIncomingNotification({
          id: `admin_claim_local_${Date.now()}`,
          type: 'system',
          title: 'تم حفظ اليوزر نيم ✅',
          body: `تم تعيين اليوزر نيم @${cleanUname} لحسابك محلياً.`,
          createdAt: Date.now(),
          read: false,
        });
      }
    },
    [playerName, playerAvatar, playerAvatarBg, plusStatus, handleIncomingNotification]
  );

  // URL invite / TV pair / admin username QR auto-detection (?room=, ?code=, ?tv=, ?assign_username=)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = (params.get('room') || params.get('code') || '').trim().toUpperCase();
      if (roomParam) {
        setView({
          kind: 'online',
          tab: 'join',
          roomCode: roomParam.replace(/[^A-Z0-9]/g, ''),
          matchKey: Date.now(),
        });
      }
      const tvParam = (params.get('tv') || '').trim().toUpperCase();
      if (tvParam) {
        setTvCastState({
          mode: 'pair_from_phone',
          initialPairTvCode: tvParam.replace(/[^A-Z0-9]/g, ''),
        });
      }
      const assignUsernameParam = (params.get('assign_username') || '').trim();
      if (assignUsernameParam) {
        void handleClaimAdminUsername(assignUsernameParam);
      }
    } catch {
      // ignore URL parsing errors
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdatePlus = (next: JamrPlusStatus) => {
    const saved = savePlusStatus(next);
    setPlusStatus(saved);
  };

  const handleAuthSuccess = (
    session: AccountSessionState,
    accountPlus?: JamrPlusStatus,
    plusExpired?: boolean
  ) => {
    saveAccountSession(session);
    setAccountSession(session);
    if (plusExpired) {
      const expiredReset = savePlusStatus(
        createDefaultPlusStatus({
          isActive: false,
          expiresAt: accountPlus?.expiresAt,
        })
      );
      setPlusStatus(expiredReset);
      handleIncomingNotification({
        id: `plus_exp_${Date.now()}`,
        type: 'system',
        title: 'انتهت سنة اشتراك جَمْر بلس 👑',
        body: 'انتهى اشتراكك السنوي، يمكنك التجديد الآن لتفعيل كافة المزايا من جديد.',
        createdAt: Date.now(),
        read: false,
      });
    } else if (accountPlus && isPlusActive(accountPlus)) {
      const saved = savePlusStatus(accountPlus);
      setPlusStatus(saved);
    }
  };

  const handleLogout = () => {
    saveAccountSession(null);
    setAccountSession(null);
  };

  const handleOpenAvatarCropper = () => {
    if (!isPlusActive(plusStatus)) {
      setPlusPromoReason(
        'رفع صورة شخصية من الاستوديو مع القص الدائري متاح حصرياً لمشتركي جَمْر بلس (٢ ريال/سنة).'
      );
      setShowPlusModal(true);
      return;
    }
    setShowAvatarCropperModal(true);
  };

  // Hidden silent unlock trigger in the bottom-left corner (grants full Jamr Plus features for free without payment)
  const handleHiddenFreePlusUnlock = async () => {
    const headers: Record<string, string> = {};
    if (accountSession?.token) {
      headers.Authorization = `Bearer ${accountSession.token}`;
    }
    const res = await apiFetchJson<{ ok?: boolean; plus?: JamrPlusStatus }>(
      '/api/plus/free-unlock',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountToken: accountSession?.token }),
      },
      { unlockStorageOnGesture: true }
    );

    const now = Date.now();
    const unlocked: JamrPlusStatus =
      res.ok && res.data?.ok && res.data.plus
        ? res.data.plus
        : {
            ...plusStatus,
            isActive: true,
            startedAt: now,
            expiresAt: now + ONE_YEAR_MS,
            paymentMethod: 'free_pass',
            priceSar: 0,
            activatedVia: 'hidden_pass',
            planLabel: 'جَمْر بلس — سنة كاملة',
          };

    handleUpdatePlus(unlocked);
    SoundFX.playWin();
    confetti({ particleCount: 95, spread: 75, origin: { x: 0.12, y: 0.9 } });
    handleIncomingNotification({
      id: `plus_free_${Date.now()}`,
      type: 'system',
      title: 'تم تفعيل جَمْر بلس 👑',
      body: 'مبروك! تم فتح جميع ميزات جَمْر بلس لك لمدة سنة كاملة.',
      createdAt: Date.now(),
      read: false,
    });
  };

  const openOfflineGame = (game: GameConfig) => {
    if (game.underMaintenance || !game.isActive) {
      setMaintenanceGame(game);
      return;
    }
    setView({ kind: 'offline', game, matchKey: Date.now() });
  };

  const handleJoinRoomDirect = (code: string) => {
    setView({
      kind: 'online',
      tab: 'join',
      roomCode: code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
      matchKey: Date.now(),
    });
  };

  const handleResetMatch = () => {
    if (view.kind === 'offline') {
      setView({ kind: 'offline', game: view.game, matchKey: Date.now() });
    } else if (view.kind === 'online') {
      setView({ ...view, matchKey: Date.now() });
      setOnlineMatchActive(false);
    }
  };

  const isInMatch = view.kind === 'offline' || (view.kind === 'online' && onlineMatchActive);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <CharacterReactionProvider>
      <div className="min-h-screen flex flex-col bg-transparent text-[#23140E]">
        <Header
          playerName={playerName}
          playerAvatar={playerAvatar}
          playerAvatarBg={playerAvatarBg}
          username={username}
          plusStatus={plusStatus}
          accountSession={accountSession}
          unreadNotifications={unreadCount}
          activeCheatsCount={activeCheats.length}
          onUpdatePlayerName={handleSaveName}
          onUpdatePlayerAvatar={handleSaveAvatar}
          onUpdatePlayerAvatarBg={handleSaveAvatarBg}
          onOpenAvatarCropper={handleOpenAvatarCropper}
          isInMatch={isInMatch}
          isHome={view.kind === 'home'}
          onGoHome={() => {
            setOnlineMatchActive(false);
            setActiveRoomCode(null);
            setView({ kind: 'home' });
          }}
          onResetMatch={handleResetMatch}
          onOpenRules={() => setShowRulesModal(true)}
          onOpenFriends={() => setFriendsModalTab('friends')}
          onOpenNotifications={() => setFriendsModalTab('notifications')}
          onOpenPlusModal={() => {
            setPlusPromoReason(undefined);
            setShowPlusModal(true);
          }}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onOpenTvCast={() =>
            setTvCastState({ mode: 'tv_screen', roomCode: activeRoomCode || undefined })
          }
          onOpenSecretCodes={() => setShowSecretCodesModal(true)}
          onOpenQrGenerator={() => setShowQrGeneratorModal(true)}
          onOpenReport={() => setShowReportModal(true)}
        />

        {/* Real-time Push Notification Toast */}
        {liveToastNotif && (
          <div className="fixed top-20 left-4 z-50 max-w-xs w-full rounded-2xl bg-white border-2 border-orange-400 shadow-2xl p-3.5 flex items-start justify-between gap-2.5 animate-bounce">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-black text-orange-700">{liveToastNotif.title}</div>
              <div className="text-xs text-[#23140E] line-clamp-2">{liveToastNotif.body}</div>
              {liveToastNotif.roomCode && (
                <button
                  type="button"
                  onClick={() => {
                    const code = liveToastNotif.roomCode!;
                    setLiveToastNotif(null);
                    handleJoinRoomDirect(code);
                  }}
                  className="mt-1 px-3 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-black cursor-pointer"
                >
                  انضمام الآن ⚡
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLiveToastNotif(null)}
              className="text-xs text-[#7C5D4F] font-black cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <main className="flex-1">
          {view.kind === 'home' && (
            <HomeScreen
              games={games}
              playerName={playerName || 'لاعب جَمْر'}
              playerAvatar={playerAvatar}
              playerAvatarBg={playerAvatarBg}
              plusStatus={plusStatus}
              onUpdatePlayerName={handleSaveName}
              onUpdatePlayerAvatar={handleSaveAvatar}
              onUpdatePlayerAvatarBg={handleSaveAvatarBg}
              onOpenAvatarCropper={handleOpenAvatarCropper}
              onOpenPlusModal={() => {
                setPlusPromoReason(undefined);
                setShowPlusModal(true);
              }}
              onOpenTvCast={() =>
                setTvCastState({ mode: 'tv_screen', roomCode: activeRoomCode || undefined })
              }
              onSelectOfflineGame={openOfflineGame}
              onSelectOnlineCreate={(gameId) =>
                setView({ kind: 'online', tab: 'create', gameId, matchKey: Date.now() })
              }
              onSelectOnlineJoin={() =>
                setView({ kind: 'online', tab: 'join', matchKey: Date.now() })
              }
              onShowMaintenance={(g) => setMaintenanceGame(g)}
            />
          )}

          {view.kind === 'offline' && (
            <OfflineGameRunner
              key={view.matchKey}
              game={view.game}
              playerName={playerName || 'لاعب جَمْر'}
              playerAvatar={playerAvatar}
              playerAvatarBg={playerAvatarBg}
              sections={sections}
              topics={topics}
              questions={questions}
              barrahCategories={barrahCategories}
              onQuestionsAdded={(added) => {
                if (!Array.isArray(added) || added.length === 0) return;
                setQuestions((prev) => {
                  const seen = new Set(prev.map((q) => q.id));
                  const fresh = added.filter((q) => q && q.id && !seen.has(q.id));
                  return fresh.length > 0 ? [...fresh, ...prev] : prev;
                });
              }}
              onJoinOnlineRoom={(code, name) => {
                if (name) handleSaveName(name);
                setView({
                  kind: 'online',
                  tab: 'join',
                  roomCode: code,
                  matchKey: Date.now(),
                });
              }}
              onExit={() => setView({ kind: 'home' })}
            />
          )}

          {view.kind === 'online' && (
            <OnlineGameView
              key={view.matchKey}
              initialTab={view.tab}
              initialGameId={view.gameId}
              initialRoomCode={view.roomCode}
              playerName={playerName}
              playerAvatar={playerAvatar}
              playerAvatarBg={playerAvatarBg}
              username={username}
              plusStatus={plusStatus}
              onUpdatePlayerAvatar={handleSaveAvatar}
              onUpdatePlayerAvatarBg={handleSaveAvatarBg}
              onOpenAvatarCropper={handleOpenAvatarCropper}
              onOpenPlusModal={() => {
                setPlusPromoReason(undefined);
                setShowPlusModal(true);
              }}
              onOpenTvCast={(rc) =>
                setTvCastState({ mode: 'tv_screen', roomCode: rc || activeRoomCode || undefined })
              }
              onClaimAdminUsername={(uname) => void handleClaimAdminUsername(uname)}
              onPairTvCode={(tvCode) =>
                setTvCastState({
                  mode: 'pair_from_phone',
                  initialPairTvCode: tvCode,
                  roomCode: activeRoomCode || undefined,
                })
              }
              onOpenFriendsInvite={() => setFriendsModalTab('friends')}
              onRoomCodeChange={setActiveRoomCode}
              onNotification={handleIncomingNotification}
              games={games}
              barrahCategories={barrahCategories}
              dubScenes={dubScenes}
              onMatchStateChange={setOnlineMatchActive}
              onExit={() => {
                setOnlineMatchActive(false);
                setActiveRoomCode(null);
                setView({ kind: 'home' });
              }}
            />
          )}
        </main>

        <Footer onOpenReport={() => setShowReportModal(true)} />

        {/* Completely invisible bottom-left secret button that unlocks full Jamr Plus features for free */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => void handleHiddenFreePlusUnlock()}
          className="fixed bottom-0 left-0 w-10 h-10 z-[85] opacity-0 bg-transparent border-0 cursor-default focus:outline-none"
        />

        {/* Zero-Login First-Load Name + Character Onboarding */}
        {!playerName && (
          <NameOnboardingModal
            initialAvatar={playerAvatar}
            initialAvatarBg={playerAvatarBg}
            isPlus={hasPlus}
            onOpenAvatarCropper={handleOpenAvatarCropper}
            onOpenPlusModal={() => {
              setPlusPromoReason(undefined);
              setShowPlusModal(true);
            }}
            onConfirm={(name, avatarId, avatarBg) => {
              handleSaveName(name);
              handleSaveAvatar(avatarId);
              handleSaveAvatarBg(avatarBg);
            }}
          />
        )}

        {showRulesModal && (
          <HowToPlayModal
            games={games}
            initialGameId={view.kind === 'offline' ? view.game.id : undefined}
            onClose={() => setShowRulesModal(false)}
          />
        )}

        {showReportModal && (
          <BugReportModal
            games={games}
            defaultReporterName={playerName}
            onClose={() => setShowReportModal(false)}
          />
        )}

        {showPlusModal && (
          <JamrPlusModal
            plusStatus={plusStatus}
            accountSession={accountSession}
            playerName={playerName || 'لاعب جَمْر'}
            playerAvatar={playerAvatar}
            playerAvatarBg={playerAvatarBg}
            username={username}
            promoBannerReason={plusPromoReason}
            onUpdatePlus={handleUpdatePlus}
            onAuthSuccess={handleAuthSuccess}
            onUpdatePlayerAvatar={handleSaveAvatar}
            onOpenAvatarCropper={() => {
              setShowPlusModal(false);
              handleOpenAvatarCropper();
            }}
            onOpenTvCast={() => {
              setShowPlusModal(false);
              setTvCastState({ mode: 'tv_screen', roomCode: activeRoomCode || undefined });
            }}
            onClose={() => {
              setShowPlusModal(false);
              setPlusPromoReason(undefined);
            }}
          />
        )}

        {showAuthModal && (
          <AuthModal
            accountSession={accountSession}
            plusStatus={plusStatus}
            playerName={playerName || 'لاعب جَمْر'}
            username={username}
            avatar={playerAvatar}
            avatarBg={playerAvatarBg}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            onClose={() => setShowAuthModal(false)}
          />
        )}

        {tvCastState && (
          <TvCastModal
            mode={tvCastState.mode}
            initialPairTvCode={tvCastState.initialPairTvCode}
            activeRoomCode={tvCastState.roomCode || activeRoomCode}
            accountSession={accountSession}
            plusStatus={plusStatus}
            playerName={playerName || 'لاعب جَمْر'}
            username={username}
            onOpenPlusModal={() => {
              setTvCastState(null);
              setPlusPromoReason(
                'ميزة العرض والبث المباشر على شاشة التلفاز متاحة حصرياً لأعضاء جَمْر بلس.'
              );
              setShowPlusModal(true);
            }}
            onClose={() => setTvCastState(null)}
          />
        )}

        {showSecretCodesModal && (
          <SecretCodesModal
            onUnlockAdmin={(enteredCode) => {
              const targetUrl = `${ADMIN_PORTAL_URL}/#code=${encodeURIComponent(enteredCode)}`;
              try {
                (window.top || window).location.href = targetUrl;
              } catch {
                window.location.href = targetUrl;
              }
            }}
            onCheatActivated={(updated) => setActiveCheats(updated)}
            onClose={() => setShowSecretCodesModal(false)}
          />
        )}

        {friendsModalTab && (
          <FriendsAndNotificationsModal
            initialTab={friendsModalTab}
            username={username}
            displayName={playerName || 'لاعب جَمْر'}
            avatar={playerAvatar}
            avatarBg={playerAvatarBg}
            plusStatus={plusStatus}
            activeRoomCode={activeRoomCode}
            notifications={notifications}
            onUsernameSaved={handleSaveUsername}
            onNotificationsChange={setNotifications}
            onJoinRoomDirect={handleJoinRoomDirect}
            onOpenPlusOffer={(reason) => {
              setFriendsModalTab(null);
              setPlusPromoReason(reason);
              setShowPlusModal(true);
            }}
            onClose={() => setFriendsModalTab(null)}
          />
        )}

        {showAvatarCropperModal && (
          <AvatarCropperModal
            onSave={(croppedDataUrl) => {
              handleSaveAvatar(croppedDataUrl);
              setShowAvatarCropperModal(false);
            }}
            onClose={() => setShowAvatarCropperModal(false)}
          />
        )}

        {showQrGeneratorModal && (
          <RoomQrModal
            initialRoomCode={activeRoomCode || undefined}
            onQuickJoinCode={handleJoinRoomDirect}
            onClose={() => setShowQrGeneratorModal(false)}
          />
        )}

        {maintenanceGame && (
          <MaintenanceModal
            game={maintenanceGame}
            onClose={() => setMaintenanceGame(null)}
          />
        )}
      </div>
    </CharacterReactionProvider>
  );
}
