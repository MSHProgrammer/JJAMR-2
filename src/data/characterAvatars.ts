export interface CharacterAvatarInfo {
  id: string;
  name: string;
  tagline: string;
  imageUrl: string;
  accentColor: string;
  isPlusOnly?: boolean;
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

const FREE_CHARACTER_AVATARS: CharacterAvatarInfo[] = [
  { id: 'char_01', name: '', tagline: 'الحماسي', imageUrl: '/avatars/char_01.png', accentColor: '#F97316' },
  { id: 'char_02', name: '', tagline: 'الكول', imageUrl: '/avatars/char_02.png', accentColor: '#6366F1' },
  { id: 'char_03', name: '', tagline: 'راعي السوالف', imageUrl: '/avatars/char_03.png', accentColor: '#F59E0B' },
  { id: 'char_04', name: '', tagline: 'الذكية المرحة', imageUrl: '/avatars/char_04.png', accentColor: '#EC4899' },
  { id: 'char_05', name: '', tagline: 'العبقري', imageUrl: '/avatars/char_05.png', accentColor: '#0EA5E9' },
  { id: 'char_06', name: '', tagline: 'راعي الكاب', imageUrl: '/avatars/char_06.png', accentColor: '#EF4444' },
  { id: 'char_07', name: '', tagline: 'أم الضحكة', imageUrl: '/avatars/char_07.png', accentColor: '#A855F7' },
  { id: 'char_08', name: '', tagline: 'فاكهة المجلس', imageUrl: '/avatars/char_08.png', accentColor: '#10B981' },
  { id: 'char_09', name: '', tagline: 'الغامض', imageUrl: '/avatars/char_09.png', accentColor: '#8B5CF6' },
  { id: 'char_10', name: '', tagline: 'القط الكول', imageUrl: '/avatars/char_10.png', accentColor: '#14B8A6' },
  { id: 'char_11', name: '', tagline: 'المحجبة الأنيقة', imageUrl: '/avatars/char_11.png', accentColor: '#14B8A6' },
  { id: 'char_12', name: '', tagline: 'الجيمر المرحة', imageUrl: '/avatars/char_12.png', accentColor: '#8B5CF6' },
  { id: 'char_13', name: '', tagline: 'الذكية القارئة', imageUrl: '/avatars/char_13.png', accentColor: '#3B82F6' },
  { id: 'char_14', name: '', tagline: 'الرياضية النشيطة', imageUrl: '/avatars/char_14.png', accentColor: '#F43F5E' },
  { id: 'char_15', name: '', tagline: 'النجمة المتألقة', imageUrl: '/avatars/char_15.png', accentColor: '#F59E0B' },
];

const PLUS_TAGLINES_50: Array<{ tagline: string; accent: string }> = [
  { tagline: 'راعي الشماغ الأصيل', accent: '#DC2626' },
  { tagline: 'المحقق الكلاسيكي', accent: '#B45309' },
  { tagline: 'ستريمر الحماس', accent: '#2563EB' },
  { tagline: 'القبطان البحري', accent: '#78350F' },
  { tagline: 'الشيف العبقري', accent: '#EA580C' },
  { tagline: 'الملك الذهبي', accent: '#D97706' },
  { tagline: 'صاحب الكاب المقلوب', accent: '#4F46E5' },
  { tagline: 'رائد الفضاء', accent: '#0284C7' },
  { tagline: 'الكوميديان الساخر', accent: '#E11D48' },
  { tagline: 'هيبة المجلس', accent: '#991B1B' },
  { tagline: 'المبرمج العبقري', accent: '#16A34A' },
  { tagline: 'الراسي المفكر', accent: '#0D9488' },
  { tagline: 'راعي القبعة الشتوية', accent: '#475569' },
  { tagline: 'مفتش العدسة', accent: '#92400E' },
  { tagline: 'أبو ابتسامة واثقة', accent: '#EA580C' },
  { tagline: 'جيمر الدوبلاج', accent: '#7C3AED' },
  { tagline: 'المحارب الضاحك', accent: '#B91C1C' },
  { tagline: 'المعلّق الصوتي', accent: '#334155' },
  { tagline: 'الإمبراطور', accent: '#F59E0B' },
  { tagline: 'شيف الحلويات', accent: '#0EA5E9' },
  { tagline: 'بطل السباق', accent: '#F97316' },
  { tagline: 'قرصان الكنوز', accent: '#0F766E' },
  { tagline: 'شيخ الجلسة', accent: '#DC2626' },
  { tagline: 'قائد المركبة', accent: '#0369A1' },
  { tagline: 'سيد الألغاز', accent: '#1E293B' },
  { tagline: 'جيمر الحجاب الزمردي', accent: '#059669' },
  { tagline: 'الكيرلي المثقفة', accent: '#EC4899' },
  { tagline: 'الأميرة الوردية', accent: '#F472B6' },
  { tagline: 'صاحبة الكاب الأسود', accent: '#1E293B' },
  { tagline: 'المحققّة الأنيقة', accent: '#B45309' },
  { tagline: 'عاشقة القهوة', accent: '#0D9488' },
  { tagline: 'مذيعة البث', accent: '#10B981' },
  { tagline: 'أستاذة التكتيك', accent: '#D97706' },
  { tagline: 'الفنانة التشكيلية', accent: '#8B5CF6' },
  { tagline: 'الذكية الرياضية', accent: '#EF4444' },
  { tagline: 'جيمر الوردي', accent: '#F472B6' },
  { tagline: 'تاج الجلسة', accent: '#A855F7' },
  { tagline: 'قارئة الشفرات', accent: '#047857' },
  { tagline: 'نجمة المايك', accent: '#059669' },
  { tagline: 'الهادئة الفخمة', accent: '#F59E0B' },
  { tagline: 'بطلة اليد الذهبية', accent: '#F97316' },
  { tagline: 'صاحبة النظارات الوردية', accent: '#EC4899' },
  { tagline: 'ملهمة السوالف', accent: '#FB7185' },
  { tagline: 'حارسة الأدلة', accent: '#7C2D12' },
  { tagline: 'أسطورة البث', accent: '#0D9488' },
  { tagline: 'الابتسامة الذهبية', accent: '#EAB308' },
  { tagline: 'أميرة الفيونكة', accent: '#F43F5E' },
  { tagline: 'رسامة باريس', accent: '#475569' },
  { tagline: 'قائدة الفريق', accent: '#059669' },
  { tagline: 'ملكة الكريستال', accent: '#6366F1' },
];

const PLUS_CHARACTER_AVATARS: CharacterAvatarInfo[] = PLUS_TAGLINES_50.map((item, idx) => {
  const num = String(16 + idx).padStart(2, '0');
  return {
    id: `char_${num}`,
    name: '',
    tagline: item.tagline,
    imageUrl: `/avatars/char_${num}.png`,
    accentColor: item.accent,
    isPlusOnly: true,
  };
});

export const CHARACTER_AVATARS: CharacterAvatarInfo[] = [
  ...FREE_CHARACTER_AVATARS,
  ...PLUS_CHARACTER_AVATARS,
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

export function isCustomAvatarDataUrl(raw?: string | null): boolean {
  const clean = (raw || '').trim();
  return clean.startsWith('data:image/') && clean.length > 30 && clean.length < 350_000;
}

export function isPlusOnlyAvatarId(raw?: string | null): boolean {
  const clean = (raw || '').trim();
  if (isCustomAvatarDataUrl(clean)) return true;
  return PLUS_CHARACTER_AVATARS.some((c) => c.id === clean);
}

export function sanitizeAvatarId(raw?: string | null): string {
  const clean = (raw || '').trim();
  if (isCustomAvatarDataUrl(clean)) {
    return clean;
  }
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
  if (isCustomAvatarDataUrl(id)) {
    return {
      id,
      name: 'صورة مخصصة',
      tagline: 'من الاستوديو 📸',
      imageUrl: id,
      accentColor: '#F97316',
      isPlusOnly: true,
    };
  }
  return CHARACTER_AVATARS.find((c) => c.id === id) || CHARACTER_AVATARS[0];
}

export function getRandomAvatarId(includePlus = false): string {
  const pool = includePlus ? CHARACTER_AVATARS : FREE_CHARACTER_AVATARS;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
