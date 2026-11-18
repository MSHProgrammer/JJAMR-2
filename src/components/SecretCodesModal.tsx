import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { KeyRound, Sparkles, X, CheckCircle2, Trash2, ExternalLink } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';
import { apiFetchJson } from '../utils/apiClient';
import { loadLocalCheatCodes } from '../utils/localFallbackStore';
import { CHEAT_EFFECTS_CATALOG } from '../data/cheatCodesCatalog';

export interface ActiveCheatEntry {
  code: string;
  effectId: number;
  title: string;
  badge: string;
  description: string;
  activatedAt: number;
}

const CHEATS_STORAGE_KEY = 'jamr_active_cheats_v1';
const ADMIN_PORTAL_URL = 'https://aledara-jamr.vercel.app';
const ADMIN_SECRET_PASS = '1100321';

export function buildAdminPortalUrl(enteredCode: string): string {
  return `${ADMIN_PORTAL_URL}/#code=${encodeURIComponent(enteredCode)}`;
}

export function loadActiveCheats(): ActiveCheatEntry[] {
  try {
    const raw = window.localStorage.getItem(CHEATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveActiveCheats(list: ActiveCheatEntry[]): void {
  try {
    window.localStorage.setItem(CHEATS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

interface SecretCodesModalProps {
  onUnlockAdmin: (enteredCode: string) => void;
  onCheatActivated?: (cheats: ActiveCheatEntry[]) => void;
  onClose: () => void;
}

export const SecretCodesModal: React.FC<SecretCodesModalProps> = ({
  onUnlockAdmin,
  onCheatActivated,
  onClose,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [portalRedirectUrl, setPortalRedirectUrl] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeCheats, setActiveCheats] = useState<ActiveCheatEntry[]>(() => loadActiveCheats());

  const activateCheatLocally = (
    cheatCode: string,
    effectId: number,
    effectTitle: string,
    description: string,
    badge: string
  ) => {
    SoundFX.playCorrect();
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    const nextEntry: ActiveCheatEntry = {
      code: cheatCode.toUpperCase(),
      effectId,
      title: effectTitle,
      badge: badge || '✨',
      description: description || '',
      activatedAt: Date.now(),
    };
    const updated = [
      nextEntry,
      ...activeCheats.filter((c) => c.effectId !== nextEntry.effectId),
    ].slice(0, 20);
    setActiveCheats(updated);
    saveActiveCheats(updated);
    onCheatActivated?.(updated);
    setSuccessMsg(`تم تفعيل كود «${nextEntry.code}»: ${nextEntry.title}!`);
    setCode('');
  };

  const redirectToAdminPortal = (enteredCode: string) => {
    const cleanCode = enteredCode.trim();
    if (cleanCode !== ADMIN_SECRET_PASS) {
      SoundFX.playWrong();
      setError('الكود السري غير صحيح أو معطّل.');
      return;
    }
    SoundFX.playCorrect();
    const targetUrl = buildAdminPortalUrl(cleanCode);
    setPortalRedirectUrl(targetUrl);
    setError('');
    setSuccessMsg('تم التحقق من الرمز! يمكنك الآن فتح موقع الإدارة.');
    onUnlockAdmin(cleanCode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('أدخل الكود السري أولاً.');
      return;
    }
    setLoading(true);
    setError('');
    setPortalRedirectUrl('');
    setSuccessMsg('');

    const result = await apiFetchJson<{
      ok?: boolean;
      kind?: 'admin' | 'cheat';
      token?: string;
      message?: string;
      error?: string;
      cheat?: { code?: string };
      effect?: { id?: number; title?: string; badge?: string; description?: string };
    }>(
      '/api/cheats/redeem',
      {
        method: 'POST',
        body: JSON.stringify({ code: trimmed }),
      },
      { unlockStorageOnGesture: true }
    );

    setLoading(false);

    if (!result.isHtmlOrStatic && !result.networkError && result.data) {
      const json = result.data;
      if (!result.ok || !json.ok) {
        SoundFX.playWrong();
        setError(String(json.error || 'الكود السري غير صحيح أو معطّل.'));
        return;
      }

      if (json.kind === 'admin' && trimmed === ADMIN_SECRET_PASS) {
        redirectToAdminPortal(trimmed);
        return;
      }

      if (json.kind === 'cheat' && json.effect) {
        activateCheatLocally(
          String(json.cheat?.code || trimmed),
          Number(json.effect.id || 1),
          String(json.effect.title || 'ميزة سرية'),
          String(json.effect.description || ''),
          String(json.effect.badge || '✨')
        );
        return;
      }
    }

    // Exact 1100321 Admin pass fallback when server unreachable in static/iframe mode
    if (trimmed === ADMIN_SECRET_PASS) {
      redirectToAdminPortal(trimmed);
      return;
    }

    // Local cheat fallback
    const localCheats = loadLocalCheatCodes();
    const localMatch = localCheats.find(
      (c) => c.enabled && c.code.trim().toUpperCase() === trimmed.toUpperCase()
    );
    if (localMatch) {
      const eff = CHEAT_EFFECTS_CATALOG.find((x) => x.id === localMatch.effectId);
      activateCheatLocally(
        localMatch.code,
        localMatch.effectId,
        eff?.title || localMatch.effectTitle,
        eff?.description || localMatch.description || '',
        eff?.badge || '✨'
      );
      return;
    }

    SoundFX.playWrong();
    setError('الكود السري غير صحيح أو معطّل.');
  };

  const clearCheats = () => {
    SoundFX.playClick();
    setActiveCheats([]);
    saveActiveCheats([]);
    onCheatActivated?.([]);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#23140E]/55 backdrop-blur-md p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-black text-[#23140E]">أكواد سرية 🔐</h2>
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
          <p className="text-xs text-[#5A3E32] font-readex leading-relaxed">
            أدخل كود الغش السري لتفعيل مزايا وإضافات خاصة داخل المنصة.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
                setPortalRedirectUrl('');
              }}
              placeholder="اكتب الكود هنا..."
              className="w-full rounded-xl bg-[#FFF8EE] border-2 border-amber-200 px-4 py-3 text-center text-base font-black tracking-wider text-[#23140E] focus:outline-none focus:border-orange-500"
            />

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-700 text-center">
                {error}
              </div>
            )}

            {/* Strict requirement: Admin portal button ONLY renders when exact password 1100321 was verified */}
            {portalRedirectUrl && code.trim() === ADMIN_SECRET_PASS && (
              <div className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-3 text-xs font-bold text-amber-950 text-center space-y-2">
                <div>افتح موقع الإدارة المستقل الآن:</div>
                <a
                  href={portalRedirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-l from-orange-500 to-amber-500 hover:brightness-105 text-white font-black text-xs inline-flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح موقع الإدارة ↗</span>
                </a>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs font-black text-emerald-800 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-l from-orange-500 via-red-500 to-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'جاري التحقق...' : 'تفعيل الكود الآن'}</span>
            </button>
          </form>

          {activeCheats.length > 0 && (
            <div className="pt-3 border-t border-amber-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-orange-700">
                  الأكواد المفعّلة حالياً ({activeCheats.length})
                </span>
                <button
                  type="button"
                  onClick={clearCheats}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>تعطيل الكل</span>
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {activeCheats.map((c) => (
                  <div
                    key={`${c.code}_${c.effectId}`}
                    className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-[#23140E] truncate">
                        {c.badge} {c.title}
                      </div>
                      <div className="text-[10px] text-[#6B4E40] truncate">{c.description}</div>
                    </div>
                    <span className="text-[10px] font-mono font-black bg-white border border-amber-200 px-2 py-0.5 rounded-md text-orange-700 shrink-0">
                      {c.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
