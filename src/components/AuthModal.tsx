import React, { useState } from 'react';
import { Crown, Lock, LogIn, LogOut, Mail, ShieldCheck, UserCheck, X } from 'lucide-react';
import { apiFetchJson } from '../utils/apiClient';
import { SoundFX } from '../utils/soundFx';
import { JamrPlusStatus } from '../types/jamr';
import {
  AccountSessionState,
  createDefaultPlusStatus,
  formatPlusExpiryDate,
  isPlusActive,
  saveAccountSession,
  savePlusStatus,
} from '../utils/plusManager';

interface AuthModalProps {
  accountSession: AccountSessionState | null;
  plusStatus: JamrPlusStatus;
  playerName: string;
  username?: string;
  avatar: string;
  avatarBg: string;
  onAuthSuccess: (session: AccountSessionState, accountPlus?: JamrPlusStatus, plusExpired?: boolean) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  accountSession,
  plusStatus,
  playerName,
  username,
  avatar,
  avatarBg,
  onAuthSuccess,
  onLogout,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('أدخل بريداً إلكترونياً صحيحاً.');
      return;
    }
    if (password.length < 4) {
      setError('كلمة السر يجب أن تكون 4 أحرف على الأقل.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const res = await apiFetchJson<{
      ok?: boolean;
      error?: string;
      token?: string;
      plusExpired?: boolean;
      account?: {
        email: string;
        displayName?: string;
        plus?: JamrPlusStatus;
      };
    }>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          password,
          displayName: playerName || 'لاعب جَمْر',
          username,
          avatar,
          avatarBg,
          plus: isPlusActive(plusStatus) ? plusStatus : undefined,
        }),
      },
      { unlockStorageOnGesture: true }
    );

    setLoading(false);

    if (!res.isHtmlOrStatic && !res.networkError && res.data) {
      if (!res.ok || !res.data.ok || !res.data.token || !res.data.account) {
        SoundFX.playWrong();
        setError(String(res.data.error || 'تعذر إتمام تسجيل الدخول.'));
        return;
      }

      const nextSession: AccountSessionState = {
        token: res.data.token,
        email: res.data.account.email,
        displayName: res.data.account.displayName,
      };
      saveAccountSession(nextSession);
      if (res.data.account.plus) {
        savePlusStatus(res.data.account.plus);
      }
      SoundFX.playCorrect();
      onAuthSuccess(nextSession, res.data.account.plus, res.data.plusExpired);
      setSuccessMsg(
        res.data.plusExpired
          ? 'تم تسجيل الدخول، ولكن انتهت سنة اشتراكك في جَمْر بلس ويمكنك تجديده الآن.'
          : 'تم تسجيل الدخول بنجاح وحفظ حسابك! ✅'
      );
      return;
    }

    // Local session fallback when running offline/iframe without reachable backend
    const localSession: AccountSessionState = {
      token: `local_${Date.now().toString(36)}`,
      email: cleanEmail,
      displayName: playerName || 'لاعب جَمْر',
    };
    saveAccountSession(localSession);
    SoundFX.playCorrect();
    onAuthSuccess(localSession, isPlusActive(plusStatus) ? plusStatus : createDefaultPlusStatus(), false);
    setSuccessMsg('تم تسجيل الدخول وحفظ بيانات الحساب على جهازك! ✅');
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#23140E]/60 backdrop-blur-md p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-black text-[#23140E]">حسابك الاختياري في جَمْر 🔐</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-[#5A3E32] leading-relaxed">
            تسجيل الدخول <span className="font-black text-[#23140E]">اختياري تماماً للّعب</span>، وفائدته الأساسية هي{' '}
            <span className="font-black text-orange-700">حفظ اشتراكك في جَمْر بلس لمدة سنة كاملة</span> حتى لا تضيع أموالك عند تغيير الجهاز أو المتصفح —{' '}
            <span className="font-bold">ولا نرسل أي رسائل على بريدك الإلكتروني.</span>
          </div>

          {accountSession ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#FFF8EE] border-2 border-emerald-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <span>مسجّل دخول حالياً</span>
                </div>
                <div className="text-xs font-mono font-bold text-[#23140E]" dir="ltr">
                  {accountSession.email}
                </div>
                {isPlusActive(plusStatus) ? (
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-black bg-amber-100 text-amber-900 px-3 py-1 rounded-full">
                    <Crown className="w-3.5 h-3.5 text-amber-600" />
                    <span>جَمْر بلس نشط حتى {formatPlusExpiryDate(plusStatus.expiresAt)}</span>
                  </div>
                ) : (
                  <div className="text-[11px] font-bold text-[#6B4E40]">
                    لا يوجد اشتراك جَمْر بلس نشط على هذا الحساب حالياً.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  saveAccountSession(null);
                  onLogout();
                }}
                className="w-full py-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج من الحساب</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#FFF8EE] border border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`py-2 rounded-lg text-xs font-black cursor-pointer ${
                    mode === 'login' ? 'bg-orange-500 text-white shadow-xs' : 'text-[#5A3E32]'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`py-2 rounded-lg text-xs font-black cursor-pointer ${
                    mode === 'register' ? 'bg-orange-500 text-white shadow-xs' : 'text-[#5A3E32]'
                  }`}
                >
                  حساب جديد
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#23140E] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-orange-500" />
                  <span>البريد الإلكتروني (لحفظ حسابك فقط)</span>
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="name@example.com"
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3.5 py-2.5 text-sm font-bold text-[#23140E] focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#23140E] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-500" />
                  <span>كلمة السر</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  dir="ltr"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3.5 py-2.5 text-sm font-bold text-[#23140E] focus:outline-none focus:border-orange-500"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'جاري الحفظ...' : mode === 'login' ? 'دخول لحسابي' : 'إنشاء وحفظ الحساب'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
