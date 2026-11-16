import {
  BugReport,
  CheatCodeConfig,
  DataStoreSnapshot,
  DubMicScene,
  GameConfig,
} from '../types/jamr';
import { DEFAULT_GAMES, DEFAULT_SECTIONS } from '../data/defaultGames';
import { buildDefault6000Questions, DEFAULT_100_TOPICS } from '../data/jamrain100Topics';
import { DEFAULT_BARRAH_CATEGORIES } from '../data/barrahSalfaCategories';
import { DEFAULT_DUB_SCENES } from '../data/dubMicScenes';

export const LOCAL_STORE_KEY = 'jamr_local_store_v1';
export const LOCAL_REPORTS_KEY = 'jamr_local_reports_v1';
export const LOCAL_CHEATS_KEY = 'jamr_local_cheats_v1';
export const LOCAL_USER_KEY = 'jamr_local_profile_v1';

export function loadLocalReports(): BugReport[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BugReport[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalReports(reports: BugReport[]): void {
  try {
    window.localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function loadLocalCheatCodes(): CheatCodeConfig[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_CHEATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CheatCodeConfig[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalCheatCodes(list: CheatCodeConfig[]): void {
  try {
    window.localStorage.setItem(LOCAL_CHEATS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function loadLocalStoreSnapshot(): DataStoreSnapshot {
  let overrides: Partial<DataStoreSnapshot> = {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) overrides = JSON.parse(raw) as Partial<DataStoreSnapshot>;
  } catch {
    overrides = {};
  }

  const games: GameConfig[] = Array.isArray(overrides.games) && overrides.games.length > 0
    ? overrides.games
    : DEFAULT_GAMES;
  const dubScenes: DubMicScene[] = Array.isArray(overrides.dubScenes) && overrides.dubScenes.length > 0
    ? overrides.dubScenes
    : DEFAULT_DUB_SCENES;

  return {
    sections: Array.isArray(overrides.sections) && overrides.sections.length > 0 ? overrides.sections : DEFAULT_SECTIONS,
    topics: Array.isArray(overrides.topics) && overrides.topics.length > 0 ? overrides.topics : DEFAULT_100_TOPICS,
    questions: Array.isArray(overrides.questions) && overrides.questions.length > 0 ? overrides.questions : buildDefault6000Questions(),
    games,
    barrahCategories:
      Array.isArray(overrides.barrahCategories) && overrides.barrahCategories.length > 0
        ? overrides.barrahCategories
        : DEFAULT_BARRAH_CATEGORIES,
    reports: loadLocalReports(),
    mimicSounds: Array.isArray(overrides.mimicSounds) ? overrides.mimicSounds : [],
    cheatCodes: loadLocalCheatCodes(),
    dubScenes,
  };
}

export function saveLocalStoreSnapshot(store: DataStoreSnapshot): void {
  try {
    saveLocalReports(store.reports || []);
    saveLocalCheatCodes(store.cheatCodes || []);
    const compact: Partial<DataStoreSnapshot> = {
      games: store.games,
      dubScenes: store.dubScenes,
      sections: store.sections,
      barrahCategories: store.barrahCategories,
      mimicSounds: store.mimicSounds,
    };
    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(compact));
  } catch {
    // ignore quota issues
  }
}
