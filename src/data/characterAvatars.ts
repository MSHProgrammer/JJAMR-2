export interface CharacterAvatarInfo {
  id: string;
  name: string;
  tagline: string;
  imageUrl: string;
  accentColor: string;
}

export interface AvatarBgPreset {
  id: string;
  label: string;
  background: string;
  swatchColor: string;
}

export const AVATAR_BG_PRESETS: AvatarBgPreset[] = [
  {
    id: 'lavender',
    label: 'بنفسجي ناعم',
    background: 'linear-gradient(135deg, #EDE9FE 0%, #C4B5FD 100%)',
    swatchColor: '#C4B5FD',
  },
  {
    id: 'sunset',
    label: 'جمر دافئ',
    background: 'linear-gradient(135deg, #FFEDD5 0%, #FB923C 100%)',
    swatchColor: '#FB923C',
  },
  {
    id: 'mint',
    label: 'تركواز منعش',
    background: 'linear-gradient(135deg, #CCFBF1 0%, #2DD4BF 100%)',
    swatchColor: '#2DD4BF',
  },
  {
    id: 'rose',
    label: 'وردي مشرق',
    background: 'linear-gradient(135deg, #FCE7F3 0%, #F472B6 100%)',
    swatchColor: '#F472B6',
  },
  {
    id: 'sky',
    label: 'سماوي صافي',
    background: 'linear-gradient(135deg, #E0F2FE 0%, #38BDF8 100%)',
    swatchColor: '#38BDF8',
  },
  {
    id: 'gold',
    label: 'ذهبي فخم',
    background: 'linear-gradient(135deg, #FEF3C7 0%, #FBBF24 100%)',
    swatchColor: '#FBBF24',
  },
  {
    id: 'emerald',
    label: 'أخضر زمردي',
    background: 'linear-gradient(135deg, #D1FAE5 0%, #34D399 100%)',
    swatchColor: '#34D399',
  },
  {
    id: 'noir',
    label: 'ليلي فاخر',
    background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
    swatchColor: '#1E293B',
  },
];

export const DEFAULT_AVATAR_BG = 'lavender';

export function sanitizeAvatarBg(raw?: string | null): string {
  const clean = (raw || '').trim();
  if (AVATAR_BG_PRESETS.some((p) => p.id === clean)) return clean;
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean;
  return DEFAULT_AVATAR_BG;
}

export function resolveAvatarBgCss(raw?: string | null): string {
  const clean = sanitizeAvatarBg(raw);
  const preset = AVATAR_BG_PRESETS.find((p) => p.id === clean);
  if (preset) return preset.background;
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean;
  return AVATAR_BG_PRESETS[0].background;
}

export const CHARACTER_AVATARS: CharacterAvatarInfo[] = [
  {
    id: 'char_01',
    name: '',
    tagline: 'الحماسي',
    imageUrl: '/avatars/char_01.png',
    accentColor: '#F97316',
  },
  {
    id: 'char_02',
    name: '',
    tagline: 'الكول',
    imageUrl: '/avatars/char_02.png',
    accentColor: '#6366F1',
  },
  {
    id: 'char_03',
    name: '',
    tagline: 'راعي السوالف',
    imageUrl: '/avatars/char_03.png',
    accentColor: '#F59E0B',
  },
  {
    id: 'char_04',
    name: '',
    tagline: 'الذكية المرحة',
    imageUrl: '/avatars/char_04.png',
    accentColor: '#EC4899',
  },
  {
    id: 'char_05',
    name: '',
    tagline: 'العبقري',
    imageUrl: '/avatars/char_05.png',
    accentColor: '#0EA5E9',
  },
  {
    id: 'char_06',
    name: '',
    tagline: 'راعي الكاب',
    imageUrl: '/avatars/char_06.png',
    accentColor: '#EF4444',
  },
  {
    id: 'char_07',
    name: '',
    tagline: 'أم الضحكة',
    imageUrl: '/avatars/char_07.png',
    accentColor: '#A855F7',
  },
  {
    id: 'char_08',
    name: '',
    tagline: 'فاكهة المجلس',
    imageUrl: '/avatars/char_08.png',
    accentColor: '#10B981',
  },
  {
    id: 'char_09',
    name: '',
    tagline: 'الغامض',
    imageUrl: '/avatars/char_09.png',
    accentColor: '#8B5CF6',
  },
  {
    id: 'char_10',
    name: '',
    tagline: 'القط الكول',
    imageUrl: '/avatars/char_10.png',
    accentColor: '#14B8A6',
  },
  {
    id: 'char_11',
    name: '',
    tagline: 'المحجبة الأنيقة',
    imageUrl: '/avatars/char_11.png',
    accentColor: '#14B8A6',
  },
  {
    id: 'char_12',
    name: '',
    tagline: 'الجيمر المرحة',
    imageUrl: '/avatars/char_12.png',
    accentColor: '#8B5CF6',
  },
  {
    id: 'char_13',
    name: '',
    tagline: 'الذكية القارئة',
    imageUrl: '/avatars/char_13.png',
    accentColor: '#3B82F6',
  },
  {
    id: 'char_14',
    name: '',
    tagline: 'الرياضية النشيطة',
    imageUrl: '/avatars/char_14.png',
    accentColor: '#F43F5E',
  },
  {
    id: 'char_15',
    name: '',
    tagline: 'النجمة المتألقة',
    imageUrl: '/avatars/char_15.png',
    accentColor: '#F59E0B',
  },
];

export const DEFAULT_AVATAR_ID = 'char_01';

const LEGACY_EMOJI_TO_CHAR: Record<string, string> = {
  '🔥': 'char_01',
  '🦁': 'char_02',
  '🦅': 'char_03',
  '⚡': 'char_04',
  '🦊': 'char_05',
  '🐼': 'char_06',
  '🎭': 'char_07',
  '🚀': 'char_08',
  '🌟': 'char_09',
  '🎮': 'char_10',
};

export function sanitizeAvatarId(raw?: string | null): string {
  const clean = (raw || '').trim();
  if (CHARACTER_AVATARS.some((c) => c.id === clean)) {
    return clean;
  }
  if (clean && LEGACY_EMOJI_TO_CHAR[clean]) {
    return LEGACY_EMOJI_TO_CHAR[clean];
  }
  return DEFAULT_AVATAR_ID;
}

export function resolveCharacterAvatar(raw?: string | null): CharacterAvatarInfo {
  const id = sanitizeAvatarId(raw);
  return CHARACTER_AVATARS.find((c) => c.id === id) || CHARACTER_AVATARS[0];
}

export function getRandomAvatarId(): string {
  return CHARACTER_AVATARS[Math.floor(Math.random() * CHARACTER_AVATARS.length)].id;
}
