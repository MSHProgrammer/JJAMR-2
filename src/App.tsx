import React, { useCallback, useEffect, useState } from 'react';
import {
  BarrahCategory,
  GameConfig,
  Question,
  Section,
  Topic,
} from './types/jamr';
import { DEFAULT_GAMES, DEFAULT_SECTIONS } from './data/defaultGames';
import { buildDefault6000Questions, DEFAULT_100_TOPICS } from './data/jamrain100Topics';
import { DEFAULT_BARRAH_CATEGORIES } from './data/barrahSalfaCategories';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeScreen } from './components/HomeScreen';
import { NameOnboardingModal } from './components/NameOnboardingModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { BugReportModal } from './components/BugReportModal';
import { MaintenanceModal } from './components/MaintenanceModal';
import { OfflineGameRunner } from './components/OfflineGameRunner';
import { OnlineGameView } from './components/OnlineGameView';
import { AdminPanel } from './components/AdminPanel';
import { CharacterReactionProvider } from './context/CharacterReactionContext';
import { DEFAULT_AVATAR_ID, sanitizeAvatarId } from './data/characterAvatars';

type ViewMode =
  | { kind: 'home' }
  | { kind: 'offline'; game: GameConfig; matchKey: number }
  | { kind: 'online'; tab: 'create' | 'join'; gameId?: string; roomCode?: string; matchKey: number }
  | { kind: 'admin' };

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

  const [games, setGames] = useState<GameConfig[]>(DEFAULT_GAMES);
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [topics, setTopics] = useState<Topic[]>(DEFAULT_100_TOPICS);
  const [questions, setQuestions] = useState<Question[]>(() => buildDefault6000Questions());
  const [barrahCategories, setBarrahCategories] = useState<BarrahCategory[]>(DEFAULT_BARRAH_CATEGORIES);

  const [view, setView] = useState<ViewMode>({ kind: 'home' });
  const [onlineMatchActive, setOnlineMatchActive] = useState(false);

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [maintenanceGame, setMaintenanceGame] = useState<GameConfig | null>(null);

  const fetchCatalogData = useCallback(async () => {
    try {
      const [catRes, jamRes] = await Promise.all([
        fetch('/api/catalog', { cache: 'no-store' }),
        fetch('/api/jamrain/data', { cache: 'no-store' }),
      ]);
      if (catRes.ok) {
        const cat = await catRes.json();
        if (Array.isArray(cat.games) && cat.games.length > 0) setGames(cat.games);
        if (Array.isArray(cat.barrahCategories) && cat.barrahCategories.length > 0) {
          setBarrahCategories(cat.barrahCategories);
        }
      }
      if (jamRes.ok) {
        const jam = await jamRes.json();
        if (Array.isArray(jam.sections) && jam.sections.length > 0) setSections(jam.sections);
        if (Array.isArray(jam.topics) && jam.topics.length > 0) setTopics(jam.topics);
        if (Array.isArray(jam.questions) && jam.questions.length > 0) setQuestions(jam.questions);
      }
    } catch {
      // Fall back smoothly to local built-in datasets
    }
  }, []);

  useEffect(() => {
    void fetchCatalogData();
  }, [fetchCatalogData]);

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

  const openOfflineGame = (game: GameConfig) => {
    if (game.underMaintenance || !game.isActive) {
      setMaintenanceGame(game);
      return;
    }
    setView({ kind: 'offline', game, matchKey: Date.now() });
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

  return (
    <CharacterReactionProvider>
      <div className="min-h-screen flex flex-col bg-transparent text-[#23140E]">
        <Header
          playerName={playerName}
          playerAvatar={playerAvatar}
          onUpdatePlayerName={handleSaveName}
          onUpdatePlayerAvatar={handleSaveAvatar}
          isInMatch={isInMatch}
          isHome={view.kind === 'home'}
          onGoHome={() => {
            setOnlineMatchActive(false);
            setView({ kind: 'home' });
          }}
          onResetMatch={handleResetMatch}
          onOpenRules={() => setShowRulesModal(true)}
          onOpenAdmin={() => setView({ kind: 'admin' })}
        />

        <main className="flex-1">
          {view.kind === 'home' && (
            <HomeScreen
              games={games}
              playerName={playerName || 'لاعب جَمْر'}
              playerAvatar={playerAvatar}
              onUpdatePlayerName={handleSaveName}
              onUpdatePlayerAvatar={handleSaveAvatar}
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
              playerName={playerName || 'لاعب جَمْر'}
              playerAvatar={playerAvatar}
              onUpdatePlayerAvatar={handleSaveAvatar}
              games={games}
              barrahCategories={barrahCategories}
              onMatchStateChange={setOnlineMatchActive}
              onExit={() => {
                setOnlineMatchActive(false);
                setView({ kind: 'home' });
              }}
            />
          )}

          {view.kind === 'admin' && (
            <AdminPanel
              onDataUpdated={() => void fetchCatalogData()}
              onExit={() => setView({ kind: 'home' })}
            />
          )}
        </main>

        <Footer onOpenReport={() => setShowReportModal(true)} />

        {/* Zero-Login First-Load Name + Character Onboarding */}
        {!playerName && (
          <NameOnboardingModal
            initialAvatar={playerAvatar}
            onConfirm={(name, avatarId) => {
              handleSaveName(name);
              handleSaveAvatar(avatarId);
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
