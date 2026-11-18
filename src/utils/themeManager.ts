export interface JamrThemeConfig {
  bg: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  packId?: string;
}

export const DEFAULT_THEME: JamrThemeConfig = {
  bg: '#FFFBF5',
  surface: '#FFFFFF',
  primary: '#F97316',
  accent: '#F59E0B',
  text: '#23140E',
  packId: 'jamr_classic',
};

export interface ThemePreset {
  id: string;
  name: string;
  subtitle: string;
  theme: JamrThemeConfig;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'jamr_classic',
    name: 'جَمْر الأصلي 🔥',
    subtitle: 'الهوية الكلاسيكية الدافئة',
    theme: { ...DEFAULT_THEME },
  },
  {
    id: 'obsidian_gold',
    name: 'سبج وذهب ملكي 👑',
    subtitle: 'داكن فاخر بحواف ذهبية',
    theme: {
      bg: '#0B0B10',
      surface: '#16161F',
      primary: '#D97706',
      accent: '#FBBF24',
      text: '#F8F4EC',
      packId: 'obsidian_gold',
    },
  },
  {
    id: 'neon_cyber',
    name: 'سايبر نيون ⚡',
    subtitle: 'إضاءة نيون أرجوانية وسماوية',
    theme: {
      bg: '#090D1A',
      surface: '#131A2E',
      primary: '#EC4899',
      accent: '#22D3EE',
      text: '#F0F9FF',
      packId: 'neon_cyber',
    },
  },
  {
    id: 'emerald_palace',
    name: 'قصر الزمرد 💎',
    subtitle: 'أخضر ملكي عميق ولمعان فيروزي',
    theme: {
      bg: '#071B16',
      surface: '#0F2B23',
      primary: '#10B981',
      accent: '#34D399',
      text: '#ECFDF5',
      packId: 'emerald_palace',
    },
  },
  {
    id: 'desert_saffron',
    name: 'زعفران الصحراء 🏜️',
    subtitle: 'رملي دافئ بنحاسي فخم',
    theme: {
      bg: '#F7EDE2',
      surface: '#FFFDF9',
      primary: '#B45309',
      accent: '#E07A5F',
      text: '#2B1B12',
      packId: 'desert_saffron',
    },
  },
  {
    id: 'midnight_ocean',
    name: 'أعماق المحيط 🌊',
    subtitle: 'أزرق ليلي وتوهج سماوي',
    theme: {
      bg: '#081426',
      surface: '#10223D',
      primary: '#0EA5E9',
      accent: '#38BDF8',
      text: '#EFF6FF',
      packId: 'midnight_ocean',
    },
  },
  {
    id: 'crimson_velvet',
    name: 'مخمل قرمزي 🌹',
    subtitle: 'أحمر داكن بطابع سينمائي',
    theme: {
      bg: '#1A0B10',
      surface: '#2A1219',
      primary: '#E11D48',
      accent: '#FB7185',
      text: '#FFF1F2',
      packId: 'crimson_velvet',
    },
  },
  {
    id: 'pastel_cotton',
    name: 'غزل البنات 🎀',
    subtitle: 'وردي ولافندر ناعم ومشرق',
    theme: {
      bg: '#FDF2F8',
      surface: '#FFFFFF',
      primary: '#DB2777',
      accent: '#A855F7',
      text: '#3B0764',
      packId: 'pastel_cotton',
    },
  },
  {
    id: 'forest_moss',
    name: 'أوراق الخريف 🍂',
    subtitle: 'زيتوني هادئ وعنبري',
    theme: {
      bg: '#F3F6EC',
      surface: '#FCFDF8',
      primary: '#4D7C0F',
      accent: '#CA8A04',
      text: '#1A2E05',
      packId: 'forest_moss',
    },
  },
  {
    id: 'lavender_dream',
    name: 'حلم الخزامى 🪻',
    subtitle: 'بنفسجي حالم مع نيلي ناعم',
    theme: {
      bg: '#F5F3FF',
      surface: '#FFFFFF',
      primary: '#7C3AED',
      accent: '#6366F1',
      text: '#2E1065',
      packId: 'lavender_dream',
    },
  },
  {
    id: 'aurora_nordic',
    name: 'الشفق القطبي 🌌',
    subtitle: 'أزرق سماوي وزمردي متوهج',
    theme: {
      bg: '#0B132B',
      surface: '#1C2541',
      primary: '#06B6D4',
      accent: '#10B981',
      text: '#E0F2FE',
      packId: 'aurora_nordic',
    },
  },
];

const STORAGE_KEY = 'jamr_custom_theme_v1';

export function isDefaultTheme(theme: JamrThemeConfig): boolean {
  return (
    theme.bg.toLowerCase() === DEFAULT_THEME.bg.toLowerCase() &&
    theme.surface.toLowerCase() === DEFAULT_THEME.surface.toLowerCase() &&
    theme.primary.toLowerCase() === DEFAULT_THEME.primary.toLowerCase() &&
    theme.accent.toLowerCase() === DEFAULT_THEME.accent.toLowerCase() &&
    theme.text.toLowerCase() === DEFAULT_THEME.text.toLowerCase()
  );
}

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
      packId: parsed.packId,
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

  if (isDefaultTheme(theme)) {
    root.removeAttribute('data-jamr-themed');
  } else {
    root.setAttribute('data-jamr-themed', 'true');
  }
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
