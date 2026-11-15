import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';
import { JamrFlameLogo } from './FestiveDecor';
import { CHARACTER_AVATARS, DEFAULT_AVATAR_ID, resolveCharacterAvatar } from '../data/characterAvatars';
import { CharacterAvatar } from './CharacterAvatar';

interface NameOnboardingModalProps {
  initialAvatar?: string;
  onConfirm: (name: string, avatarId: string) => void;
}

export const NameOnboardingModal: React.FC<NameOnboardingModalProps> = ({
  initialAvatar = DEFAULT_AVATAR_ID,
  onConfirm,
}) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatar);
  const [previewKey, setPreviewKey] = useState(0);
  const [error, setError] = useState('');

  const selectedInfo = resolveCharacterAvatar(selectedAvatar);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (cleaned.length < 2) {
      setError('اكتب اسماً أو لقباً من حرفين على الأقل للبدء.');
      return;
    }
    SoundFX.playCorrect();
    onConfirm(cleaned.slice(0, 15), selectedAvatar);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white border-2 border-amber-300 p-6 sm:p-7 shadow-2xl my-auto">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-2xl shadow-lg shadow-orange-500/20">
              <JamrFlameLogo size={54} />
            </div>
            <CharacterAvatar
              avatarId={selectedAvatar}
              size={64}
              mood="excited"
              reactionKey={previewKey}
              showBubble
              bubbleText={
                selectedInfo.name.trim()
                  ? `أهلاً! أنا ${selectedInfo.name.trim()} 👋`
                  : `أهلاً بك! (${selectedInfo.tagline}) 👋`
              }
            />
          </div>
          <h2 className="text-2xl font-black text-[#23140E] mb-1">أهلاً بك في جَمْر 🔥</h2>
          <p className="text-xs sm:text-sm text-[#5A3E32] font-readex leading-relaxed">
            اكتب اسمك المستعار واختر شخصيتك الكرتونية لتتفاعل معك في كل فوز وشات!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-orange-700 mb-1.5">
              اسمك في الجلسة (بحد أقصى 15 حرف)
            </label>
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
            {error && <p className="text-xs text-rose-600 mt-1.5 font-bold">{error}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold text-orange-700">
                اختر شخصيتك المفضلة:
              </label>
              <span className="text-[11px] font-black text-[#5A3E32] bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {selectedInfo.name.trim()
                  ? `${selectedInfo.name.trim()} · ${selectedInfo.tagline}`
                  : selectedInfo.tagline}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2.5 p-3 rounded-2xl bg-[#FFF8EE] border border-amber-200">
              {CHARACTER_AVATARS.map((char) => {
                const isSelected = selectedAvatar === char.id;
                const cleanLabel = char.name.trim();
                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => {
                      SoundFX.playTileSelect();
                      setSelectedAvatar(char.id);
                      setPreviewKey((k) => k + 1);
                    }}
                    title={cleanLabel ? `${cleanLabel} (${char.tagline})` : char.tagline}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white ring-2 ring-orange-500 shadow-md scale-105'
                        : 'hover:bg-white/80 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <CharacterAvatar
                      avatarId={char.id}
                      size={48}
                      mood={isSelected ? 'picking_game' : 'idle'}
                      interactive={false}
                    />
                    {cleanLabel && (
                      <span className="text-[10px] font-black text-[#23140E] truncate max-w-full">
                        {cleanLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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
