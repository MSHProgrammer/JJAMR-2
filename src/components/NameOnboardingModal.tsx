import React, { useState } from 'react';
import { Flame, Sparkles } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';

interface NameOnboardingModalProps {
  onConfirm: (name: string) => void;
}

export const NameOnboardingModal: React.FC<NameOnboardingModalProps> = ({ onConfirm }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (cleaned.length < 2) {
      setError('اكتب اسماً أو لقباً من حرفين على الأقل للبدء.');
      return;
    }
    SoundFX.playCorrect();
    onConfirm(cleaned.slice(0, 15));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#140c24] border border-amber-500/30 p-7 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-600/30 mb-4">
            <Flame className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">أهلاً بك في جَمْر 🔥</h2>
          <p className="text-sm text-slate-300 font-readex leading-relaxed">
            لا تسجيل حسابات ولا كلمات مرور — فقط اكتب اسمك المستعار وابدأ اللعب فوراً مع أصدقائك مجاناً!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-amber-300 mb-2">اسمك في الجلسة (بحد أقصى 15 حرف)</label>
            <input
              type="text"
              autoFocus
              maxLength={15}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="مثال: أبو فهد، نورة، الصقر..."
              className="w-full rounded-xl bg-[#0c0716] border border-white/15 px-4 py-3 text-white text-base font-bold placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
            />
            {error && <p className="text-xs text-rose-400 mt-2 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black py-3.5 px-6 text-base transition-transform active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>ادخل وولّع جمعتكم</span>
          </button>
        </form>
      </div>
    </div>
  );
};
