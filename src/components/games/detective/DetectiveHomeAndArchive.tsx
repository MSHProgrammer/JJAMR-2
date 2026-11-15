import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileSearch,
  Filter,
  FolderOpen,
  HelpCircle,
  Lock,
  MapPin,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  Skull,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type {
  DetectiveCasePublic,
  DetectiveCaseStatus,
  DetectiveCategory,
  DetectiveDifficulty,
  DetectivePlayerCaseProgress,
  DetectiveProfileStats,
} from '../../../types/detective.ts';
import {
  DETECTIVE_CATEGORIES,
  DIFFICULTY_LEVELS,
  getDetectiveRank,
} from '../../../data/detectivePublicCases.ts';
import { getCaseStatusBadge, getDifficultyMeta } from './detectiveTheme.ts';

interface DetectiveHomeAndArchiveProps {
  cases: DetectiveCasePublic[];
  profile: DetectiveProfileStats;
  subView: 'home' | 'archive' | 'detail' | 'completed';
  selectedCaseId: string;
  isMultiplayer?: boolean;
  onChangeSubView: (view: 'home' | 'archive' | 'detail' | 'completed') => void;
  onSelectCase: (caseId: string, openDetail?: boolean) => void;
  onStartInvestigation: (caseId: string) => void;
  onResetCaseProgress: (caseId: string) => void;
  onBackToJamr?: () => void;
}

