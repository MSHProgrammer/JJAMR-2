import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Lock,
  Mail,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tv,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { JamrPlusStatus, PlusGlowConfig } from '../types/jamr';
import {
  AccountSessionState,
  EXTRA_10_PLUS_PERKS,
  formatPlusExpiryDate,
  GLOW_STYLE_OPTIONS,
  isPlusActive,
  JAMR_PLUS_PRICE_SAR,
  ONE_YEAR_MS,
  PLUS_AVATAR_FRAMES,
  PLUS_PAYMENT_METHODS,
  PLUS_TITLES,
  saveAccountSession,
  savePlusStatus,
} from '../utils/plusManager';
import {
  applyThemeConfig,
  JamrThemeConfig,
  loadThemeConfig,
  resetThemeConfig,
  saveThemeConfig,
  THEME_PRESETS,
} from '../utils/themeManager';
import { CHARACTER_AVATARS } from '../data/characterAvatars';
import {
  PLUS_ANIMATION_CATEGORIES,
  PLUS_CHARACTER_ANIMATIONS,
  PlusCharacterAnimation,
  resolvePlusAnimation,
} from '../data/plusAnimations';
import { CharacterAvatar } from './CharacterAvatar';
import { JamrFlameLogo } from './FestiveDecor';
import { PlayerNameWithPlus } from './PlusBadge';
import { apiFetchJson } from '../utils/apiClient';
import { SoundFX } from '../utils/soundFx';

interface JamrPlusModalProps {
  plusStatus: JamrPlusStatus;
  accountSession: AccountSessionState | null;
  playerName: string;
  playerAvatar: string;
  playerAvatarBg: string;
  username?: string;
  promoBannerReason?: string;
  onUpdatePlus: (next: JamrPlusStatus) => void;
  onAuthSuccess: (session: AccountSessionState, accountPlus?: JamrPlusStatus) => void;
  onUpdatePlayerAvatar: (avatarId: string) => void;
  onOpenAvatarCropper: () => void;
  onOpenTvCast: () => void;
  onClose: () => void;
}

