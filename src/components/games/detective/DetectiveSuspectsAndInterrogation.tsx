import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  MessageSquareText,
  Pin,
  ShieldQuestion,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  DetectiveCasePublic,
  DetectivePlayerCaseProgress,
  DetectiveSuspect,
} from '../../../types/detective.ts';

interface DetectiveSuspectsAndInterrogationProps {
  caseData: DetectiveCasePublic;
  progress: DetectivePlayerCaseProgress;
  mode: 'suspects' | 'interrogation';
  onReviewSuspect: (suspectId: string) => void;
  onAskQuestion: (suspectId: string, questionId: string, unlocksEvidenceId?: string) => void;
  onPinSuspectToBoard: (suspect: DetectiveSuspect) => void;
  onGoToInterrogation?: (suspectId: string) => void;
}

export const DetectiveSuspectsAndInterrogation: React.FC<
  DetectiveSuspectsAndInterrogationProps
> = ({
  caseData,
  progress,
  mode,
  onReviewSuspect,
  onAskQuestion,
  onPinSuspectToBoard,
  onGoToInterrogation,
}) => {
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>(
    caseData.suspects[0]?.id || ''
  );
  const [modalSuspect, setModalSuspect] = useState<DetectiveSuspect | null>(null);
  const [askedStandardBySuspect, setAskedStandardBySuspect] = useState<Record<string, string[]>>({});

  const activeSuspect = useMemo(
    () => caseData.suspects.find((s) => s.id === selectedSuspectId) || caseData.suspects[0],
    [caseData.suspects, selectedSuspectId]
  );

  const openSuspectProfile = (suspect: DetectiveSuspect) => {
    onReviewSuspect(suspect.id);
    setModalSuspect(suspect);
  };

  const handleSelectSuspectForInterrogation = (suspectId: string) => {
    setSelectedSuspectId(suspectId);
    onReviewSuspect(suspectId);
  };

  // =========================================================================
  // VIEW A: SUSPECTS FILE GRID + DOSSIER MODAL
  // =========================================================================
  if (mode === 'suspects') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#131217] border border-[#C89B3C]/25 rounded-2xl p-3.5">
          <div>
            <h3 className="font-black text-base text-[#F3EFE6] flex items-center gap-2">
              <Users size={18} className="text-[#C89B3C]" />
              ملفات المشتبه بهم ({caseData.suspects.length})
            </h3>
            <p className="text-[11px] text-[#9FA3AE]">
              افحص السيرة والعلاقات والذريعة (Alibi) لكل شخصية، وثبّت المشتبه به على لوحة التحقيق
            </p>
          </div>
          <span className="text-xs font-bold text-[#E5C16C] bg-[#0D0C10] border border-[#C89B3C]/30 px-3 py-1 rounded-xl">
            تمت مراجعتهم: {progress.reviewedSuspectIds.length} / {caseData.suspects.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {caseData.suspects.map((s) => {
            const isReviewed = progress.reviewedSuspectIds.includes(s.id);
            const askedCount = (progress.askedQuestionsBySuspect[s.id] || []).length;
            return (
              <div
                key={s.id}
                className="bg-[#131217] border border-white/10 hover:border-[#C89B3C]/45 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xl transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-[#F3EFE6] border border-[#C89B3C]/50 shadow-inner shrink-0"
                        style={{ backgroundColor: s.accentTone }}
                      >
                        {s.monogram}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#F3EFE6]">{s.name}</h4>
                        <p className="text-[11px] text-[#C89B3C] font-bold">{s.role}</p>
                        <p className="text-[10px] text-[#9FA3AE]">العمر: {s.age} عاماً</p>
                      </div>
                    </div>
                    {isReviewed && (
                      <span className="text-[10px] bg-[#17281C] text-[#8DE098] border border-[#386B43] px-2 py-0.5 rounded font-bold shrink-0">
                        مُراجَع
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#D2CEC4] leading-relaxed bg-[#0D0C10] border border-white/5 rounded-xl p-2.5">
                    «{s.initialStatement}»
                  </p>

                  <div className="text-[11px] space-y-1">
                    <p className="text-[#9FA3AE]">
                      <span className="text-[#E5C16C] font-bold">العذر المعلن: </span>
                      {s.alibiClaim}
                    </p>
                    <p className="text-[#9FA3AE]">
                      <span className="text-[#F08088] font-bold">مؤشر الدافع: </span>
                      {s.motiveClue}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => openSuspectProfile(s)}
                    className="flex-1 bg-[#1E1714] hover:bg-[#2B201C] text-[#E5C16C] border border-[#C89B3C]/35 py-2 rounded-xl text-xs font-bold"
                  >
                    ملف الشخصية
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSuspectForInterrogation(s.id);
                      onGoToInterrogation?.(s.id);
                    }}
                    className="flex-1 bg-[#7A1219] hover:bg-[#961820] text-white py-2 rounded-xl text-xs font-black"
                  >
                    استجواب ({askedCount}/{s.interrogationQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => onPinSuspectToBoard(s)}
                    title="تثبيت على لوحة التحقيق"
                    className="bg-[#0D0C10] hover:bg-[#1A181F] text-[#9FA3AE] hover:text-[#E5C16C] border border-white/10 px-2.5 py-2 rounded-xl"
                  >
                    <Pin size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Suspect Full Profile Modal */}
        {modalSuspect && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#131217] border border-[#C89B3C]/45 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white border border-[#C89B3C]/60"
                    style={{ backgroundColor: modalSuspect.accentTone }}
                  >
                    {modalSuspect.monogram}
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-[#F3EFE6]">{modalSuspect.name}</h4>
                    <p className="text-xs text-[#C89B3C] font-bold">
                      {modalSuspect.role} • {modalSuspect.age} عاماً
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalSuspect(null)}
                  className="text-[#9FA3AE] hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="bg-[#1A181F] border border-white/10 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-[#C89B3C] mb-1">الخلفية والصلة بالقضية</p>
                  <p className="text-[#D8D3C9] leading-relaxed">{modalSuspect.bio}</p>
                </div>

                <div className="bg-[#1E1714] border border-[#C89B3C]/25 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-[#E5C16C] mb-1">العذر المعلن (Alibi)</p>
                  <p className="text-[#F3EFE6]">{modalSuspect.alibiClaim}</p>
                </div>

                <div className="bg-[#231417] border border-[#7A1219]/60 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-[#F08088] mb-1">نقطة اشتباه / دافع محتمل</p>
                  <p className="text-[#F3EFE6]">{modalSuspect.motiveClue}</p>
                </div>

                {modalSuspect.relationships.length > 0 && (
                  <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-[#C89B3C] mb-1.5">العلاقات المسجلة</p>
                    <ul className="space-y-1">
                      {modalSuspect.relationships.map((rel, i) => (
                        <li key={i} className="text-xs text-[#D2CEC4]">
                          <span className="font-bold text-white">{rel.targetName}:</span> {rel.relation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onPinSuspectToBoard(modalSuspect);
                    setModalSuspect(null);
                  }}
                  className="flex-1 bg-[#1E1714] hover:bg-[#2A201B] text-[#E5C16C] border border-[#C89B3C]/35 py-2.5 rounded-xl text-xs font-bold"
                >
                  📌 تثبيت على اللوحة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = modalSuspect.id;
                    setModalSuspect(null);
                    handleSelectSuspectForInterrogation(id);
                    onGoToInterrogation?.(id);
                  }}
                  className="flex-1 bg-[#7A1219] hover:bg-[#961820] text-white py-2.5 rounded-xl text-xs font-black"
                >
                  الانتقال للاستجواب
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: INTERACTIVE INTERROGATION ROOM
  // =========================================================================
  const askedIds = progress.askedQuestionsBySuspect[activeSuspect?.id || ''] || [];
  const askedStdIds = askedStandardBySuspect[activeSuspect?.id || ''] || [];

  const universalQuestions = activeSuspect
    ? [
        {
          id: 'std_alibi',
          label: 'أعد سرد أين كنت بالتفصيل وقت الحادثة؟',
          answer: activeSuspect.alibiClaim,
        },
        {
          id: 'std_motive',
          label: 'هل كانت لديك أي خلافات أو مصلحة مع الضحية/الملف؟',
          answer: `${activeSuspect.initialStatement} (ملاحظة التحقيق: ${activeSuspect.motiveClue})`,
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Suspect Sidebar Selector */}
      <div className="lg:col-span-4 bg-[#131217] border border-[#C89B3C]/25 rounded-2xl p-3.5 space-y-2.5">
        <p className="text-xs font-black text-[#C89B3C] px-1 flex items-center gap-1.5">
          <UserCheck size={15} />
          اختر مشتبهاً للاستجواب
        </p>
        <div className="space-y-2">
          {caseData.suspects.map((s) => {
            const isSelected = activeSuspect?.id === s.id;
            const askedCount = (progress.askedQuestionsBySuspect[s.id] || []).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSuspectForInterrogation(s.id)}
                className={`w-full text-right rounded-xl p-2.5 border transition flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#241618] border-[#C89B3C]/70 text-[#F3EFE6]'
                    : 'bg-[#0D0C10] hover:bg-[#191720] border-white/10 text-[#9FA3AE]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0 border border-[#C89B3C]/40"
                    style={{ backgroundColor: s.accentTone }}
                  >
                    {s.monogram}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#F3EFE6] truncate">{s.name}</p>
                    <p className="text-[10px] text-[#9FA3AE] truncate">{s.role}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-black/50 px-2 py-0.5 rounded text-[#E5C16C] shrink-0">
                  {askedCount}/{s.interrogationQuestions.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interrogation Transcript & Question Deck */}
      {activeSuspect && (
        <div className="lg:col-span-8 bg-[#131217] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Interrogation header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black text-white border border-[#C89B3C]/50"
                  style={{ backgroundColor: activeSuspect.accentTone }}
                >
                  {activeSuspect.monogram}
                </span>
                <div>
                  <h4 className="font-black text-base text-[#F3EFE6]">
                    غرفة الاستجواب: {activeSuspect.name}
                  </h4>
                  <p className="text-[11px] text-[#C89B3C]">{activeSuspect.relationToCase}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onPinSuspectToBoard(activeSuspect)}
                className="bg-[#1E1714] hover:bg-[#2A201B] text-[#E5C16C] border border-[#C89B3C]/30 px-3 py-1.5 rounded-lg text-[11px] font-bold"
              >
                📌 تثبيت المشتبه به
              </button>
            </div>

            {/* Transcript History */}
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {/* Opening Statement */}
              <div className="bg-[#0D0C10] border border-white/10 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-[#9FA3AE] mb-1">الإفادة المبدئية المسجلة</p>
                <p className="text-xs sm:text-sm text-[#F3EFE6] leading-relaxed">
                  «{activeSuspect.initialStatement}»
                </p>
              </div>

              {/* Universal Questions Answered */}
              {universalQuestions
                .filter((uq) => askedStdIds.includes(uq.id))
                .map((uq) => (
                  <div key={uq.id} className="space-y-2">
                    <div className="bg-[#1F1518] border border-[#7A1219]/50 rounded-xl p-2.5 mr-6 text-xs text-[#E5C16C] font-bold">
                      المحقق: {uq.label}
                    </div>
                    <div className="bg-[#1A181F] border border-white/10 rounded-xl p-3 ml-6 text-xs text-[#F3EFE6] leading-relaxed">
                      {uq.answer}
                    </div>
                  </div>
                ))}

              {/* Case-specific Questions Answered */}
              {activeSuspect.interrogationQuestions
                .filter((q) => askedIds.includes(q.id))
                .map((q) => {
                  const unlockedEv = q.unlocksEvidenceId
                    ? caseData.evidence.find((e) => e.id === q.unlocksEvidenceId)
                    : null;
                  return (
                    <div key={q.id} className="space-y-2">
                      <div className="bg-[#241316] border border-[#7A1219]/70 rounded-xl p-3 mr-4 sm:mr-8">
                        <p className="text-[10px] text-[#E5C16C] font-bold mb-0.5">سؤال التحقيق</p>
                        <p className="text-xs font-bold text-[#F3EFE6]">{q.question}</p>
                      </div>
                      <div className="bg-[#1A181F] border border-white/10 rounded-xl p-3.5 ml-4 sm:ml-8 space-y-2">
                        <p className="text-xs sm:text-sm text-[#F3EFE6] leading-relaxed">
                          «{q.answer}»
                        </p>
                        {q.revealsContradiction && (
                          <div className="bg-[#2D1216] border border-[#B8333C]/60 rounded-lg p-2.5 flex items-start gap-2">
                            <AlertTriangle size={15} className="text-[#F08088] shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-[#F08088]">تناقض مكتشف!</p>
                              <p className="text-[11px] text-[#F3EFE6]">{q.revealsContradiction}</p>
                            </div>
                          </div>
                        )}
                        {unlockedEv && (
                          <div className="bg-[#17281C] border border-[#386B43] rounded-lg p-2 flex items-center justify-between gap-2 text-[11px] text-[#8DE098]">
                            <span className="flex items-center gap-1.5 font-bold">
                              <FilePlus2 size={14} />
                              تم فتح دليل جديد في الملف: {unlockedEv.title}
                            </span>
                            <CheckCircle2 size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Interactive Question Chips */}
          <div className="border-t border-white/10 pt-3.5 space-y-2">
            <p className="text-[11px] font-bold text-[#C89B3C] flex items-center gap-1.5">
              <MessageSquareText size={14} />
              اختر سؤالاً لطرحه على {activeSuspect.name}:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {activeSuspect.interrogationQuestions.map((q) => {
                const isAsked = askedIds.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onAskQuestion(activeSuspect.id, q.id, q.unlocksEvidenceId)}
                    className={`text-right rounded-xl px-3.5 py-2.5 text-xs border transition flex items-center justify-between gap-2 ${
                      isAsked
                        ? 'bg-[#0D0C10] border-white/5 text-[#9FA3AE]'
                        : 'bg-[#1E1714] hover:bg-[#2B201C] border-[#C89B3C]/45 text-[#F3EFE6] font-bold'
                    }`}
                  >
                    <span>{q.question}</span>
                    {isAsked ? (
                      <span className="text-[10px] text-[#8DE098] shrink-0">طُرح</span>
                    ) : (
                      <span className="text-[10px] text-[#E5C16C] shrink-0">اسأل ←</span>
                    )}
                  </button>
                );
              })}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {universalQuestions.map((uq) => {
                  const isAsked = askedStdIds.includes(uq.id);
                  return (
                    <button
                      key={uq.id}
                      type="button"
                      disabled={isAsked}
                      onClick={() =>
                        setAskedStandardBySuspect((prev) => ({
                          ...prev,
                          [activeSuspect.id]: [...(prev[activeSuspect.id] || []), uq.id],
                        }))
                      }
                      className={`text-right rounded-xl px-3 py-2 text-[11px] border transition flex items-center gap-1.5 ${
                        isAsked
                          ? 'bg-[#0D0C10]/60 border-white/5 text-[#6F737D]'
                          : 'bg-[#0D0C10] hover:bg-[#191720] border-white/15 text-[#D2CEC4]'
                      }`}
                    >
                      <ShieldQuestion size={13} className="text-[#C89B3C] shrink-0" />
                      <span className="truncate">{uq.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
