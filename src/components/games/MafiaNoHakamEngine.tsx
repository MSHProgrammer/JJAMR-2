import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Moon,
  Sun,
  Shield,
  Search,
  Skull,
  UserPlus,
  ArrowLeft,
  Eye,
  EyeOff,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { RoomState } from '../../types/jamr';
import { SoundFX } from '../../utils/soundFx';

interface MafiaNoHakamEngineProps {
  mode: 'offline' | 'online';
  playerName: string;
  room?: RoomState | null;
  localPlayerId?: string;
  onSendAction?: (payload: Record<string, unknown>) => void;
  onExit: () => void;
}

type Role = 'mafia' | 'doctor' | 'detective' | 'citizen';

const ROLE_LABELS: Record<Role, { title: string; desc: string; icon: string; color: string }> = {
  mafia: {
    title: 'مافيا 🕶️',
    desc: 'تختار في كل ليلة ضحية لإقصائها من المدينة وحاول إقناع الجميع ببراءتك نهاراً.',
    icon: '🕶️',
    color: 'text-rose-400 border-rose-500/40 bg-rose-500/15',
  },
  doctor: {
    title: 'طبيب 🩺',
    desc: 'تختار في كل ليلة شخصاً واحداً لحمايته وإنقاذه من هجوم المافيا.',
    icon: '🩺',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15',
  },
  detective: {
    title: 'محقق 🔎',
    desc: 'تفحص هوية لاعب واحد كل ليلة لتعرف إن كان من المافيا أم مواطناً بريئاً.',
    icon: '🔎',
    color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/15',
  },
  citizen: {
    title: 'مواطن 🏘️',
    desc: 'راقب النقاشات وصوّت بذكاء في النهار لإخراج عناصر المافيا.',
    icon: '🏘️',
    color: 'text-amber-300 border-amber-500/40 bg-amber-500/15',
  },
};

