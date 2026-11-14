import React, { useState } from 'react';
import { X, Users, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import { GameConfig } from '../types/jamr';
import { SoundFX } from '../utils/soundFx';

interface HowToPlayModalProps {
  games: GameConfig[];
  initialGameId?: string;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  games,
  initialGameId,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState<string>(initialGameId || games[0]?.id || 'broken_tv');
  const activeGame = games.find((g) => g.id === selectedId) || games[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📖</span>
            <h2 className="text-xl font-black text-[#23140E]">قواعد وطريقة اللعب</h2>
          </div>
          <button
            onClick={() => {
              SoundFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] hover:text-[#23140E] cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto px-5 py-3 border-b border-amber-100 bg-[#FFFDF9]">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                SoundFX.playClick();
                setSelectedId(g.id);
              }}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                selectedId === g.id
                  ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-sm'
                  : 'bg-[#FFF7ED] text-[#5A3E32] hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>{g.icon}</span>
              <span>{g.title}</span>
            </button>
          ))}
        </div>

        {/* Selected Game Details */}
        {activeGame && (
          <div className="p-6 overflow-y-auto space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] border border-amber-200 flex items-center justify-center text-3xl shrink-0">
                  {activeGame.imageUrl ? (
                    <img
                      src={activeGame.imageUrl}
                      alt={activeGame.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    activeGame.icon
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#23140E]">{activeGame.title}</h3>
                  <p className="text-sm text-orange-600 font-readex font-bold">{activeGame.subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#5A3E32]">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-orange-500" />
                  <span className="tabular-nums">{activeGame.minPlayers}–{activeGame.maxPlayers}</span> لاعب
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600" />
                  {activeGame.duration}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  الصعوبة: {activeGame.difficulty}
                </span>
              </div>
            </div>

            <p className="text-sm text-[#3F291E] font-readex leading-relaxed">
              {activeGame.description}
            </p>

            {activeGame.underMaintenance && (
              <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-amber-900 text-sm font-bold">
                🔧 هذه اللعبة حالياً تحت التعديل والصيانة: {activeGame.maintenanceNote || 'قريباً بتحديث جديد!'}
              </div>
            )}

            <div>
              <h4 className="text-sm font-black text-orange-600 mb-3">خطوات وقواعد اللعب:</h4>
              <ol className="space-y-2.5">
                {activeGame.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-[#FFF8EE] rounded-xl p-3 border border-amber-200/80">
                    <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-black text-xs flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-[#23140E] font-readex leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ol>
            </div>

            {activeGame.specialMechanic && (
              <div className="rounded-2xl bg-gradient-to-l from-amber-50 to-orange-50 border border-orange-200 p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-black text-orange-700 mb-1">الميزة الخاصة في اللعبة</div>
                  <div className="text-sm text-[#23140E] font-readex">{activeGame.specialMechanic}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
