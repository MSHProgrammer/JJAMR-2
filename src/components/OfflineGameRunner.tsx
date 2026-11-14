import React from 'react';
import { Wrench, ArrowLeft } from 'lucide-react';
import { BarrahCategory, GameConfig, Question, Section, Topic } from '../types/jamr';
import { BrokenTvEngine } from './games/BrokenTvEngine';
import { IsmHayawanEngine } from './games/IsmHayawanEngine';
import { JamrainEngine } from './games/JamrainEngine';
import { HuroofJamrEngine } from './games/HuroofJamrEngine';
import { BarrahSalfaEngine } from './games/BarrahSalfaEngine';
import { MafiaNoHakamEngine } from './games/MafiaNoHakamEngine';

interface OfflineGameRunnerProps {
  game: GameConfig;
  playerName: string;
  sections: Section[];
  topics: Topic[];
  questions: Question[];
  barrahCategories: BarrahCategory[];
  onJoinOnlineRoom?: (code: string, name: string) => void;
  onExit: () => void;
}

export const OfflineGameRunner: React.FC<OfflineGameRunnerProps> = ({
  game,
  playerName,
  sections,
  topics,
  questions,
  barrahCategories,
  onJoinOnlineRoom,
  onExit,
}) => {
  // Enforce Maintenance Guard inside OfflineGameRunner
  if (game.underMaintenance || !game.isActive) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
          <Wrench className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white">
          {game.icon} {game.title} — تحت التعديل والصيانة
        </h2>
        <p className="text-sm text-slate-300 font-readex leading-relaxed">
          {game.maintenanceNote || 'هذه اللعبة مغلقة مؤقتاً للتطوير والتحسين.'}
        </p>
        <button
          onClick={onExit}
          className="px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-sm inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>
      </div>
    );
  }

  switch (game.id) {
    case 'broken_tv':
      return (
        <BrokenTvEngine
          mode="offline"
          playerName={playerName}
          onJoinOnlineRoom={onJoinOnlineRoom}
          onExit={onExit}
        />
      );
    case 'ism_hayawan':
      return <IsmHayawanEngine mode="offline" playerName={playerName} onExit={onExit} />;
    case 'jamrain':
      return (
        <JamrainEngine
          sections={sections}
          topics={topics}
          questions={questions}
          onExit={onExit}
        />
      );
    case 'huroof_jamr':
      return <HuroofJamrEngine onExit={onExit} />;
    case 'barrah_salfa':
      return (
        <BarrahSalfaEngine
          mode="offline"
          playerName={playerName}
          categories={barrahCategories}
          onExit={onExit}
        />
      );
    case 'mafia_no_hakam':
      return <MafiaNoHakamEngine mode="offline" playerName={playerName} onExit={onExit} />;
    default:
      // Custom Admin/AI created game view
      return (
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <div className="rounded-3xl bg-[#130b22] border border-orange-500/30 p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{game.icon}</span>
                <div>
                  <h2 className="text-2xl font-black text-white">{game.title}</h2>
                  <p className="text-xs text-amber-300 font-bold">{game.subtitle}</p>
                </div>
              </div>
              <button
                onClick={onExit}
                className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-black cursor-pointer"
              >
                رجوع
              </button>
            </div>
            <p className="text-sm text-slate-300 font-readex leading-relaxed">{game.description}</p>
            <div className="space-y-2">
              <h3 className="text-sm font-black text-orange-400">قواعد الجلسة:</h3>
              <ol className="space-y-2">
                {game.rules.map((r, i) => (
                  <li key={i} className="bg-white/5 rounded-xl p-3 text-sm text-slate-200">
                    {i + 1}. {r}
                  </li>
                ))}
              </ol>
            </div>
            {game.specialMechanic && (
              <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-4 text-xs font-bold text-amber-200">
                ✨ {game.specialMechanic}
              </div>
            )}
          </div>
        </div>
      );
  }
};