export const MafiaNoHakamEngine: React.FC<MafiaNoHakamEngineProps> = ({
  mode,
  playerName,
  room,
  localPlayerId,
  onSendAction,
  onExit,
}) => {
  const isOnline = mode === 'online' && Boolean(room);
  const mf = room?.mafia;

  const [offlinePhase, setOfflinePhase] = useState<
    'setup' | 'role_reveal' | 'night' | 'day_announcement' | 'day_discussion' | 'day_voting' | 'game_over'
  >('setup');
  const [offlinePlayers, setOfflinePlayers] = useState<Array<{ id: string; name: string }>>([
    { id: 'm1', name: playerName || 'اللاعب 1' },
    { id: 'm2', name: 'اللاعب 2' },
    { id: 'm3', name: 'اللاعب 3' },
    { id: 'm4', name: 'اللاعب 4' },
  ]);
  const [newName, setNewName] = useState('');
  const [rolesByPlayer, setRolesByPlayer] = useState<Record<string, Role>>({});
  const [aliveIds, setAliveIds] = useState<string[]>([]);
  const [dayNumber, setDayNumber] = useState(1);
  const [revealIdx, setRevealIdx] = useState(0);
  const [cardShown, setCardShown] = useState(false);

  // Night pass-and-play turn queue
  const [nightStep, setNightStep] = useState<'mafia' | 'doctor' | 'detective'>('mafia');
  const [nightPassReady, setNightPassReady] = useState(false);
  const [nightChoices, setNightChoices] = useState<{ mafiaTarget?: string; doctorSave?: string }>({});
  const [detectiveInspectMsg, setDetectiveInspectMsg] = useState<string | null>(null);
  const [nightSummary, setNightSummary] = useState('');

  // Day discussion 60s timer & voting
  const [discussionTimer, setDiscussionTimer] = useState(60);
  const [voteTurnIdx, setVoteTurnIdx] = useState(0);
  const [dayVotes, setDayVotes] = useState<Record<string, string>>({});
  const [offlineWinner, setOfflineWinner] = useState<'citizens' | 'mafia' | null>(null);

  const activePhase = isOnline && mf ? mf.phase : offlinePhase;
  const isHost = isOnline ? room?.hostId === localPlayerId : true;
  const displayPlayers = isOnline && room ? room.players : offlinePlayers;
  const activeAliveIds = isOnline && mf ? mf.aliveIds : aliveIds;

  useEffect(() => {
    if (activePhase !== 'day_discussion') return;
    setDiscussionTimer(60);
    const id = window.setInterval(() => {
      setDiscussionTimer((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activePhase]);

  useEffect(() => {
    if (activePhase === 'game_over') {
      SoundFX.playVictory();
      void confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
  }, [activePhase]);

  const startOfflineMafia = () => {
    if (offlinePlayers.length < 3) return;
    SoundFX.playNight();
    const shuffled = [...offlinePlayers].sort(() => Math.random() - 0.5);
    const count = shuffled.length;
    const mafiaCount = count >= 9 ? 3 : count >= 6 ? 2 : 1;
    const hasDetective = count >= 6;
    const assigned: Record<string, Role> = {};
    shuffled.forEach((p, idx) => {
      if (idx < mafiaCount) assigned[p.id] = 'mafia';
      else if (idx === mafiaCount) assigned[p.id] = 'doctor';
      else if (hasDetective && idx === mafiaCount + 1) assigned[p.id] = 'detective';
      else assigned[p.id] = 'citizen';
    });

    setRolesByPlayer(assigned);
    setAliveIds(offlinePlayers.map((p) => p.id));
    setDayNumber(1);
    setRevealIdx(0);
    setCardShown(false);
    setOfflineWinner(null);
    setOfflinePhase('role_reveal');
  };

  const beginOfflineNight = (currentAlive: string[], currentRoles: Record<string, Role>) => {
    SoundFX.playNight();
    setNightChoices({});
    setDetectiveInspectMsg(null);
    setNightPassReady(false);
    const aliveRoles = currentAlive.map((id) => currentRoles[id]);
    if (aliveRoles.includes('mafia')) setNightStep('mafia');
    else if (aliveRoles.includes('doctor')) setNightStep('doctor');
    else if (aliveRoles.includes('detective')) setNightStep('detective');
  };

  const finishOfflineNight = (choices: { mafiaTarget?: string; doctorSave?: string }) => {
    const victimId = choices.mafiaTarget;
    const saved = victimId && victimId === choices.doctorSave;
    let nextAlive = [...aliveIds];
    let msg = 'أشرقت الشمس بسلام! نجح الطبيب في حماية المدينة الليلة.';
    if (victimId && !saved) {
      nextAlive = nextAlive.filter((id) => id !== victimId);
      const name = offlinePlayers.find((p) => p.id === victimId)?.name || 'لاعب';
      msg = `استيقظت المدينة على خبر إقصاء (${name}) ليلاً!`;
    }
    setAliveIds(nextAlive);
    setNightSummary(msg);

    const aliveMafia = nextAlive.filter((id) => rolesByPlayer[id] === 'mafia').length;
    const aliveCitizens = nextAlive.length - aliveMafia;
    if (aliveMafia === 0) {
      setOfflineWinner('citizens');
      setOfflinePhase('game_over');
    } else if (aliveMafia >= aliveCitizens) {
      setOfflineWinner('mafia');
      setOfflinePhase('game_over');
    } else {
      SoundFX.playGong();
      setOfflinePhase('day_announcement');
    }
  };

  const handleOfflineNightPick = (targetId: string) => {
    SoundFX.playClick();
    const aliveRoles = aliveIds.map((id) => rolesByPlayer[id]);
    if (nightStep === 'mafia') {
      const nextChoices = { ...nightChoices, mafiaTarget: targetId };
      setNightChoices(nextChoices);
      setNightPassReady(false);
      if (aliveRoles.includes('doctor')) setNightStep('doctor');
      else if (aliveRoles.includes('detective')) setNightStep('detective');
      else finishOfflineNight(nextChoices);
    } else if (nightStep === 'doctor') {
      const nextChoices = { ...nightChoices, doctorSave: targetId };
      setNightChoices(nextChoices);
      setNightPassReady(false);
      if (aliveRoles.includes('detective')) setNightStep('detective');
      else finishOfflineNight(nextChoices);
    } else if (nightStep === 'detective') {
      const targetName = offlinePlayers.find((p) => p.id === targetId)?.name || '';
      const isMaf = rolesByPlayer[targetId] === 'mafia';
      setDetectiveInspectMsg(`${targetName}: ${isMaf ? 'من المافيا 🕶️' : 'مواطن بريء ✅'}`);
    }
  };

  const handleOfflineVote = (targetId: string) => {
    SoundFX.playClick();
    const alivePlayers = offlinePlayers.filter((p) => aliveIds.includes(p.id));
    const voter = alivePlayers[voteTurnIdx];
    const nextVotes = { ...dayVotes, [voter.id]: targetId };
    setDayVotes(nextVotes);
    if (voteTurnIdx + 1 < alivePlayers.length) {
      setVoteTurnIdx(voteTurnIdx + 1);
    } else {
      const tally: Record<string, number> = {};
      Object.values(nextVotes).forEach((v) => {
        tally[v] = (tally[v] || 0) + 1;
      });
      const eliminated = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
      const nextAlive = eliminated ? aliveIds.filter((id) => id !== eliminated) : aliveIds;
      setAliveIds(nextAlive);
      const aliveMafia = nextAlive.filter((id) => rolesByPlayer[id] === 'mafia').length;
      const aliveCitizens = nextAlive.length - aliveMafia;
      if (aliveMafia === 0) {
        setOfflineWinner('citizens');
        setOfflinePhase('game_over');
      } else if (aliveMafia >= aliveCitizens) {
        setOfflineWinner('mafia');
        setOfflinePhase('game_over');
      } else {
        setDayNumber((d) => d + 1);
        beginOfflineNight(nextAlive, rolesByPlayer);
        setOfflinePhase('night');
      }
    }
  };

  const myOnlineRole = isOnline && mf && localPlayerId ? mf.rolesByPlayer[localPlayerId] : null;
  const activeDayNumber = isOnline && mf ? mf.dayNumber : dayNumber;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between rounded-2xl bg-[#130b22] border border-rose-500/30 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-purple-900 flex items-center justify-center text-2xl">
            🎭
          </div>
          <div>
            <h1 className="text-xl font-black text-white">مافيا بدون حكم</h1>
            <p className="text-xs text-rose-300 font-bold tabular-nums">
              اليوم {activeDayNumber} · الأحياء: {activeAliveIds.length || displayPlayers.length}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            SoundFX.playClick();
            onExit();
          }}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-black text-white flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </div>

      {/* SETUP (Offline) */}
      {activePhase === 'setup' && (
        <div className="rounded-3xl bg-[#130b22] border border-white/10 p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white">إضافة اللاعبين (الكل يلعب — النظام هو الحكم!)</h2>
            <p className="text-xs text-slate-400 font-readex">
              3–5 لاعبين: 1 مافيا + 1 طبيب · 6–8 لاعبين: 2 مافيا + 1 طبيب + 1 محقق · 9+: 3 مافيا + طبيب + محقق
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              maxLength={15}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم لاعب جديد..."
              className="flex-1 rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-sm text-white"
            />
            <button
              onClick={() => {
                if (!newName.trim() || offlinePlayers.length >= 16) return;
                SoundFX.playClick();
                setOfflinePlayers((p) => [...p, { id: `m_${Date.now()}`, name: newName.trim() }]);
                setNewName('');
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {offlinePlayers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-white"
              >
                <span className="truncate">{p.name}</span>
                {offlinePlayers.length > 3 && (
                  <button
                    onClick={() => setOfflinePlayers((prev) => prev.filter((x) => x.id !== p.id))}
                    className="text-rose-400 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            disabled={offlinePlayers.length < 3}
            onClick={startOfflineMafia}
            className="w-full py-4 rounded-2xl bg-gradient-to-l from-rose-600 to-purple-700 text-white font-black text-lg cursor-pointer"
          >
            توزيع الأدوار السري وبدء اللعبة 🎭
          </button>
        </div>
      )}

      {/* ROLE REVEAL */}
      {activePhase === 'role_reveal' && (
        <div className="rounded-3xl bg-[#130b22] border border-rose-500/30 p-8 text-center space-y-6">
          {isOnline && mf && myOnlineRole ? (
            <>
              <div className="text-5xl">{ROLE_LABELS[myOnlineRole].icon}</div>
              <div className={`max-w-md mx-auto rounded-2xl border p-6 space-y-2 ${ROLE_LABELS[myOnlineRole].color}`}>
                <h2 className="text-2xl font-black">{ROLE_LABELS[myOnlineRole].title}</h2>
                <p className="text-sm font-readex text-white/90">{ROLE_LABELS[myOnlineRole].desc}</p>
              </div>
              {!mf.revealedIds.includes(localPlayerId || '') ? (
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    onSendAction?.({ type: 'mafia_mark_revealed' });
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-rose-500 text-white font-black cursor-pointer"
                >
                  حفظت دوري السري ✅
                </button>
              ) : (
                <p className="text-sm text-slate-300 font-bold">
                  بانتظار بقية اللاعبين ({mf.revealedIds.length}/{displayPlayers.length})...
                </p>
              )}
            </>
          ) : (
            <>
              <div className="text-xs font-black text-rose-300 tabular-nums">
                لاعب {revealIdx + 1} من {offlinePlayers.length}
              </div>
              <h2 className="text-3xl font-black text-white">
                مرّر الجوال إلى: <span className="text-rose-400">{offlinePlayers[revealIdx]?.name}</span>
              </h2>
              {!cardShown ? (
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    setCardShown(true);
                  }}
                  className="px-8 py-4 rounded-2xl bg-rose-600 text-white font-black text-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="w-5 h-5" />
                  <span>اكشف دوري</span>
                </button>
              ) : (
                (() => {
                  const r = rolesByPlayer[offlinePlayers[revealIdx].id] || 'citizen';
                  const info = ROLE_LABELS[r];
                  return (
                    <div className="max-w-md mx-auto space-y-5">
                      <div className={`rounded-2xl border p-6 space-y-2 ${info.color}`}>
                        <div className="text-4xl">{info.icon}</div>
                        <h3 className="text-2xl font-black">{info.title}</h3>
                        <p className="text-sm font-readex text-white/90">{info.desc}</p>
                      </div>
                      <button
                        onClick={() => {
                          SoundFX.playClick();
                          setCardShown(false);
                          if (revealIdx + 1 < offlinePlayers.length) {
                            setRevealIdx(revealIdx + 1);
                          } else {
                            beginOfflineNight(aliveIds, rolesByPlayer);
                            setOfflinePhase('night');
                          }
                        }}
                        className="w-full py-3.5 rounded-2xl bg-white/15 text-white font-black inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <EyeOff className="w-4 h-4" />
                        <span>إخفاء والانتقال للتالي</span>
                      </button>
                    </div>
                  );
                })()
              )}
            </>
          )}
        </div>
      )}

      {/* NIGHT PHASE */}
      {activePhase === 'night' && (
        <div className="rounded-3xl bg-[#0e071a] border border-indigo-500/35 p-6 sm:p-8 text-center space-y-6">
          <Moon className="w-12 h-12 text-indigo-400 mx-auto" />
          <h2 className="text-2xl font-black text-white">حلّ الليل على المدينة 🌙</h2>

          {isOnline && mf && myOnlineRole ? (
            !activeAliveIds.includes(localPlayerId || '') ? (
              <p className="text-slate-400 font-bold">أنت خارج المنافسة — راقب بصمت حتى الصباح.</p>
            ) : myOnlineRole === 'citizen' ? (
              <p className="text-slate-300 font-readex">أنت مواطن — نم بسلام حتى تنتهي المافيا والطبيب والمحقق!</p>
            ) : (
              <div className="space-y-4 max-w-lg mx-auto">
                <p className="text-sm font-black text-amber-300">
                  {myOnlineRole === 'mafia'
                    ? 'اختر ضحية الليلة:'
                    : myOnlineRole === 'doctor'
                      ? 'اختر لاعباً لحمايته:'
                      : 'اختر لاعباً لفحص هويته:'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {displayPlayers
                    .filter((p) => activeAliveIds.includes(p.id))
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          SoundFX.playClick();
                          onSendAction?.({ type: 'mafia_night_action', targetId: p.id });
                        }}
                        className="p-3.5 rounded-xl bg-white/10 hover:bg-indigo-500/30 border border-white/15 font-black text-white text-sm cursor-pointer"
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              </div>
            )
          ) : !nightPassReady ? (
            <div className="space-y-4">
              <p className="text-lg font-black text-indigo-300">
                دور:{' '}
                {nightStep === 'mafia'
                  ? 'المافيا 🕶️'
                  : nightStep === 'doctor'
                    ? 'الطبيب 🩺'
                    : 'المحقق 🔎'}
              </p>
              <button
                onClick={() => {
                  SoundFX.playClick();
                  setNightPassReady(true);
                }}
                className="px-8 py-3.5 rounded-2xl bg-indigo-500 text-white font-black cursor-pointer"
              >
                أنا صاحب الدور — جاهز 👀
              </button>
            </div>
          ) : detectiveInspectMsg ? (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="p-5 rounded-2xl bg-cyan-500/20 border border-cyan-400 text-white font-black text-lg">
                نتيجة التحقيق: {detectiveInspectMsg}
              </div>
              <button
                onClick={() => finishOfflineNight(nightChoices)}
                className="w-full py-3.5 rounded-2xl bg-amber-500 text-slate-950 font-black cursor-pointer"
              >
                إعلان الصباح ☀️
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-lg mx-auto">
              <p className="text-sm font-black text-amber-300">
                {nightStep === 'mafia' && 'المافيا: اختر الضحية لإقصائها'}
                {nightStep === 'doctor' && 'الطبيب: اختر شخصاً لإنقاذه وحمايته'}
                {nightStep === 'detective' && 'المحقق: اختر شخصاً لفحص هويته'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {offlinePlayers
                  .filter((p) => aliveIds.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleOfflineNightPick(p.id)}
                      className="p-3.5 rounded-xl bg-white/10 hover:bg-indigo-500/30 border border-white/15 font-black text-white text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {nightStep === 'mafia' && <Skull className="w-4 h-4 text-rose-400" />}
                      {nightStep === 'doctor' && <Shield className="w-4 h-4 text-emerald-400" />}
                      {nightStep === 'detective' && <Search className="w-4 h-4 text-cyan-400" />}
                      <span>{p.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DAY ANNOUNCEMENT */}
      {activePhase === 'day_announcement' && (
        <div className="rounded-3xl bg-[#130b22] border border-amber-500/35 p-8 text-center space-y-6">
          <Sun className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-black text-white">أشرق الصباح — تقرير الليلة ☀️</h2>
          <p className="text-lg font-bold text-amber-200 bg-black/35 border border-white/10 rounded-2xl p-5 max-w-lg mx-auto">
            {isOnline && mf ? mf.lastNightSummary : nightSummary}
          </p>
          {isHost && (
            <button
              onClick={() => {
                SoundFX.playClick();
                if (isOnline) onSendAction?.({ type: 'mafia_next_phase' });
                else setOfflinePhase('day_discussion');
              }}
              className="px-8 py-3.5 rounded-2xl bg-amber-500 text-slate-950 font-black cursor-pointer"
            >
              بدء نقاش النهار (60ث) 💬
            </button>
          )}
        </div>
      )}

      {/* DAY DISCUSSION (60s timer) */}
      {activePhase === 'day_discussion' && (
        <div className="rounded-3xl bg-[#130b22] border border-amber-500/35 p-8 text-center space-y-6">
          <div className="text-4xl font-black text-amber-400 tabular-nums">⏱️ {discussionTimer}ث</div>
          <h2 className="text-2xl font-black text-white">وقت النقاش وتبادل الاتهامات! 🗣️</h2>
          <p className="text-sm text-slate-300 font-readex">
            الأحياء الآن: {displayPlayers.filter((p) => activeAliveIds.includes(p.id)).map((p) => p.name).join(' · ')}
          </p>
          {isHost && (
            <button
              onClick={() => {
                SoundFX.playTileSelect();
                if (isOnline) {
                  onSendAction?.({ type: 'mafia_next_phase' });
                } else {
                  setDayVotes({});
                  setVoteTurnIdx(0);
                  setOfflinePhase('day_voting');
                }
              }}
              className="px-8 py-3.5 rounded-2xl bg-rose-600 text-white font-black cursor-pointer"
            >
              انتقل للتصويت والطرد 🗳️
            </button>
          )}
        </div>
      )}

      {/* DAY VOTING */}
      {activePhase === 'day_voting' && (
        <div className="rounded-3xl bg-[#130b22] border border-rose-500/35 p-8 text-center space-y-6">
          <h2 className="text-2xl font-black text-white">
            {isOnline
              ? 'صوّتوا لطرد المشتبه به:'
              : `تصويت: ${offlinePlayers.filter((p) => aliveIds.includes(p.id))[voteTurnIdx]?.name}`}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
            {displayPlayers
              .filter((p) => activeAliveIds.includes(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (isOnline) {
                      SoundFX.playClick();
                      onSendAction?.({ type: 'mafia_day_vote', targetId: p.id });
                    } else {
                      handleOfflineVote(p.id);
                    }
                  }}
                  className="p-4 rounded-2xl bg-white/10 hover:bg-rose-500/30 border border-white/15 font-black text-white cursor-pointer"
                >
                  طرد {p.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {activePhase === 'game_over' && (
        <div className="rounded-3xl bg-[#130b22] border border-amber-400/50 p-8 text-center space-y-6">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
          <h2 className="text-3xl font-black text-white">
            {(isOnline && mf ? mf.winner : offlineWinner) === 'citizens'
              ? 'انتصر المواطنون وتطهّرت المدينة! 🎉'
              : 'سيطرت المافيا على المدينة! 🕶️🔥'}
          </h2>
          <div className="max-w-md mx-auto grid grid-cols-1 gap-2 text-sm">
            {displayPlayers.map((p) => {
              const r = (isOnline && mf ? mf.rolesByPlayer[p.id] : rolesByPlayer[p.id]) || 'citizen';
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 border border-white/10"
                >
                  <span className="font-black text-white">{p.name}</span>
                  <span className="font-bold text-amber-300">{ROLE_LABELS[r].title}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              SoundFX.playClick();
              if (isOnline) onSendAction?.({ type: 'return_to_lobby' });
              else setOfflinePhase('setup');
            }}
            className="px-8 py-3.5 rounded-2xl bg-rose-600 text-white font-black inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>العب جولة جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
};
