import { JamrPlusStatus, PlusGlowConfig } from '../types/jamr';

export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const JAMR_PLUS_PRICE_SAR = 2;

const PLUS_STORAGE_KEY = 'jamr_plus_status_v1';
const ACCOUNT_TOKEN_KEY = 'jamr_account_token_v1';
const ACCOUNT_EMAIL_KEY = 'jamr_account_email_v1';

export interface AccountSessionState {
  token: string;
  email: string;
  displayName?: string;
}

export const DEFAULT_GLOW_CONFIG: PlusGlowConfig = {
  enabled: true,
  color: '#FBBF24',
  style: 'royal_gold',
  intensity: 'bright',
};

export interface GlowStyleOption {
  id: PlusGlowConfig['style'];
  label: string;
  color: string;
  previewClass: string;
}

export const GLOW_STYLE_OPTIONS: GlowStyleOption[] = [
  { id: 'royal_gold', label: 'الذهب الملكي 👑', color: '#FBBF24', previewClass: 'from-amber-400 to-yellow-500' },
  { id: 'ember_fire', label: 'جمر متقد 🔥', color: '#F97316', previewClass: 'from-orange-500 to-red-500' },
  { id: 'emerald_neon', label: 'زمرد نيون 💎', color: '#10B981', previewClass: 'from-emerald-400 to-teal-500' },
  { id: 'cosmic_purple', label: 'بنفسجي كوني ⚡', color: '#A855F7', previewClass: 'from-purple-500 to-fuchsia-500' },
  { id: 'arctic_blue', label: 'سماوي ثلجي ❄️', color: '#38BDF8', previewClass: 'from-sky-400 to-cyan-500' },
  { id: 'crimson_ruby', label: 'ياقوت قرمزي 🌹', color: '#F43F5E', previewClass: 'from-rose-500 to-pink-500' },
];

export const PLUS_TITLES = [
  'عضو جَمْر بلس الملكي 👑',
  'نجم المجلس 🌟',
  'المحقق الذهبي 🕵️‍♂️',
  'أسطورة الدوبلاج 🎙️',
  'ملك التحديات 🔥',
  'أيقونة الجلسة 💎',
  'سيد الألغاز 🧩',
];

export const PLUS_AVATAR_FRAMES: Array<{ id: NonNullable<JamrPlusStatus['avatarFrame']>; label: string; ringCss: string }> = [
  { id: 'gold_crown', label: 'الإطار الذهبي الملكي', ringCss: 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.75)]' },
  { id: 'flame_ring', label: 'حلقة اللهب المتوهجة', ringCss: 'ring-2 ring-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.8)]' },
  { id: 'diamond_halo', label: 'هالة الألماس السماوية', ringCss: 'ring-2 ring-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.75)]' },
  { id: 'obsidian_royal', label: 'إطار السبج الفاخر', ringCss: 'ring-2 ring-yellow-500 shadow-[0_0_14px_rgba(234,179,8,0.65)]' },
  { id: 'none', label: 'بدون إطار إضافي', ringCss: '' },
];

export interface PlusPaymentMethodOption {
  id: string;
  label: string;
  badge: string;
  sublabel: string;
  requiresCard?: boolean;
  requiresPhone?: boolean;
}

export const PLUS_PAYMENT_METHODS: PlusPaymentMethodOption[] = [
  { id: 'mada', label: 'بطاقة مدى mada', badge: 'mada', sublabel: 'خصم فوري آمن', requiresCard: true },
  { id: 'apple_pay', label: 'Apple Pay', badge: ' Pay', sublabel: 'دفع سريع بلمسة واحدة' },
  { id: 'visa', label: 'بطاقة Visa', badge: 'VISA', sublabel: 'ائتمانية أو مسبقة الدفع', requiresCard: true },
  { id: 'mastercard', label: 'Mastercard', badge: 'MC', sublabel: 'ماستركارد العالمية', requiresCard: true },
  { id: 'stc_pay', label: 'STC Pay', badge: 'STC', sublabel: 'المحفظة الرقمية السعودية', requiresPhone: true },
  { id: 'google_pay', label: 'Google Pay', badge: 'G Pay', sublabel: 'دفع فوري عبر جوجل' },
  { id: 'samsung_pay', label: 'Samsung Pay', badge: 'S Pay', sublabel: 'دفع عبر محفظة سامسونج' },
  { id: 'paypal', label: 'PayPal', badge: 'PayPal', sublabel: 'حساب باي بال العالمي' },
  { id: 'tabby', label: 'Tabby تابي', badge: 'tabby', sublabel: 'دفع ميسّر وموثوق' },
  { id: 'tamara', label: 'Tamara تمارا', badge: 'tamara', sublabel: 'دفع سريع وآمن' },
];

