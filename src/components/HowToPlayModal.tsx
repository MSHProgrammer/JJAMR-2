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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl bg-[#130b22] border border-amber-500/25 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d0718]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📖</span>
            <h2 className="text-xl font-black text-white">قواعد وطريقة اللعب</h2>
          </div>
          <button
            onClick={() => {
              SoundFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto px-5 py-3 border-b border-white/10 bg-[#10091c]">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                SoundFX.playClick();
                setSelectedId(g.id);
              }}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                selectedId === g.id
                  ? 'bg-orange-500 text-slate-950 shadow-md'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
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
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shrink-0">
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
                  <h3 className="text-2xl font-black text-white">{activeGame.title}</h3>
                  <p className="text-sm text-amber-300/90 font-readex">{activeGame.subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-orange-400" />
                  <span className="tabular-nums">{activeGame.minPlayers}–{activeGame.maxPlayers}</span> لاعب
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-400" />
                  {activeGame.duration}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  الصعوبة: {activeGame.difficulty}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-200 font-readex leading-relaxed">
              {activeGame.description}
            </p>

            {activeGame.underMaintenance && (
              <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-4 text-amber-200 text-sm">
                🔧 هذه اللعبة حالياً تحت التعديل والصيانة: {activeGame.maintenanceNote || 'قريباً بتحديث جديد!'}
              </div>
            )}

            <div>
              <h4 className="text-sm font-black text-orange-400 mb-3">خطوات وقواعد اللعب:</h4>
              <ol className="space-y-2.5">
                {activeGame.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/5">
                    <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-300 font-black text-xs flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-slate-200 font-readex leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ol>
            </div>

            {activeGame.specialMechanic && (
              <div className="rounded-2xl bg-gradient-to-l from-orange-500/15 to-amber-500/10 border border-orange-500/25 p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-black text-amber-300 mb-1">الميزة الخاصة في اللعبة</div>
                  <div className="text-sm text-slate-200 font-readex">{activeGame.specialMechanic}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