export const JamrPlusModal: React.FC<JamrPlusModalProps> = ({
  plusStatus,
  accountSession,
  playerName,
  playerAvatar,
  playerAvatarBg,
  username,
  promoBannerReason,
  onUpdatePlus,
  onAuthSuccess,
  onUpdatePlayerAvatar,
  onOpenAvatarCropper,
  onOpenTvCast,
  onClose,
}) => {
  const active = isPlusActive(plusStatus);
  const [sectionTab, setSectionTab] = useState<'overview' | 'themes' | 'avatars' | 'animations' | 'glow_perks'>(
    active ? 'themes' : 'overview'
  );
  const [animCategory, setAnimCategory] = useState<'all' | PlusCharacterAnimation['category']>('all');
  const [previewCharId, setPreviewCharId] = useState<string>(playerAvatar);

  // Step 1: Email + Password Auth before Payment (No emails sent)
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState(accountSession?.email || '');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Step 2: Payment Method & Checkout (2 SAR / 1 Year)
  const [paymentMethod, setPaymentMethod] = useState<string>('mada');
  const [cardLast4, setCardLast4] = useState('');
  const [cardHolder, setCardHolder] = useState(playerName || '');
  const [phoneNum, setPhoneNum] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');

  // Full Site Theme State
  const [theme, setTheme] = useState<JamrThemeConfig>(() => loadThemeConfig());

  const plusCharacters = CHARACTER_AVATARS.filter((c) => c.isPlusOnly);
  const selectedPaymentMeta = PLUS_PAYMENT_METHODS.find((m) => m.id === paymentMethod);

  const handleStep1Auth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError('أدخل بريداً إلكترونياً صحيحاً لحفظ اشتراكك.');
      return;
    }
    if (password.length < 4) {
      setAuthError('كلمة السر يجب أن تكون 4 أحرف على الأقل.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');

    const res = await apiFetchJson<{
      ok?: boolean;
      error?: string;
      token?: string;
      account?: { email: string; displayName?: string; plus?: JamrPlusStatus };
    }>(
      authMode === 'register' ? '/api/auth/register' : '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          password,
          displayName: playerName || 'لاعب جَمْر',
          username,
          avatar: playerAvatar,
          avatarBg: playerAvatarBg,
        }),
      },
      { unlockStorageOnGesture: true }
    );

    setAuthLoading(false);

    if (!res.isHtmlOrStatic && !res.networkError && res.data) {
      if (!res.ok || !res.data.ok || !res.data.token || !res.data.account) {
        SoundFX.playWrong();
        setAuthError(String(res.data.error || 'تعذر تسجيل الدخول، تحقق من البيانات.'));
        return;
      }
      const nextSess: AccountSessionState = {
        token: res.data.token,
        email: res.data.account.email,
        displayName: res.data.account.displayName,
      };
      saveAccountSession(nextSess);
      SoundFX.playCorrect();
      onAuthSuccess(nextSess, res.data.account.plus);
      return;
    }

    const fallbackSess: AccountSessionState = {
      token: `local_${Date.now().toString(36)}`,
      email: cleanEmail,
      displayName: playerName || 'لاعب جَمْر',
    };
    saveAccountSession(fallbackSess);
    SoundFX.playCorrect();
    onAuthSuccess(fallbackSess);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountSession) {
      setPayError('سجّل دخولك أولاً بالإيميل وكلمة السر أعلاه لحماية اشتراكك لمدة سنة.');
      return;
    }
    if (selectedPaymentMeta?.requiresCard && cardLast4.replace(/\D/g, '').length < 4) {
      setPayError('أدخل آخر ٤ أرقام أو رقم البطاقة للمتابعة.');
      return;
    }
    if (selectedPaymentMeta?.requiresPhone && phoneNum.replace(/\D/g, '').length < 8) {
      setPayError('أدخل رقم الجوال المرتبط بـ STC Pay.');
      return;
    }

    setPayLoading(true);
    setPayError('');
    setPaySuccess('');

    const res = await apiFetchJson<{
      ok?: boolean;
      error?: string;
      plus?: JamrPlusStatus;
      message?: string;
    }>(
      '/api/plus/checkout',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accountSession.token}` },
        body: JSON.stringify({
          accountToken: accountSession.token,
          email: accountSession.email,
          paymentMethod,
          cardLast4: cardLast4.slice(-4),
          username,
          glow: plusStatus.glow,
        }),
      },
      { unlockStorageOnGesture: true }
    );

    setPayLoading(false);

    if (!res.isHtmlOrStatic && !res.networkError && res.data) {
      if (!res.ok || !res.data.ok || !res.data.plus) {
        SoundFX.playWrong();
        setPayError(String(res.data.error || 'تعذر إتمام عملية الدفع الآن.'));
        return;
      }
      const saved = savePlusStatus(res.data.plus);
      onUpdatePlus(saved);
      SoundFX.playWin();
      confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
      setPaySuccess(res.data.message || 'تم تفعيل جَمْر بلس لمدة سنة كاملة بنجاح! 👑');
      setSectionTab('themes');
      return;
    }

    // Local persistence fallback
    const now = Date.now();
    const localPlus: JamrPlusStatus = savePlusStatus({
      ...plusStatus,
      isActive: true,
      startedAt: now,
      expiresAt: now + ONE_YEAR_MS,
      paymentMethod,
      priceSar: JAMR_PLUS_PRICE_SAR,
      activatedVia: 'checkout',
      planLabel: 'جَمْر بلس — سنة كاملة',
    });
    onUpdatePlus(localPlus);
    SoundFX.playWin();
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
    setPaySuccess('تم تفعيل جَمْر بلس بنجاح لمدة سنة كاملة (٢ ريال)! 👑');
    setSectionTab('themes');
  };

  const updatePlusCustomization = async (patch: Partial<JamrPlusStatus>) => {
    const next = savePlusStatus({ ...plusStatus, ...patch });
    onUpdatePlus(next);
    if (accountSession?.token) {
      await apiFetchJson('/api/plus/customize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accountSession.token}` },
        body: JSON.stringify({
          accountToken: accountSession.token,
          glow: next.glow,
          profileTitle: next.profileTitle,
          avatarFrame: next.avatarFrame,
          avatarAnimation: next.avatarAnimation,
          reactionStyle: next.reactionStyle,
          soundPack: next.soundPack,
          heroParticles: next.heroParticles,
        }),
      });
    }
  };

  const updateGlow = (glowPatch: Partial<PlusGlowConfig>) => {
    void updatePlusCustomization({ glow: { ...plusStatus.glow, ...glowPatch } });
  };

  const applyThemePreset = (presetTheme: JamrThemeConfig) => {
    if (!active) return;
    SoundFX.playTileSelect();
    setTheme(presetTheme);
    saveThemeConfig(presetTheme);
  };

  const updateThemeColor = (key: keyof JamrThemeConfig, val: string) => {
    if (!active) return;
    const next = { ...theme, [key]: val };
    setTheme(next);
    saveThemeConfig(next);
    applyThemeConfig(next);
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl rounded-3xl bg-white border-2 border-amber-400 shadow-[0_0_55px_rgba(245,158,11,0.35)] overflow-hidden my-auto max-h-[93vh] flex flex-col">
        {/* Top Modal Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-amber-200 bg-gradient-to-l from-[#1E1409] via-[#120C06] to-[#1D1308] text-amber-50">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-amber-300">
                  {active ? 'عضوية جَمْر بلس المفعّلة 👑' : 'اشتراك جَمْر بلس — JAMR PLUS 🔥'}
                </h2>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-[#140D05]">
                  ريالان / سنة كاملة
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                تخصيص كامل للهوية والشخصيات والشاشة والتوهج — بدون إقفال أي ألعاب!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-amber-400/30 text-amber-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-2.5 bg-[#FFF8EE] border-b border-amber-200">
          {[
            { id: 'overview', label: active ? 'الاشتراك وحسابي 👑' : 'اشترك الآن (٢ ريال) 💳' },
            { id: 'themes', label: '10 حزم ألوان + الموقع 🎨' },
            { id: 'avatars', label: '50 شخصية + الاستوديو 🧑‍🎨' },
            { id: 'animations', label: '50 أنميشن للشخصيات 💃' },
            { id: 'glow_perks', label: 'التوهج + 11 ميزة + TV ✨' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                SoundFX.playClick();
                setSectionTab(t.id as typeof sectionTab);
              }}
              className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-black cursor-pointer transition ${
                sectionTab === t.id
                  ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-sm'
                  : 'bg-white text-[#5A3E32] border border-amber-200 hover:bg-amber-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {promoBannerReason && (
            <div className="rounded-2xl bg-gradient-to-l from-amber-50 to-orange-50 border-2 border-amber-300 px-4 py-3 text-xs font-black text-orange-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
              <span>{promoBannerReason}</span>
            </div>
          )}

          {/* HERO LOGO SWITCH: Plus Emblem BEFORE subscribing -> Classic Jamr Logo AFTER subscribing */}
          <div className="rounded-3xl bg-gradient-to-br from-[#160F08] via-[#0B0805] to-[#1E1409] border-2 border-amber-400/70 p-5 sm:p-6 text-amber-50 flex flex-col md:flex-row items-center gap-6 shadow-xl">
            <div className="shrink-0 flex flex-col items-center justify-center">
              {active ? (
                <div className="p-4 rounded-3xl bg-[#1A1124] border-2 border-amber-400 shadow-[0_0_32px_rgba(251,191,36,0.4)] flex flex-col items-center gap-2">
                  <JamrFlameLogo size={108} />
                  <span className="text-[11px] font-black text-amber-300">تم الترقية بنجاح — شعار جَمْر الأصلي 🔥</span>
                </div>
              ) : (
                <img
                  src="/assets/aistudio/________________________1ae37580.png"
                  alt="شعار جَمْر بلس الذهبي"
                  className="w-40 h-40 sm:w-44 sm:h-44 rounded-3xl object-cover border-2 border-amber-400/80 shadow-[0_0_35px_rgba(251,191,36,0.45)]"
                />
              )}
            </div>

            <div className="flex-1 space-y-3 text-center md:text-right">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <PlayerNameWithPlus
                  name={playerName || 'لاعب جَمْر'}
                  isPlus
                  plusGlow={plusStatus.glow}
                  nameClassName="text-lg sm:text-xl font-black text-amber-100"
                />
                {active && (
                  <span className="text-[11px] font-black bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-3 py-0.5 rounded-full">
                    نشط لمدة سنة كاملة ✅
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-amber-100/85 leading-relaxed">
                {active
                  ? `أهلاً بك في نادي جَمْر بلس! اشتراكك فعّال حتى ${formatPlusExpiryDate(plusStatus.expiresAt) || 'عام كامل من اليوم'}. استمتع بـ 50 شخصية جديدة، 10 حزم ألوان تغيّر الموقع بالكامل، التوهج الفريد، البث على شاشة التلفاز، وصورتك من الاستوديو.`
                  : 'احصل على عضوية جَمْر بلس الكاملة لمدة سنة واحدة مقابل ريالين سعوديين فقط (٢ ريال)! خصّص ألوان الموقع بالكامل، افتح 50 شخصية جديدة، ارفع صورتك من الاستوديو، أضف توهجاً حول اسمك، واعرض ألعابكم على شاشة التلفاز.'}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                <span className="px-3 py-1 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                  💰 السعر: ٢ ريال سعودي / سنة
                </span>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[11px] font-black">
                  🎮 جميع الألعاب مجانية للجميع دائماً
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: OVERVIEW, AUTH & PAYMENT */}
          {sectionTab === 'overview' && (
            <div className="space-y-5">
              {active ? (
                <div className="rounded-3xl bg-emerald-50 border-2 border-emerald-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      <div>
                        <h3 className="text-base font-black text-emerald-950">اشتراك جَمْر بلس نشط ✅</h3>
                        <p className="text-xs text-emerald-800">
                          ينتهي الاشتراك بتاريخ:{' '}
                          <span className="font-black">{formatPlusExpiryDate(plusStatus.expiresAt) || 'بعد 365 يوماً'}</span>{' '}
                          (بعد انتهاء السنة يلزم تسجيل الدخول للتجديد).
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTvCast();
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#140D05] text-amber-300 border border-amber-400/60 text-xs font-black inline-flex items-center gap-2 cursor-pointer shadow"
                    >
                      <Tv className="w-4 h-4" />
                      <span>فتح شاشة التلفاز والبث 📺</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Step 1: Email + Password Auth BEFORE Payment (No Email Sent) */}
                  <div className="lg:col-span-5 rounded-3xl bg-[#FFF8EE] border-2 border-amber-200 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-orange-500 text-white">
                        الخطوة ١: حفظ الحساب
                      </span>
                      {accountSession && (
                        <span className="text-[11px] font-black text-emerald-700 inline-flex items-center gap-1">
                          <UserCheck className="w-4 h-4" />
                          <span>مسجّل ✅</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#5A3E32] leading-relaxed">
                      سجّل بالإيميل وكلمة السر قبل الدفع <span className="font-black text-[#23140E]">كي لا تضيع أموالك</span> عند الخروج من المتصفح أو تغيير الجهاز.{' '}
                      <span className="font-bold text-orange-700">(لا نرسل أي رسالة على بريدك الإلكتروني).</span>
                    </p>

                    {accountSession ? (
                      <div className="rounded-2xl bg-white border border-emerald-200 p-4 space-y-2">
                        <div className="text-xs font-black text-emerald-800">تم تأمين الحساب بنجاح:</div>
                        <div className="text-xs font-mono font-bold text-[#23140E]" dir="ltr">
                          {accountSession.email}
                        </div>
                        <p className="text-[11px] text-[#6B4E40]">
                          الآن أكمل الخطوة ٢ بالدفع الآمن (٢ ريال سعودي فقط).
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleStep1Auth} className="space-y-3">
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white border border-amber-200">
                          <button
                            type="button"
                            onClick={() => setAuthMode('register')}
                            className={`py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${
                              authMode === 'register' ? 'bg-orange-500 text-white' : 'text-[#5A3E32]'
                            }`}
                          >
                            إنشاء حساب جديد
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthMode('login')}
                            className={`py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${
                              authMode === 'login' ? 'bg-orange-500 text-white' : 'text-[#5A3E32]'
                            }`}
                          >
                            لدي حساب مسبقاً
                          </button>
                        </div>

                        <div>
                          <label className="text-[11px] font-black text-[#23140E] flex items-center gap-1 mb-1">
                            <Mail className="w-3.5 h-3.5 text-orange-500" />
                            <span>البريد الإلكتروني</span>
                          </label>
                          <input
                            type="email"
                            required
                            dir="ltr"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-black text-[#23140E] flex items-center gap-1 mb-1">
                            <Lock className="w-3.5 h-3.5 text-orange-500" />
                            <span>كلمة السر</span>
                          </label>
                          <input
                            type="password"
                            required
                            minLength={4}
                            dir="ltr"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••"
                            className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
                          />
                        </div>

                        {authError && <p className="text-[11px] font-bold text-rose-700">{authError}</p>}

                        <button
                          type="submit"
                          disabled={authLoading}
                          className="w-full py-2.5 rounded-xl bg-[#23140E] text-white text-xs font-black cursor-pointer disabled:opacity-50"
                        >
                          {authLoading
                            ? 'جاري التسجيل...'
                            : authMode === 'register'
                              ? 'حفظ الحساب والمتابعة للدفع ➔'
                              : 'تسجيل الدخول والمتابعة للدفع ➔'}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Step 2: Real Multi-Method Checkout Form (2 SAR / 1 Year) */}
                  <form
                    onSubmit={handleCheckout}
                    className={`lg:col-span-7 rounded-3xl bg-white border-2 border-amber-300 p-5 space-y-4 ${
                      !accountSession ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-500 text-white">
                        الخطوة ٢: الدفع وتفعيل سنة كاملة
                      </span>
                      <span className="text-sm font-black text-orange-700">الإجمالي: ٢.٠٠ ر.س</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PLUS_PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            SoundFX.playClick();
                            setPaymentMethod(m.id);
                            setPayError('');
                          }}
                          className={`p-2.5 rounded-xl border-2 text-right transition cursor-pointer ${
                            paymentMethod === m.id
                              ? 'border-orange-500 bg-[#FFF8EE] shadow-xs'
                              : 'border-amber-100 bg-white hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#23140E] text-amber-300">
                              {m.badge}
                            </span>
                            {paymentMethod === m.id && <Check className="w-3.5 h-3.5 text-orange-600" />}
                          </div>
                          <div className="text-xs font-black text-[#23140E] mt-1">{m.label}</div>
                          <div className="text-[10px] text-[#7C5D4F] truncate">{m.sublabel}</div>
                        </button>
                      ))}
                    </div>

                    {selectedPaymentMeta?.requiresCard && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-[#FFFDF9] border border-amber-200">
                        <div>
                          <label className="text-[11px] font-bold text-[#5A3E32] block mb-1">
                            اسم حامل البطاقة
                          </label>
                          <input
                            type="text"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value)}
                            placeholder="الاسم على البطاقة"
                            className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#5A3E32] block mb-1">
                            آخر ٤ أرقام أو رقم البطاقة
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            maxLength={19}
                            value={cardLast4}
                            onChange={(e) => setCardLast4(e.target.value.replace(/[^0-9\s]/g, ''))}
                            placeholder="•••• •••• •••• 4242"
                            className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-mono font-bold text-[#23140E]"
                          />
                        </div>
                      </div>
                    )}

                    {selectedPaymentMeta?.requiresPhone && (
                      <div className="p-3 rounded-2xl bg-[#FFFDF9] border border-amber-200">
                        <label className="text-[11px] font-bold text-[#5A3E32] block mb-1">
                          رقم الجوال المرتبط بمحفظة STC Pay
                        </label>
                        <input
                          type="tel"
                          dir="ltr"
                          value={phoneNum}
                          onChange={(e) => setPhoneNum(e.target.value)}
                          placeholder="05XXXXXXXX"
                          className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-mono font-bold text-[#23140E]"
                        />
                      </div>
                    )}

                    {payError && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
                        {payError}
                      </div>
                    )}

                    {paySuccess && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-800">
                        {paySuccess}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={payLoading}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-l from-orange-500 via-red-500 to-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {payLoading
                          ? 'جاري تأكيد الدفع...'
                          : `إتمام الدفع عبر ${selectedPaymentMeta?.label || paymentMethod} — ٢ ريال سعودي (سنة كاملة)`}
                      </span>
                    </button>

                    <div className="flex items-center justify-center gap-2 text-[11px] text-[#7C5D4F]">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>اشتراك سنوي يمتد ٣٦٥ يوماً ثم يتطلب إعادة تسجيل الدخول للتجديد.</span>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: 10 FULL-SITE COLOR PACKS & FREE CUSTOMIZER */}
          {sectionTab === 'themes' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-[#23140E] flex items-center gap-2">
                    <Palette className="w-5 h-5 text-orange-500" />
                    <span>تغيير ألوان الموقع بالكامل + 10 حزم ألوان فاخرة</span>
                  </h3>
                  <p className="text-xs text-[#5A3E32]">
                    عند التفعيل، تتغيّر خلفية وبطاقات وأزرار ونصوص المنصة بالكامل فوراً حسب ذوقك حتى لو تغيّرت هوية الموقع!
                  </p>
                </div>
                {active && (
                  <button
                    type="button"
                    onClick={() => {
                      SoundFX.playClick();
                      setTheme(resetThemeConfig());
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة ألوان جَمْر</span>
                  </button>
                )}
              </div>

              {!active && (
                <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs font-black text-amber-950 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-orange-600" />
                    <span>هذه الميزة وحزم الألوان الـ 10 حصرية لمشتركي جَمْر بلس.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSectionTab('overview')}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 text-white cursor-pointer"
                  >
                    اشترك بـ ٢ ريال
                  </button>
                </div>
              )}

              <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 ${!active ? 'opacity-65' : ''}`}>
                {THEME_PRESETS.map((preset) => {
                  const selected = theme.bg.toLowerCase() === preset.theme.bg.toLowerCase() &&
                    theme.primary.toLowerCase() === preset.theme.primary.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={!active}
                      onClick={() => applyThemePreset(preset.theme)}
                      className={`p-3 rounded-2xl border-2 text-right space-y-1.5 transition cursor-pointer disabled:cursor-not-allowed ${
                        selected
                          ? 'border-orange-500 bg-[#FFF8EE] shadow-md'
                          : 'border-amber-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full border border-black/15" style={{ backgroundColor: preset.theme.bg }} />
                        <span className="w-5 h-5 rounded-full border border-black/15" style={{ backgroundColor: preset.theme.surface }} />
                        <span className="w-5 h-5 rounded-full border border-black/15" style={{ backgroundColor: preset.theme.primary }} />
                        <span className="w-5 h-5 rounded-full border border-black/15" style={{ backgroundColor: preset.theme.accent }} />
                      </div>
                      <div className="text-xs font-black text-[#23140E]">{preset.name}</div>
                      <div className="text-[10px] text-[#6B4E40]">{preset.subtitle}</div>
                    </button>
                  );
                })}
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${!active ? 'opacity-65 pointer-events-none' : ''}`}>
                {[
                  { key: 'bg' as const, label: 'لون الخلفية العام' },
                  { key: 'surface' as const, label: 'لون البطاقات والنوافذ' },
                  { key: 'primary' as const, label: 'اللون الرئيسي والأزرار' },
                  { key: 'accent' as const, label: 'اللون الثانوي والتوهج' },
                  { key: 'text' as const, label: 'لون النصوص الكامل' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#FFF8EE] border border-amber-200 cursor-pointer"
                  >
                    <span className="text-xs font-black text-[#23140E]">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase text-[#6B4E40]">{theme[item.key]}</span>
                      <input
                        type="color"
                        value={theme[item.key]}
                        onChange={(e) => updateThemeColor(item.key, e.target.value)}
                        className="w-8 h-8 rounded-lg border border-amber-300 cursor-pointer"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: 50 EXCLUSIVE PLUS CHARACTERS + STUDIO PHOTO CROPPER */}
          {sectionTab === 'avatars' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FFF8EE] border-2 border-amber-200 p-4">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#23140E]">
                    50 شخصية حصرية جديدة + رفع صورة من الاستوديو 📸
                  </h3>
                  <p className="text-xs text-[#5A3E32]">
                    25 شخصية شبابية + 25 شخصية بناتية بنفس أسلوب جَمْر المميز، بالإضافة لقص صورتك الشخصية بشكل دائري!
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => {
                    onClose();
                    onOpenAvatarCropper();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-45"
                >
                  <Camera className="w-4 h-4" />
                  <span>{active ? 'إضافة صورة من الاستوديو (قص دائري)' : 'مغلق — خاص بجَمْر بلس 🔒'}</span>
                </button>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-80 overflow-y-auto p-3 rounded-2xl bg-[#FFFDF9] border border-amber-200">
                {plusCharacters.map((char) => {
                  const selected = playerAvatar === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      disabled={!active}
                      onClick={() => {
                        SoundFX.playTileSelect();
                        onUpdatePlayerAvatar(char.id);
                      }}
                      title={char.tagline}
                      className={`relative p-1.5 rounded-2xl flex flex-col items-center justify-center transition cursor-pointer disabled:cursor-not-allowed ${
                        selected ? 'bg-amber-100 ring-2 ring-orange-500 scale-105' : 'hover:bg-amber-50'
                      }`}
                    >
                      <CharacterAvatar
                        avatarId={char.id}
                        backgroundColor={playerAvatarBg}
                        size={46}
                        interactive={false}
                        isPlus={active}
                        plusGlow={active ? plusStatus.glow : undefined}
                      />
                      {!active && (
                        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/70 text-amber-300 flex items-center justify-center text-[9px]">
                          🔒
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: 50 CHARACTER ANIMATIONS FOR ALL CHARACTERS */}
          {sectionTab === 'animations' && (
            <div className="space-y-5">
              {!active && (
                <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3.5 text-xs font-bold text-amber-950 flex flex-wrap items-center justify-between gap-2">
                  <span>🔒 فعّل اشتراك جَمْر بلس (٢ ريال/سنة) لتطبيق أي من الـ 50 أنميشن على شخصياتك في كل الغرف!</span>
                  <button
                    type="button"
                    onClick={() => setSectionTab('overview')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-black text-xs cursor-pointer"
                  >
                    اشترك الآن (٢ ريال)
                  </button>
                </div>
              )}

              {/* Live Character Animation Showcase */}
              {(() => {
                const currentAnim = resolvePlusAnimation(plusStatus.avatarAnimation);
                return (
                  <div className="rounded-3xl bg-gradient-to-br from-[#160F08] via-[#0B0805] to-[#1D1409] border-2 border-amber-400/70 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-50 shadow-xl">
                    <div className="flex items-center gap-4">
                      <CharacterAvatar
                        avatarId={previewCharId || playerAvatar}
                        backgroundColor={playerAvatarBg}
                        size={82}
                        isPlus
                        plusGlow={plusStatus.glow}
                        plusFrame={plusStatus.avatarFrame}
                        plusAnimation={plusStatus.avatarAnimation || 'royal_float'}
                        interactive={false}
                      />
                      <div className="space-y-1">
                        <div className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-1.5">
                          <span>{currentAnim ? `${currentAnim.badge} ${currentAnim.name}` : 'بدون أنميشن مخصص'}</span>
                          {currentAnim && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200">
                              #{currentAnim.index} / 50
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-100/80">
                          جميع الـ 50 أنميشن تعمل على كل الشخصيات المجانية والملكية وحتى صورتك المرفوعة من الاستوديو!
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          const randomChar =
                            CHARACTER_AVATARS[Math.floor(Math.random() * CHARACTER_AVATARS.length)];
                          setPreviewCharId(randomChar.id);
                        }}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-amber-400/40 text-xs font-black text-amber-200 cursor-pointer"
                      >
                        جرّب على شخصية أخرى 🎲
                      </button>
                      {active && plusStatus.avatarAnimation && plusStatus.avatarAnimation !== 'none' && (
                        <button
                          type="button"
                          onClick={() => {
                            SoundFX.playClick();
                            void updatePlusCustomization({ avatarAnimation: 'none' });
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-black text-rose-200 cursor-pointer"
                        >
                          إيقاف الأنميشن
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Category Filters */}
              <div className="flex flex-wrap gap-1.5">
                {PLUS_ANIMATION_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      SoundFX.playClick();
                      setAnimCategory(cat.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition ${
                      animCategory === cat.id
                        ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-xs'
                        : 'bg-[#FFF8EE] border border-amber-200 text-[#5A3E32] hover:bg-amber-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 50 Character Animations Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {PLUS_CHARACTER_ANIMATIONS.filter(
                  (a) => animCategory === 'all' || a.category === animCategory
                ).map((anim) => {
                  const selected = (plusStatus.avatarAnimation || 'royal_float') === anim.id;
                  return (
                    <button
                      key={anim.id}
                      type="button"
                      disabled={!active}
                      onClick={() => {
                        SoundFX.playTileSelect();
                        void updatePlusCustomization({ avatarAnimation: anim.id });
                      }}
                      className={`relative p-2.5 rounded-2xl border-2 text-center flex flex-col items-center gap-1.5 transition cursor-pointer disabled:cursor-not-allowed ${
                        selected
                          ? 'bg-amber-50 border-orange-500 ring-2 ring-orange-400/60 shadow-md scale-[1.03]'
                          : 'bg-white border-amber-200 hover:bg-[#FFF8EE]'
                      }`}
                    >
                      <span className="absolute top-1.5 right-2 text-[9px] font-mono font-black text-amber-700">
                        #{anim.index}
                      </span>
                      {!active && (
                        <span className="absolute top-1.5 left-1.5 text-[10px]">🔒</span>
                      )}
                      <CharacterAvatar
                        avatarId={previewCharId || playerAvatar}
                        backgroundColor={playerAvatarBg}
                        size={44}
                        isPlus
                        plusAnimation={anim.id}
                        interactive={false}
                      />
                      <div className="text-[11px] font-black text-[#23140E] leading-tight line-clamp-2">
                        {anim.badge} {anim.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 5: CUSTOM GLOW + EXTRA PERKS + TV CAST */}
          {sectionTab === 'glow_perks' && (
            <div className="space-y-6">
              {/* Glow & VIP Frame Customizer */}
              <div className={`rounded-3xl bg-[#140E08] text-amber-50 border-2 border-amber-400/60 p-5 space-y-4 ${!active ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      <span>تخصيص التوهج والهالة حول اسمك وصورتك ✨</span>
                    </h3>
                    <p className="text-xs text-amber-100/75">
                      اجعل اسمك وأفاتارك يتألقان بتوهج بلس مخصص يراه جميع اللاعبين داخل الغرف!
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-2xl border border-amber-400/40">
                    <CharacterAvatar
                      avatarId={playerAvatar}
                      backgroundColor={playerAvatarBg}
                      size={42}
                      isPlus
                      plusGlow={plusStatus.glow}
                      plusFrame={plusStatus.avatarFrame}
                      interactive={false}
                    />
                    <PlayerNameWithPlus
                      name={playerName || 'لاعب جَمْر'}
                      isPlus
                      plusGlow={plusStatus.glow}
                      nameClassName="text-sm font-black text-white"
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${!active ? 'pointer-events-none' : ''}`}>
                  {GLOW_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateGlow({ enabled: true, style: opt.id, color: opt.color })}
                      className={`p-2.5 rounded-xl border text-right text-xs font-black flex items-center gap-2 cursor-pointer ${
                        plusStatus.glow.style === opt.id
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                          : 'border-white/10 bg-white/5 text-amber-100/80'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-gradient-to-br ${opt.previewClass}`} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${!active ? 'pointer-events-none' : ''}`}>
                  <div>
                    <label className="text-[11px] font-bold text-amber-200 block mb-1">شدة التوهج</label>
                    <select
                      value={plusStatus.glow.intensity}
                      onChange={(e) => updateGlow({ intensity: e.target.value as PlusGlowConfig['intensity'] })}
                      className="w-full rounded-xl bg-black/50 border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-100"
                    >
                      <option value="soft">ناعم هادئ</option>
                      <option value="bright">ساطع مشرق</option>
                      <option value="legendary">أسطوري متوهج</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-amber-200 block mb-1">إطار الصورة الملكي</label>
                    <select
                      value={plusStatus.avatarFrame || 'gold_crown'}
                      onChange={(e) =>
                        void updatePlusCustomization({
                          avatarFrame: e.target.value as JamrPlusStatus['avatarFrame'],
                        })
                      }
                      className="w-full rounded-xl bg-black/50 border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-100"
                    >
                      {PLUS_AVATAR_FRAMES.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-amber-200 block mb-1">اللقب الخاص في الغرفة</label>
                    <select
                      value={plusStatus.profileTitle || PLUS_TITLES[0]}
                      onChange={(e) => void updatePlusCustomization({ profileTitle: e.target.value })}
                      className="w-full rounded-xl bg-black/50 border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-100"
                    >
                      {PLUS_TITLES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* TV Screen Cast Launch Banner */}
              <div className="rounded-2xl bg-gradient-to-l from-[#1C1409] to-[#0D0A06] border border-amber-400/60 p-4 flex flex-wrap items-center justify-between gap-3 text-amber-50">
                <div className="flex items-center gap-3">
                  <Tv className="w-7 h-7 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-sm font-black text-amber-300">خيار العرض على شاشة التلفاز 📺</div>
                    <div className="text-xs text-amber-100/80">
                      افتح الموقع من التلفاز وامسح الباركود الفخم أو سجل حسابك واضغط «بث» لعرض الألعاب مباشرة!
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTvCast();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-400 to-orange-500 text-[#140D05] text-xs font-black cursor-pointer shadow"
                >
                  فتح وضع الشاشة الآن 📺
                </button>
              </div>

              {/* 10 Extra Original Plus Perks */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-[#23140E] flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  <span>10 ميزات إضافية حصرية لمشتركي جَمْر بلس:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {EXTRA_10_PLUS_PERKS.map((perk) => (
                    <div
                      key={perk.id}
                      className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3.5 flex items-start gap-3"
                    >
                      <span className="text-xl shrink-0">{perk.icon}</span>
                      <div>
                        <div className="text-xs font-black text-[#23140E]">
                          {perk.id}. {perk.title}
                        </div>
                        <div className="text-[11px] text-[#5A3E32] leading-relaxed mt-0.5">{perk.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
