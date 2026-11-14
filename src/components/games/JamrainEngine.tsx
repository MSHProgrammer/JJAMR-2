import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Check,
  Search,
  Settings,
  X,
  Phone,
  ShieldAlert,
  Sparkles,
  Trophy,
  RotateCcw,
  Globe,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Question, Section, Topic } from '../../types/jamr';
import { SoundFX } from '../../utils/soundFx';

interface JamrainEngineProps {
  sections: Section[];
  topics: Topic[];
  questions: Question[];
  onQuestionsAdded?: (added: Question[]) => void;
  onExit: () => void;
}

interface LifelinesState {
  friend: boolean; // +30s
  twoAnswers: boolean; // 2 attempts
  pit: boolean; // double & deduct
}

const JamrainIllustration: React.FC<{ topic: Topic }> = ({ topic }) => {
  const customImg = topic.customImage || topic.coverImage;
  if (customImg) {
    return (
      <img
        src={customImg}
        alt={topic.name}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
      />
    );
  }
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#ddf0f9] overflow-hidden select-none">
      {/* Comic starburst rays */}
      <svg viewBox="0 0 200 130" className="absolute inset-0 w-full h-full opacity-35" aria-hidden="true">
        <circle cx="100" cy="65" r="48" fill="#ffffff" />
        <path
          d="M100 5 L108 35 M100 125 L92 95 M20 65 L52 65 M180 65 L148 65 M40 20 L65 42 M160 110 L135 88 M160 20 L135 42 M40 110 L65 88"
          stroke="#7dd3fc"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <span className="relative z-10 text-5xl sm:text-6xl drop-shadow-sm">
        {topic.icon || '🔥'}
      </span>
    </div>
  );
};