export const EXTRA_10_PLUS_PERKS = [
  { id: 1, icon: '✨', title: 'التوهج المخصص للاسم والصورة', desc: 'اختر لون التوهج ونمطه ليظهر مضيئاً حول اسمك وأفاتارك في كل الغرف.' },
  { id: 2, icon: '🖼️', title: 'إطارات بلس الملكية حول الصورة', desc: '5 إطارات فخمة (تاج ذهبي، لهب، ألماس، سبج ملكي).' },
  { id: 3, icon: '🏅', title: 'ألقاب بلس الحصرية', desc: 'لقب مميز يظهر مع بطاقتك في اللوبي ولوحة النتائج.' },
  { id: 4, icon: '🎆', title: 'مؤثرات احتفالية متقدمة', desc: 'ألعاب نارية أو نجوم ذهبية أو كونفيتي خاص عند كل فوز.' },
  { id: 5, icon: '🔊', title: 'حزمة أصوات ملكية مطوّرة', desc: 'نغمات احتفالية إضافية عند الانضمام والإجابة الصحيحة.' },
  { id: 6, icon: '💬', title: 'تمييز رسائلك في شات الغرف', desc: 'إبراز رسائلك داخل شات الغرفة بلمسة توهج بلس الذهبية.' },
  { id: 7, icon: '✨', title: 'شرارات وهج بالواجهة الرئيسية', desc: 'تأثيرات بصرية راقية تزيّن بطاقة ملفك في الرئيسية.' },
  { id: 8, icon: '📺', title: 'البث المباشر على شاشة التلفاز', desc: 'امسح باركود الشاشة الفخم واضغط بث لعرض ألعابكم ونتائجكم لحظياً.' },
  { id: 9, icon: '📸', title: 'رفع صورة شخصية من الاستوديو', desc: 'قص دائري احترافي لصورتك الخاصة مع خلفيات متدرجة.' },
  { id: 10, icon: '🛡️', title: 'حفظ الحساب والاشتراك لسنة كاملة', desc: 'ربط دائم بالإيميل وكلمة السر لضمان عدم ضياع أموالك أو مزاياك.' },
];

export function createDefaultPlusStatus(overrides?: Partial<JamrPlusStatus>): JamrPlusStatus {
  const now = Date.now();
  return {
    isActive: false,
    startedAt: undefined,
    expiresAt: undefined,
    planLabel: 'جَمْر بلس — سنة كاملة',
    priceSar: JAMR_PLUS_PRICE_SAR,
    glow: { ...DEFAULT_GLOW_CONFIG },
    profileTitle: PLUS_TITLES[0],
    avatarFrame: 'gold_crown',
    reactionStyle: 'confetti',
    soundPack: 'royal_brass',
    heroParticles: true,
    vipChatBadge: true,
    fastHostBoost: true,
    ...overrides,
  };
}

export function isPlusActive(plus?: JamrPlusStatus | null): boolean {
  if (!plus || !plus.isActive) return false;
  if (plus.expiresAt && Date.now() > plus.expiresAt) return false;
  return true;
}

export function isPlusExpired(plus?: JamrPlusStatus | null): boolean {
  if (!plus || !plus.expiresAt) return false;
  return Date.now() > plus.expiresAt;
}

export function loadPlusStatus(): JamrPlusStatus {
  try {
    const raw = window.localStorage.getItem(PLUS_STORAGE_KEY);
    if (!raw) return createDefaultPlusStatus();
    const parsed = JSON.parse(raw) as JamrPlusStatus;
    const active = isPlusActive(parsed);
    return createDefaultPlusStatus({
      ...parsed,
      isActive: active,
      glow: parsed.glow ? { ...DEFAULT_GLOW_CONFIG, ...parsed.glow } : { ...DEFAULT_GLOW_CONFIG },
    });
  } catch {
    return createDefaultPlusStatus();
  }
}

export function savePlusStatus(status: JamrPlusStatus): JamrPlusStatus {
  const normalized: JamrPlusStatus = {
    ...status,
    isActive: isPlusActive(status),
    glow: status.glow || { ...DEFAULT_GLOW_CONFIG },
  };
  try {
    window.localStorage.setItem(PLUS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
  return normalized;
}

export function loadAccountSession(): AccountSessionState | null {
  try {
    const token = window.localStorage.getItem(ACCOUNT_TOKEN_KEY) || '';
    const email = window.localStorage.getItem(ACCOUNT_EMAIL_KEY) || '';
    if (!token || !email) return null;
    return { token, email };
  } catch {
    return null;
  }
}

export function saveAccountSession(session: AccountSessionState | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(ACCOUNT_TOKEN_KEY);
      window.localStorage.removeItem(ACCOUNT_EMAIL_KEY);
    } else {
      window.localStorage.setItem(ACCOUNT_TOKEN_KEY, session.token);
      window.localStorage.setItem(ACCOUNT_EMAIL_KEY, session.email);
    }
  } catch {
    // ignore
  }
}

export function formatPlusExpiryDate(expiresAt?: number): string {
  if (!expiresAt) return '';
  try {
    return new Date(expiresAt).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function getGlowStyleForPlayer(isPlus?: boolean, glow?: PlusGlowConfig): React.CSSProperties | undefined {
  if (!isPlus || !glow?.enabled) return undefined;
  const c = glow.color || '#FBBF24';
  const spread = glow.intensity === 'legendary' ? '18px' : glow.intensity === 'bright' ? '12px' : '7px';
  return {
    boxShadow: `0 0 ${spread} ${c}80, 0 0 4px ${c}`,
    textShadow: `0 0 10px ${c}88`,
    ['--plus-glow-color' as string]: c,
  };
}
