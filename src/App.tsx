import React, { useCallback, useEffect, useState } from 'react';
import {
  AppNotification,
  BarrahCategory,
  DubMicScene,
  GameConfig,
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
import { ThemeCustomizerModal } from './components/ThemeCustomizerModal';
import { AvatarCropperModal } from './components/AvatarCropperModal';
import { ActiveCheatEntry, loadActiveCheats, SecretCodesModal } from './components/SecretCodesModal';
import { FriendsAndNotificationsModal } from './components/FriendsAndNotificationsModal';
import { RoomQrModal } from './components/RoomQrModal';
import { CharacterReactionProvider } from './context/CharacterReactionContext';
import { applyThemeConfig, loadThemeConfig } from './utils/themeManager';
import { getOrCreateSessionPlayerId } from './network/socketClient';
import { apiFetchJson } from './utils/apiClient';
import { loadLocalStoreSnapshot } from './utils/localFallbackStore';
import {
  DEFAULT_AVATAR_BG,
  DEFAULT_AVATAR_ID,
  sanitizeAvatarBg,
  sanitizeAvatarId,
} from './data/characterAvatars';

const ADMIN_PORTAL_URL = 'https://ais-pre-hxpy5566j6xae4ya2hfuj2-546090154039.europe-west2.run.app';

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
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showSecretCodesModal, setShowSecretCodesModal] = useState(false);
  const [showAvatarCropperModal, setShowAvatarCropperModal] = useState(false);
  const [showQrGeneratorModal, setShowQrGeneratorModal] = useState(false);
  const [friendsModalTab, setFriendsModalTab] = useState<'friends' | 'notifications' | null>(null);
  const [maintenanceGame, setMaintenanceGame] = useState<GameConfig | null>(null);

  // Apply custom CSS colors on startup
  useEffect(() => {
    applyThemeConfig(loadThemeConfig());
  }, []);

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
      }),
    });
    const res = await apiFetchJson<{ ok?: boolean; notifications?: AppNotification[] }>(
      `/api/friends/state?username=${encodeURIComponent(username)}`
    );
    if (res.ok && res.data?.ok && Array.isArray(res.data.notifications)) {
      setNotifications(res.data.notifications);
    }
  }, [username, playerName, playerAvatar, playerAvatarBg, activeRoomCode]);

  useEffect(() => {
    if (!username) return;
    void syncUserPresence();
    const timer = window.setInterval(() => {
      void syncUserPresence();
    }, 15_000);
    return () => clearInterval(timer);
  }, [username, syncUserPresence]);

  // Invite link auto-detection (?room=CODE or ?code=CODE)
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
    } catch {
      // ignore URL parsing errors
    }
  }, []);

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
          unreadNotifications={unreadCount}
          activeCheatsCount={activeCheats.length}
          onUpdatePlayerName={handleSaveName}
          onUpdatePlayerAvatar={handleSaveAvatar}
          onUpdatePlayerAvatarBg={handleSaveAvatarBg}
          onOpenAvatarCropper={() => setShowAvatarCropperModal(true)}
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
          onOpenThemeCustomizer={() => setShowThemeModal(true)}
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
              onUpdatePlayerName={handleSaveName}
              onUpdatePlayerAvatar={handleSaveAvatar}
              onUpdatePlayerAvatarBg={handleSaveAvatarBg}
              onOpenAvatarCropper={() => setShowAvatarCropperModal(true)}
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
              onUpdatePlayerAvatar={handleSaveAvatar}
              onUpdatePlayerAvatarBg={handleSaveAvatarBg}
              onOpenAvatarCropper={() => setShowAvatarCropperModal(true)}
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

        {/* Zero-Login First-Load Name + Character Onboarding */}
        {!playerName && (
          <NameOnboardingModal
            initialAvatar={playerAvatar}
            initialAvatarBg={playerAvatarBg}
            onOpenAvatarCropper={() => setShowAvatarCropperModal(true)}
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

        {showThemeModal && (
          <ThemeCustomizerModal onClose={() => setShowThemeModal(false)} />
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
            activeRoomCode={activeRoomCode}
            notifications={notifications}
            onUsernameSaved={handleSaveUsername}
            onNotificationsChange={setNotifications}
            onJoinRoomDirect={handleJoinRoomDirect}
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
