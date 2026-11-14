import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';
import { JamrFlameLogo } from './FestiveDecor';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 p-7 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="rounded-2xl shadow-lg shadow-orange-500/25 mb-4">
            <JamrFlameLogo size={64} />
          </div>
          <h2 className="text-2xl font-black text-[#23140E] mb-2">أهلاً بك في جَمْر 🔥</h2>
          <p className="text-sm text-[#5A3E32] font-readex leading-relaxed">
            لا تسجيل حسابات ولا كلمات مرور — فقط اكتب اسمك المستعار وابدأ اللعب فوراً مع أصدقائك مجاناً!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-orange-700 mb-2">اسمك في الجلسة (بحد أقصى 15 حرف)</label>
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
              className="w-full rounded-xl bg-[#FFF8EE] border-2 border-amber-200 px-4 py-3 text-[#23140E] text-base font-bold placeholder:text-[#9A7B6D] focus:outline-none focus:border-orange-500"
            />
            {error && <p className="text-xs text-rose-600 mt-2 font-bold">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-orange-500 via-red-500 to-amber-500 hover:brightness-105 text-white font-black py-3.5 px-6 text-base shadow-md shadow-orange-500/25 transition-transform active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>ادخل وولّع جمعتكم</span>
          </button>
        </form>
      </div>
    </div>
  );
};
