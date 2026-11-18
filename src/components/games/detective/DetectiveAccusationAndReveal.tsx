import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Gavel,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  DetectiveCasePublic,
  DetectiveCaseSolution,
  DetectiveOnlineState,
  DetectivePlayerCaseProgress,
} from '../../../types/detective.ts';
import type { Player } from '../../../types/jamr.ts';
import { CharacterAvatar } from '../../CharacterAvatar.tsx';

interface DetectiveAccusationAndRevealProps {
  caseData: DetectiveCasePublic;
  progress: DetectivePlayerCaseProgress;
  mode: 'offline' | 'online';
  // Offline props
  revealedSolution: DetectiveCaseSolution | null;
  verifying?: boolean;
  lastAttemptFeedback?: { correct: boolean; message: string; pointsDelta: number } | null;
  onSubmitSoloAccusation?: (suspectId: string, reason: string, revealEvenIfWrong: boolean) => void;
  onReturnToArchive?: () => void;
  // Online props
  onlineState?: DetectiveOnlineState;
  players?: Player[];
  currentPlayerId?: string;
  isHost?: boolean;
  onSubmitOnlineAccusation?: (suspectId: string, reason: string) => void;
  onHostCloseCase?: () => void;
  onHostNextCase?: () => void;
}

export const DetectiveAccusationAndReveal: React.FC<DetectiveAccusationAndRevealProps> = ({
  caseData,
  progress,
  mode,
  revealedSolution,
  verifying = false,
  lastAttemptFeedback,
  onSubmitSoloAccusation,
  onReturnToArchive,
  onlineState,
  players = [],
  currentPlayerId = '',
  isHost = false,
  onSubmitOnlineAccusation,
  onHostCloseCase,
  onHostNextCase,
}) => {
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const suspectsGridRef = React.useRef<HTMLDivElement | null>(null);

  const isCaseClosed =
    mode === 'online'
      ? onlineState?.phase === 'case_closed'
      : Boolean(revealedSolution);

  const solutionToRender =
    mode === 'online' ? onlineState?.revealedSolution || null : revealedSolution;

  const hasSubmittedOnline =
    mode === 'online' && Boolean(onlineState?.submittedAccuserIds?.includes(currentPlayerId));

  // =========================================================================
  // PHASE A: CASE CLOSED — DRAMATIC REVEAL SCREEN
  // =========================================================================
  if (isCaseClosed && solutionToRender) {
    const culprit = caseData.suspects.find((s) => s.id === solutionToRender.culpritId);
    const proofEvidences = caseData.evidence.filter((e) =>
      solutionToRender.proofEvidenceIds.includes(e.id)
    );

    return (
      <div className="space-y-6">
        {/* Dramatic Crimson Wax Seal Header */}
        <div className="relative rounded-3xl overflow-hidden border-2 border-[#C89B3C]/60 bg-gradient-to-br from-[#231014] via-[#131217] to-[#0D0C10] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#C89B3C]/25 pb-5">
            <div>
              <p className="text-[11px] font-black tracking-[0.25em] text-[#C89B3C] uppercase">
                CASE CLOSED • تم إغلاق القضية
              </p>
              <h2 className="text-2xl sm:text-4xl font-black text-[#F3EFE6] mt-1">
                الحقيقة الكاملة: {caseData.title}
              </h2>
            </div>
            <div className="bg-[#7A1219] border-2 border-[#E5C16C]/70 rounded-2xl px-4 py-3 text-center shadow-xl">
              <p className="text-[10px] text-[#F3EFE6]/80 font-bold">المسؤول عن القضية</p>
              <p className="text-lg font-black text-[#E5C16C]">{solutionToRender.culpritName}</p>
            </div>
          </div>

          {/* Culprit spotlight + closing narrative */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
            <div className="lg:col-span-5 bg-[#0D0C10]/90 border border-[#7A1219]/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white border-2 border-[#C89B3C]"
                  style={{ backgroundColor: culprit?.accentTone || '#7A1219' }}
                >
                  {culprit?.monogram || '؟'}
                </div>
                <div>
                  <span className="text-[10px] bg-[#7A1219] text-white px-2 py-0.5 rounded font-black">
                    الفاعل الحقيقي
                  </span>
                  <h3 className="text-xl font-black text-[#F3EFE6] mt-0.5">
                    {solutionToRender.culpritName}
                  </h3>
                  {culprit && <p className="text-xs text-[#C89B3C]">{culprit.role}</p>}
                </div>
              </div>

              <div className="bg-[#1E1714] border border-[#C89B3C]/25 rounded-xl p-3">
                <p className="text-[11px] font-black text-[#E5C16C] mb-1">الدافع الحقيقي:</p>
                <p className="text-xs text-[#F3EFE6] leading-relaxed">{solutionToRender.motive}</p>
              </div>
            </div>

            <div className="lg:col-span-7 bg-[#1A181F]/90 border border-white/10 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-black text-[#E5C16C] flex items-center gap-1.5">
                <FileCheck2 size={16} />
                كيف نُفذت الحادثة؟ (إعادة بناء القصة)
              </p>
              <p className="text-xs sm:text-sm text-[#F3EFE6] leading-relaxed">
                {solutionToRender.method}
              </p>
              <div className="bg-[#17281C]/80 border border-[#386B43] rounded-xl p-3">
                <p className="text-[11px] font-black text-[#8DE098] mb-1">خاتمة التحقيق الرسمية:</p>
                <p className="text-xs text-[#E4F7E7] leading-relaxed">
                  {solutionToRender.closingNarrative}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Multiplayer Round Results Leaderboard */}
        {mode === 'online' && onlineState?.resultsByPlayer && onlineState.resultsByPlayer.length > 0 && (
          <div className="bg-[#131217] border border-[#C89B3C]/40 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-lg text-[#E5C16C] flex items-center gap-2">
              <Award size={18} />
              نتائج المحققين في الغرفة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {onlineState.resultsByPlayer.map((res) => (
                <div
                  key={res.playerId}
                  className={`rounded-xl p-3.5 border flex items-center justify-between gap-3 ${
                    res.isCorrect
                      ? 'bg-[#17281C]/70 border-[#386B43]'
                      : 'bg-[#241316]/70 border-[#7A1219]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CharacterAvatar
                      avatarId={res.avatar}
                      backgroundColor={res.avatarBg}
                      size={36}
                      interactive={false}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#F3EFE6] truncate">
                        {res.playerName}
                      </p>
                      <p className="text-[11px] text-[#D2CEC4] truncate">
                        اتهم: <span className="font-bold">{res.accusedSuspectName || 'لم يُصوّت'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                        res.isCorrect ? 'text-[#8DE098]' : 'text-[#F08088]'
                      }`}
                    >
                      {res.isCorrect ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {res.isCorrect ? 'إصابة دقيقة' : 'استنتاج خاطئ'}
                    </span>
                    <p className="text-xs font-mono font-black text-[#E5C16C] mt-0.5">
                      {res.pointsDelta >= 0 ? `+${res.pointsDelta}` : res.pointsDelta} نقطة
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Solo Score Feedback */}
        {mode === 'offline' && lastAttemptFeedback && (
          <div
            className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
              lastAttemptFeedback.correct
                ? 'bg-[#17281C] border-[#386B43] text-[#8DE098]'
                : 'bg-[#241316] border-[#7A1219] text-[#F08088]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {lastAttemptFeedback.correct ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              <div>
                <p className="font-black text-sm">{lastAttemptFeedback.message}</p>
                <p className="text-xs opacity-90">
                  التغير في رصيدك: {lastAttemptFeedback.pointsDelta >= 0 ? '+' : ''}
                  {lastAttemptFeedback.pointsDelta} نقطة
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Contradictions & Evidence Chain */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#131217] border border-white/10 rounded-2xl p-4 space-y-2.5">
            <h4 className="font-black text-sm text-[#F08088]">التناقضات القاطعة التي كشفت الجاني</h4>
            <ul className="space-y-2">
              {solutionToRender.keyContradictions.map((c, idx) => (
                <li
                  key={idx}
                  className="bg-[#0D0C10] border border-[#7A1219]/40 rounded-xl p-3 text-xs text-[#F3EFE6] leading-relaxed"
                >
                  <span className="text-[#C89B3C] font-black ml-1.5">{idx + 1}.</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#131217] border border-white/10 rounded-2xl p-4 space-y-2.5">
            <h4 className="font-black text-sm text-[#E5C16C]">سلسلة الأدلة المثبتة ({proofEvidences.length})</h4>
            <div className="space-y-2">
              {proofEvidences.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-[#1E1714] border border-[#C89B3C]/25 rounded-xl p-2.5 text-xs"
                >
                  <p className="font-black text-[#E5C16C]">{ev.title}</p>
                  <p className="text-[#D2CEC4] text-[11px] mt-0.5">{ev.keyDetail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why other suspects were innocent */}
        <div className="bg-[#131217] border border-white/10 rounded-2xl p-4 space-y-3">
          <h4 className="font-black text-sm text-[#9FA3AE]">لماذا بُرّئ بقية المشتبه بهم؟</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {solutionToRender.whyOthersAreInnocent.map((item) => (
              <div
                key={item.suspectId}
                className="bg-[#0D0C10] border border-white/5 rounded-xl p-3 text-xs"
              >
                <p className="font-black text-[#F3EFE6]">{item.suspectName}</p>
                <p className="text-[#9FA3AE] mt-1 leading-relaxed">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action footer */}
        <div className="flex flex-wrap gap-3">
          {mode === 'offline' && onReturnToArchive && (
            <button
              type="button"
              onClick={onReturnToArchive}
              className="bg-[#7A1219] hover:bg-[#961820] text-white px-6 py-3 rounded-xl font-black text-sm"
            >
              العودة إلى أرشيف القضايا
            </button>
          )}
          {mode === 'online' && isHost && onHostNextCase && (
            <button
              type="button"
              onClick={onHostNextCase}
              className="bg-[#7A1219] hover:bg-[#961820] text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2"
            >
              <RotateCcw size={16} />
              الانتقال لقضية جديدة مع المجموعة
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // PHASE B: ONLINE SECRET WAITING STATE (AFTER THIS PLAYER VOTED)
  // =========================================================================
  if (mode === 'online' && hasSubmittedOnline) {
    const connectedPlayers = players.filter((p) => p.connected);
    const totalNeeded = connectedPlayers.length || players.length;
    const submittedCount = onlineState?.submittedAccuserIds?.length || 0;

    return (
      <div className="bg-[#131217] border border-[#C89B3C]/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#1E1714] border-2 border-[#C89B3C] flex items-center justify-center">
          <EyeOff size={28} className="text-[#E5C16C]" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-[#F3EFE6]">تم استلام اتهامك السري بنجاح</h3>
          <p className="text-xs sm:text-sm text-[#9FA3AE] mt-1.5 max-w-md mx-auto">
            تبقى اختيارات المحققين سرية تماماً حتى يُدلي الجميع بأصواتهم وتُغلق القضية!
          </p>
        </div>

        <div className="bg-[#0D0C10] border border-white/10 rounded-2xl p-4 max-w-md mx-auto">
          <p className="text-xs font-bold text-[#E5C16C] mb-2">
            حالة التصويت السري: {submittedCount} / {totalNeeded} محققين
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {players.map((p) => {
              const done = onlineState?.submittedAccuserIds?.includes(p.id);
              return (
                <span
                  key={p.id}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                    done
                      ? 'bg-[#17281C] border-[#386B43] text-[#8DE098]'
                      : 'bg-[#1A181F] border-white/10 text-[#9FA3AE]'
                  }`}
                >
                  {done ? '✓ ' : '⏳ '}
                  {p.name}
                </span>
              );
            })}
          </div>
        </div>

        {isHost && onHostCloseCase && (
          <button
            type="button"
            onClick={onHostCloseCase}
            className="bg-[#7A1219] hover:bg-[#961820] text-white border border-[#C89B3C]/45 px-6 py-3 rounded-xl font-black text-sm"
          >
            إغلاق القضية وكشف النتيجة للجميع الآن
          </button>
        )}
      </div>
    );
  }

  // =========================================================================
  // PHASE C: MAKE YOUR ACCUSATION SCREEN
  // =========================================================================
  return (
    <div className="bg-[#131217] border border-[#7A1219]/60 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-[11px] font-black tracking-[0.2em] text-[#C89B3C] uppercase">
            MAKE YOUR ACCUSATION
          </p>
          <h3 className="text-2xl font-black text-[#F3EFE6] flex items-center gap-2 mt-0.5">
            <Gavel size={22} className="text-[#F08088]" />
            قدّم اتهامك الرسمي
          </h3>
          <p className="text-xs text-[#9FA3AE] mt-1">
            اختر المشتبه به المسؤول عن القضية واذكر أبرز سبب أو دليل يدينه
            {mode === 'online' ? ' (سيظل اختيارك سرياً عن بقية اللاعبين حتى الإغلاق)' : ''}
          </p>
        </div>
      </div>

      {lastAttemptFeedback && !lastAttemptFeedback.correct && (
        <div className="bg-[#2D1216] border border-[#B8333C] rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-[#F08088] font-black text-sm">
            <XCircle size={18} />
            <span>{lastAttemptFeedback.message}</span>
          </div>
          <p className="text-xs text-[#D8D3C9]">
            يمكنك مراجعة الأدلة والاستجواب والمحاولة مجدداً، أو تفعيل خيار كشف الحل الكامل للمراجعة.
          </p>
        </div>
      )}

      {/* Suspect Selection Grid */}
      <div
        ref={suspectsGridRef}
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-2xl p-1 transition ${
          validationError && !selectedSuspectId ? 'ring-2 ring-rose-500/80 bg-rose-950/20' : ''
        }`}
      >
        {caseData.suspects.map((s) => {
          const isPicked = selectedSuspectId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedSuspectId(s.id);
                setValidationError('');
              }}
              className={`text-right rounded-2xl p-4 border-2 transition flex items-center gap-3 cursor-pointer ${
                isPicked
                  ? 'bg-[#2C1418] border-[#E5C16C] shadow-lg shadow-[#7A1219]/30'
                  : 'bg-[#0D0C10] hover:bg-[#191720] border-white/10'
              }`}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0 border border-[#C89B3C]/40"
                style={{ backgroundColor: s.accentTone }}
              >
                {s.monogram}
              </div>
              <div className="min-w-0">
                <p className="font-black text-sm text-[#F3EFE6] truncate">{s.name}</p>
                <p className="text-[11px] text-[#C89B3C] truncate">{s.role}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Reasoning Field */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#E5C16C]">
          ملخص الدليل القاطع / سبب اتهامك (اختياري في الفردي، يظهر للمجموعة بعد الإغلاق):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="مثال: تناقض توقيت بوابة الرسوم مع عذره، إضافة إلى شرائه الحبر الأخضر..."
          className="w-full bg-[#0D0C10] border border-white/10 focus:border-[#C89B3C] rounded-xl p-3 text-xs text-[#F3EFE6] outline-none resize-none"
        />
      </div>

      {mode === 'offline' && progress.wrongAccusations > 0 && (
        <label className="flex items-center gap-2 text-xs text-[#D2CEC4] cursor-pointer">
          <input
            type="checkbox"
            checked={confirmReveal}
            onChange={(e) => setConfirmReveal(e.target.checked)}
            className="accent-[#7A1219]"
          />
          <span>إذا كان اتهامي هذا خاطئاً أيضاً، أظهر لي الحل الكامل وأغلق الملف</span>
        </label>
      )}

      {validationError && (
        <div className="rounded-xl bg-[#2D1216] border border-[#E55B66] px-4 py-3 text-xs font-black text-[#FFAEB5] flex items-center gap-2">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {lastAttemptFeedback && !lastAttemptFeedback.correct && (
        <div className="rounded-xl bg-[#2D1216] border border-[#B8333C] px-4 py-3 text-xs font-bold text-[#F08088] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <XCircle size={15} className="shrink-0" />
            <span>{lastAttemptFeedback.message}</span>
          </div>
          {mode === 'offline' && (
            <button
              type="button"
              disabled={verifying}
              onClick={() =>
                onSubmitSoloAccusation?.(
                  selectedSuspectId || caseData.suspects[0]?.id || '',
                  reason.trim(),
                  true
                )
              }
              className="px-3 py-1.5 rounded-lg bg-[#7A1219] hover:bg-[#961820] text-white text-[11px] font-black border border-[#E5C16C]/50 cursor-pointer"
            >
              كشف الحل الكامل وإغلاق الملف الآن
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={verifying}
          onClick={() => {
            if (!selectedSuspectId) {
              setValidationError('يرجى الضغط لاختيار أحد المشتبه بهم من القائمة أعلاه أولاً قبل تثبيت الاتهام!');
              suspectsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return;
            }
            setValidationError('');
            if (mode === 'online') {
              onSubmitOnlineAccusation?.(selectedSuspectId, reason.trim());
            } else {
              onSubmitSoloAccusation?.(selectedSuspectId, reason.trim(), confirmReveal);
            }
          }}
          className="flex-1 min-w-[220px] bg-[#7A1219] hover:bg-[#961820] disabled:opacity-50 text-white border border-[#C89B3C]/50 py-3.5 px-6 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition cursor-pointer"
        >
          {verifying ? <Loader2 size={17} className="animate-spin" /> : <Gavel size={17} />}
          {mode === 'online' ? 'اعتماد وإرسال الاتهام السري' : 'تثبيت الاتهام وإغلاق القضية'}
        </button>
      </div>
    </div>
  );
};