export const DetectiveHomeAndArchive: React.FC<DetectiveHomeAndArchiveProps> = ({
  cases,
  profile,
  subView,
  selectedCaseId,
  isMultiplayer = false,
  onChangeSubView,
  onSelectCase,
  onStartInvestigation,
  onResetCaseProgress,
  onBackToJamr,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DetectiveDifficulty>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DetectiveCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DetectiveCaseStatus>('all');
  const [sortBy, setSortBy] = useState<'order' | 'difficulty' | 'recent'>('order');
  const [showGuide, setShowGuide] = useState(false);

  const rankInfo = useMemo(() => getDetectiveRank(profile.totalPoints), [profile.totalPoints]);

  const getStatusForCase = (caseId: string): DetectiveCaseStatus => {
    const p: DetectivePlayerCaseProgress | undefined = profile.progressByCase[caseId];
    if (!p) return 'open';
    return p.status;
  };

  const lastInProgressCase = useMemo(() => {
    const entries = Object.values(profile.progressByCase)
      .filter((p) => p.status === 'in_progress')
      .sort((a, b) => (b.lastUpdatedAt || 0) - (a.lastUpdatedAt || 0));
    if (entries.length > 0) {
      return cases.find((c) => c.id === entries[0].caseId) || cases[0];
    }
    return cases[0];
  }, [cases, profile.progressByCase]);

  const filteredCases = useMemo(() => {
    const diffRank: Record<DetectiveDifficulty, number> = {
      beginner: 1,
      detective: 2,
      expert: 3,
      genius: 4,
      legendary: 5,
    };

    const list = cases.filter((c) => {
      const status = getStatusForCase(c.id);
      if (subView === 'completed' && status !== 'closed') return false;
      if (difficultyFilter !== 'all' && c.difficulty !== difficultyFilter) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${c.caseNumber} ${c.title} ${c.subtitle} ${c.location} ${c.categoryLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'difficulty') return diffRank[a.difficulty] - diffRank[b.difficulty];
      if (sortBy === 'recent') {
        const tA = profile.progressByCase[a.id]?.lastUpdatedAt || 0;
        const tB = profile.progressByCase[b.id]?.lastUpdatedAt || 0;
        return tB - tA;
      }
      return a.orderIndex - b.orderIndex;
    });
  }, [cases, subView, difficultyFilter, categoryFilter, statusFilter, searchQuery, sortBy, profile.progressByCase]);

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || cases[0],
    [cases, selectedCaseId]
  );

  const renderSkulls = (count: number) => (
    <div className="flex items-center gap-0.5" aria-label={`صعوبة ${count} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Skull
          key={i}
          size={13}
          className={i <= count ? 'text-[#C89B3C]' : 'text-[#393640]'}
        />
      ))}
    </div>
  );

  // =========================================================================
  // SUB-VIEW 1: HOME SCREEN
  // =========================================================================
  if (subView === 'home') {
    const solvedCount = profile.solvedCaseIds.length;
    return (
      <div className="space-y-6">
        {/* Hero Noir Archive Header Banner */}
        <div className="relative rounded-3xl overflow-hidden border border-[#C89B3C]/30 bg-[#0D0C10] shadow-2xl">
          <div className="relative h-64 sm:h-80 overflow-hidden">
            <img
              src="/assets/detective/hero_desk.jpg"
              alt="مكتب التحقيق السري"
              className="w-full h-full object-cover opacity-55 scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09080A] via-[#09080A]/65 to-[#09080A]/30" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#09080A]/90 via-transparent to-[#09080A]/75" />

            {/* Top bar inside hero */}
            <div className="absolute top-4 inset-x-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 bg-[#131217]/90 border border-[#C89B3C]/35 px-3 py-1.5 rounded-xl backdrop-blur-md">
                <span className="text-lg">{rankInfo.current.badge}</span>
                <div>
                  <p className="text-[11px] text-[#C89B3C] font-bold tracking-wide">
                    {rankInfo.current.title} • المستوى {rankInfo.current.level}
                  </p>
                  <p className="text-[10px] text-[#9FA3AE]">
                    {profile.totalPoints} نقطة • {solvedCount} من {cases.length} قضايا محلولة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="bg-[#1A181F]/90 hover:bg-[#25222C] text-[#F3EFE6] border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <HelpCircle size={14} className="text-[#C89B3C]" />
                  دليل المحقق
                </button>
                {onBackToJamr && (
                  <button
                    type="button"
                    onClick={onBackToJamr}
                    className="bg-[#1A181F]/90 hover:bg-[#25222C] text-[#9FA3AE] hover:text-white border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                  >
                    العودة لجَمْر
                  </button>
                )}
              </div>
            </div>

            {/* Hero Titles */}
            <div className="absolute bottom-5 inset-x-5 sm:inset-x-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#C89B3C] font-bold mb-1">
                  THE SMART DETECTIVE — SECRET ARCHIVE
                </p>
                <h1 className="text-3xl sm:text-5xl font-black text-[#F3EFE6] drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
                  المحقق الشاطر
                </h1>
                <p className="text-sm sm:text-base text-[#D9D3C7] mt-1.5 font-medium max-w-xl">
                  «كل تفصيل يخفي حقيقة... وكل دليل يقربك منها»
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {lastInProgressCase && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCase(lastInProgressCase.id, false);
                      onStartInvestigation(lastInProgressCase.id);
                    }}
                    className="bg-[#7A1219] hover:bg-[#991922] text-[#F3EFE6] border border-[#C89B3C]/40 px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-xl shadow-[#7A1219]/30 transition active:scale-[0.98]"
                  >
                    <Play size={16} />
                    {profile.progressByCase[lastInProgressCase.id]?.status === 'in_progress'
                      ? `استكمال: ${lastInProgressCase.title}`
                      : `ابدأ قضية: ${lastInProgressCase.title}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChangeSubView('archive')}
                  className="bg-[#1E1714]/95 hover:bg-[#2A201B] text-[#E5C16C] border border-[#C89B3C]/45 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition"
                >
                  <FolderOpen size={16} />
                  أرشيف القضايا
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Navigation Strip + Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onChangeSubView('archive')}
            className="text-right bg-[#131217] hover:bg-[#19171E] border border-[#C89B3C]/25 rounded-2xl p-4 transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <FolderOpen size={18} className="text-[#C89B3C]" />
              <span className="text-xs font-mono text-[#9FA3AE]">{cases.length} / 100 ملف</span>
            </div>
            <p className="font-black text-[#F3EFE6] text-sm group-hover:text-[#E5C16C]">أرشيف القضايا</p>
            <p className="text-[11px] text-[#9FA3AE] mt-0.5">تصفح القضايا حسب الصعوبة والنوع</p>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubView('completed')}
            className="text-right bg-[#131217] hover:bg-[#19171E] border border-white/10 rounded-2xl p-4 transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 size={18} className="text-[#8DE098]" />
              <span className="text-xs font-mono text-[#8DE098]">{solvedCount} مغلقة</span>
            </div>
            <p className="font-black text-[#F3EFE6] text-sm">سجل القضايا المنجزة</p>
            <p className="text-[11px] text-[#9FA3AE] mt-0.5">مراجعة الحلول والملاحظات السابقة</p>
          </button>

          <div className="bg-[#131217] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Award size={18} className="text-[#E5C16C]" />
              <span className="text-xs font-bold text-[#E5C16C]">{profile.totalPoints} ن</span>
            </div>
            <p className="font-black text-[#F3EFE6] text-sm">{rankInfo.current.title}</p>
            <p className="text-[11px] text-[#9FA3AE] mt-0.5">
              {rankInfo.next
                ? `متبقٍ ${rankInfo.next.minPoints - profile.totalPoints} نقطة للرتبة التالية`
                : 'وصلت أعلى رتبة تحقيق!'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="text-right bg-[#131217] hover:bg-[#19171E] border border-white/10 rounded-2xl p-4 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <BookOpen size={18} className="text-[#F08088]" />
              <span className="text-[11px] text-[#9FA3AE]">قواعد اللعب</span>
            </div>
            <p className="font-black text-[#F3EFE6] text-sm">دليل المحقق الشاطر</p>
            <p className="text-[11px] text-[#9FA3AE] mt-0.5">كيف تفحص المشهد وتربط الخيوط؟</p>
          </button>
        </div>

        {/* Five Difficulty Tiers Overview (Scaled for 100 Cases Architecture) */}
        <div className="bg-[#131217] border border-[#C89B3C]/20 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-black text-base text-[#F3EFE6] flex items-center gap-2">
                <ShieldAlert size={18} className="text-[#C89B3C]" />
                مسارات الأرشيف السري (٥ مستويات صعوبة)
              </h2>
              <p className="text-xs text-[#9FA3AE] mt-0.5">
                منظومة ملفات مصنفة من ١ إلى ٥ درجات صعوبة — ٥ قضايا متكاملة متاحة الآن ضمن بنية أرشيف من ١٠٠ ملف
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeSubView('archive')}
              className="text-xs font-bold text-[#C89B3C] hover:underline"
            >
              عرض كل الملفات ←
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {DIFFICULTY_LEVELS.map((lvl) => {
              const lvlCases = cases.filter((c) => c.difficulty === lvl.id);
              const lvlSolved = lvlCases.filter((c) => profile.solvedCaseIds.includes(c.id)).length;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => {
                    setDifficultyFilter(lvl.id);
                    onChangeSubView('archive');
                  }}
                  className="text-right bg-[#0D0C10] hover:bg-[#19171E] border border-white/10 hover:border-[#C89B3C]/45 rounded-xl p-3.5 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${lvl.bgClass} ${lvl.borderClass}`}>
                      {lvl.label}
                    </span>
                    {renderSkulls(lvl.skulls)}
                  </div>
                  <p className="text-xs font-bold text-[#F3EFE6]">
                    {lvlSolved} / {lvlCases.length} متاحة محلولة
                  </p>
                  <p className="text-[10px] text-[#9FA3AE] mt-1">
                    المكافأة الأساسية: {lvl.basePoints} نقطة
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Cases Cards Strip */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-base text-[#F3EFE6] flex items-center gap-2">
              <FileSearch size={18} className="text-[#C89B3C]" />
              الملفات النشطة للتحقيق الفوري
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cases.map((c) => {
              const status = getStatusForCase(c.id);
              const badge = getCaseStatusBadge(status);
              const diff = getDifficultyMeta(c.difficulty);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCase(c.id, true)}
                  className="text-right bg-[#131217] hover:bg-[#191720] border border-white/10 hover:border-[#C89B3C]/50 rounded-2xl overflow-hidden shadow-xl transition group flex flex-col"
                >
                  <div className="relative h-44 overflow-hidden bg-black">
                    <img
                      src={c.coverImage}
                      alt={c.title}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131217] via-[#131217]/30 to-transparent" />
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span className="bg-[#09080A]/85 border border-[#C89B3C]/40 text-[#E5C16C] text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                        {c.caseNumber}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="absolute top-3 left-3 bg-[#09080A]/80 px-2 py-1 rounded border border-white/10">
                      {renderSkulls(diff.skulls)}
                    </div>
                    <div className="absolute bottom-3 inset-x-4">
                      <span className="text-[10px] text-[#C89B3C] font-bold">{c.categoryLabel}</span>
                      <h3 className="text-lg font-black text-[#F3EFE6] group-hover:text-[#E5C16C] transition">
                        {c.title}
                      </h3>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <p className="text-xs text-[#9FA3AE] leading-relaxed line-clamp-2">{c.teaser}</p>
                    <div className="flex items-center justify-between text-[11px] text-[#9FA3AE] pt-2 border-t border-white/5">
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-[#C89B3C]" />
                        {c.suspects.length} مشتبه
                      </span>
                      <span className="flex items-center gap-1">
                        <FileSearch size={12} className="text-[#C89B3C]" />
                        {c.evidence.length} أدلة
                      </span>
                      <span className={`font-bold ${diff.bgClass} px-2 py-0.5 rounded`}>
                        {diff.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Beginner Detective Guide Modal */}
        {showGuide && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#131217] border border-[#C89B3C]/40 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-black text-lg text-[#F3EFE6] flex items-center gap-2">
                  <Sparkles size={18} className="text-[#C89B3C]" />
                  دليل المحقق الشاطر
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="text-[#9FA3AE] hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3 text-xs sm:text-sm text-[#D8D3C9] leading-relaxed">
                <div className="bg-[#1E1714] border border-[#C89B3C]/25 rounded-xl p-3">
                  <p className="font-black text-[#E5C16C] mb-1">١. افحص مسرح الحادثة بعناية</p>
                  <p className="text-[#9FA3AE] text-xs">
                    انقر على النقاط الساخنة (Hotspots) فوق صورة القضية لاكتشاف آثار خفية وفتح أدلة جديدة وإضافتها لملفك.
                  </p>
                </div>
                <div className="bg-[#1E1714] border border-[#C89B3C]/25 rounded-xl p-3">
                  <p className="font-black text-[#E5C16C] mb-1">٢. استجوب المشتبه بهم واكشف الكذب</p>
                  <p className="text-[#9FA3AE] text-xs">
                    راجع عذر كل مشتبه (Alibi)، ثم اطرح أسئلة التحقيق الذكية لكشف التناقض الزمني أو المادي بين أقوالهم والوثائق.
                  </p>
                </div>
                <div className="bg-[#1E1714] border border-[#C89B3C]/25 rounded-xl p-3">
                  <p className="font-black text-[#E5C16C] mb-1">٣. اربط الخيوط على لوحة التحقيق</p>
                  <p className="text-[#9FA3AE] text-xs">
                    ثبّت بطاقات المشتبهين والأدلة والخط الزمني على لوحة التحقيق واربطها بالخيوط الحمراء لتكوين الصورة الكاملة.
                  </p>
                </div>
                <div className="bg-[#1E1714] border border-[#C89B3C]/25 rounded-xl p-3">
                  <p className="font-black text-[#E5C16C] mb-1">٤. قدّم اتهامك الحاسم</p>
                  <p className="text-[#9FA3AE] text-xs">
                    عندما تتيقن من المسؤول والدليل القاطع، انتقل إلى «قدّم اتهامك» وحدد الجاني! في اللعب الجماعي يظل تصويتك سرياً حتى إغلاق القضية.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full bg-[#7A1219] hover:bg-[#961820] text-white py-2.5 rounded-xl font-black text-sm"
              >
                فهمت — مستعد للتحقيق
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SUB-VIEW 2: CASE DETAIL DOSSIER SCREEN
  // =========================================================================
  if (subView === 'detail' && selectedCase) {
    const status = getStatusForCase(selectedCase.id);
    const badge = getCaseStatusBadge(status);
    const diff = getDifficultyMeta(selectedCase.difficulty);
    const prog = profile.progressByCase[selectedCase.id];

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onChangeSubView('archive')}
            className="bg-[#131217] hover:bg-[#1E1B24] text-[#F3EFE6] border border-white/10 px-4 py-2 rounded-xl text-xs font-bold"
          >
            ← العودة للأرشيف
          </button>
          <span className="text-xs font-mono text-[#C89B3C]">ملف رقم {selectedCase.caseNumber}</span>
        </div>

        {/* Split Aged Dossier Sheet */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#131217] border border-[#C89B3C]/35 rounded-3xl p-4 sm:p-6 shadow-2xl">
          {/* Scene Photo + Polaroids */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-[#C89B3C]/30 bg-black shadow-xl">
              <img
                src={selectedCase.coverImage}
                alt={selectedCase.title}
                className="w-full h-64 sm:h-72 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              <div className="absolute top-3 right-3">
                <span className={`text-xs font-black px-3 py-1 rounded-lg border shadow ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-xs text-[#E5C16C] font-bold">
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {selectedCase.location}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={13} />
                  {selectedCase.inStoryTime}
                </span>
              </div>
            </div>

            {/* Suspects preview strip */}
            <div className="bg-[#1E1714] border border-[#C89B3C]/20 rounded-2xl p-3.5">
              <p className="text-[11px] font-bold text-[#C89B3C] mb-2.5">
                المشتبه بهم المسجلون ({selectedCase.suspects.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedCase.suspects.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 bg-[#131217] border border-white/10 px-2.5 py-1.5 rounded-xl"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-[#F3EFE6] border border-[#C89B3C]/50"
                      style={{ backgroundColor: s.accentTone }}
                    >
                      {s.monogram}
                    </span>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-[#F3EFE6] leading-tight">{s.name}</p>
                      <p className="text-[9px] text-[#9FA3AE]">{s.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dossier Details & Facts */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-xs font-bold text-[#C89B3C]">{selectedCase.categoryLabel}</span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#F3EFE6] mt-0.5">
                    {selectedCase.title}
                  </h2>
                  <p className="text-xs text-[#9FA3AE] mt-1">{selectedCase.subtitle}</p>
                </div>
                <div className="bg-[#0D0C10] border border-[#C89B3C]/30 rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] text-[#9FA3AE] mb-1">مستوى الصعوبة</p>
                  <div className="flex items-center gap-2">
                    {renderSkulls(diff.skulls)}
                    <span className="text-xs font-black text-[#E5C16C]">{diff.label}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#1A181F] border border-white/10 rounded-2xl p-4">
                <p className="text-xs font-bold text-[#C89B3C] mb-1.5">ملخص البلاغ السري</p>
                <p className="text-sm text-[#F3EFE6] leading-relaxed">{selectedCase.briefingNarrative}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-[#C89B3C] mb-2">الحقائق الأولية المثبتة</p>
                <ul className="space-y-2">
                  {selectedCase.initialFacts.map((fact, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-[#D8D3C9] bg-[#0D0C10]/80 border border-white/5 rounded-xl px-3 py-2"
                    >
                      <span className="text-[#C89B3C] font-black mt-0.5">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-2.5">
                  <p className="text-[10px] text-[#9FA3AE]">نقاط الفوز</p>
                  <p className="text-sm font-black text-[#E5C16C]">+{selectedCase.baseRewardPoints}</p>
                </div>
                <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-2.5">
                  <p className="text-[10px] text-[#9FA3AE]">الأدلة والنقاط</p>
                  <p className="text-sm font-black text-[#F3EFE6]">
                    {selectedCase.evidence.length} / {selectedCase.hotspots.length}
                  </p>
                </div>
                <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-2.5">
                  <p className="text-[10px] text-[#9FA3AE]">الزمن التقديري</p>
                  <p className="text-sm font-black text-[#F3EFE6]">{selectedCase.estimatedMinutes} دقيقة</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onStartInvestigation(selectedCase.id)}
                className="flex-1 min-w-[200px] bg-[#7A1219] hover:bg-[#991821] text-[#F3EFE6] border border-[#C89B3C]/45 py-3.5 px-6 rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-[#7A1219]/35 transition active:scale-[0.98]"
              >
                <Play size={18} />
                {status === 'in_progress'
                  ? 'متابعة التحقيق المفتوح'
                  : status === 'closed'
                  ? 'فتح الملف والمراجعة'
                  : 'ابدأ التحقيق'}
              </button>

              {prog && !isMultiplayer && (
                <button
                  type="button"
                  onClick={() => onResetCaseProgress(selectedCase.id)}
                  className="bg-[#1E1714] hover:bg-[#2B201C] text-[#9FA3AE] hover:text-white border border-white/10 px-4 py-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  إعادة التحقيق من البداية
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUB-VIEW 3: ARCHIVE & COMPLETED CASES LOG
  // =========================================================================
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131217] border border-[#C89B3C]/25 rounded-2xl p-4">
        <div>
          <h2 className="font-black text-xl text-[#F3EFE6] flex items-center gap-2">
            <FolderOpen size={20} className="text-[#C89B3C]" />
            {subView === 'completed' ? 'سجل القضايا المنجزة والمغلقة' : 'أرشيف قضايا المحقق الشاطر'}
          </h2>
          <p className="text-xs text-[#9FA3AE] mt-0.5">
            {subView === 'completed'
              ? 'جميع القضايا التي أغلقتها ونجحت في حلها'
              : 'ابحث وصفِّ حسب الصعوبة أو التصنيف أو حالة الملف'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeSubView('home')}
            className="bg-[#1E1714] hover:bg-[#2A211D] text-[#F3EFE6] border border-white/10 px-3.5 py-2 rounded-xl text-xs font-bold"
          >
            الشاشة الرئيسية
          </button>
          <button
            type="button"
            onClick={() => onChangeSubView(subView === 'completed' ? 'archive' : 'completed')}
            className="bg-[#1A181F] hover:bg-[#25222C] text-[#E5C16C] border border-[#C89B3C]/30 px-3.5 py-2 rounded-xl text-xs font-bold"
          >
            {subView === 'completed' ? 'كل القضايا' : `المنجزة (${profile.solvedCaseIds.length})`}
          </button>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-[#131217] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9FA3AE]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم القضية أو الرقم (#001) أو المكان..."
              className="w-full bg-[#0D0C10] border border-white/10 focus:border-[#C89B3C] rounded-xl pr-10 pl-3 py-2.5 text-xs text-[#F3EFE6] outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | DetectiveCategory)}
            className="bg-[#0D0C10] border border-white/10 focus:border-[#C89B3C] rounded-xl px-3 py-2.5 text-xs text-[#F3EFE6] outline-none"
          >
            <option value="all">كل التصنيفات</option>
            {DETECTIVE_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'order' | 'difficulty' | 'recent')}
            className="bg-[#0D0C10] border border-white/10 focus:border-[#C89B3C] rounded-xl px-3 py-2.5 text-xs text-[#F3EFE6] outline-none"
          >
            <option value="order">الترتيب: رقم القضية</option>
            <option value="difficulty">الترتيب: مستوى الصعوبة</option>
            <option value="recent">الترتيب: الأحدث تصفحاً</option>
          </select>
        </div>

        {/* Difficulty + Status filter pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-[#9FA3AE] flex items-center gap-1 ml-1">
            <Filter size={12} /> الصعوبة:
          </span>
          <button
            type="button"
            onClick={() => setDifficultyFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
              difficultyFilter === 'all'
                ? 'bg-[#7A1219] text-white border-[#C89B3C]/50'
                : 'bg-[#0D0C10] text-[#9FA3AE] border-white/10'
            }`}
          >
            الكل
          </button>
          {DIFFICULTY_LEVELS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficultyFilter(d.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                difficultyFilter === d.id
                  ? 'bg-[#7A1219] text-white border-[#C89B3C]/50'
                  : 'bg-[#0D0C10] text-[#9FA3AE] border-white/10 hover:text-white'
              }`}
            >
              {d.label}
            </button>
          ))}

          {subView !== 'completed' && (
            <>
              <span className="text-[11px] text-[#9FA3AE] mr-2">الحالة:</span>
              {(['all', 'open', 'in_progress', 'closed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                    statusFilter === st
                      ? 'bg-[#C89B3C] text-[#09080A] border-[#C89B3C]'
                      : 'bg-[#0D0C10] text-[#9FA3AE] border-white/10'
                  }`}
                >
                  {st === 'all'
                    ? 'الجميع'
                    : st === 'open'
                    ? 'مفتوحة'
                    : st === 'in_progress'
                    ? 'قيد التحقيق'
                    : 'مغلقة'}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <div className="bg-[#131217] border border-white/10 rounded-2xl p-10 text-center space-y-2">
          <Lock size={28} className="mx-auto text-[#C89B3C]/70" />
          <p className="font-bold text-sm text-[#F3EFE6]">لا توجد قضايا تطابق شروط البحث الحالية</p>
          <p className="text-xs text-[#9FA3AE]">جرّب تغيير الفلتر أو البحث بكلمة أخرى.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCases.map((c) => {
            const status = getStatusForCase(c.id);
            const badge = getCaseStatusBadge(status);
            const diff = getDifficultyMeta(c.difficulty);
            return (
              <div
                key={c.id}
                className="bg-[#131217] border border-white/10 hover:border-[#C89B3C]/45 rounded-2xl overflow-hidden flex flex-col sm:flex-row transition shadow-lg"
              >
                <div className="sm:w-44 h-40 sm:h-auto relative shrink-0 bg-black">
                  <img
                    src={c.coverImage}
                    alt={c.title}
                    className="w-full h-full object-cover opacity-85"
                  />
                  <span className="absolute top-2.5 right-2.5 bg-black/80 text-[#E5C16C] border border-[#C89B3C]/35 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                    {c.caseNumber}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.className}`}>
                        {badge.label}
                      </span>
                      {renderSkulls(diff.skulls)}
                    </div>
                    <h3 className="font-black text-base text-[#F3EFE6]">{c.title}</h3>
                    <p className="text-[11px] text-[#C89B3C] font-bold">{c.categoryLabel} • {c.location}</p>
                    <p className="text-xs text-[#9FA3AE] mt-1.5 line-clamp-2">{c.teaser}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <span className="text-[11px] text-[#9FA3AE]">+{c.baseRewardPoints} نقطة</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectCase(c.id, true)}
                        className="bg-[#1E1714] hover:bg-[#2A201B] text-[#E5C16C] border border-[#C89B3C]/35 px-3 py-1.5 rounded-lg text-xs font-bold"
                      >
                        عرض الملف
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCase(c.id, false);
                          onStartInvestigation(c.id);
                        }}
                        className="bg-[#7A1219] hover:bg-[#991821] text-white px-3 py-1.5 rounded-lg text-xs font-black"
                      >
                        تحقيق
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
