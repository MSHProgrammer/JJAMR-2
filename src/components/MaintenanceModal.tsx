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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#23140E]/45 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 p-6 shadow-2xl text-center space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => {
              SoundFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-600">
          <Wrench className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-[#23140E]">
          {game.icon} {game.title} — تحت التعديل والصيانة
        </h3>
        <p className="text-sm text-[#5A3E32] font-readex leading-relaxed">
          {game.maintenanceNote ||
            'هذه اللعبة مغلقة مؤقتاً لأعمال التحديث والتطوير وتحسين التجربة. جربوا باقي ألعاب جَمْر المتاحة الآن!'}
        </p>
        <button
          onClick={() => {
            SoundFX.playClick();
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 hover:brightness-105 text-white font-black text-sm shadow-sm cursor-pointer"
        >
          حسناً، العودة للألعاب
        </button>
      </div>
    </div>
  );
};
