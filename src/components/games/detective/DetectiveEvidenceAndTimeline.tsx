import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  FileSearch,
  FolderLock,
  Lock,
  Pin,
  Scale,
  X,
} from 'lucide-react';
import type {
  DetectiveCasePublic,
  DetectiveEvidence,
  DetectivePlayerCaseProgress,
  DetectiveTimelineEvent,
} from '../../../types/detective.ts';

interface DetectiveEvidenceAndTimelineProps {
  caseData: DetectiveCasePublic;
  progress: DetectivePlayerCaseProgress;
  mode: 'evidence' | 'timeline';
  onPinEvidenceToBoard: (evidence: DetectiveEvidence) => void;
  onPinTimelineToBoard: (event: DetectiveTimelineEvent) => void;
}

export const DetectiveEvidenceAndTimeline: React.FC<DetectiveEvidenceAndTimelineProps> = ({
  caseData,
  progress,
  mode,
  onPinEvidenceToBoard,
  onPinTimelineToBoard,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | DetectiveEvidence['type']>('all');
  const [inspectingEvidence, setInspectingEvidence] = useState<DetectiveEvidence | null>(null);
  const [compareSuspectId, setCompareSuspectId] = useState<string>(caseData.suspects[0]?.id || '');
  const [compareTimelineId, setCompareTimelineId] = useState<string>(caseData.timeline[0]?.id || '');

  const discoveredEvidence = useMemo(
    () => caseData.evidence.filter((e) => progress.savedEvidenceIds.includes(e.id)),
    [caseData.evidence, progress.savedEvidenceIds]
  );

  const lockedCount = caseData.evidence.length - discoveredEvidence.length;

  const filteredEvidence = useMemo(() => {
    if (typeFilter === 'all') return discoveredEvidence;
    return discoveredEvidence.filter((e) => e.type === typeFilter);
  }, [discoveredEvidence, typeFilter]);

  const compareSuspect = caseData.suspects.find((s) => s.id === compareSuspectId);
  const compareEvent = caseData.timeline.find((t) => t.id === compareTimelineId);

  // =========================================================================
  // VIEW A: EVIDENCE LOCKER & DOCUMENT PARCHMENT INSPECTOR
  // =========================================================================
  if (mode === 'evidence') {
    const typesInEvidence = Array.from(new Set(discoveredEvidence.map((e) => e.type)));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#131217] border border-[#C89B3C]/25 rounded-2xl p-3.5">
          <div>
            <h3 className="font-black text-base text-[#F3EFE6] flex items-center gap-2">
              <FileSearch size={18} className="text-[#C89B3C]" />
              خزانة الأدلة والوثائق السرية ({discoveredEvidence.length} / {caseData.evidence.length})
            </h3>
            <p className="text-[11px] text-[#9FA3AE]">
              انقر على أي وثيقة لفتحها بالقراءة المكبّرة، أو ثبّتها على لوحة التحقيق
            </p>
          </div>
          {lockedCount > 0 && (
            <span className="text-[11px] bg-[#1E1714] border border-[#C89B3C]/30 text-[#E5C16C] px-3 py-1 rounded-xl flex items-center gap-1.5 font-bold">
              <FolderLock size={13} />
              يوجد {lockedCount} أدلة مخفية تُفتح من المسرح والاستجواب
            </span>
          )}
        </div>

        {/* Type filter strip */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              typeFilter === 'all'
                ? 'bg-[#7A1219] text-white border-[#C89B3C]/50'
                : 'bg-[#131217] text-[#9FA3AE] border-white/10'
            }`}
          >
            الكل ({discoveredEvidence.length})
          </button>
          {typesInEvidence.map((tp) => {
            const sample = discoveredEvidence.find((e) => e.type === tp);
            return (
              <button
                key={tp}
                type="button"
                onClick={() => setTypeFilter(tp)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  typeFilter === tp
                    ? 'bg-[#7A1219] text-white border-[#C89B3C]/50'
                    : 'bg-[#131217] text-[#9FA3AE] border-white/10 hover:text-white'
                }`}
              >
                {sample?.typeLabel || tp}
              </button>
            );
          })}
        </div>

        {/* Discovered Evidence Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvidence.map((ev) => (
            <div
              key={ev.id}
              className="bg-[#131217] border border-[#C89B3C]/25 hover:border-[#C89B3C]/60 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xl transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black bg-[#1E1714] text-[#E5C16C] border border-[#C89B3C]/35 px-2.5 py-0.5 rounded-md">
                    {ev.typeLabel}
                  </span>
                  <span className="text-[10px] text-[#9FA3AE]">الموقع: {ev.foundAt}</span>
                </div>
                <h4 className="font-black text-sm sm:text-base text-[#F3EFE6]">{ev.title}</h4>
                <p className="text-xs text-[#D2CEC4] leading-relaxed">{ev.summary}</p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setInspectingEvidence(ev)}
                  className="flex-1 bg-[#7A1219] hover:bg-[#961820] text-white py-2 rounded-xl text-xs font-black"
                >
                  قراءة الوثيقة الكاملة
                </button>
                <button
                  type="button"
                  onClick={() => onPinEvidenceToBoard(ev)}
                  className="bg-[#1E1714] hover:bg-[#2B201C] text-[#E5C16C] border border-[#C89B3C]/35 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Pin size={13} />
                  تثبيت
                </button>
              </div>
            </div>
          ))}

          {/* Undiscovered Mystery Slots */}
          {Array.from({ length: lockedCount }).map((_, idx) => (
            <div
              key={`locked_${idx}`}
              className="bg-[#0D0C10]/80 border border-dashed border-white/15 rounded-2xl p-5 flex items-center gap-3 text-[#6E727D]"
            >
              <Lock size={22} className="shrink-0 text-[#C89B3C]/40" />
              <div>
                <p className="text-xs font-bold text-[#9FA3AE]">دليل سري لم يُكشف بعد</p>
                <p className="text-[11px]">افحص النقاط الساخنة في المسرح أو استجوب المشتبه بهم</p>
              </div>
            </div>
          ))}
        </div>

        {/* Realistic Parchment Document Inspector Modal */}
        {inspectingEvidence && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#E8DEC8] text-[#251B12] border-4 border-[#8A692C] rounded-2xl max-w-lg w-full p-5 sm:p-7 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto relative">
              <button
                type="button"
                onClick={() => setInspectingEvidence(null)}
                className="absolute top-4 left-4 bg-[#251B12]/10 hover:bg-[#251B12]/20 text-[#251B12] p-1.5 rounded-full"
              >
                <X size={18} />
              </button>

              <div className="border-b-2 border-[#251B12]/20 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-[#7A1219] text-[#F3EFE6] text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    {inspectingEvidence.typeLabel}
                  </span>
                  <span className="text-[11px] font-bold text-[#5E4731]">
                    مصدر الأثر: {inspectingEvidence.foundAt}
                  </span>
                </div>
                <h4 className="font-black text-xl text-[#1B120B]">{inspectingEvidence.title}</h4>
              </div>

              <div className="bg-[#DFD2B5] border border-[#B29763] rounded-xl p-4 font-medium text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-inner">
                {inspectingEvidence.documentText}
              </div>

              <div className="bg-[#7A1219]/10 border border-[#7A1219]/40 rounded-xl p-3">
                <p className="text-[11px] font-black text-[#7A1219] mb-0.5">نقطة محورية للمحقق:</p>
                <p className="text-xs font-bold text-[#251B12]">{inspectingEvidence.keyDetail}</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onPinEvidenceToBoard(inspectingEvidence);
                    setInspectingEvidence(null);
                  }}
                  className="flex-1 bg-[#7A1219] hover:bg-[#961820] text-[#F3EFE6] py-2.5 rounded-xl text-xs font-black"
                >
                  📌 تثبيت على لوحة التحقيق
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingEvidence(null)}
                  className="bg-[#251B12] text-[#E8DEC8] px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: CHRONOLOGICAL TIMELINE & CONTRADICTION COMPARATOR
  // =========================================================================
  return (
    <div className="space-y-5">
      <div className="bg-[#131217] border border-[#C89B3C]/25 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black text-base text-[#F3EFE6] flex items-center gap-2">
            <Clock size={18} className="text-[#C89B3C]" />
            الخط الزمني للأحداث وتدقيق التناقضات
          </h3>
          <p className="text-[11px] text-[#9FA3AE]">
            راقب التسلسل الدقيق للدقائق وقارن ادعاءات المشتبه بهم بالأوقات المرصودة فعلياً
          </p>
        </div>
      </div>

      {/* Vertical Noir Timeline */}
      <div className="bg-[#131217] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="relative border-r-2 border-[#C89B3C]/35 pr-5 space-y-4">
          {caseData.timeline.map((evt) => (
            <div
              key={evt.id}
              className={`relative rounded-2xl p-3.5 border transition ${
                evt.isUncertain
                  ? 'bg-[#241316]/85 border-[#B8333C]/60'
                  : 'bg-[#0D0C10] border-white/10'
              }`}
            >
              {/* Timeline dot */}
              <span
                className={`absolute -right-[27px] top-4 w-3.5 h-3.5 rounded-full border-2 ${
                  evt.isUncertain
                    ? 'bg-[#B8333C] border-[#F3EFE6]'
                    : 'bg-[#C89B3C] border-[#09080A]'
                }`}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="bg-[#1E1714] border border-[#C89B3C]/45 text-[#E5C16C] font-mono text-xs font-black px-2.5 py-0.5 rounded-lg">
                    {evt.time}
                  </span>
                  {evt.isUncertain && (
                    <span className="bg-[#7A1219] text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertCircle size={11} />
                      نقطة شك / تناقض
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onPinTimelineToBoard(evt)}
                  className="text-[11px] text-[#C89B3C] hover:underline font-bold flex items-center gap-1"
                >
                  <Pin size={12} />
                  تثبيت
                </button>
              </div>

              <h4 className="font-black text-sm text-[#F3EFE6]">{evt.title}</h4>
              <p className="text-xs text-[#D2CEC4] mt-1 leading-relaxed">{evt.description}</p>
              {evt.contradictionNote && (
                <p className="text-[11px] text-[#F08088] font-bold mt-1.5 bg-black/40 px-2.5 py-1.5 rounded-lg">
                  ⚠️ ملاحظة التطابق الزمني: {evt.contradictionNote}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contradiction Comparison Tool */}
      <div className="bg-[#131217] border border-[#C89B3C]/30 rounded-2xl p-4 sm:p-5 space-y-3">
        <h4 className="font-black text-sm text-[#E5C16C] flex items-center gap-2">
          <Scale size={16} />
          أداة مطابقة الأقوال والوقت (اختبر كذب الذريعة)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-3 space-y-2">
            <label className="text-[11px] font-bold text-[#9FA3AE]">١. اختر إفادة المشتبه به:</label>
            <select
              value={compareSuspectId}
              onChange={(e) => setCompareSuspectId(e.target.value)}
              className="w-full bg-[#1A181F] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-[#F3EFE6] outline-none"
            >
              {caseData.suspects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.role}
                </option>
              ))}
            </select>
            {compareSuspect && (
              <p className="text-xs text-[#E5C16C] bg-[#1E1714] p-2.5 rounded-lg leading-relaxed">
                «{compareSuspect.alibiClaim}»
              </p>
            )}
          </div>

          <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-3 space-y-2">
            <label className="text-[11px] font-bold text-[#9FA3AE]">٢. قارنها بحدث في الخط الزمني:</label>
            <select
              value={compareTimelineId}
              onChange={(e) => setCompareTimelineId(e.target.value)}
              className="w-full bg-[#1A181F] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-[#F3EFE6] outline-none"
            >
              {caseData.timeline.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.time}] {t.title}
                </option>
              ))}
            </select>
            {compareEvent && (
              <p className="text-xs text-[#F3EFE6] bg-[#1A181F] p-2.5 rounded-lg leading-relaxed">
                <span className="font-mono text-[#C89B3C] font-bold">{compareEvent.time}:</span>{' '}
                {compareEvent.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