export const JamrainEngine: React.FC<JamrainEngineProps> = ({
  sections,
  topics,
  questions,
  onQuestionsAdded,
  onExit,
}) => {
  const [phase, setPhase] = useState<'pick_topics' | 'board' | 'victory'>('pick_topics');

  // Teams
  const [team1Name, setTeam1Name] = useState('فريق الشرارة');
  const [team2Name, setTeam2Name] = useState('فريق البركان');
  const [editingTeam, setEditingTeam] = useState<1 | 2 | null>(null);
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [activeTurn, setActiveTurn] = useState<1 | 2>(1);

  // Lifelines
  const [t1Lifelines, setT1Lifelines] = useState<LifelinesState>({ friend: true, twoAnswers: true, pit: true });
  const [t2Lifelines, setT2Lifelines] = useState<LifelinesState>({ friend: true, twoAnswers: true, pit: true });

  // Topic picking (3 slots Team 1 + 3 slots Team 2)
  const [team1Slots, setTeam1Slots] = useState<Array<Topic | null>>([null, null, null]);
  const [team2Slots, setTeam2Slots] = useState<Array<Topic | null>>([null, null, null]);
  const [activeSlotPtr, setActiveSlotPtr] = useState<{ team: 1 | 2; index: number }>({ team: 1, index: 0 });
  const [stagedTopic, setStagedTopic] = useState<Topic | null>(null);
  const [catFilter, setCatFilter] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');

  // Board state
  const [usedTiles, setUsedTiles] = useState<Record<string, 1 | 2 | 'none'>>({});
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [localAddedQuestions, setLocalAddedQuestions] = useState<Question[]>([]);
  const [webSearching, setWebSearching] = useState(false);
  const [webNotice, setWebNotice] = useState<string | null>(null);
  const [activeTile, setActiveTile] = useState<{
    tileKey: string;
    topic: Topic;
    points: 200 | 400 | 600;
    question: Question;
  } | null>(null);
  const [modalStep, setModalStep] = useState<'question' | 'answer' | 'decide'>('question');
  const [timer, setTimer] = useState(60);
  const [showHint, setShowHint] = useState(false);
  const [pitActive, setPitActive] = useState(false);
  const [twoAnswersActive, setTwoAnswersActive] = useState(false);

  const allQuestions = useMemo(() => {
    const seen = new Set<string>();
    const combined: Question[] = [];
    for (const q of [...localAddedQuestions, ...questions]) {
      if (q && q.id && !seen.has(q.id)) {
        seen.add(q.id);
        combined.push(q);
      }
    }
    return combined;
  }, [localAddedQuestions, questions]);

  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    team1Slots.forEach((t) => t && ids.add(t.id));
    team2Slots.forEach((t) => t && ids.add(t.id));
    return ids;
  }, [team1Slots, team2Slots]);

  const allSixPicked = team1Slots.every(Boolean) && team2Slots.every(Boolean);
  const sixTopics = useMemo(
    () => [...team1Slots, ...team2Slots].filter((t): t is Topic => Boolean(t)),
    [team1Slots, team2Slots]
  );

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const catOk = catFilter === 'الكل' || t.category === catFilter;
      const qOk =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return catOk && qOk;
    });
  }, [topics, catFilter, searchQuery]);

  // Countdown inside Question Modal
  useEffect(() => {
    if (!activeTile || modalStep !== 'question') return;
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
  }, [activeTile, modalStep]);

  // Check if all 36 tiles used
  useEffect(() => {
    if (phase === 'board' && Object.keys(usedTiles).length >= 36) {
      SoundFX.playVictory();
      void confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      setPhase('victory');
    }
  }, [usedTiles, phase]);

  const confirmStagedTopic = (topicToLock?: Topic) => {
    const chosen = topicToLock || stagedTopic;
    if (!chosen || selectedIds.has(chosen.id)) return;
    SoundFX.playCorrect();

    if (activeSlotPtr.team === 1) {
      const next = [...team1Slots];
      next[activeSlotPtr.index] = chosen;
      setTeam1Slots(next);
      if (activeSlotPtr.index < 2) {
        setActiveSlotPtr({ team: 1, index: activeSlotPtr.index + 1 });
      } else {
        setActiveSlotPtr({ team: 2, index: 0 });
      }
    } else {
      const next = [...team2Slots];
      next[activeSlotPtr.index] = chosen;
      setTeam2Slots(next);
      if (activeSlotPtr.index < 2) {
        setActiveSlotPtr({ team: 2, index: activeSlotPtr.index + 1 });
      }
    }
    setStagedTopic(null);
  };

  const fetchLiveWebQuestions = async (topicIds: string[], swapIntoActive?: { tileKey: string; topic: Topic; points: 200 | 400 | 600 }) => {
    if (topicIds.length === 0 || webSearching) return;
    setWebSearching(true);
    setWebNotice('جاري البحث في المواقع الموثوقة عن أسئلة جديدة...');
    try {
      const res = await fetch('/api/jamrain/search-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWebNotice(data?.error || 'تعذر جلب أسئلة جديدة من الويب حالياً.');
        return;
      }
      const added: Question[] = Array.isArray(data.questions) ? data.questions : [];
      if (added.length > 0) {
        setLocalAddedQuestions((prev) => [...added, ...prev]);
        onQuestionsAdded?.(added);
        setWebNotice(`تم جلب ${added.length} سؤالاً حقيقياً موثقاً من الويب!`);
        if (swapIntoActive) {
          const matched =
            added.find((q) => q.topicId === swapIntoActive.topic.id && q.points === swapIntoActive.points) ||
            added.find((q) => q.topicId === swapIntoActive.topic.id);
          if (matched) {
            setUsedQuestionIds((prev) => [...prev, matched.id]);
            setActiveTile({ ...swapIntoActive, question: matched });
            setModalStep('question');
            setTimer(60);
            setShowHint(false);
          }
        }
      } else {
        setWebNotice('لم يتم العثور على أسئلة إضافية جديدة غير الموجودة حالياً.');
      }
    } catch {
      setWebNotice('حدث خطأ في الاتصال أثناء البحث في الويب.');
    } finally {
      setWebSearching(false);
    }
  };

  const openTileQuestion = (topic: Topic, points: 200 | 400 | 600, side: 'R' | 'L') => {
    const tileKey = `${topic.id}_${points}_${side}`;
    if (usedTiles[tileKey]) return;

    SoundFX.playTileSelect();
    const usedSet = new Set(usedQuestionIds);
    const tierUnused = allQuestions.filter(
      (q) => q.topicId === topic.id && Number(q.points) === points && !usedSet.has(q.id)
    );
    const topicUnused = allQuestions.filter((q) => q.topicId === topic.id && !usedSet.has(q.id));
    const tierAll = allQuestions.filter((q) => q.topicId === topic.id && Number(q.points) === points);
    const topicAll = allQuestions.filter((q) => q.topicId === topic.id);

    const finalPool =
      tierUnused.length > 0
        ? tierUnused
        : topicUnused.length > 0
          ? topicUnused
          : tierAll.length > 0
            ? tierAll
            : topicAll;

    const picked = finalPool[Math.floor(Math.random() * Math.max(1, finalPool.length))] || {
      id: `fallback_${tileKey}`,
      topicId: topic.id,
      points,
      question: `لا توجد أسئلة كافية مضافة في "${topic.name}" — اضغط زر البحث من الويب لجلب أسئلة حقيقية فوراً!`,
      answer: `استخدم زر "🌐 سؤال جديد من الويب" أعلاه أو أضف أسئلة من لوحة الإدارة.`,
    };

    if (picked.id) {
      setUsedQuestionIds((prev) => (prev.includes(picked.id) ? prev : [...prev, picked.id]));
    }

    setActiveTile({ tileKey, topic, points, question: picked });
    setModalStep('question');
    setTimer(60);
    setShowHint(false);
    setPitActive(false);
    setTwoAnswersActive(false);
  };

  const resolveQuestion = (winner: 1 | 2 | 'none') => {
    if (!activeTile) return;
    const pts = activeTile.points;
    if (winner === 1) {
      SoundFX.playCorrect();
      if (pitActive) {
        setTeam1Score((s) => s + pts * 2);
        setTeam2Score((s) => Math.max(0, s - pts));
      } else {
        setTeam1Score((s) => s + pts);
      }
    } else if (winner === 2) {
      SoundFX.playCorrect();
      if (pitActive) {
        setTeam2Score((s) => s + pts * 2);
        setTeam1Score((s) => Math.max(0, s - pts));
      } else {
        setTeam2Score((s) => s + pts);
      }
    } else {
      SoundFX.playWrong();
    }

    setUsedTiles((prev) => ({ ...prev, [activeTile.tileKey]: winner }));
    setActiveTile(null);
    setActiveTurn((t) => (t === 1 ? 2 : 1));
  };

  const useLifeline = (type: keyof LifelinesState) => {
    const current = activeTurn === 1 ? t1Lifelines : t2Lifelines;
    if (!current[type]) return;
    SoundFX.playLifeline();
    if (activeTurn === 1) {
      setT1Lifelines((prev) => ({ ...prev, [type]: false }));
    } else {
      setT2Lifelines((prev) => ({ ...prev, [type]: false }));
    }

    if (type === 'friend') setTimer((t) => t + 30);
    if (type === 'twoAnswers') setTwoAnswersActive(true);
    if (type === 'pit') setPitActive(true);
  };

  const activeLifelines = activeTurn === 1 ? t1Lifelines : t2Lifelines;

  return (
    <div className="fixed inset-0 z-40 w-full min-h-screen bg-[#150c2b] flex flex-col justify-between overflow-hidden">
      {/* TOP ROYAL PURPLE BAR */}
      <div className="bg-[#4c359e] border-b-4 border-[#311f73] px-4 py-3 flex items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              SoundFX.playClick();
              onExit();
            }}
            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black flex items-center justify-center cursor-pointer"
            title="خروج"
          >
            ✕
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">جَمْرَيْن</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              SoundFX.playClick();
              setPhase('pick_topics');
            }}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">المواضيع الـ 100 ⚙️</span>
            <span className="sm:hidden">المواضيع</span>
          </button>

          {phase === 'board' && sixTopics.length > 0 && (
            <button
              disabled={webSearching}
              onClick={() => void fetchLiveWebQuestions(sixTopics.map((t) => t.id))}
              className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="بحث في المواقع وجلب أسئلة جديدة للمواضيع الحالية"
            >
              {webSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">أسئلة جديدة من الويب</span>
            </button>
          )}
        </div>

        <button
          onClick={() => {
            SoundFX.playClick();
            setActiveTurn((t) => (t === 1 ? 2 : 1));
          }}
          className="px-4 py-2 rounded-xl bg-[#f06634] text-white text-xs sm:text-sm font-black shadow cursor-pointer"
        >
          دور: {activeTurn === 1 ? team1Name : team2Name}
        </button>
      </div>

      {webNotice && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-4 py-2 text-center text-xs font-bold text-emerald-200 flex items-center justify-center gap-3 shrink-0">
          <span>{webNotice}</span>
          <button onClick={() => setWebNotice(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {phase === 'pick_topics' && (
          <div className="max-w-7xl mx-auto space-y-5 pb-20">
            {/* 6 Topic Slots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                { team: 1 as const, name: team1Name, slots: team1Slots, color: 'border-amber-400 bg-amber-500/10' },
                { team: 2 as const, name: team2Name, slots: team2Slots, color: 'border-cyan-400 bg-cyan-500/10' },
              ].map((grp) => (
                <div key={grp.team} className={`rounded-2xl border-2 ${grp.color} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white text-sm">مواضيع {grp.name} (3 مواضيع)</span>
                    <span className="text-xs font-bold text-slate-300 tabular-nums">
                      {grp.slots.filter(Boolean).length}/3
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {grp.slots.map((slot, idx) => {
                      const isCurrent = activeSlotPtr.team === grp.team && activeSlotPtr.index === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (slot) {
                              if (grp.team === 1) {
                                const n = [...team1Slots];
                                n[idx] = null;
                                setTeam1Slots(n);
                              } else {
                                const n = [...team2Slots];
                                n[idx] = null;
                                setTeam2Slots(n);
                              }
                            }
                            setActiveSlotPtr({ team: grp.team, index: idx });
                          }}
                          className={`p-2.5 rounded-xl border-2 text-center text-xs font-black transition-all cursor-pointer ${
                            isCurrent
                              ? 'border-orange-400 bg-orange-500/20 text-white'
                              : slot
                                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                                : 'border-white/15 bg-black/30 text-slate-400'
                          }`}
                        >
                          {slot ? `${slot.icon || '🔥'} ${slot.name}` : `خانة ${idx + 1}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Category Filters + Instant Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {['الكل', ...sections.map((s) => s.name)].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      SoundFX.playClick();
                      setCatFilter(cat);
                    }}
                    className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                      catFilter === cat
                        ? 'bg-[#f06634] text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/15'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative sm:w-64 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الـ 100 موضوع..."
                  className="w-full rounded-xl bg-black/40 border border-white/15 pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* 100 Topics Comic Card Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredTopics.map((topic) => {
                const isPicked = selectedIds.has(topic.id);
                const isStaged = stagedTopic?.id === topic.id;
                return (
                  <div
                    key={topic.id}
                    onClick={() => {
                      if (isPicked) return;
                      SoundFX.playClick();
                      setStagedTopic(topic);
                    }}
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col ${
                      isPicked
                        ? 'opacity-40 border-emerald-400 cursor-not-allowed'
                        : isStaged
                          ? 'border-amber-300 ring-4 ring-amber-400/30 scale-[1.02]'
                          : 'border-white/20 hover:border-orange-400'
                    }`}
                  >
                    <div className="h-24 w-full bg-[#ddf0f9]">
                      <JamrainIllustration topic={topic} />
                    </div>
                    <div className="bg-[#f06634] px-2.5 py-2 text-center">
                      <div className="text-xs font-black text-white truncate">{topic.name}</div>
                      <div className="text-[10px] font-bold text-orange-100/90 truncate">{topic.category}</div>
                    </div>

                    {isStaged && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmStagedTopic(topic);
                        }}
                        className="absolute top-2 left-2 px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>صح ✓</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Floating Bottom Action Pill */}
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2.5 px-3 w-full max-w-3xl">
              {stagedTopic && (
                <button
                  onClick={() => confirmStagedTopic()}
                  className="px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-2xl flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-5 h-5" />
                  <span>صح ✓ تأكيد "{stagedTopic.name}"</span>
                </button>
              )}
              {allSixPicked && (
                <>
                  <button
                    disabled={webSearching}
                    onClick={() => void fetchLiveWebQuestions(sixTopics.map((t) => t.id))}
                    className="px-5 py-3.5 rounded-full bg-[#1d113a] hover:bg-[#2a1952] border-2 border-emerald-400/60 text-emerald-200 font-black text-xs sm:text-sm shadow-2xl inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {webSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                    <span>{webSearching ? 'جاري البحث في المواقع...' : '🌐 جلب أسئلة حية من الويب'}</span>
                  </button>
                  <button
                    onClick={() => {
                      SoundFX.playTileSelect();
                      setPhase('board');
                    }}
                    className="px-8 py-3.5 rounded-full bg-gradient-to-l from-amber-400 to-orange-500 text-slate-950 font-black text-base shadow-2xl cursor-pointer"
                  >
                    ابدأ لوحة الـ 36 سؤال 🔥
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 36-TILE MAIN BOARD (2 rows x 3 columns) */}
        {phase === 'board' && (
          <div className="max-w-7xl mx-auto h-full flex items-center justify-center">
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {sixTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="rounded-3xl bg-[#241647] border-2 border-[#4c359e] p-3 flex items-stretch gap-2.5 shadow-xl"
                >
                  {/* Right Points Column */}
                  <div className="flex flex-col justify-between gap-2 w-16 shrink-0">
                    {([200, 400, 600] as const).map((pts) => {
                      const key = `${topic.id}_${pts}_R`;
                      const used = usedTiles[key];
                      return (
                        <button
                          key={key}
                          disabled={Boolean(used)}
                          onClick={() => openTileQuestion(topic, pts, 'R')}
                          className={`flex-1 rounded-xl font-black text-sm tabular-nums transition-all cursor-pointer ${
                            used
                              ? 'bg-black/35 text-slate-500 line-through cursor-not-allowed'
                              : 'bg-[#36226b] hover:bg-[#f06634] text-amber-300 hover:text-white border border-white/15'
                          }`}
                        >
                          {pts}
                        </button>
                      );
                    })}
                  </div>

                  {/* Center Comic Topic Card */}
                  <div className="flex-1 rounded-2xl overflow-hidden border-2 border-white/20 flex flex-col">
                    <div className="flex-1 min-h-[115px] bg-[#ddf0f9]">
                      <JamrainIllustration topic={topic} />
                    </div>
                    <div className="bg-[#f06634] py-2 px-2 text-center">
                      <div className="text-xs sm:text-sm font-black text-white truncate">{topic.name}</div>
                    </div>
                  </div>

                  {/* Left Points Column */}
                  <div className="flex flex-col justify-between gap-2 w-16 shrink-0">
                    {([200, 400, 600] as const).map((pts) => {
                      const key = `${topic.id}_${pts}_L`;
                      const used = usedTiles[key];
                      return (
                        <button
                          key={key}
                          disabled={Boolean(used)}
                          onClick={() => openTileQuestion(topic, pts, 'L')}
                          className={`flex-1 rounded-xl font-black text-sm tabular-nums transition-all cursor-pointer ${
                            used
                              ? 'bg-black/35 text-slate-500 line-through cursor-not-allowed'
                              : 'bg-[#36226b] hover:bg-[#f06634] text-amber-300 hover:text-white border border-white/15'
                          }`}
                        >
                          {pts}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VICTORY SCREEN */}
        {phase === 'victory' && (
          <div className="max-w-xl mx-auto mt-10 rounded-3xl bg-[#241647] border-2 border-amber-400 p-8 text-center space-y-6">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
            <h2 className="text-3xl font-black text-white">
              {team1Score === team2Score
                ? 'تعادل ملحمي بين الفريقين!'
                : `الفائز: ${team1Score > team2Score ? team1Name : team2Name} 🏆`}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-black/30 border border-white/15">
                <div className="text-sm font-bold text-amber-300">{team1Name}</div>
                <div className="text-3xl font-black text-white tabular-nums mt-1">{team1Score}</div>
              </div>
              <div className="p-4 rounded-2xl bg-black/30 border border-white/15">
                <div className="text-sm font-bold text-cyan-300">{team2Name}</div>
                <div className="text-3xl font-black text-white tabular-nums mt-1">{team2Score}</div>
              </div>
            </div>
            <button
              onClick={() => {
                setUsedTiles({});
                setUsedQuestionIds([]);
                setTeam1Score(0);
                setTeam2Score(0);
                setT1Lifelines({ friend: true, twoAnswers: true, pit: true });
                setT2Lifelines({ friend: true, twoAnswers: true, pit: true });
                setPhase('pick_topics');
              }}
              className="px-8 py-3.5 rounded-2xl bg-[#f06634] text-white font-black text-base inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>مباراة جديدة</span>
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM ROYAL PURPLE SCORE BAR */}
      <div className="bg-[#4c359e] border-t-4 border-[#311f73] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {[
          { num: 1 as const, name: team1Name, setName: setTeam1Name, score: team1Score },
          { num: 2 as const, name: team2Name, setName: setTeam2Name, score: team2Score },
        ].map((t) => (
          <div key={t.num} className="flex items-center gap-3">
            {editingTeam === t.num ? (
              <input
                type="text"
                autoFocus
                value={t.name}
                onChange={(e) => t.setName(e.target.value)}
                onBlur={() => setEditingTeam(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTeam(null)}
                className="rounded-xl bg-black/40 border border-white/30 px-3 py-1.5 text-sm font-black text-white"
              />
            ) : (
              <button
                onClick={() => setEditingTeam(t.num)}
                className={`px-4 py-2 rounded-xl font-black text-sm flex items-center gap-3 cursor-pointer transition-all ${
                  activeTurn === t.num
                    ? 'bg-[#f06634] text-white shadow-lg'
                    : 'bg-white/15 text-slate-100'
                }`}
              >
                <span>{t.name}</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-black/30 tabular-nums">{t.score}</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* QUESTION MODAL */}
      {activeTile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-[#1d113a] border-2 border-[#6d4ee3] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-[#f06634] text-white font-black text-xs tabular-nums">
                  {activeTile.topic.icon} {activeTile.topic.name} · {activeTile.points} نقطة
                  {activeTile.points === 200 ? ' (سهل)' : activeTile.points === 400 ? ' (متوسط)' : ' (تحدي)'}
                  {pitActive ? ' (الحفرة ×2 🕳️)' : ''}
                </span>
                {activeTile.question.isWebResearched && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-black inline-flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>موثق من الويب</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {modalStep === 'question' && (
                  <button
                    disabled={webSearching}
                    onClick={() =>
                      void fetchLiveWebQuestions([activeTile.topic.id], {
                        tileKey: activeTile.tileKey,
                        topic: activeTile.topic,
                        points: activeTile.points,
                      })
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="البحث في الويب عن سؤال جديد وتبديله"
                  >
                    {webSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                    <span>سؤال ويب جديد</span>
                  </button>
                )}
                <span className={`text-lg font-black tabular-nums ${timer <= 10 ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>
                  ⏱️ {timer}ث
                </span>
                <button
                  onClick={() => setActiveTile(null)}
                  className="p-2 rounded-xl bg-white/10 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {modalStep === 'question' && (
              <>
                <div className="text-center space-y-4 py-4">
                  <h3 className="text-2xl sm:text-3xl font-black text-white leading-relaxed">
                    {activeTile.question.question}
                  </h3>

                  {activeTile.question.image && (
                    <img
                      src={activeTile.question.image}
                      alt="صورة السؤال"
                      referrerPolicy="no-referrer"
                      className="max-h-52 mx-auto rounded-2xl border border-white/15"
                    />
                  )}

                  {activeTile.question.hint && showHint && (
                    <div className="inline-block px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-sm font-bold">
                      💡 تلميح: {activeTile.question.hint}
                    </div>
                  )}

                  {twoAnswersActive && (
                    <div className="text-xs font-black text-emerald-300">
                      ✌️ وسيلة جوابين مفعّلة — للفريق محاولتان للإجابة!
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center text-xs text-slate-300">
                  تنبيه للخصم: استعدوا في حال أخطأ الفريق صاحب الدور!
                </div>

                {/* 3 Lifelines */}
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    disabled={!activeLifelines.friend}
                    onClick={() => useLifeline('friend')}
                    className="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-35 text-xs font-black text-white flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Phone className="w-4 h-4 text-teal-400" />
                    <span>📞 صديق (+30ث)</span>
                  </button>
                  <button
                    disabled={!activeLifelines.twoAnswers}
                    onClick={() => useLifeline('twoAnswers')}
                    className="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-35 text-xs font-black text-white flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>✌️ جوابين للسؤال</span>
                  </button>
                  <button
                    disabled={!activeLifelines.pit}
                    onClick={() => useLifeline('pit')}
                    className="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-35 text-xs font-black text-white flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>🕳️ الحفرة (تدبيل وخصم)</span>
                  </button>
                </div>

                <div className="flex gap-3">
                  {activeTile.question.hint && !showHint && (
                    <button
                      onClick={() => setShowHint(true)}
                      className="px-4 py-3.5 rounded-2xl bg-white/10 text-amber-300 font-black text-sm cursor-pointer"
                    >
                      تلميح 💡
                    </button>
                  )}
                  <button
                    onClick={() => {
                      SoundFX.playClick();
                      setModalStep('answer');
                    }}
                    className="flex-1 py-3.5 rounded-2xl bg-[#f06634] hover:bg-[#e05725] text-white font-black text-base cursor-pointer"
                  >
                    👁️ إظهار الإجابة
                  </button>
                </div>
              </>
            )}

            {modalStep === 'answer' && (
              <div className="text-center space-y-6 py-4">
                <div className="text-xs font-black text-emerald-300">الإجابة المعتمدة:</div>
                <div className="text-2xl sm:text-3xl font-black text-white bg-emerald-500/15 border border-emerald-400/40 rounded-2xl p-6">
                  {activeTile.question.answer}
                </div>
                {activeTile.question.explanation && (
                  <p className="text-sm text-slate-300 font-readex">{activeTile.question.explanation}</p>
                )}
                {activeTile.question.sourceUrl && (
                  <div className="flex justify-center">
                    <a
                      href={activeTile.question.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-cyan-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>المصدر: {activeTile.question.sourceTitle || 'موقع موثق'}</span>
                    </a>
                  </div>
                )}
                <button
                  onClick={() => {
                    SoundFX.playClick();
                    setModalStep('decide');
                  }}
                  className="w-full py-4 rounded-2xl bg-amber-500 text-slate-950 font-black text-lg cursor-pointer"
                >
                  كَمّل ➔
                </button>
              </div>
            )}

            {modalStep === 'decide' && (
              <div className="space-y-4 py-2">
                <h3 className="text-xl font-black text-center text-white">من يستحق نقاط السؤال؟</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => resolveQuestion('none')}
                    className="py-4 px-4 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-black text-sm cursor-pointer"
                  >
                    ❌ محد جاوب
                  </button>
                  <button
                    onClick={() => resolveQuestion(1)}
                    className="py-4 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm cursor-pointer"
                  >
                    🏆 {team1Name} جاوب
                  </button>
                  <button
                    onClick={() => resolveQuestion(2)}
                    className="py-4 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm cursor-pointer"
                  >
                    🏆 {team2Name} جاوب
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
