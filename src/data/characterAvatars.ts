export interface CharacterAvatarInfo {
  id: string;
  name: string;
  tagline: string;
  imageUrl: string;
  accentColor: string;
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
    name: ' ',
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
