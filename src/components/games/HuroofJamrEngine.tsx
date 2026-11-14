import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Shuffle,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Eye,
  Check,
  X,
} from 'lucide-react';
import { ARABIC_LETTERS, HUROOF_DEFAULT_BANK, HuroofQuestion } from '../../data/huroofBank';
import { SoundFX } from '../../utils/soundFx';

interface HuroofJamrEngineProps {
  onExit: () => void;
}

type CellOwner = 'green' | 'orange' | null;

interface HexCell {
  row: number;
  col: number;
  letter: string;
  owner: CellOwner;
}

function getHoneyNeighbors(r: number, c: number): Array<[number, number]> {
  const evenRowOffsets: Array<[number, number]> = [
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 0],
    [1, -1],
    [1, 0],
  ];
  const oddRowOffsets: Array<[number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [-1, 1],
    [1, 0],
    [1, 1],
  ];
  const offsets = r % 2 === 0 ? evenRowOffsets : oddRowOffsets;
  return offsets
    .map(([dr, dc]) => [r + dr, c + dc] as [number, number])
    .filter(([nr, nc]) => nr >= 0 && nr < 5 && nc >= 0 && nc < 5);
}

function checkHexWinner(grid: HexCell[][]): 'green' | 'orange' | null {
  // Green: connects col 0 to col 4 horizontally
  const greenQueue: Array<[number, number]> = [];
  const greenVisited = new Set<string>();
  for (let r = 0; r < 5; r++) {
    if (grid[r][0].owner === 'green') {
      greenQueue.push([r, 0]);
      greenVisited.add(`${r},0`);
    }
  }
  while (greenQueue.length > 0) {
    const [r, c] = greenQueue.shift()!;
    if (c === 4) return 'green';
    for (const [nr, nc] of getHoneyNeighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!greenVisited.has(key) && grid[nr][nc].owner === 'green') {
        greenVisited.add(key);
        greenQueue.push([nr, nc]);
      }
    }
  }

  // Orange: connects row 0 to row 4 vertically
  const orangeQueue: Array<[number, number]> = [];
  const orangeVisited = new Set<string>();
  for (let c = 0; c < 5; c++) {
    if (grid[0][c].owner === 'orange') {
      orangeQueue.push([0, c]);
      orangeVisited.add(`0,${c}`);
    }
  }
  while (orangeQueue.length > 0) {
    const [r, c] = orangeQueue.shift()!;
    if (r === 4) return 'orange';
    for (const [nr, nc] of getHoneyNeighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!orangeVisited.has(key) && grid[nr][nc].owner === 'orange') {
        orangeVisited.add(key);
        orangeQueue.push([nr, nc]);
      }
    }
  }

  return null;
}

function createShuffledGrid(): HexCell[][] {
  const letters = [...ARABIC_LETTERS].sort(() => Math.random() - 0.5).slice(0, 25);
  const grid: HexCell[][] = [];
  let idx = 0;
  for (let r = 0; r < 5; r++) {
    const row: HexCell[] = [];
    for (let c = 0; c < 5; c++) {
      row.push({ row: r, col: c, letter: letters[idx++], owner: null });
    }
    grid.push(row);
  }
  return grid;
}

