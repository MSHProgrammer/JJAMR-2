import React from 'react';
import { Wrench, X } from 'lucide-react';
import { GameConfig } from '../types/jamr';
import { SoundFX } from '../utils/soundFx';

interface MaintenanceModalProps {
  game: GameConfig;
  onClose: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ game, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#150d26] border border-amber-500/35 p-6 shadow-2xl text-center space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => {
              SoundFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/35 flex items-center justify-center mx-auto text-amber-400">
          <Wrench className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-white">
          {game.icon} {game.title} — تحت التعديل والصيانة
        </h3>
        <p className="text-sm text-slate-300 font-readex leading-relaxed">
          {game.maintenanceNote ||
            'هذه اللعبة مغلقة مؤقتاً لأعمال التحديث والتطوير وتحسين التجربة. جربوا باقي ألعاب جَمْر المتاحة الآن!'}
        </p>
        <button
          onClick={() => {
            SoundFX.playClick();
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm cursor-pointer"
        >
          حسناً، العودة للألعاب
        </button>
      </div>
    </div>
  );
};
