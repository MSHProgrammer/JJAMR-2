export interface JamrThemeConfig {
  bg: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
}

export const DEFAULT_THEME: JamrThemeConfig = {
  bg: '#FFFBF5',
  surface: '#FFFFFF',
  primary: '#F97316',
  accent: '#F59E0B',
  text: '#23140E',
};

export interface ThemePreset {
  id: string;
  name: string;
  theme: JamrThemeConfig;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'jamr_classic',
    name: 'جَمْر الأصلي 🔥',
    theme: { ...DEFAULT_THEME },
  },
  {
    id: 'royal_night',
    name: 'ليالي المجلس 🌙',
    theme: {
      bg: '#141118',
      surface: '#211C28',
      primary: '#F97316',
      accent: '#C89B3C',
      text: '#F7F2EA',
    },
  },
  {
    id: 'emerald_oasis',
    name: 'واحة النخيل 🌴',
    theme: {
      bg: '#F3FBF7',
      surface: '#FFFFFF',
      primary: '#0D9488',
      accent: '#10B981',
      text: '#0F2A24',
    },
  },
  {
    id: 'berry_pop',
    name: 'توت احتفالي 🍓',
    theme: {
      bg: '#FFF6FA',
      surface: '#FFFFFF',
      primary: '#E11D48',
      accent: '#8B5CF6',
      text: '#2E1022',
    },
  },
  {
    id: 'ocean_sky',
    name: 'سماء الساحل 🌊',
    theme: {
      bg: '#F2F8FF',
      surface: '#FFFFFF',
      primary: '#2563EB',
      accent: '#06B6D4',
      text: '#0F1E3A',
    },
  },
  {
    id: 'coffee_oud',
    name: 'قهوة وعود ☕',
    theme: {
      bg: '#F8F3EC',
      surface: '#FFFDF9',
      primary: '#9A4D1E',
      accent: '#D97706',
      text: '#26170E',
    },
  },
];

const STORAGE_KEY = 'jamr_custom_theme_v1';

export function loadThemeConfig(): JamrThemeConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    const parsed = JSON.parse(raw) as Partial<JamrThemeConfig>;
    return {
      bg: parsed.bg || DEFAULT_THEME.bg,
      surface: parsed.surface || DEFAULT_THEME.surface,
      primary: parsed.primary || DEFAULT_THEME.primary,
      accent: parsed.accent || DEFAULT_THEME.accent,
      text: parsed.text || DEFAULT_THEME.text,
    };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function applyThemeConfig(theme: JamrThemeConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--jamr-bg', theme.bg);
  root.style.setProperty('--jamr-surface', theme.surface);
  root.style.setProperty('--jamr-primary', theme.primary);
  root.style.setProperty('--jamr-accent', theme.accent);
  root.style.setProperty('--jamr-text', theme.text);
}

export function saveThemeConfig(theme: JamrThemeConfig): void {
  applyThemeConfig(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // ignore storage limits
  }
}

export function resetThemeConfig(): JamrThemeConfig {
  const fresh = { ...DEFAULT_THEME };
  applyThemeConfig(fresh);
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return fresh;
}
