import React, { useEffect, useState } from 'react';
import {
  Shield,
  Lock,
  ArrowLeft,
  Plus,
  Trash2,
  Image as ImageIcon,
  Wrench,
  RotateCcw,
  Download,
  Upload,
  Sparkles,
  Volume2,
  RefreshCw,
  Check,
  X,
  Flame,
  KeyRound,
  Film,
  ExternalLink,
} from 'lucide-react';
import {
  BarrahCategory,
  BugReport,
  CheatCodeConfig,
  DataStoreSnapshot,
  DubMicScene,
  GameConfig,
  MimicSound,
  Question,
  Section,
  Topic,
} from '../types/jamr';
import { CHEAT_EFFECTS_CATALOG } from '../data/cheatCodesCatalog';
import { DEFAULT_GAMES } from '../data/defaultGames';
import { extractAudioFromFile, processStudioImageFile } from '../utils/mediaTools';
import { SoundFX } from '../utils/soundFx';
import { apiFetchJson } from '../utils/apiClient';
import { loadLocalStoreSnapshot, saveLocalStoreSnapshot } from '../utils/localFallbackStore';

interface AdminPanelProps {
  onDataUpdated: () => void;
  onExit: () => void;
}

type AdminTab =
  | 'games'
  | 'cheats'
  | 'dub_scenes'
  | 'topics'
  | 'sections'
  | 'questions'
  | 'barrah'
  | 'mimic'
  | 'ai'
  | 'reports'
  | 'rooms';