export const HuroofJamrEngine: React.FC<HuroofJamrEngineProps> = ({ onExit }) => {
  const [grid, setGrid] = useState<HexCell[][]>(() => createShuffledGrid());
  const [greenName, setGreenName] = useState('الفريق الأخضر');
  const [orangeName, setOrangeName] = useState('الفريق البرتقالي');
  const [greenRounds, setGreenRounds] = useState(0);
  const [orangeRounds, setOrangeRounds] = useState(0);
  const [roundWinner, setRoundWinner] = useState<'green' | 'orange' | null>(null);

  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: number;
    letter: string;
    q: HuroofQuestion;
  } | null>(null);
  const [timer, setTimer] = useState(25);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (!activeCell) return;
    const id = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        if (prev <= 5) SoundFX.playTick(true);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeCell]);

  const handleCellClick = (cell: HexCell) => {
    if (roundWinner) return;
    SoundFX.playTileSelect();
    const matches = HUROOF_DEFAULT_BANK.filter((q) => q.letter === cell.letter);
    const chosen =
      matches[Math.floor(Math.random() * matches.length)] || {
        letter: cell.letter,
        question: `اذكر اسماً أو مدينة أو شيئاً معروفاً يبدأ بحرف (${cell.letter})`,
        answer: `أي إجابة صحيحة تبدأ بحرف (${cell.letter})`,
      };
    setActiveCell({ row: cell.row, col: cell.col, letter: cell.letter, q: chosen });
    setTimer(25);
    setShowAnswer(false);
  };

  const assignCell = (owner: CellOwner) => {
    if (!activeCell) return;
    const next = grid.map((r) =>
      r.map((cell) =>
        cell.row === activeCell.row && cell.col === activeCell.col ? { ...cell, owner } : cell
      )
    );
    setGrid(next);
    setActiveCell(null);

    if (owner) {
      SoundFX.playHoneycomb();
      const win = checkHexWinner(next);
      if (win) {
        setRoundWinner(win);
        if (win === 'green') setGreenRounds((s) => s + 1);
        else setOrangeRounds((s) => s + 1);
        SoundFX.playVictory();
        void confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
      }
    } else {
      SoundFX.playWrong();
    }
  };

  const resetBoard = () => {
    SoundFX.playClick();
    setGrid(createShuffledGrid());
    setRoundWinner(null);
    setActiveCell(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Purple Control Sidebar */}
        <div className="lg:col-span-4 rounded-3xl bg-[#241345] border-2 border-[#4c359e] p-5 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-white">🐝 حروف مع جَمْر</h1>
            <button
              onClick={() => {
                SoundFX.playClick();
                onExit();
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black text-white flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-300">المسار الأفقي (يمين ⟷ يسار)</span>
                <span className="text-lg font-black text-white tabular-nums">{greenRounds} جولات</span>
              </div>
              <input
                type="text"
                value={greenName}
                onChange={(e) => setGreenName(e.target.value)}
                className="w-full rounded-xl bg-black/35 border border-emerald-500/30 px-3 py-2 text-sm font-black text-white"
              />
            </div>

            <div className="rounded-2xl bg-orange-500/15 border border-orange-500/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-orange-300">المسار العمودي (أعلى ↕ أسفل)</span>
                <span className="text-lg font-black text-white tabular-nums">{orangeRounds} جولات</span>
              </div>
              <input
                type="text"
                value={orangeName}
                onChange={(e) => setOrangeName(e.target.value)}
                className="w-full rounded-xl bg-black/35 border border-orange-500/30 px-3 py-2 text-sm font-black text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={resetBoard}
              className="py-3 px-3 rounded-xl bg-[#4c359e] hover:bg-[#5c42ba] text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>خلط الحروف</span>
            </button>
            <button
              onClick={() => {
                setGreenRounds(0);
                setOrangeRounds(0);
                resetBoard();
              }}
              className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>تصفير النتيجة</span>
            </button>
          </div>

          {roundWinner && (
            <div className="rounded-2xl bg-amber-500/20 border-2 border-amber-400 p-4 text-center space-y-3">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
              <div className="text-lg font-black text-white">
                فاز {roundWinner === 'green' ? greenName : orangeName} بالمسار المتصل! 🎉
              </div>
              <button
                onClick={resetBoard}
                className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm cursor-pointer"
              >
                جولة جديدة
              </button>
            </div>
          )}
        </div>

        {/* 5x5 Staggered Honeycomb Board */}
        <div className="lg:col-span-8 rounded-3xl bg-[#130b22] border border-white/15 p-4 sm:p-6 shadow-2xl">
          {/* Top Orange Border */}
          <div className="h-4 rounded-t-2xl bg-gradient-to-l from-orange-500 to-amber-500 mb-3 flex items-center justify-center text-[10px] font-black text-slate-950">
            {orangeName}
          </div>

          <div className="flex items-stretch gap-2 sm:gap-3">
            {/* Right Green Border */}
            <div className="w-4 rounded-xl bg-emerald-500 shrink-0" title={greenName} />

            {/* Staggered Hex Rows */}
            <div className="flex-1 flex flex-col items-center justify-center py-2 select-none overflow-x-auto">
              {grid.map((row, rIdx) => (
                <div
                  key={rIdx}
                  className="flex items-center justify-center gap-1.5 sm:gap-2.5"
                  style={{
                    marginTop: rIdx === 0 ? 0 : '-10px',
                    transform: rIdx % 2 === 1 ? 'translateX(-18px)' : 'translateX(18px)',
                  }}
                >
                  {row.map((cell) => {
                    const bgClass =
                      cell.owner === 'green'
                        ? 'bg-emerald-500 text-slate-950'
                        : cell.owner === 'orange'
                          ? 'bg-orange-500 text-slate-950'
                          : 'bg-[#f8fafc] hover:bg-amber-200 text-[#1e1b4b]';
                    return (
                      <button
                        key={`${cell.row}-${cell.col}`}
                        onClick={() => handleCellClick(cell)}
                        style={{
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        }}
                        className={`w-14 h-16 sm:w-20 sm:h-22 flex items-center justify-center text-xl sm:text-3xl font-black transition-transform hover:scale-105 cursor-pointer shadow-lg ${bgClass}`}
                      >
                        {cell.letter}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Left Green Border */}
            <div className="w-4 rounded-xl bg-emerald-500 shrink-0" title={greenName} />
          </div>

          {/* Bottom Orange Border */}
          <div className="h-4 rounded-b-2xl bg-gradient-to-l from-orange-500 to-amber-500 mt-3 flex items-center justify-center text-[10px] font-black text-slate-950">
            {orangeName}
          </div>
        </div>
      </div>

      {/* Question Modal */}
      {activeCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#180e2c] border-2 border-amber-400/50 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-2xl flex items-center justify-center">
                  {activeCell.letter}
                </span>
                <div>
                  <div className="text-xs font-bold text-amber-300">حرف الخلية</div>
                  <div className="text-sm font-black text-white">أجب بحرف ({activeCell.letter})</div>
                </div>
              </div>
              <span className={`text-xl font-black tabular-nums ${timer <= 5 ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>
                ⏱️ {timer}ث
              </span>
            </div>

            <div className="rounded-2xl bg-black/35 border border-white/10 p-5 text-center space-y-3">
              <h3 className="text-xl sm:text-2xl font-black text-white leading-relaxed">
                {activeCell.q.question}
              </h3>
              {showAnswer && (
                <div className="pt-3 border-t border-white/10 text-lg font-black text-emerald-300">
                  الإجابة: {activeCell.q.answer}
                </div>
              )}
            </div>

            {!showAnswer ? (
              <button
                onClick={() => {
                  SoundFX.playClick();
                  setShowAnswer(true);
                }}
                className="w-full py-3.5 rounded-2xl bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye className="w-5 h-5" />
                <span>إظهار الإجابة</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => assignCell('green')}
                  className="py-3 px-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{greenName}</span>
                </button>
                <button
                  onClick={() => assignCell('orange')}
                  className="py-3 px-2 rounded-xl bg-orange-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{orangeName}</span>
                </button>
                <button
                  onClick={() => assignCell(null)}
                  className="py-3 px-2 rounded-xl bg-white/10 text-slate-200 font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>إلغاء / لا أحد</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
