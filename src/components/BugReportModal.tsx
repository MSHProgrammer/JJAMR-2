import React, { useState } from 'react';
import { X, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { GameConfig } from '../types/jamr';
import { SoundFX } from '../utils/soundFx';

interface BugReportModalProps {
  games: GameConfig[];
  defaultReporterName: string;
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({
  games,
  defaultReporterName,
  onClose,
}) => {
  const [type, setType] = useState('خلل تقني');
  const [gameId, setGameId] = useState('general');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(defaultReporterName || '');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 4) {
      setError('يرجى كتابة تفاصيل واضحة للمشكلة أو الاقتراح.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const selectedGame = games.find((g) => g.id === gameId);
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          gameId,
          gameTitle: selectedGame ? selectedGame.title : 'المنصة العامة',
          description: description.trim(),
          reporterName: reporterName.trim() || 'لاعب',
          contact: contact.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'تعذّر إرسال البلاغ');
      }
      SoundFX.playCorrect();
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الإرسال');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-black text-[#23140E]">الإبلاغ عن خلل أو مشكلة</h2>
          </div>
          <button
            onClick={() => {
              SoundFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-[#23140E]">تم استلام بلاغك بنجاح!</h3>
            <p className="text-sm text-[#5A3E32] font-readex">
              شكراً لمساهمتك في تحسين منصة جَمْر. سيراجع الفريق بلاغك في أقرب وقت.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-sm cursor-pointer shadow-sm"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-[#5A3E32] mb-1.5">نوع البلاغ</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2.5 text-sm font-bold text-[#23140E] focus:outline-none focus:border-orange-500"
                >
                  <option value="خلل تقني">خلل تقني</option>
                  <option value="مشكلة في لعبة">مشكلة في لعبة</option>
                  <option value="اقتراح تحسين">اقتراح تحسين</option>
                  <option value="محتوى غير مناسب">محتوى غير مناسب</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#5A3E32] mb-1.5">اللعبة المعنية</label>
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2.5 text-sm font-bold text-[#23140E] focus:outline-none focus:border-orange-500"
                >
                  <option value="general">المنصة العامة</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.icon} {g.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#5A3E32] mb-1.5">وصف المشكلة أو الملاحظة</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError('');
                }}
                placeholder="اشرح ما حدث بدقة ليتمكن فريق جَمْر من معالجته سريعاً..."
                className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3.5 py-2.5 text-sm text-[#23140E] placeholder:text-[#9A7B6D] focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-[#5A3E32] mb-1.5">اسمك</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="الاسم المستعار"
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3.5 py-2.5 text-sm font-bold text-[#23140E] focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#5A3E32] mb-1.5">وسيلة تواصل (اختياري)</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="تويتر / بريد / تيليجرام"
                  className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3.5 py-2.5 text-sm font-bold text-[#23140E] focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black py-3 px-6 text-sm shadow-md cursor-pointer disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'جاري الإرسال...' : 'إرسال البلاغ للإدارة'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
