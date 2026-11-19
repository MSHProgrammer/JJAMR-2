import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  X,
  Gamepad2,
  AtSign,
  KeyRound,
  AlertTriangle,
  Database,
  RefreshCw,
  Plus,
  Trash2,
  QrCode,
  Copy,
  Check,
  Upload,
  Download,
  ExternalLink,
  Wrench,
  Star,
  Film,
  BookOpen,
} from 'lucide-react';
import {
  BarrahCategory,
  BugReport,
  CheatCodeConfig,
  DataStoreSnapshot,
  DubMicScene,
  GameConfig,
  ReservedUsernameRecord,
  Section,
  Topic,
} from '../types/jamr';
import { CHEAT_EFFECTS_CATALOG } from '../data/cheatCodesCatalog';
import { apiFetchJson } from '../utils/apiClient';
import { SoundFX } from '../utils/soundFx';

interface AdminPanelModalProps {
  adminToken: string;
  externalPortalUrl: string;
  onDataUpdated: () => void;
  onClose: () => void;
}

type AdminTab = 'games' | 'usernames' | 'cheats' | 'content' | 'reports' | 'sync';

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  adminToken,
  externalPortalUrl,
  onDataUpdated,
  onClose,
}) => {
  const [tab, setTab] = useState<AdminTab>('games');
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [games, setGames] = useState<GameConfig[]>([]);
  const [cheatCodes, setCheatCodes] = useState<CheatCodeConfig[]>([]);
  const [reservedUsernames, setReservedUsernames] = useState<ReservedUsernameRecord[]>([]);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [barrahCategories, setBarrahCategories] = useState<BarrahCategory[]>([]);
  const [dubScenes, setDubScenes] = useState<DubMicScene[]>([]);

  // Games editing
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editGameTitle, setEditGameTitle] = useState('');
  const [editGameSubtitle, setEditGameSubtitle] = useState('');
  const [editMaintNote, setEditMaintNote] = useState('');

  // New Custom Game
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameIcon, setNewGameIcon] = useState('🎲');
  const [newGameDesc, setNewGameDesc] = useState('');

  // Reserved Usernames
  const [newUsername, setNewUsername] = useState('');
  const [newUsernamePlus, setNewUsernamePlus] = useState(true);
  const [newUsernameNote, setNewUsernameNote] = useState('');
  const [activeQrPreview, setActiveQrPreview] = useState<{
    username: string;
    url: string;
    token: string;
    dataUrl: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cheats
  const [newCheatCode, setNewCheatCode] = useState('');
  const [newCheatEffectId, setNewCheatEffectId] = useState<number>(1);
  const [newCheatDesc, setNewCheatDesc] = useState('');

  // Barrah words quick-add
  const [selectedBarrahId, setSelectedBarrahId] = useState('');
  const [newBarrahWord, setNewBarrahWord] = useState('');

  // Sync / Backup Import
  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [bridgeKey, setBridgeKey] = useState('1100321');

  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
  };

  const notifySaved = (msg: string) => {
    setErrorMsg('');
    setSavingMsg(msg);
    onDataUpdated();
    window.setTimeout(() => {
      setSavingMsg((curr) => (curr === msg ? '' : curr));
    }, 3000);
  };

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    const [dataRes, bridgeRes] = await Promise.all([
      apiFetchJson<DataStoreSnapshot>('/api/admin/data', { headers: authHeaders }),
      apiFetchJson<{ ok?: boolean; bridgeConfig?: { bridgeKey?: string } }>('/api/admin/bridge', {
        headers: authHeaders,
      }),
    ]);

    setLoading(false);
    if (!dataRes.ok || !dataRes.data) {
      setErrorMsg('تعذر جلب بيانات الإدارة من الخادم. تأكد من تشغيل المنصة بالخادم الكامل.');
      return;
    }

    const d = dataRes.data;
    setGames(Array.isArray(d.games) ? d.games : []);
    setCheatCodes(Array.isArray(d.cheatCodes) ? d.cheatCodes : []);
    setReservedUsernames(Array.isArray(d.reservedUsernames) ? d.reservedUsernames : []);
    setReports(Array.isArray(d.reports) ? d.reports : []);
    setSections(Array.isArray(d.sections) ? d.sections : []);
    setTopics(Array.isArray(d.topics) ? d.topics : []);
    const bCats = Array.isArray(d.barrahCategories) ? d.barrahCategories : [];
    setBarrahCategories(bCats);
    if (bCats.length > 0 && !selectedBarrahId) {
      setSelectedBarrahId(bCats[0].id);
    }
    setDubScenes(Array.isArray(d.dubScenes) ? d.dubScenes : []);

    if (bridgeRes.ok && bridgeRes.data?.bridgeConfig?.bridgeKey) {
      setBridgeKey(bridgeRes.data.bridgeConfig.bridgeKey);
    }
  }, [adminToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAllAdminData();
  }, [loadAllAdminData]);

  const copyText = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    SoundFX.playClick();
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const buildClaimUrl = (rec: ReservedUsernameRecord) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();
    if (rec.qrToken) params.set('claim_qr', rec.qrToken);
    params.set('assign_username', rec.username);
    return `${origin}/?${params.toString()}`;
  };

  const openQrForReserved = async (rec: ReservedUsernameRecord) => {
    let targetRec = rec;
    if (!targetRec.qrToken) {
      const res = await apiFetchJson<{ ok?: boolean; usernameRecord?: ReservedUsernameRecord }>(
        `/api/admin/usernames/${encodeURIComponent(rec.id)}/qr`,
        { method: 'POST', headers: authHeaders }
      );
      if (res.ok && res.data?.usernameRecord) {
        targetRec = res.data.usernameRecord;
        setReservedUsernames((prev) => prev.map((x) => (x.id === targetRec.id ? targetRec : x)));
      }
    }
    const url = buildClaimUrl(targetRec);
    const dataUrl = await QRCode.toDataURL(url, {
      width: 340,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#23140E', light: '#FFFFFF' },
    });
    setActiveQrPreview({
      username: targetRec.username,
      url,
      token: targetRec.qrToken || '',
      dataUrl,
    });
  };

  // Game mutations
  const toggleGameField = async (
    g: GameConfig,
    patch: Partial<Pick<GameConfig, 'isActive' | 'underMaintenance' | 'isMostPlayed'>>
  ) => {
    const res = await apiFetchJson<{ game?: GameConfig }>(`/api/admin/games/${encodeURIComponent(g.id)}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(patch),
    });
    if (res.ok && res.data?.game) {
      setGames((prev) => prev.map((x) => (x.id === g.id ? res.data!.game! : x)));
      SoundFX.playCorrect();
      notifySaved(`تم تحديث «${g.title}» ومزامنتها فوراً مع الموقع ✅`);
    } else {
      setErrorMsg('تعذر حفظ التعديل.');
    }
  };

  const saveEditedGame = async (g: GameConfig) => {
    const res = await apiFetchJson<{ game?: GameConfig }>(`/api/admin/games/${encodeURIComponent(g.id)}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        title: editGameTitle,
        subtitle: editGameSubtitle,
        maintenanceNote: editMaintNote,
      }),
    });
    if (res.ok && res.data?.game) {
      setGames((prev) => prev.map((x) => (x.id === g.id ? res.data!.game! : x)));
      setEditingGameId(null);
      SoundFX.playCorrect();
      notifySaved(`تم حفظ تعديلات «${res.data.game.title}» ونشرها للموقع فوراً!`);
    }
  };

  const handleAddCustomGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameTitle.trim()) return;
    const res = await apiFetchJson<{ game?: GameConfig }>('/api/admin/games', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: newGameTitle.trim(),
        icon: newGameIcon.trim() || '🎲',
        description: newGameDesc.trim() || 'لعبة جماعية مضافة من الإدارة',
        supportsOffline: true,
        supportsOnline: false,
      }),
    });
    if (res.ok && res.data?.game) {
      setGames((prev) => [...prev, res.data!.game!]);
      setNewGameTitle('');
      setNewGameDesc('');
      SoundFX.playCorrect();
      notifySaved('تمت إضافة اللعبة الجديدة وظهرت في الرئيسية فوراً! 🎉');
    }
  };

  const handleDeleteGame = async (id: string) => {
    const res = await apiFetchJson(`/api/admin/games/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      setGames((prev) => prev.filter((g) => g.id !== id));
      notifySaved('تم حذف اللعبة من المنصة.');
    }
  };

  // Username mutations
  const handleCreateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newUsername.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || clean.length > 20) {
      setErrorMsg('اكتب يوزر نيم إنجليزي صحيح من 1 إلى 20 خانة.');
      return;
    }
    const res = await apiFetchJson<{ ok?: boolean; usernameRecord?: ReservedUsernameRecord; error?: string }>(
      '/api/admin/usernames',
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          username: clean,
          allowJamrPlus: newUsernamePlus,
          tier: newUsernamePlus ? 'vip' : 'standard',
          note: newUsernameNote.trim() || undefined,
        }),
      }
    );
    if (res.ok && res.data?.usernameRecord) {
      const rec = res.data.usernameRecord;
      setReservedUsernames((prev) => [rec, ...prev]);
      setNewUsername('');
      setNewUsernameNote('');
      SoundFX.playCorrect();
      notifySaved(`تم إصدار اليوزر نيم @${rec.username} وكود QR الخاص به بنجاح!`);
      void openQrForReserved(rec);
    } else {
      setErrorMsg(res.data?.error || 'تعذر إنشاء اليوزر نيم.');
    }
  };

  const handleDeleteUsername = async (id: string) => {
    const res = await apiFetchJson(`/api/admin/usernames/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      setReservedUsernames((prev) => prev.filter((u) => u.id !== id));
      notifySaved('تم حذف اليوزر نيم الإداري.');
    }
  };

  // Cheat mutations
  const handleAddCheat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheatCode.trim()) return;
    const res = await apiFetchJson<{ cheat?: CheatCodeConfig; error?: string }>('/api/admin/cheats', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: newCheatCode.trim().toUpperCase(),
        effectId: newCheatEffectId,
        description: newCheatDesc.trim() || undefined,
      }),
    });
    if (res.ok && res.data?.cheat) {
      setCheatCodes((prev) => [res.data!.cheat!, ...prev]);
      setNewCheatCode('');
      setNewCheatDesc('');
      SoundFX.playCorrect();
      notifySaved(`تم تفعيل كود الغش «${res.data.cheat.code}» على الموقع مباشرة!`);
    } else {
      setErrorMsg(res.data?.error || 'تعذر إضافة الكود.');
    }
  };

  const handleToggleCheat = async (c: CheatCodeConfig) => {
    const res = await apiFetchJson<{ cheat?: CheatCodeConfig }>(`/api/admin/cheats/${encodeURIComponent(c.id)}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    if (res.ok && res.data?.cheat) {
      setCheatCodes((prev) => prev.map((x) => (x.id === c.id ? res.data!.cheat! : x)));
      notifySaved('تم تحديث حالة الكود.');
    }
  };

  const handleDeleteCheat = async (id: string) => {
    const res = await apiFetchJson(`/api/admin/cheats/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      setCheatCodes((prev) => prev.filter((x) => x.id !== id));
      notifySaved('تم حذف الكود.');
    }
  };

  // Barrah add word
  const handleAddBarrahWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = barrahCategories.find((c) => c.id === selectedBarrahId);
    const word = newBarrahWord.trim();
    if (!cat || !word) return;
    const updatedWords = Array.from(new Set([word, ...cat.words]));
    const res = await apiFetchJson<{ category?: BarrahCategory }>(
      `/api/admin/barrah/categories/${encodeURIComponent(cat.id)}`,
      {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ words: updatedWords }),
      }
    );
    if (res.ok && res.data?.category) {
      setBarrahCategories((prev) => prev.map((x) => (x.id === cat.id ? res.data!.category! : x)));
      setNewBarrahWord('');
      SoundFX.playCorrect();
      notifySaved(`تمت إضافة «${word}» إلى ${cat.name}!`);
    }
  };

  // Reports
  const handleUpdateReport = async (id: string, status: BugReport['status']) => {
    const res = await apiFetchJson<{ report?: BugReport }>(`/api/admin/reports/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ status }),
    });
    if (res.ok && res.data?.report) {
      setReports((prev) => prev.map((r) => (r.id === id ? res.data!.report! : r)));
      notifySaved('تم تحديث حالة البلاغ.');
    }
  };

  // Import/Export Backup (supports jamr_backup JSON exported from aledara-jamr.vercel.app)
  const handleExportBackup = async () => {
    const res = await apiFetchJson<DataStoreSnapshot>('/api/admin/export', { headers: authHeaders });
    if (!res.ok || !res.data) return;
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jamr_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText);
      const res = await apiFetchJson<{ ok?: boolean }>('/api/admin/import', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ mode: importMode, data: parsed }),
      });
      if (res.ok && res.data?.ok) {
        SoundFX.playCorrect();
        setImportJsonText('');
        await loadAllAdminData();
        notifySaved('تم استيراد جميع التعديلات ومزامنتها مع الموقع الرئيسي فوراً! 🎉');
      } else {
        setErrorMsg('تعذر استيراد النسخة.');
      }
    } catch {
      setErrorMsg('ملف أو نص JSON غير صالح.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void handleImportJson(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#140B07]/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-3xl bg-[#FFFDF9] border-2 border-amber-400 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-amber-200 bg-gradient-to-l from-[#1E130B] via-[#2A190E] to-[#1A1008] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-amber-300">
                لوحة إدارة جَمْر المباشرة ⚡
              </h2>
              <p className="text-[11px] text-amber-100/80">
                أي تعديل تجريه هنا يظهر فوراً في الموقع الأساسي بدون إعادة تحميل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAllAdminData()}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
            <a
              href={`${externalPortalUrl}/#code=1100321`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-black inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>بوابة Vercel</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 p-3 bg-[#FFF8EE] border-b border-amber-200">
          {[
            { id: 'games', label: `الألعاب (${games.length})`, icon: Gamepad2 },
            { id: 'usernames', label: `اليوزرات والـ QR (${reservedUsernames.length})`, icon: AtSign },
            { id: 'cheats', label: `أكواد الغش (${cheatCodes.length})`, icon: KeyRound },
            { id: 'content', label: `المحتوى والمشاهد`, icon: BookOpen },
            { id: 'reports', label: `البلاغات (${reports.length})`, icon: AlertTriangle },
            { id: 'sync', label: `مزامنة واستيراد Vercel`, icon: Database },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setTab(item.id as AdminTab);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition ${
                  active
                    ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-sm'
                    : 'bg-white border border-amber-200 text-[#5A3E32] hover:bg-amber-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback Banners */}
        {(savingMsg || errorMsg) && (
          <div className="px-5 pt-3">
            {savingMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-2.5 text-xs font-black text-emerald-800">
                {savingMsg}
              </div>
            )}
            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-300 px-4 py-2.5 text-xs font-black text-rose-800">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {tab === 'games' && (
            <div className="space-y-5">
              {/* Quick Add Game */}
              <form
                onSubmit={handleAddCustomGame}
                className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black text-[#5A3E32] mb-1">الأيقونة</label>
                  <input
                    type="text"
                    value={newGameIcon}
                    onChange={(e) => setNewGameIcon(e.target.value)}
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-center text-base"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-black text-[#5A3E32] mb-1">اسم اللعبة الجديدة</label>
                  <input
                    type="text"
                    value={newGameTitle}
                    onChange={(e) => setNewGameTitle(e.target.value)}
                    placeholder="مثال: تحدي الألغاز السريع"
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-black text-[#5A3E32] mb-1">وصف مختصر</label>
                  <input
                    type="text"
                    value={newGameDesc}
                    onChange={(e) => setNewGameDesc(e.target.value)}
                    placeholder="وصف يظهر في البطاقة..."
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة</span>
                  </button>
                </div>
              </form>

              {/* Games List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {games.map((g) => {
                  const isEditing = editingGameId === g.id;
                  return (
                    <div
                      key={g.id}
                      className="rounded-2xl bg-white border-2 border-amber-200 p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl shrink-0">{g.icon}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-[#23140E] truncate">{g.title}</div>
                            <div className="text-[11px] text-[#7C5D4F] truncate">{g.subtitle}</div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                            g.underMaintenance || !g.isActive
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {g.underMaintenance ? 'صيانة 🔧' : g.isActive ? 'مفعّلة ✅' : 'متوقفة ⏸️'}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1 border-t border-amber-100">
                          <input
                            type="text"
                            value={editGameTitle}
                            onChange={(e) => setEditGameTitle(e.target.value)}
                            placeholder="العنوان"
                            className="w-full rounded-lg bg-[#FFF8EE] border border-amber-200 px-3 py-1.5 text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={editGameSubtitle}
                            onChange={(e) => setEditGameSubtitle(e.target.value)}
                            placeholder="العنوان الفرعي"
                            className="w-full rounded-lg bg-[#FFF8EE] border border-amber-200 px-3 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={editMaintNote}
                            onChange={(e) => setEditMaintNote(e.target.value)}
                            placeholder="رسالة الصيانة (اختياري)"
                            className="w-full rounded-lg bg-[#FFF8EE] border border-amber-200 px-3 py-1.5 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEditedGame(g)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-black cursor-pointer"
                            >
                              حفظ ونشر فوراً
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGameId(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => void toggleGameField(g, { isActive: !g.isActive })}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${
                              g.isActive
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-slate-100 border border-slate-200 text-slate-700'
                            }`}
                          >
                            {g.isActive ? 'تعطيل' : 'تفعيل'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void toggleGameField(g, { underMaintenance: !g.underMaintenance })
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1 cursor-pointer ${
                              g.underMaintenance
                                ? 'bg-rose-500 text-white'
                                : 'bg-amber-50 border border-amber-200 text-amber-800'
                            }`}
                          >
                            <Wrench className="w-3 h-3" />
                            <span>{g.underMaintenance ? 'إنهاء الصيانة' : 'وضع الصيانة'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleGameField(g, { isMostPlayed: !g.isMostPlayed })}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1 cursor-pointer ${
                              g.isMostPlayed
                                ? 'bg-amber-400 text-[#23140E]'
                                : 'bg-[#FFF8EE] border border-amber-200 text-[#5A3E32]'
                            }`}
                          >
                            <Star className="w-3 h-3" />
                            <span>{g.isMostPlayed ? 'الأكثر لعباً ★' : 'تمييز'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGameId(g.id);
                              setEditGameTitle(g.title);
                              setEditGameSubtitle(g.subtitle);
                              setEditMaintNote(g.maintenanceNote || '');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-black cursor-pointer"
                          >
                            تعديل النص
                          </button>
                          {g.isCustom && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteGame(g.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'usernames' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateUsername}
                className="rounded-2xl bg-[#FFF8EE] border-2 border-amber-200 p-4 space-y-3"
              >
                <div className="text-xs font-black text-orange-800">
                  إصدار يوزر نيم إداري + رابط & كود QR للاستلام الفوري 👑
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-[#5A3E32] mb-1">اليوزر نيم (إنجليزي)</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) =>
                        setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
                      }
                      dir="ltr"
                      placeholder="king_1"
                      className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-[#5A3E32] mb-1">ملاحظة / اسم اللاعب</label>
                    <input
                      type="text"
                      value={newUsernameNote}
                      onChange={(e) => setNewUsernameNote(e.target.value)}
                      placeholder="هدية VIP..."
                      className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2 py-2">
                    <input
                      id="plus_vip_chk"
                      type="checkbox"
                      checked={newUsernamePlus}
                      onChange={(e) => setNewUsernamePlus(e.target.checked)}
                      className="accent-orange-500 w-4 h-4"
                    />
                    <label htmlFor="plus_vip_chk" className="text-xs font-black text-[#23140E] cursor-pointer">
                      مع جَمْر بلس 👑
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white text-xs font-black cursor-pointer"
                    >
                      إنشاء + QR
                    </button>
                  </div>
                </div>
              </form>

              {activeQrPreview && (
                <div className="rounded-2xl bg-[#160F08] border-2 border-amber-400 p-4 text-amber-50 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={activeQrPreview.dataUrl}
                      alt={activeQrPreview.username}
                      className="w-28 h-28 rounded-xl bg-white p-1.5 border border-amber-400 shrink-0"
                    />
                    <div className="space-y-1.5 min-w-0">
                      <div className="text-sm font-black text-amber-300">
                        رابط وكود الاستلام ليوزر: @{activeQrPreview.username}
                      </div>
                      <div className="text-[11px] font-mono text-amber-200/90 break-all">
                        كود التفعيل: {activeQrPreview.token}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-300 break-all">
                        {activeQrPreview.url}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => copyText(activeQrPreview.url, 'qr_url')}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 text-[#140D05] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'qr_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>نسخ الرابط الكامل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(activeQrPreview.token, 'qr_tok')}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-amber-200 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الكود فقط</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveQrPreview(null)}
                    className="p-2 rounded-xl bg-white/10 text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reservedUsernames.map((rec) => {
                  const link = buildClaimUrl(rec);
                  return (
                    <div
                      key={rec.id}
                      className="rounded-2xl bg-white border border-amber-200 p-3.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-sm text-[#23140E]">@{rec.username}</span>
                          {rec.allowJamrPlus && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black">
                              بلس 👑
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                              rec.status === 'claimed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {rec.status === 'claimed' ? 'مُستلم ✅' : 'بانتظار الاستلام'}
                          </span>
                        </div>
                        {rec.note && <div className="text-[11px] text-[#7C5D4F] truncate mt-0.5">{rec.note}</div>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void openQrForReserved(rec)}
                          className="p-2 rounded-xl bg-[#23140E] text-amber-400 cursor-pointer"
                          title="عرض QR والرابط"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(link, rec.id)}
                          className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-orange-700 cursor-pointer"
                          title="نسخ رابط الاستلام"
                        >
                          {copiedKey === rec.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteUsername(rec.id)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'cheats' && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddCheat}
                className="rounded-2xl bg-[#FFF8EE] border-2 border-amber-200 p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-[#5A3E32] mb-1">رمز الكود السري</label>
                  <input
                    type="text"
                    value={newCheatCode}
                    onChange={(e) => setNewCheatCode(e.target.value.toUpperCase())}
                    placeholder="JAMR2025"
                    dir="ltr"
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-mono font-black"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-[#5A3E32] mb-1">الوظيفة (من 100 نوع غش)</label>
                  <select
                    value={newCheatEffectId}
                    onChange={(e) => setNewCheatEffectId(Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs font-bold"
                  >
                    {CHEAT_EFFECTS_CATALOG.map((ef) => (
                      <option key={ef.id} value={ef.id}>
                        #{ef.id} — {ef.badge} {ef.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#5A3E32] mb-1">وصف إضافي</label>
                  <input
                    type="text"
                    value={newCheatDesc}
                    onChange={(e) => setNewCheatDesc(e.target.value)}
                    placeholder="اختياري"
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-xs font-black cursor-pointer"
                  >
                    إضافة الكود
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {cheatCodes.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl bg-white border border-amber-200 p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-orange-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                          {c.code}
                        </span>
                        <span className="text-xs font-black text-[#23140E] truncate">{c.effectTitle}</span>
                      </div>
                      <div className="text-[11px] text-[#7C5D4F] truncate mt-0.5">{c.description}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleCheat(c)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${
                          c.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.enabled ? 'مفعّل' : 'معطّل'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCheat(c.id)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {cheatCodes.length === 0 && (
                  <p className="text-center text-xs text-[#7C5D4F] py-8">لم تُضف أكواد غش بعد.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'content' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3 text-center">
                  <div className="text-lg font-black text-orange-600">{sections.length}</div>
                  <div className="text-[11px] font-bold text-[#5A3E32]">أقسام جمرين</div>
                </div>
                <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3 text-center">
                  <div className="text-lg font-black text-orange-600">{topics.length}</div>
                  <div className="text-[11px] font-bold text-[#5A3E32]">موضوع ثقافي</div>
                </div>
                <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3 text-center">
                  <div className="text-lg font-black text-teal-600">{barrahCategories.length}</div>
                  <div className="text-[11px] font-bold text-[#5A3E32]">تصنيفات برا السالفة</div>
                </div>
                <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3 text-center">
                  <div className="text-lg font-black text-purple-600">{dubScenes.length}</div>
                  <div className="text-[11px] font-bold text-[#5A3E32]">مشاهد مايك الدوبلاج</div>
                </div>
              </div>

              <form
                onSubmit={handleAddBarrahWord}
                className="rounded-2xl bg-white border border-amber-200 p-4 space-y-3"
              >
                <div className="text-xs font-black text-[#23140E] flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-teal-600" />
                  <span>إضافة كلمة سريعة في لعبة «برا السالفة»</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedBarrahId}
                    onChange={(e) => setSelectedBarrahId(e.target.value)}
                    className="rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs font-bold"
                  >
                    {barrahCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name} ({c.words.length})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newBarrahWord}
                    onChange={(e) => setNewBarrahWord(e.target.value)}
                    placeholder="اكتب الكلمة الجديدة..."
                    className="flex-1 rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs font-bold"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-black cursor-pointer"
                  >
                    إضافة الكلمة
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-2.5">
              {reports.length === 0 ? (
                <div className="text-center text-xs text-[#7C5D4F] py-10">لا توجد بلاغات واردة حالياً ✅</div>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white border border-amber-200 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#23140E]">
                        {r.type} — {r.gameTitle}
                      </span>
                      <select
                        value={r.status}
                        onChange={(e) =>
                          void handleUpdateReport(r.id, e.target.value as BugReport['status'])
                        }
                        className="rounded-lg bg-[#FFF8EE] border border-amber-200 px-2 py-1 text-[11px] font-black"
                      >
                        <option value="new">جديد</option>
                        <option value="investigating">قيد المراجعة</option>
                        <option value="resolved">تم الحل ✅</option>
                      </select>
                    </div>
                    <p className="text-xs text-[#5A3E32]">{r.description}</p>
                    <div className="text-[10px] text-[#8C6D5E]">بواسطة: {r.reporterName}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'sync' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#1A1008] border border-amber-400/60 p-4 text-amber-50 space-y-2">
                <div className="text-xs font-black text-amber-300">
                  ربط بوابة الإدارة المستقلة (aledara-jamr.vercel.app)
                </div>
                <p className="text-[11px] text-amber-100/80 leading-relaxed">
                  لأن موقع الإدارة الخارجي على Vercel موقع ثابت بدون خادم، أدخل عنوان هذا الموقع أدناه في إعدادات الجسر داخل موقع Vercel لتنتقل تعديلاته مباشرة، أو استورد ملف النسخة الاحتياطية (JSON) هنا فوراً:
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-amber-200">رابط الجسر:</span>
                  <code className="px-2 py-1 rounded-lg bg-black/50 text-emerald-300 font-mono">
                    {currentOrigin}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(currentOrigin, 'origin')}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 text-[#140D05] text-[11px] font-black cursor-pointer"
                  >
                    {copiedKey === 'origin' ? 'تم النسخ ✅' : 'نسخ الرابط'}
                  </button>
                  <span className="font-bold text-amber-200">المفتاح:</span>
                  <code className="px-2 py-1 rounded-lg bg-black/50 text-amber-300 font-mono">
                    {bridgeKey}
                  </code>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-amber-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-black text-[#23140E]">
                    استيراد أو تصدير نسخة البيانات الكاملة (JSON)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleExportBackup()}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير نسخة JSON</span>
                    </button>
                    <label className="px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع ملف JSON من Vercel</span>
                      <input type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-bold text-[#5A3E32]">
                  <span>وضع الاستيراد:</span>
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`px-3 py-1 rounded-lg cursor-pointer ${
                      importMode === 'merge' ? 'bg-orange-500 text-white' : 'bg-[#FFF8EE]'
                    }`}
                  >
                    دمج ذكي (Merge)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1 rounded-lg cursor-pointer ${
                      importMode === 'replace' ? 'bg-rose-600 text-white' : 'bg-[#FFF8EE]'
                    }`}
                  >
                    استبدال كامل (Replace)
                  </button>
                </div>

                <textarea
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  rows={4}
                  placeholder='الصق محتوى ملف jamr_backup.json هنا لاستيراده ومزامنته مباشرة...'
                  dir="ltr"
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 p-3 text-xs font-mono"
                />
                {importJsonText.trim() && (
                  <button
                    type="button"
                    onClick={() => void handleImportJson(importJsonText)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white text-xs font-black cursor-pointer"
                  >
                    تطبيق ومزامنة البيانات الآن ⚡
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
