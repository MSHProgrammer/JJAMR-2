import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FilePlus2,
  MapPin,
  Search,
  StickyNote,
  X,
} from 'lucide-react';
import type {
  DetectiveCasePublic,
  DetectivePlayerCaseProgress,
  SceneHotspot,
} from '../../../types/detective.ts';

interface DetectiveSceneViewProps {
  caseData: DetectiveCasePublic;
  progress: DetectivePlayerCaseProgress;
  onInspectHotspot: (hotspot: SceneHotspot) => void;
  onAddEvidenceToFile: (evidenceId: string) => void;
  onUpdateHotspotNote: (hotspotId: string, note: string) => void;
  onPinToBoard?: (item: { kind: 'evidence'; refId: string; title: string; subtitle: string }) => void;
}

export const DetectiveSceneView: React.FC<DetectiveSceneViewProps> = ({
  caseData,
  progress,
  onInspectHotspot,
  onAddEvidenceToFile,
  onUpdateHotspotNote,
  onPinToBoard,
}) => {
  const [activeHotspot, setActiveHotspot] = useState<SceneHotspot | null>(null);

  const discoveredCount = progress.discoveredHotspotIds.length;
  const totalHotspots = caseData.hotspots.length;

  const unlockedEvidence = useMemo(() => {
    if (!activeHotspot?.unlocksEvidenceId) return null;
    return caseData.evidence.find((e) => e.id === activeHotspot.unlocksEvidenceId) || null;
  }, [activeHotspot, caseData.evidence]);

  const handleOpenHotspot = (hs: SceneHotspot) => {
    setActiveHotspot(hs);
    onInspectHotspot(hs);
  };

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#131217] border border-[#C89B3C]/25 rounded-2xl p-3.5">
        <div>
          <h3 className="font-black text-base text-[#F3EFE6] flex items-center gap-2">
            <Eye size={18} className="text-[#C89B3C]" />
            معاينة مسرح القضية: {caseData.location}
          </h3>
          <p className="text-[11px] text-[#9FA3AE]">
            انقر على علامات الفحص المضيئة داخل المشهد لاكتشاف الأدلة الميدانية وتدوين ملاحظاتك
          </p>
        </div>
        <div className="bg-[#0D0C10] border border-[#C89B3C]/35 px-3 py-1.5 rounded-xl text-xs font-bold text-[#E5C16C]">
          المواضع المفحوصة: {discoveredCount} / {totalHotspots}
        </div>
      </div>

      {/* Interactive Scene Canvas */}
      <div className="relative rounded-3xl overflow-hidden border border-[#C89B3C]/35 bg-black shadow-2xl select-none">
        <img
          src={caseData.sceneImage}
          alt={caseData.title}
          className="w-full h-[320px] sm:h-[450px] object-cover brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09080A]/85 via-transparent to-[#09080A]/35 pointer-events-none" />

        {/* Interactive Hotspot Pins */}
        {caseData.hotspots.map((hs, idx) => {
          const isFound = progress.discoveredHotspotIds.includes(hs.id);
          return (
            <button
              key={hs.id}
              type="button"
              onClick={() => handleOpenHotspot(hs)}
              style={{
                left: `${hs.xPercent}%`,
                top: `${hs.yPercent}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 focus:outline-none"
              title={hs.title}
            >
              <span
                className={`relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 shadow-xl transition transform group-hover:scale-110 ${
                  isFound
                    ? 'bg-[#1D2B1F]/90 border-[#6BA368] text-[#9AD996]'
                    : 'bg-[#7A1219]/90 border-[#E5C16C] text-[#F3EFE6] animate-pulse'
                }`}
              >
                <span className="text-base">{hs.icon}</span>
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#09080A] border border-[#C89B3C] text-[9px] font-black text-[#E5C16C] flex items-center justify-center">
                  {idx + 1}
                </span>
              </span>

              {/* Floating desktop tooltip */}
              <span className="hidden sm:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#09080A]/95 text-[#F3EFE6] border border-[#C89B3C]/40 px-2.5 py-1 rounded-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition shadow-lg">
                {hs.title}
              </span>
            </button>
          );
        })}

        {/* Corner scene metadata tag */}
        <div className="absolute bottom-3 right-3 bg-[#09080A]/85 border border-white/15 px-3 py-1.5 rounded-xl text-[11px] text-[#D8D3C9] flex items-center gap-2">
          <MapPin size={13} className="text-[#C89B3C]" />
          <span>{caseData.inStoryDate} • {caseData.inStoryTime}</span>
        </div>
      </div>

      {/* Accessible Quick List of Scene Hotspots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {caseData.hotspots.map((hs, idx) => {
          const isFound = progress.discoveredHotspotIds.includes(hs.id);
          return (
            <button
              key={hs.id}
              type="button"
              onClick={() => handleOpenHotspot(hs)}
              className={`text-right rounded-xl p-3 border transition flex items-center justify-between gap-2 ${
                isFound
                  ? 'bg-[#171C18] border-[#6BA368]/35 text-[#F3EFE6]'
                  : 'bg-[#131217] hover:bg-[#1C1A22] border-white/10 hover:border-[#C89B3C]/45 text-[#F3EFE6]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-[#0D0C10] border border-white/10 flex items-center justify-center text-base shrink-0">
                  {hs.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">
                    {idx + 1}. {hs.title}
                  </p>
                  <p className="text-[10px] text-[#9FA3AE]">
                    {isFound ? 'تمت المعاينة' : 'بانتظار الفحص'}
                  </p>
                </div>
              </div>
              {isFound ? (
                <CheckCircle2 size={16} className="text-[#8DE098] shrink-0" />
              ) : (
                <Search size={15} className="text-[#C89B3C] shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Hotspot Inspection Modal */}
      {activeHotspot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131217] border border-[#C89B3C]/45 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-[#1E1714] border border-[#C89B3C]/35 flex items-center justify-center text-xl">
                  {activeHotspot.icon}
                </span>
                <div>
                  <p className="text-[10px] text-[#C89B3C] font-bold uppercase tracking-wider">
                    تقرير معاينة ميدانية
                  </p>
                  <h4 className="font-black text-base text-[#F3EFE6]">{activeHotspot.title}</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveHotspot(null)}
                className="text-[#9FA3AE] hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#1A181F] border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs sm:text-sm text-[#F3EFE6] leading-relaxed">
                {activeHotspot.description}
              </p>
              <div className="pt-2 border-t border-white/10">
                <p className="text-[11px] font-bold text-[#E5C16C]">معلومة مرتبطة:</p>
                <p className="text-xs text-[#D2CEC4] mt-0.5">{activeHotspot.relatedInfo}</p>
              </div>
            </div>

            {unlockedEvidence && (
              <div className="bg-[#1E1714] border border-[#C89B3C]/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-[#C89B3C] font-bold">دليل مرتبط بهذا الموضع</p>
                    <p className="text-xs font-black text-[#F3EFE6]">{unlockedEvidence.title}</p>
                  </div>
                  <span className="text-[10px] bg-[#0D0C10] text-[#E5C16C] px-2 py-0.5 rounded border border-white/10">
                    {unlockedEvidence.typeLabel}
                  </span>
                </div>
                <p className="text-[11px] text-[#9FA3AE]">{unlockedEvidence.summary}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {progress.savedEvidenceIds.includes(unlockedEvidence.id) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8DE098] bg-[#17281C] border border-[#386B43] px-3 py-1.5 rounded-lg">
                      <CheckCircle2 size={14} />
                      تمت الإضافة إلى ملف الأدلة
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddEvidenceToFile(unlockedEvidence.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-black bg-[#7A1219] hover:bg-[#961820] text-white px-3.5 py-1.5 rounded-lg"
                    >
                      <FilePlus2 size={14} />
                      إضافة لملف الأدلة
                    </button>
                  )}

                  {onPinToBoard && progress.savedEvidenceIds.includes(unlockedEvidence.id) && (
                    <button
                      type="button"
                      onClick={() =>
                        onPinToBoard({
                          kind: 'evidence',
                          refId: unlockedEvidence.id,
                          title: unlockedEvidence.title,
                          subtitle: unlockedEvidence.typeLabel,
                        })
                      }
                      className="text-xs font-bold bg-[#0D0C10] hover:bg-[#191720] text-[#E5C16C] border border-[#C89B3C]/35 px-3 py-1.5 rounded-lg"
                    >
                      📌 تثبيت على اللوحة
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Personal Note on Hotspot */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#C89B3C] flex items-center gap-1.5">
                <StickyNote size={13} />
                ملاحظتك الشخصية حول هذا الموضع
              </label>
              <textarea
                value={progress.hotspotNotes[activeHotspot.id] || ''}
                onChange={(e) => onUpdateHotspotNote(activeHotspot.id, e.target.value)}
                rows={2}
                placeholder="اكتب استنتاجك أو تساؤلك حول هذا الأثر..."
                className="w-full bg-[#0D0C10] border border-white/10 focus:border-[#C89B3C] rounded-xl p-2.5 text-xs text-[#F3EFE6] outline-none resize-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveHotspot(null)}
              className="w-full bg-[#1E1714] hover:bg-[#2A201B] text-[#F3EFE6] border border-white/10 py-2.5 rounded-xl text-xs font-bold"
            >
              إغلاق المعاينة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