interface LiveStats {
  liveRooms: Array<{
    code: string;
    gameId: string;
    status: string;
    playersCount: number;
    maxPlayers: number;
    isJudgeRoom: boolean;
  }>;
  totals: {
    rooms: number;
    playersOnline: number;
    games: number;
    topics: number;
    questions: number;
    reportsNew: number;
    mimicSounds: number;
  };
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onDataUpdated, onExit }) => {
  const [token, setToken] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem('jamr_admin_token') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loginBlockedHint, setLoginBlockedHint] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<AdminTab>('games');
  const [store, setStore] = useState<DataStoreSnapshot | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [toast, setToast] = useState('');

  // Modal states
  const [logoModalGame, setLogoModalGame] = useState<GameConfig | null>(null);
  const [topicImgModal, setTopicImgModal] = useState<Topic | null>(null);

  // Forms
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameDesc, setNewGameDesc] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionIcon, setNewSectionIcon] = useState('📂');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicCat, setNewTopicCat] = useState('ثقافة وعامة');
  const [newTopicIcon, setNewTopicIcon] = useState('✨');

  // Question form
  const [qTopicId, setQTopicId] = useState('');
  const [qPoints, setQPoints] = useState<200 | 400 | 600>(200);
  const [qText, setQText] = useState('');
  const [qAnswer, setQAnswer] = useState('');
  const [qHint, setQHint] = useState('');
  const [qImage, setQImage] = useState('');
  const [qVideo, setQVideo] = useState('');

  // Barrah category form
  const [bName, setBName] = useState('');
  const [bIcon, setBIcon] = useState('🕵️');
  const [bDesc, setBDesc] = useState('');
  const [bWordsText, setBWordsText] = useState('');

  // Mimic sound form
  const [mTitle, setMTitle] = useState('');
  const [mCat, setMCat] = useState('مؤثرات');
  const [mHint, setMHint] = useState('');
  const [mAudioData, setMAudioData] = useState('');
  const [mDuration, setMDuration] = useState(0);
  const [extractingAudio, setExtractingAudio] = useState(false);

  // AI Game Designer
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraftGame, setAiDraftGame] = useState<GameConfig | null>(null);

  // Import mode
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Cheat codes form (100 effects)
  const [cheatCodeInput, setCheatCodeInput] = useState('');
  const [cheatEffectId, setCheatEffectId] = useState<number>(1);
  const [cheatEffectSearch, setCheatEffectSearch] = useState('');
  const [cheatDescInput, setCheatDescInput] = useState('');

  // Dub scenes form
  const [dubTitle, setDubTitle] = useState('');
  const [dubWorkTitle, setDubWorkTitle] = useState('');
  const [dubCat, setDubCat] = useState('كوميديا كرتون');
  const [dubVideoUrl, setDubVideoUrl] = useState('');
  const [dubStartSec, setDubStartSec] = useState(5);
  const [dubEndSec, setDubEndSec] = useState(25);
  const [dubDesc, setDubDesc] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  };

  const handleLocalAdminRequest = async (url: string, options: RequestInit = {}): Promise<Record<string, any>> => {
    const method = (options.method || 'GET').toUpperCase();
    const body = typeof options.body === 'string' && options.body ? JSON.parse(options.body) : {};
    const snap = loadLocalStoreSnapshot();

    if (url === '/api/admin/data') return snap;
    if (url === '/api/admin/stats') {
      return {
        liveRooms: [],
        totals: {
          rooms: 0,
          playersOnline: 0,
          games: snap.games.length,
          topics: snap.topics.length,
          questions: snap.questions.length,
          reportsNew: snap.reports.filter((r) => r.status === 'new').length,
          mimicSounds: snap.mimicSounds.length,
        },
      };
    }

    if (url === '/api/admin/games/reset' && method === 'POST') {
      snap.games = DEFAULT_GAMES;
      saveLocalStoreSnapshot(snap);
      return { games: snap.games };
    }
    if (url === '/api/admin/games' && method === 'POST') {
      const created: GameConfig = {
        id: body.id || `custom_${Date.now()}`,
        title: body.title || 'لعبة جديدة',
        subtitle: body.subtitle || 'لعبة مخصصة',
        description: body.description || '',
        icon: body.icon || '🎮',
        category: body.category || 'ألعاب جماعية',
        minPlayers: body.minPlayers || 2,
        maxPlayers: body.maxPlayers || 12,
        duration: body.duration || '10–20 دقيقة',
        difficulty: body.difficulty || 'حماسية',
        tags: Array.isArray(body.tags) ? body.tags : ['جماعية'],
        supportsOffline: true,
        supportsOnline: false,
        isActive: true,
        underMaintenance: false,
        bgGradient: body.bgGradient || 'from-orange-500 to-amber-500',
        accentColor: body.accentColor || '#F97316',
        isCustom: true,
        rules: Array.isArray(body.rules) ? body.rules : ['لعبة مخصصة في الوضع المحلي'],
      };
      snap.games = [...snap.games, created];
      saveLocalStoreSnapshot(snap);
      return { game: created };
    }
    if (url.startsWith('/api/admin/games/') && url.endsWith('/image') && method === 'PUT') {
      const id = url.split('/')[4];
      let updated: GameConfig | undefined;
      snap.games = snap.games.map((g): GameConfig => {
        if (g.id === id) {
          const next: GameConfig = { ...g, imageUrl: body.imageUrl || undefined };
          updated = next;
          return next;
        }
        return g;
      });
      saveLocalStoreSnapshot(snap);
      return { game: updated };
    }
    if (url.startsWith('/api/admin/games/') && method === 'PUT') {
      const id = url.split('/')[4];
      let updated: GameConfig | undefined;
      snap.games = snap.games.map((g): GameConfig => {
        if (g.id === id) {
          const next: GameConfig = { ...g, ...body };
          updated = next;
          return next;
        }
        return g;
      });
      saveLocalStoreSnapshot(snap);
      return { game: updated };
    }
    if (url.startsWith('/api/admin/games/') && method === 'DELETE') {
      const id = url.split('/')[4];
      snap.games = snap.games.filter((g) => g.id !== id);
      saveLocalStoreSnapshot(snap);
      return { ok: true };
    }

    if (url === '/api/admin/cheats' && method === 'POST') {
      const ef = CHEAT_EFFECTS_CATALOG.find((x) => x.id === Number(body.effectId)) || CHEAT_EFFECTS_CATALOG[0];
      const cheat: CheatCodeConfig = {
        id: `cheat_${Date.now()}`,
        code: String(body.code || '').trim().toUpperCase(),
        effectId: ef.id,
        effectTitle: ef.title,
        description: body.description || ef.description,
        enabled: true,
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };
      snap.cheatCodes = [cheat, ...(snap.cheatCodes || [])];
      saveLocalStoreSnapshot(snap);
      return { cheat };
    }
    if (url.startsWith('/api/admin/cheats/') && method === 'PUT') {
      const id = url.split('/')[4];
      let updated: CheatCodeConfig | undefined;
      snap.cheatCodes = (snap.cheatCodes || []).map((c): CheatCodeConfig => {
        if (c.id === id) {
          const next: CheatCodeConfig = { ...c, ...body };
          updated = next;
          return next;
        }
        return c;
      });
      saveLocalStoreSnapshot(snap);
      return { cheat: updated };
    }
    if (url.startsWith('/api/admin/cheats/') && method === 'DELETE') {
      const id = url.split('/')[4];
      snap.cheatCodes = (snap.cheatCodes || []).filter((c) => c.id !== id);
      saveLocalStoreSnapshot(snap);
      return { ok: true };
    }

    if (url === '/api/admin/dub-scenes' && method === 'POST') {
      const startSec = Number(body.clipStartSec) || 0;
      const endSec = Number(body.clipEndSec) || 20;
      const scene: DubMicScene = {
        id: `dub_${Date.now()}`,
        title: body.title || 'مشهد جديد',
        workTitle: body.workTitle || 'Cartoon Scene',
        category: body.category || 'كوميديا كرتون',
        durationSec: Math.max(5, endSec - startSec),
        videoUrl: body.videoUrl || '',
        clipStartSec: startSec,
        clipEndSec: endSec,
        description: body.description || '',
        isCustom: true,
        characters: [
          {
            id: 'c1',
            name: 'الشخصية 1',
            originalName: 'Character 1',
            roleColor: '#F97316',
            cueStartSec: startSec,
            cueEndSec: Math.round((startSec + endSec) / 2),
          },
          {
            id: 'c2',
            name: 'الشخصية 2',
            originalName: 'Character 2',
            roleColor: '#0D9488',
            cueStartSec: Math.round((startSec + endSec) / 2),
            cueEndSec: endSec,
          },
        ],
      };
      snap.dubScenes = [scene, ...(snap.dubScenes || [])];
      saveLocalStoreSnapshot(snap);
      return { scene };
    }
    if (url.startsWith('/api/admin/dub-scenes/') && method === 'DELETE') {
      const id = url.split('/')[4];
      snap.dubScenes = (snap.dubScenes || []).filter((s) => s.id !== id);
      saveLocalStoreSnapshot(snap);
      return { ok: true };
    }

    if (url.startsWith('/api/admin/reports/') && method === 'PUT') {
      const id = url.split('/')[4];
      let updated: BugReport | undefined;
      snap.reports = snap.reports.map((r): BugReport => {
        if (r.id === id) {
          const next: BugReport = { ...r, ...body };
          updated = next;
          return next;
        }
        return r;
      });
      saveLocalStoreSnapshot(snap);
      return { report: updated };
    }
    if (url.startsWith('/api/admin/reports/') && method === 'DELETE') {
      const id = url.split('/')[4];
      snap.reports = snap.reports.filter((r) => r.id !== id);
      saveLocalStoreSnapshot(snap);
      return { ok: true };
    }

    if (url === '/api/admin/sections' && method === 'POST') {
      const section: Section = { id: `sec_${Date.now()}`, name: body.name || 'قسم', icon: body.icon || '📂' };
      snap.sections = [...snap.sections, section];
      saveLocalStoreSnapshot(snap);
      return { section };
    }
    if (url.startsWith('/api/admin/sections/') && method === 'DELETE') {
      const id = url.split('/')[4];
      snap.sections = snap.sections.filter((s) => s.id !== id);
      saveLocalStoreSnapshot(snap);
      return { ok: true };
    }

    if (url === '/api/admin/barrah/categories' && method === 'POST') {
      const category: BarrahCategory = {
        id: `bar_${Date.now()}`,
        name: body.name || 'قسم',
        icon: body.icon || '🕵️',
        description: body.description || '',
        words: Array.isArray(body.words) ? body.words : [],
      };
      snap.barrahCategories = [...snap.barrahCategories, category];
      saveLocalStoreSnapshot(snap);
      return { category };
    }
    if (url.startsWith('/api/admin/barrah/categories/') && method === 'DELETE') {
      const id = url.split('/')[5];
      snap.barrahCategories = snap.barrahCategories.filter((b) => b.id !== id);
      saveLocalStoreSnapshot(snap);
      return { ok: true };
    }

    if (url === '/api/admin/export') return snap;
    if (url === '/api/admin/import' && method === 'POST') {
      const incoming = body.data || {};
      const next: DataStoreSnapshot =
        body.mode === 'replace'
          ? { ...snap, ...incoming }
          : {
              ...snap,
              games: Array.isArray(incoming.games) ? incoming.games : snap.games,
              cheatCodes: Array.isArray(incoming.cheatCodes) ? incoming.cheatCodes : snap.cheatCodes,
              dubScenes: Array.isArray(incoming.dubScenes) ? incoming.dubScenes : snap.dubScenes,
            };
      saveLocalStoreSnapshot(next);
      return { store: next };
    }

    throw new Error('هذه العملية تتطلب فتح المنصة في تبويب مستقل للاتصال المباشر بالخادم.');
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    if (token === 'local_admin_session') {
      return handleLocalAdminRequest(url, options);
    }

    const res = await apiFetchJson<Record<string, any>>(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      setToken('');
      try {
        window.sessionStorage.removeItem('jamr_admin_token');
      } catch {
        // ignore
      }
      throw new Error('انتهت جلسة الإدارة، يرجى تسجيل الدخول مجدداً');
    }

    if (res.isHtmlOrStatic || res.networkError) {
      throw new Error('المتصفح يحظر كوكيز الجلسة داخل الإطار المضمّن — افتح في تبويب مستقل أو استخدم الوضع المحلي.');
    }

    if (!res.ok) {
      throw new Error(String(res.data?.error || `حدث خطأ في الخادم (${res.status})`));
    }
    return res.data || {};
  };

  const loadAdminData = async () => {
    if (!token) return;
    try {
      const [dataJson, statsJson] = await Promise.all([
        authFetch('/api/admin/data'),
        authFetch('/api/admin/stats'),
      ]);
      setStore(dataJson as DataStoreSnapshot);
      setStats(statsJson as LiveStats);
      setAuthError('');
      if (!qTopicId && dataJson.topics?.[0]?.id) {
        setQTopicId(dataJson.topics[0].id);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'تعذّر التحميل');
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [token]);

  useEffect(() => {
    if (token && (tab === 'reports' || tab === 'rooms')) {
      void loadAdminData();
    }
  }, [tab, token]);

  const enterLocalAdminMode = () => {
    SoundFX.playCorrect();
    setToken('local_admin_session');
    setPassword('');
    setAuthError('');
    setLoginBlockedHint(false);
    try {
      window.sessionStorage.setItem('jamr_admin_token', 'local_admin_session');
    } catch {
      // ignore
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setAuthError('يرجى إدخال رمز المرور الإداري.');
      return;
    }
    setLoggingIn(true);
    setAuthError('');
    setLoginBlockedHint(false);

    const res = await apiFetchJson<{ token?: string; error?: string }>(
      '/api/admin/login',
      {
        method: 'POST',
        body: JSON.stringify({ password }),
      },
      { unlockStorageOnGesture: true }
    );

    setLoggingIn(false);

    if (!res.isHtmlOrStatic && !res.networkError && res.data) {
      if (!res.ok || !res.data.token) {
        SoundFX.playWrong();
        setAuthError(String(res.data.error || `تعذّر تسجيل الدخول (${res.status})`));
        return;
      }
      SoundFX.playCorrect();
      setToken(res.data.token);
      setPassword('');
      try {
        window.sessionStorage.setItem('jamr_admin_token', res.data.token);
      } catch {
        // ignore
      }
      return;
    }

    if (password.trim().toLowerCase() === 'jamr2026') {
      enterLocalAdminMode();
      return;
    }

    SoundFX.playWrong();
    setLoginBlockedHint(true);
    setAuthError(
      res.isAuthBlocked
        ? 'المتصفح يحظر كوكيز الجلسة داخل الإطار المضمّن عند إرسال الرمز للخادم.'
        : 'تعذّر الوصول لواجهة الخادم الخلفي من هذه النافذة.'
    );
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-14">
        <div className="rounded-3xl bg-white border-2 border-amber-300 p-7 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-orange-500" />
              <h1 className="text-xl font-black text-[#23140E]">دخول إدارة جَمْر</h1>
            </div>
            <button type="button" onClick={onExit} className="text-xs font-bold text-[#7C5D4F] hover:text-[#23140E] cursor-pointer">
              رجوع
            </button>
          </div>

          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5A3E32] mb-2">رمز المرور الإداري</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9A7B6D] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAuthError('');
                    setLoginBlockedHint(false);
                  }}
                  placeholder="أدخل رمز الإدارة"
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 pr-10 pl-4 py-3 text-[#23140E] text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <p className="text-[11px] text-[#7C5D4F] font-readex mt-2">
                إذا لم تُضبط قيمة <code className="font-mono text-orange-700">ADMIN_PASSWORD</code> في البيئة، الرمز الافتراضي هو:{' '}
                <button
                  type="button"
                  onClick={() => setPassword('jamr2026')}
                  className="font-mono font-black text-orange-700 underline cursor-pointer"
                >
                  jamr2026
                </button>
              </p>
              {authError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 font-bold mt-2 space-y-2">
                  <div>{authError}</div>
                  {loginBlockedHint && (
                    <div className="flex flex-col gap-2 pt-1">
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-[11px] inline-flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>افتح المنصة في تبويب مستقل للدخول برمز الخادم ↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={enterLocalAdminMode}
                        className="w-full py-2 px-3 rounded-lg bg-white hover:bg-amber-50 border border-amber-300 text-[#23140E] font-black text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-orange-500" />
                        <span>الدخول بالوضع المحلي السريع 🛠️</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 hover:brightness-105 text-white font-black text-sm shadow-sm cursor-pointer disabled:opacity-60"
            >
              {loggingIn ? 'جاري التحقق...' : 'دخول لوحة التحكم'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white border-2 border-amber-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-black text-[#23140E]">لوحة إدارة منصة جَمْر</h1>
            <p className="text-xs font-bold text-[#6B4E40]">
              {stats
                ? `الغرف المباشرة: ${stats.totals.rooms} · المواضيع: ${stats.totals.topics} · الأسئلة: ${stats.totals.questions} · بلاغات جديدة: ${stats.totals.reportsNew}`
                : 'جاري تحميل الإحصائيات...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => void loadAdminData()}
            className="px-3.5 py-2 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-xs font-black text-[#23140E] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
            <span>تحديث</span>
          </button>
          <button
            onClick={() => {
              setToken('');
              window.sessionStorage.removeItem('jamr_admin_token');
              onExit();
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>تسجيل خروج</span>
          </button>
        </div>
      </div>

      {token === 'local_admin_session' && (
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
          <div className="font-bold leading-relaxed">
            🛠️ وضع الإدارة المحلي نشط (بسبب تقييد المتصفح لكوكيز الجلسة داخل الإطار المضمّن). تعديلاتك على الألعاب وأكواد الغش والبلاغات محفوظة وتعمل فوراً على هذا الجهاز.
          </div>
          <a
            href={typeof window !== 'undefined' ? window.location.href : '/'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-[11px] shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>افتح في تبويب مستقل للاتصال بالخادم ↗</span>
          </a>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-2xl">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'games', label: 'الألعاب والشعارات' },
          { id: 'cheats', label: `أكواد الغش (100 نوع) 🔐` },
          { id: 'dub_scenes', label: 'مشاهد مايك الدوبلاج 🎬' },
          { id: 'topics', label: 'مواضيع جَمْرَيْن' },
          { id: 'sections', label: 'الأقسام' },
          { id: 'questions', label: 'بنك الأسئلة' },
          { id: 'barrah', label: 'أقسام برا السالفة' },
          { id: 'mimic', label: 'تقليد الأصوات 🎙️' },
          { id: 'ai', label: 'مصمم الألعاب AI ✨' },
          { id: 'reports', label: `البلاغات (${store?.reports.filter((r) => r.status === 'new').length || 0})` },
          { id: 'rooms', label: 'الغرف والنسخ الاحتياطي' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as AdminTab)}
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer ${
              tab === t.id
                ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-sm'
                : 'bg-white text-[#5A3E32] border border-amber-200 hover:bg-amber-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: GAMES & LOGOS */}
      {tab === 'games' && store && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-[#23140E]">إدارة الألعاب ({store.games.length})</h2>
            <button
              onClick={async () => {
                const res = await authFetch('/api/admin/games/reset', { method: 'POST' });
                setStore((s) => (s ? { ...s, games: res.games } : s));
                onDataUpdated();
                showToast('تمت استعادة كتالوج الألعاب الافتراضي');
              }}
              className="px-4 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-xs font-black text-orange-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {store.games.map((g) => (
              <div key={g.id} className="rounded-2xl bg-white border border-amber-200 shadow-xs p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-xl bg-[#FFF8EE] border border-amber-200 flex items-center justify-center overflow-hidden shrink-0">
                    {g.imageUrl ? (
                      <img src={g.imageUrl} alt={g.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{g.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-[#23140E] text-sm truncate">{g.title}</div>
                    <div className="text-xs text-[#7C5D4F] truncate">{g.category}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    onClick={async () => {
                      const res = await authFetch(`/api/admin/games/${g.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ isMostPlayed: !g.isMostPlayed }),
                      });
                      setStore((s) => (s ? { ...s, games: s.games.map((x) => (x.id === g.id ? res.game : x)) } : s));
                      onDataUpdated();
                      showToast(res.game.isMostPlayed ? 'تم تثبيت اللعبة في الأكثر لعباً 🔥' : 'تمت الإزالة من الأكثر لعباً');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                      g.isMostPlayed
                        ? 'bg-gradient-to-l from-orange-500 to-rose-500 text-white shadow-xs'
                        : 'bg-[#FFF8EE] border border-amber-200 text-[#5A3E32]'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{g.isMostPlayed ? 'الأكثر لعباً 🔥' : 'تعيين الأكثر لعباً'}</span>
                  </button>
                  <button
                    onClick={() => setLogoModalGame(g)}
                    className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 border border-orange-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>تغيير الشعار 🎨</span>
                  </button>
                  <button
                    onClick={async () => {
                      const res = await authFetch(`/api/admin/games/${g.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ underMaintenance: !g.underMaintenance, isActive: g.underMaintenance }),
                      });
                      setStore((s) => (s ? { ...s, games: s.games.map((x) => (x.id === g.id ? res.game : x)) } : s));
                      onDataUpdated();
                      showToast('تم تحديث حالة الصيانة');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
                      g.underMaintenance ? 'bg-amber-400 text-[#23140E]' : 'bg-[#FFF8EE] border border-amber-200 text-[#5A3E32]'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{g.underMaintenance ? 'صيانة مفعّلة' : 'تفعيل الصيانة'}</span>
                  </button>
                  {g.isCustom && (
                    <button
                      onClick={async () => {
                        await authFetch(`/api/admin/games/${g.id}`, { method: 'DELETE' });
                        setStore((s) => (s ? { ...s, games: s.games.filter((x) => x.id !== g.id) } : s));
                        onDataUpdated();
                        showToast('تم حذف اللعبة');
                      }}
                      className="p-1.5 rounded-lg bg-rose-100 text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Custom Game */}
          <div className="rounded-2xl bg-white border border-amber-200 shadow-xs p-5 space-y-3">
            <h3 className="text-sm font-black text-orange-700">إضافة لعبة مخصصة جديدة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newGameTitle}
                onChange={(e) => setNewGameTitle(e.target.value)}
                placeholder="اسم اللعبة..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={newGameDesc}
                onChange={(e) => setNewGameDesc(e.target.value)}
                placeholder="وصف مختصر..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E] sm:col-span-2"
              />
            </div>
            <button
              onClick={async () => {
                if (!newGameTitle.trim()) return;
                const res = await authFetch('/api/admin/games', {
                  method: 'POST',
                  body: JSON.stringify({ title: newGameTitle.trim(), description: newGameDesc.trim() }),
                });
                setStore((s) => (s ? { ...s, games: [...s.games, res.game] } : s));
                setNewGameTitle('');
                setNewGameDesc('');
                onDataUpdated();
                showToast('تمت إضافة اللعبة');
              }}
              className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة اللعبة</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB: CHEAT CODES (100 TYPES) */}
      {tab === 'cheats' && store && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-amber-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-black text-[#23140E]">
                إنشاء كود غش سري (اختر من 100 نوع وظيفة + حدد الأحرف والأرقام)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#5A3E32] mb-1">الكود السري (أحرف/أرقام):</label>
                <input
                  type="text"
                  value={cheatCodeInput}
                  onChange={(e) => setCheatCodeInput(e.target.value)}
                  placeholder="مثال: VIP777 أو JAMR_WIN"
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm font-mono font-bold text-[#23140E]"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-[#5A3E32]">
                  اختر وظيفة الكود (1–100 نوع):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cheatEffectSearch}
                    onChange={(e) => setCheatEffectSearch(e.target.value)}
                    placeholder="ابحث داخل الـ 100 وظيفة..."
                    className="w-44 rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
                  />
                  <select
                    value={cheatEffectId}
                    onChange={(e) => setCheatEffectId(Number(e.target.value))}
                    className="flex-1 rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
                  >
                    {CHEAT_EFFECTS_CATALOG.filter(
                      (ef) =>
                        !cheatEffectSearch.trim() ||
                        ef.title.includes(cheatEffectSearch.trim()) ||
                        ef.category.includes(cheatEffectSearch.trim()) ||
                        String(ef.id) === cheatEffectSearch.trim()
                    ).map((ef) => (
                      <option key={ef.id} value={ef.id}>
                        #{ef.id} — {ef.badge} {ef.title} ({ef.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <input
              type="text"
              value={cheatDescInput}
              onChange={(e) => setCheatDescInput(e.target.value)}
              placeholder="ملاحظة أو وصف إضافي اختياري..."
              className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
            />

            <button
              onClick={async () => {
                if (!cheatCodeInput.trim()) return;
                const res = await authFetch('/api/admin/cheats', {
                  method: 'POST',
                  body: JSON.stringify({
                    code: cheatCodeInput.trim(),
                    effectId: cheatEffectId,
                    description: cheatDescInput.trim(),
                  }),
                });
                setStore((s) =>
                  s ? { ...s, cheatCodes: [res.cheat, ...(s.cheatCodes || [])] } : s
                );
                setCheatCodeInput('');
                setCheatDescInput('');
                showToast('تم إنشاء كود الغش السري بنجاح 🔐');
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>حفظ وتفعيل الكود السري</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(store.cheatCodes || []).map((ch: CheatCodeConfig) => (
              <div
                key={ch.id}
                className="rounded-2xl bg-white border border-amber-200 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-orange-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                      {ch.code}
                    </span>
                    <span className="text-[11px] font-bold text-[#7C5D4F]">
                      النوع #{ch.effectId} · استُخدم {ch.usageCount || 0} مرة
                    </span>
                  </div>
                  <div className="text-xs font-black text-[#23140E] truncate">{ch.effectTitle}</div>
                  {ch.description && <div className="text-[11px] text-[#6B4E40] truncate">{ch.description}</div>}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={async () => {
                      const res = await authFetch(`/api/admin/cheats/${ch.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ enabled: !ch.enabled }),
                      });
                      setStore((s) =>
                        s
                          ? {
                              ...s,
                              cheatCodes: (s.cheatCodes || []).map((x) =>
                                x.id === ch.id ? res.cheat : x
                              ),
                            }
                          : s
                      );
                      showToast(res.cheat.enabled ? 'تم تفعيل الكود' : 'تم تعطيل الكود');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                      ch.enabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {ch.enabled ? 'مفعّل' : 'معطّل'}
                  </button>
                  <button
                    onClick={async () => {
                      await authFetch(`/api/admin/cheats/${ch.id}`, { method: 'DELETE' });
                      setStore((s) =>
                        s
                          ? { ...s, cheatCodes: (s.cheatCodes || []).filter((x) => x.id !== ch.id) }
                          : s
                      );
                      showToast('تم حذف الكود');
                    }}
                    className="p-1.5 rounded-lg bg-rose-100 text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: DUB MIC SCENES MANAGEMENT */}
      {tab === 'dub_scenes' && store && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-amber-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-black text-[#23140E]">
                إضافة مشهد إنجليزي جديد للعبة مايك الدوبلاج
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={dubTitle}
                onChange={(e) => setDubTitle(e.target.value)}
                placeholder="عنوان المشهد بالعربي..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
              />
              <input
                type="text"
                value={dubWorkTitle}
                onChange={(e) => setDubWorkTitle(e.target.value)}
                placeholder="اسم العمل الإنجليزي (مثال: Classic Cartoon)..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
              />
              <input
                type="text"
                value={dubCat}
                onChange={(e) => setDubCat(e.target.value)}
                placeholder="التصنيف (كوميديا / أكشن / مغامرات)..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
              />
              <input
                type="url"
                value={dubVideoUrl}
                onChange={(e) => setDubVideoUrl(e.target.value)}
                placeholder="رابط الفيديو MP4 المباشر..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E] sm:col-span-2"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={dubStartSec}
                  onChange={(e) => setDubStartSec(Number(e.target.value))}
                  placeholder="البداية (ث)"
                  className="w-1/2 rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
                />
                <input
                  type="number"
                  value={dubEndSec}
                  onChange={(e) => setDubEndSec(Number(e.target.value))}
                  placeholder="النهاية (ث)"
                  className="w-1/2 rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
                />
              </div>
              <input
                type="text"
                value={dubDesc}
                onChange={(e) => setDubDesc(e.target.value)}
                placeholder="وصف المشهد..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E] sm:col-span-3"
              />
            </div>

            <button
              onClick={async () => {
                if (!dubTitle.trim() || !dubVideoUrl.trim()) return;
                const res = await authFetch('/api/admin/dub-scenes', {
                  method: 'POST',
                  body: JSON.stringify({
                    title: dubTitle.trim(),
                    workTitle: dubWorkTitle.trim() || 'Cartoon Scene',
                    category: dubCat.trim() || 'كوميديا كرتون',
                    videoUrl: dubVideoUrl.trim(),
                    clipStartSec: dubStartSec,
                    clipEndSec: dubEndSec,
                    description: dubDesc.trim(),
                  }),
                });
                setStore((s) =>
                  s ? { ...s, dubScenes: [res.scene, ...(s.dubScenes || [])] } : s
                );
                setDubTitle('');
                setDubVideoUrl('');
                setDubDesc('');
                onDataUpdated();
                showToast('تمت إضافة المشهد لمايك الدوبلاج 🎬');
              }}
              className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>حفظ المشهد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(store.dubScenes || []).map((sc: DubMicScene) => (
              <div
                key={sc.id}
                className="rounded-2xl bg-white border border-amber-200 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-black text-[#23140E] truncate">{sc.title}</div>
                  <div className="text-[11px] font-bold text-orange-700">
                    {sc.workTitle} · {sc.category} ({sc.clipStartSec}s–{sc.clipEndSec}s)
                  </div>
                  <div className="text-[10px] text-[#7C5D4F] truncate">{sc.videoUrl}</div>
                </div>
                <button
                  onClick={async () => {
                    await authFetch(`/api/admin/dub-scenes/${sc.id}`, { method: 'DELETE' });
                    setStore((s) =>
                      s ? { ...s, dubScenes: (s.dubScenes || []).filter((x) => x.id !== sc.id) } : s
                    );
                    onDataUpdated();
                    showToast('تم حذف المشهد');
                  }}
                  className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TOPICS */}
      {tab === 'topics' && store && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-amber-200 shadow-xs p-5 space-y-3">
            <h3 className="text-sm font-black text-orange-700">إضافة موضوع جديد لجَمْرَيْن</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="اسم الموضوع..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <select
                value={newTopicCat}
                onChange={(e) => setNewTopicCat(e.target.value)}
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              >
                {store.sections.map((sec) => (
                  <option key={sec.id} value={sec.name}>{sec.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={newTopicIcon}
                onChange={(e) => setNewTopicIcon(e.target.value)}
                placeholder="إيموجي"
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <button
                onClick={async () => {
                  if (!newTopicName.trim()) return;
                  const res = await authFetch('/api/admin/topics', {
                    method: 'POST',
                    body: JSON.stringify({ name: newTopicName.trim(), category: newTopicCat, icon: newTopicIcon }),
                  });
                  setStore((s) => (s ? { ...s, topics: [...s.topics, res.topic] } : s));
                  setNewTopicName('');
                  onDataUpdated();
                  showToast('تمت إضافة الموضوع');
                }}
                className="rounded-xl bg-orange-500 text-white font-black text-xs cursor-pointer"
              >
                + إضافة موضوع
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto">
            {store.topics.map((t) => (
              <div key={t.id} className="rounded-2xl bg-white border border-amber-200 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#FFF8EE] border border-amber-200 overflow-hidden flex items-center justify-center shrink-0">
                    {t.customImage || t.coverImage ? (
                      <img src={t.customImage || t.coverImage} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">{t.icon || '🔥'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-[#23140E] truncate">{t.name}</div>
                    <div className="text-[11px] text-[#7C5D4F] truncate">{t.category}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setTopicImgModal(t)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-black cursor-pointer"
                  >
                    صورة
                  </button>
                  <button
                    onClick={async () => {
                      await authFetch(`/api/admin/topics/${t.id}`, { method: 'DELETE' });
                      setStore((s) => (s ? { ...s, topics: s.topics.filter((x) => x.id !== t.id) } : s));
                      onDataUpdated();
                      showToast('تم حذف الموضوع');
                    }}
                    className="p-1.5 rounded-lg bg-rose-100 text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SECTIONS */}
      {tab === 'sections' && store && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-amber-200 p-5 flex flex-wrap gap-3">
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="اسم القسم..."
              className="flex-1 min-w-[200px] rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
            />
            <input
              type="text"
              value={newSectionIcon}
              onChange={(e) => setNewSectionIcon(e.target.value)}
              className="w-20 rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E] text-center"
            />
            <button
              onClick={async () => {
                if (!newSectionName.trim()) return;
                const res = await authFetch('/api/admin/sections', {
                  method: 'POST',
                  body: JSON.stringify({ name: newSectionName.trim(), icon: newSectionIcon }),
                });
                setStore((s) => (s ? { ...s, sections: [...s.sections, res.section] } : s));
                setNewSectionName('');
                onDataUpdated();
                showToast('تمت إضافة القسم');
              }}
              className="px-5 py-2 rounded-xl bg-orange-500 text-white font-black text-xs cursor-pointer"
            >
              + إضافة قسم
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {store.sections.map((sec: Section) => (
              <div key={sec.id} className="rounded-2xl bg-white border border-amber-200 p-4 flex items-center justify-between">
                <div className="font-black text-sm text-[#23140E]">
                  {sec.icon} {sec.name}
                </div>
                <button
                  onClick={async () => {
                    await authFetch(`/api/admin/sections/${sec.id}`, { method: 'DELETE' });
                    setStore((s) => (s ? { ...s, sections: s.sections.filter((x) => x.id !== sec.id) } : s));
                    onDataUpdated();
                    showToast('تم حذف القسم');
                  }}
                  className="p-1.5 rounded-lg bg-rose-100 text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: QUESTIONS BANK */}
      {tab === 'questions' && store && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-amber-200 p-5 space-y-3">
            <h3 className="text-sm font-black text-orange-700">إضافة سؤال جديد</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={qTopicId}
                onChange={(e) => setQTopicId(e.target.value)}
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              >
                {store.topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select
                value={qPoints}
                onChange={(e) => setQPoints(Number(e.target.value) as 200 | 400 | 600)}
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              >
                <option value={200}>200 نقطة</option>
                <option value={400}>400 نقطة</option>
                <option value={600}>600 نقطة</option>
              </select>
              <input
                type="text"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="نص السؤال..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={qAnswer}
                onChange={(e) => setQAnswer(e.target.value)}
                placeholder="الإجابة المعتمدة..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={qHint}
                onChange={(e) => setQHint(e.target.value)}
                placeholder="تلميح اختياري..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={qImage}
                onChange={(e) => setQImage(e.target.value)}
                placeholder="رابط صورة اختياري..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={qVideo}
                onChange={(e) => setQVideo(e.target.value)}
                placeholder="رابط فيديو يوتيوب/MP4 اختياري..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E] sm:col-span-2"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={async () => {
                  if (!qText.trim() || !qAnswer.trim()) return;
                  const res = await authFetch('/api/admin/questions', {
                    method: 'POST',
                    body: JSON.stringify({
                      topicId: qTopicId,
                      points: qPoints,
                      question: qText.trim(),
                      answer: qAnswer.trim(),
                      hint: qHint.trim(),
                      image: qImage.trim(),
                      video: qVideo.trim(),
                    }),
                  });
                  setStore((s) => (s ? { ...s, questions: [res.question, ...s.questions] } : s));
                  setQText('');
                  setQAnswer('');
                  setQHint('');
                  setQImage('');
                  setQVideo('');
                  onDataUpdated();
                  showToast('تمت إضافة السؤال بنجاح');
                }}
                className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-black text-xs cursor-pointer"
              >
                + حفظ السؤال
              </button>

              <button
                onClick={async () => {
                  if (!qTopicId) return;
                  showToast('جاري البحث في المواقع وتوليد 6 أسئلة موثّقة...');
                  try {
                    const r = await apiFetchJson<{ questions?: Question[]; error?: string }>(
                      '/api/jamrain/search-questions',
                      {
                        method: 'POST',
                        body: JSON.stringify({ topicId: qTopicId }),
                      },
                      { unlockStorageOnGesture: true }
                    );
                    if (!r.ok || !r.data) {
                      showToast(r.data?.error || 'تعذر البحث في الويب حالياً');
                      return;
                    }
                    const added: Question[] = Array.isArray(r.data.questions) ? r.data.questions : [];
                    if (added.length > 0) {
                      setStore((s) => (s ? { ...s, questions: [...added, ...s.questions] } : s));
                      onDataUpdated();
                      showToast(`تمت إضافة ${added.length} أسئلة موثّقة من الويب بنجاح!`);
                    } else {
                      showToast('لم يُعثر على أسئلة جديدة غير مكررة');
                    }
                  } catch {
                    showToast('تعذر الاتصال بخدمة البحث');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 font-black text-xs cursor-pointer"
              >
                🌐 بحث وجلب 6 أسئلة حقيقية من الويب لهذا الموضوع
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {store.questions.slice(0, 60).map((q: Question) => (
              <div key={q.id} className="rounded-xl bg-white border border-amber-200 p-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-black text-orange-600 tabular-nums">[{q.points}] </span>
                  {q.isWebResearched && <span className="text-emerald-700 font-black ml-1">[ويب 🌐]</span>}
                  <span className="font-bold text-[#23140E]">{q.question}</span>
                  <span className="text-emerald-700 font-bold mr-2">← {q.answer}</span>
                </div>
                <button
                  onClick={async () => {
                    await authFetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' });
                    setStore((s) => (s ? { ...s, questions: s.questions.filter((x) => x.id !== q.id) } : s));
                    onDataUpdated();
                    showToast('تم حذف السؤال');
                  }}
                  className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: BARRAH CATEGORIES */}
      {tab === 'barrah' && store && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-amber-200 p-5 space-y-3">
            <h3 className="text-sm font-black text-teal-700">إضافة قسم جديد لبرا السالفة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="اسم القسم..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={bIcon}
                onChange={(e) => setBIcon(e.target.value)}
                placeholder="أيقونة"
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={bDesc}
                onChange={(e) => setBDesc(e.target.value)}
                placeholder="وصف القسم..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
            </div>
            <textarea
              rows={2}
              value={bWordsText}
              onChange={(e) => setBWordsText(e.target.value)}
              placeholder="الكلمات مفصولة بفاصلة (مثال: قهوة، شاهي، موكا، ماتشا)..."
              className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
            />
            <button
              onClick={async () => {
                if (!bName.trim()) return;
                const words = bWordsText.split(/[،,]/).map((w) => w.trim()).filter(Boolean);
                const res = await authFetch('/api/admin/barrah/categories', {
                  method: 'POST',
                  body: JSON.stringify({ name: bName.trim(), icon: bIcon, description: bDesc, words }),
                });
                setStore((s) => (s ? { ...s, barrahCategories: [...s.barrahCategories, res.category] } : s));
                setBName('');
                setBDesc('');
                setBWordsText('');
                onDataUpdated();
                showToast('تمت إضافة قسم برا السالفة');
              }}
              className="px-5 py-2 rounded-xl bg-teal-600 text-white font-black text-xs cursor-pointer"
            >
              + إضافة القسم
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {store.barrahCategories.map((cat: BarrahCategory) => (
              <div key={cat.id} className="rounded-2xl bg-white border border-amber-200 p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-[#23140E] text-sm">{cat.icon} {cat.name}</div>
                  <div className="text-xs text-[#6B4E40] mt-1">{cat.words.length} كلمة: {cat.words.slice(0, 6).join('، ')}...</div>
                </div>
                <button
                  onClick={async () => {
                    await authFetch(`/api/admin/barrah/categories/${cat.id}`, { method: 'DELETE' });
                    setStore((s) => (s ? { ...s, barrahCategories: s.barrahCategories.filter((x) => x.id !== cat.id) } : s));
                    onDataUpdated();
                    showToast('تم حذف القسم');
                  }}
                  className="p-1.5 rounded-lg bg-rose-100 text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SOUND MIMIC BANK & AUDIO EXTRACTOR */}
      {tab === 'mimic' && store && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-xs font-bold text-amber-900">
            🔧 ملاحظة: لعبة "تقليد الأصوات" مقفلة تحت الصيانة أمام اللاعبين، ويمكنك هنا تجهيز مكتبة المقاطع الصوتية واستخراج الصوت من الفيديو أو الملفات الصوتية.
          </div>

          <div className="rounded-2xl bg-white border border-amber-200 p-5 space-y-4">
            <h3 className="text-sm font-black text-orange-700">استوديو استخراج وضغط الصوت</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
                placeholder="عنوان الصوت (مثال: ضحكة شريرة)..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={mCat}
                onChange={(e) => setMCat(e.target.value)}
                placeholder="التصنيف..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
              <input
                type="text"
                value={mHint}
                onChange={(e) => setMHint(e.target.value)}
                placeholder="تلميح للأداء..."
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-sm text-[#23140E]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="px-4 py-2.5 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-xs font-black text-[#23140E] cursor-pointer">
                <span>{extractingAudio ? 'جاري استخراج الصوت...' : 'اختر ملف صوت أو فيديو للاستخراج 🎵'}</span>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setExtractingAudio(true);
                    try {
                      const out = await extractAudioFromFile(file, 15);
                      setMAudioData(out.dataUrl);
                      setMDuration(out.durationSec);
                      showToast(`تم استخراج وضغط الصوت (${out.durationSec}ث)`);
                    } catch {
                      showToast('تعذّر استخراج الصوت من هذا الملف');
                    } finally {
                      setExtractingAudio(false);
                    }
                  }}
                />
              </label>

              {mAudioData && (
                <audio controls src={mAudioData} className="h-9" />
              )}

              <button
                onClick={async () => {
                  if (!mTitle.trim()) return;
                  const res = await authFetch('/api/admin/mimic/sounds', {
                    method: 'POST',
                    body: JSON.stringify({
                      title: mTitle.trim(),
                      category: mCat,
                      hint: mHint,
                      audioDataUrl: mAudioData || undefined,
                      durationSec: mDuration || undefined,
                    }),
                  });
                  setStore((s) => (s ? { ...s, mimicSounds: [res.sound, ...s.mimicSounds] } : s));
                  setMTitle('');
                  setMHint('');
                  setMAudioData('');
                  showToast('تم حفظ المقطع في بنك تقليد الأصوات');
                }}
                className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-black text-xs cursor-pointer"
              >
                + حفظ المقطع
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {store.mimicSounds.map((snd: MimicSound) => (
              <div key={snd.id} className="rounded-2xl bg-white border border-amber-200 p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-black text-[#23140E] text-sm flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-orange-500" />
                    <span>{snd.title}</span>
                  </div>
                  <div className="text-xs text-[#6B4E40]">{snd.category} {snd.durationSec ? `· ${snd.durationSec}ث` : ''}</div>
                  {snd.audioDataUrl && <audio controls src={snd.audioDataUrl} className="h-8 mt-1" />}
                </div>
                <button
                  onClick={async () => {
                    await authFetch(`/api/admin/mimic/sounds/${snd.id}`, { method: 'DELETE' });
                    setStore((s) => (s ? { ...s, mimicSounds: s.mimicSounds.filter((x) => x.id !== snd.id) } : s));
                    showToast('تم حذف المقطع');
                  }}
                  className="p-1.5 rounded-lg bg-rose-100 text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: AI GAME DESIGNER */}
      {tab === 'ai' && (
        <div className="rounded-3xl bg-white border-2 border-amber-200 p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-black text-[#23140E]">مصمم الألعاب الذكي للإدارة</h2>
          </div>
          <textarea
            rows={3}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="صف فكرة اللعبة الجديدة بالعربية (مثال: لعبة تحدي لهجات خليجية بين فريقين مع مؤقت)..."
            className="w-full rounded-2xl bg-[#FFF8EE] border border-amber-200 p-4 text-sm text-[#23140E]"
          />
          <button
            disabled={aiLoading || !aiPrompt.trim()}
            onClick={async () => {
              setAiLoading(true);
              try {
                const res = await authFetch('/api/admin/ai/games', {
                  method: 'POST',
                  body: JSON.stringify({ prompt: aiPrompt.trim() }),
                });
                setAiDraftGame(res.game);
                showToast('تم توليد تصميم اللعبة!');
              } finally {
                setAiLoading(false);
              }
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-sm cursor-pointer disabled:opacity-50"
          >
            {aiLoading ? 'جاري التصميم...' : 'توليد لعبة بالذكاء الاصطناعي ✨'}
          </button>

          {aiDraftGame && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-5 space-y-3">
              <div className="text-lg font-black text-[#23140E]">{aiDraftGame.icon} {aiDraftGame.title}</div>
              <p className="text-xs text-orange-700 font-bold">{aiDraftGame.subtitle}</p>
              <p className="text-sm text-[#5A3E32]">{aiDraftGame.description}</p>
              <ul className="text-xs text-[#23140E] list-disc pr-5 space-y-1">
                {aiDraftGame.rules.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <button
                onClick={async () => {
                  const res = await authFetch('/api/admin/games', {
                    method: 'POST',
                    body: JSON.stringify(aiDraftGame),
                  });
                  setStore((s) => (s ? { ...s, games: [...s.games, res.game] } : s));
                  setAiDraftGame(null);
                  onDataUpdated();
                  showToast('تم نشر اللعبة في الكتالوج!');
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs cursor-pointer"
              >
                اعتماد ونشر اللعبة في المنصة ✅
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 8: BUG REPORTS */}
      {tab === 'reports' && store && (
        <div className="space-y-3">
          {store.reports.length === 0 ? (
            <div className="rounded-2xl bg-white border border-amber-200 p-10 text-center text-[#7C5D4F] text-sm">
              لا توجد بلاغات حالياً.
            </div>
          ) : (
            store.reports.map((rep: BugReport) => (
              <div key={rep.id} className="rounded-2xl bg-white border border-amber-200 p-4 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-black text-orange-700">{rep.type}</span>
                    <span>·</span>
                    <span className="font-bold text-[#23140E]">{rep.gameTitle}</span>
                    <span>·</span>
                    <span className="text-[#7C5D4F]">بواسطة: {rep.reporterName}</span>
                    {rep.contact && <span className="text-teal-700 font-bold">({rep.contact})</span>}
                  </div>
                  <p className="text-sm text-[#3F291E] font-readex">{rep.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={rep.status}
                    onChange={async (e) => {
                      const res = await authFetch(`/api/admin/reports/${rep.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: e.target.value }),
                      });
                      setStore((s) =>
                        s ? { ...s, reports: s.reports.map((x) => (x.id === rep.id ? res.report : x)) } : s
                      );
                      showToast('تم تحديث حالة البلاغ');
                    }}
                    className="rounded-lg bg-[#FFF8EE] border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-[#23140E]"
                  >
                    <option value="new">جديد</option>
                    <option value="investigating">قيد المراجعة</option>
                    <option value="resolved">تم الحل</option>
                  </select>
                  <button
                    onClick={async () => {
                      await authFetch(`/api/admin/reports/${rep.id}`, { method: 'DELETE' });
                      setStore((s) => (s ? { ...s, reports: s.reports.filter((x) => x.id !== rep.id) } : s));
                      showToast('تم حذف البلاغ');
                    }}
                    className="p-1.5 rounded-lg bg-rose-100 text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 9: LIVE ROOMS & EXPORT/IMPORT */}
      {tab === 'rooms' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-amber-200 p-5 space-y-4">
            <h3 className="text-base font-black text-[#23140E]">الغرف المباشرة النشطة الآن ({stats?.liveRooms.length || 0})</h3>
            {stats && stats.liveRooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.liveRooms.map((r) => (
                  <div key={r.code} className="rounded-xl bg-[#FFF8EE] border border-amber-200 p-3.5 text-xs space-y-1">
                    <div className="font-black text-orange-700">غرفة {r.code}</div>
                    <div className="text-[#23140E] font-bold">اللعبة: {r.gameId} · الحالة: {r.status}</div>
                    <div className="text-[#6B4E40] tabular-nums">اللاعبون: {r.playersCount}/{r.maxPlayers}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#7C5D4F]">لا توجد غرف أونلاين مفتوحة في هذه اللحظة.</p>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-amber-200 p-5 space-y-4">
            <h3 className="text-base font-black text-[#23140E]">تصدير واستيراد النسخة الاحتياطية (JSON)</h3>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={async () => {
                  const data = await authFetch('/api/admin/export');
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `jamr_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('تم تصدير النسخة الاحتياطية');
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تصدير JSON كامل</span>
              </button>

              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs font-bold text-[#23140E]"
              >
                <option value="merge">استيراد بوضع الدمج (Merge)</option>
                <option value="replace">استيراد بوضع الاستبدال (Replace)</option>
              </select>

              <label className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>استيراد ملف JSON</span>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const text = await f.text();
                    const parsed = JSON.parse(text);
                    const res = await authFetch('/api/admin/import', {
                      method: 'POST',
                      body: JSON.stringify({ mode: importMode, data: parsed }),
                    });
                    setStore(res.store);
                    onDataUpdated();
                    showToast('تم استيراد البيانات بنجاح');
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* GAME LOGO MODAL */}
      {logoModalGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[#23140E]">تغيير شعار: {logoModalGame.title}</h3>
              <button onClick={() => setLogoModalGame(null)} className="cursor-pointer text-[#5A3E32]"><X className="w-5 h-5" /></button>
            </div>
            <label className="block w-full py-8 rounded-2xl border-2 border-dashed border-orange-300 bg-[#FFF8EE] text-center text-sm font-black text-orange-700 cursor-pointer hover:bg-amber-50">
              اضغط لرفع صورة شعار من جهازك (يتم ضغطها تلقائياً)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const compressed = await processStudioImageFile(file, 512, 512, 0.85);
                  const res = await authFetch(`/api/admin/games/${logoModalGame.id}/image`, {
                    method: 'PUT',
                    body: JSON.stringify({ imageUrl: compressed }),
                  });
                  setStore((s) =>
                    s ? { ...s, games: s.games.map((x) => (x.id === logoModalGame.id ? res.game : x)) } : s
                  );
                  setLogoModalGame(null);
                  onDataUpdated();
                  showToast('تم تحديث شعار اللعبة بنجاح');
                }}
              />
            </label>
            {logoModalGame.imageUrl && (
              <button
                onClick={async () => {
                  const res = await authFetch(`/api/admin/games/${logoModalGame.id}/image`, {
                    method: 'PUT',
                    body: JSON.stringify({ imageUrl: '' }),
                  });
                  setStore((s) =>
                    s ? { ...s, games: s.games.map((x) => (x.id === logoModalGame.id ? res.game : x)) } : s
                  );
                  setLogoModalGame(null);
                  onDataUpdated();
                  showToast('تمت إزالة الشعار المخصص');
                }}
                className="w-full py-2.5 rounded-xl bg-rose-100 text-rose-700 font-black text-xs cursor-pointer"
              >
                إزالة الشعار والرجوع للأيقونة الافتراضية
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOPIC IMAGE MODAL */}
      {topicImgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[#23140E]">صورة موضوع: {topicImgModal.name}</h3>
              <button onClick={() => setTopicImgModal(null)} className="cursor-pointer text-[#5A3E32]"><X className="w-5 h-5" /></button>
            </div>
            <label className="block w-full py-7 rounded-2xl border-2 border-dashed border-amber-300 bg-[#FFF8EE] text-center text-sm font-black text-amber-800 cursor-pointer hover:bg-amber-50">
              رفع صورة من جهازك
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const compressed = await processStudioImageFile(file, 480, 360, 0.82);
                  const res = await authFetch(`/api/admin/topics/${topicImgModal.id}/image`, {
                    method: 'PUT',
                    body: JSON.stringify({ imageUrl: compressed }),
                  });
                  setStore((s) =>
                    s ? { ...s, topics: s.topics.map((x) => (x.id === topicImgModal.id ? res.topic : x)) } : s
                  );
                  setTopicImgModal(null);
                  onDataUpdated();
                  showToast('تم تحديث صورة الموضوع');
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2 justify-center">
              {['🏆', '🎬', '🔬', '🌍', '🎮', '🍛', '🏛️', '🕌'].map((ic) => (
                <button
                  key={ic}
                  onClick={async () => {
                    const res = await authFetch(`/api/admin/topics/${topicImgModal.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ icon: ic }),
                    });
                    await authFetch(`/api/admin/topics/${topicImgModal.id}/image`, {
                      method: 'PUT',
                      body: JSON.stringify({ imageUrl: '' }),
                    });
                    setStore((s) =>
                      s ? { ...s, topics: s.topics.map((x) => (x.id === topicImgModal.id ? { ...res.topic, customImage: undefined, coverImage: undefined } : x)) } : s
                    );
                    setTopicImgModal(null);
                    onDataUpdated();
                    showToast('تم اختيار الأيقونة الكرتونية');
                  }}
                  className="w-10 h-10 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-xl cursor-pointer flex items-center justify-center"
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
