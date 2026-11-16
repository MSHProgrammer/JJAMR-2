import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Award,
  Check,
  Clapperboard,
  Crown,
  Film,
  Mic,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Square,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DubMicMode,
  DubMicScene,
  DubTakeRecord,
  DubVoteCategory,
  RoomState,
} from '../../types/jamr';
import {
  DEFAULT_DUB_SCENES,
  DUB_VOTE_CATEGORIES,
} from '../../data/dubMicScenes';
import { CharacterAvatar } from '../CharacterAvatar';
import { SoundFX } from '../../utils/soundFx';
import { useCharacterReaction } from '../../context/CharacterReactionContext';

interface DubMicEngineProps {
  room: RoomState;
  localPlayerId: string;
  dubScenes?: DubMicScene[];
  onSendAction: (payload: Record<string, unknown>) => void;
  onExit: () => void;
}

const MODE_LABELS: Array<{ id: DubMicMode; title: string; desc: string; badge: string }> = [
  {
    id: 'live_dub',
    title: 'الدوبلاج المباشر',
    desc: 'المشهد مكتوم واللاعب يرتجل الحوار بالعربي مباشرة مع حركة الشفايف!',
    badge: '🎙️ فوري',
  },
  {
    id: 'habd_dub',
    title: 'دوبلاج الهبد',
    desc: 'وقت كتابة قصير لصياغة حوار عربي مضحك وبعدين تسجيل الأداء الصوتي.',
    badge: '✍️ هبد',
  },
  {
    id: 'group_acting',
    title: 'التمثيل الجماعي',
    desc: 'كل لاعب يمسك شخصية داخل نفس المشهد ويتسابقون في الأداء!',
    badge: '🎭 جماعي',
  },
  {
    id: 'pvp',
    title: 'اللاعب ضد اللاعب',
    desc: 'نفس المشهد يتنافس فيه اللاعبون لتحديد من يدبلجه بأسلوب أرهب.',
    badge: '⚔️ تحدي',
  },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const DubMicEngine: React.FC<DubMicEngineProps> = ({
  room,
  localPlayerId,
  dubScenes,
  onSendAction,
  onExit,
}) => {
  const dub = room.dubMic;
  const isHost = room.hostId === localPlayerId;
  const { triggerReaction } = useCharacterReaction();

  const scenesPool = useMemo(
    () => (dubScenes && dubScenes.length > 0 ? dubScenes : DEFAULT_DUB_SCENES),
    [dubScenes]
  );

  const currentScene = useMemo(
    () => scenesPool.find((s) => s.id === dub?.sceneId) || scenesPool[0],
    [scenesPool, dub?.sceneId]
  );

  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [scriptDraft, setScriptDraft] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Video & Audio recording refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentVideoSec, setCurrentVideoSec] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // Recording state
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadingTake, setUploadingTake] = useState(false);
  const [micError, setMicError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recStartRef = useRef<number>(0);

  // Ruined It comparison audio playback
  const takeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeReplayTakeIdx, setActiveReplayTakeIdx] = useState(0);

  // Voting state
  const [myVotes, setMyVotes] = useState<Partial<Record<DubVoteCategory, string>>>({});
  const [voteError, setVoteError] = useState('');

  // Reset per-round local state cleanly when scene or phase resets
  useEffect(() => {
    if (dub?.phase === 'setup') {
      setMyVotes({});
      setVoteError('');
      setScriptDraft('');
      setMicError('');
    }
    if (dub?.phase === 'results') {
      SoundFX.playCorrect();
      confetti({ particleCount: 95, spread: 80, origin: { y: 0.6 } });
      if (dub.winnerPlayerId === localPlayerId) {
        triggerReaction('win', 'ملك الدوبلاج! 👑🎙️', 3500);
      } else {
        triggerReaction('excited', 'خربنا المشهد بنجاح! 😂🎬', 3000);
      }
    }
  }, [dub?.phase, dub?.winnerPlayerId, localPlayerId]);

  // Countdown tick
  useEffect(() => {
    if (!dub?.phaseDeadline) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((dub.phaseDeadline! - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => clearInterval(id);
  }, [dub?.phaseDeadline]);

  // Keep HTML5 video constrained to [clipStartSec, clipEndSec]
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !currentScene) return;

    const handleLoaded = () => {
      if (vid.currentTime < currentScene.clipStartSec || vid.currentTime > currentScene.clipEndSec) {
        vid.currentTime = currentScene.clipStartSec;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentVideoSec(vid.currentTime);
      if (vid.currentTime >= currentScene.clipEndSec) {
        if (dub?.phase === 'watch_original' || dub?.phase === 'performing' || dub?.phase === 'ruined_it') {
          vid.currentTime = currentScene.clipStartSec;
        } else {
          vid.pause();
          setVideoPlaying(false);
        }
      }
    };

    vid.addEventListener('loadedmetadata', handleLoaded);
    vid.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      vid.removeEventListener('loadedmetadata', handleLoaded);
      vid.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentScene, dub?.phase]);

  // Auto-play clipped segment when phase enters watch_original or ruined_it
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !currentScene || !dub) return;
    if (dub.phase === 'watch_original') {
      vid.muted = false;
      vid.currentTime = currentScene.clipStartSec;
      void vid.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
    } else if (dub.phase === 'ruined_it') {
      const isOrig = dub.replayMode === 'original';
      vid.muted = !isOrig;
      vid.currentTime = currentScene.clipStartSec;
      void vid.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));

      if (!isOrig) {
        const takeToPlay = dub.takes[activeReplayTakeIdx] || dub.takes[0];
        if (takeToPlay?.audioDataUrl && takeAudioRef.current) {
          takeAudioRef.current.src = takeToPlay.audioDataUrl;
          takeAudioRef.current.currentTime = 0;
          void takeAudioRef.current.play().catch(() => {});
        }
      } else if (takeAudioRef.current) {
        takeAudioRef.current.pause();
      }
    }
  }, [dub?.phase, dub?.replayMode, dub?.replaySyncAt, activeReplayTakeIdx, currentScene]);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    };
  }, []);

  if (!dub || !currentScene) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-sm font-black text-[#23140E]">جاري تهيئة استوديو مايك الدوبلاج...</p>
      </div>
    );
  }

  const categories = ['الكل', ...Array.from(new Set(scenesPool.map((s) => s.category)))];
  const filteredScenes = scenesPool.filter((s) =>
    categoryFilter === 'الكل' ? true : s.category === categoryFilter
  );

  const activeCueChar = currentScene.characters.find(
    (c) => currentVideoSec >= c.cueStartSec && currentVideoSec <= c.cueEndSec
  );

  const myAssignedChar = currentScene.characters.find(
    (c) => dub.assignments[c.id] === localPlayerId
  );

  const startLiveRecordingWithCountdown = async () => {
    setMicError('');
    if (isRecording || uploadingTake || countdownNum !== null) return;

    // 3-2-1 Countdown
    for (const num of [3, 2, 1]) {
      setCountdownNum(num);
      SoundFX.playClick();
      await new Promise((r) => setTimeout(r, 650));
    }
    setCountdownNum(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(
        stream,
        chosenMime
          ? { mimeType: chosenMime, audioBitsPerSecond: 32000 }
          : { audioBitsPerSecond: 32000 }
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;

        const durationSec = Math.max(2, Math.round((Date.now() - recStartRef.current) / 1000));
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setUploadingTake(true);
        try {
          const audioDataUrl = await blobToDataUrl(blob);
          await uploadRecordedTake(audioDataUrl, durationSec);
        } catch {
          setMicError('تعذر حفظ التسجيل الصوتي، حاول مرة أخرى أو ارفع النص فقط.');
        } finally {
          setUploadingTake(false);
        }
      };

      // Play muted cartoon scene in sync while user dubs!
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.currentTime = currentScene.clipStartSec;
        void videoRef.current.play().then(() => setVideoPlaying(true)).catch(() => {});
      }

      recStartRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);
      recorder.start(250);

      recordTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recStartRef.current) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= 30) {
          stopLiveRecording();
        }
      }, 300);
    } catch (err) {
      setMicError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'اسمح للمتصفح باستخدام المايكروفون لتسجيل صوتك، أو استخدم زر "اعتماد الأداء النصي" أدناه.'
          : 'تعذر الوصول للمايكروفون على هذا الجهاز، يمكنك كتابة النص وإرساله بالأسفل.'
      );
    }
  };

  const stopLiveRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }
    if (videoRef.current) {
      videoRef.current.pause();
      setVideoPlaying(false);
    }
  };

  const uploadRecordedTake = async (audioDataUrl?: string, durationSec = 8) => {
    const cleanScript = (scriptDraft || dub.scriptsByPlayer[localPlayerId] || '').trim();
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(room.code)}/dub-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: localPlayerId,
          scriptText: cleanScript || 'ارتجال مباشر بالصوت 🔥',
          audioDataUrl,
          durationSec,
        }),
      });
      if (!res.ok) {
        onSendAction({
          type: 'dub_submit_take',
          scriptText: cleanScript || 'ارتجال مباشر 🔥',
          audioDataUrl,
          durationSec,
        });
      } else {
        SoundFX.playCorrect();
        triggerReaction('chat_sent', 'تسجيل رهيب! 🎙️', 2200);
      }
    } catch {
      onSendAction({
        type: 'dub_submit_take',
        scriptText: cleanScript || 'ارتجال مباشر 🔥',
        audioDataUrl,
        durationSec,
      });
    }
  };

  const otherPlayers = room.players.filter((p) => p.id !== localPlayerId && !p.isJudge);
  const myTake = dub.takes.find((t) => t.playerId === localPlayerId);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Studio Top Bar */}
      <div className="rounded-3xl bg-gradient-to-l from-[#23140E] via-[#2F1A12] to-[#1B110D] border-2 border-amber-400/50 text-white p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
            <Clapperboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black">مايك الدوبلاج | DUB MIC</h1>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-[#23140E]">
                المشهد إنجليزي... والهبد عربي! 🎙️
              </span>
            </div>
            <p className="text-xs text-amber-200/90 mt-0.5">
              {currentScene.workTitle} — {currentScene.title} ({MODE_LABELS.find((m) => m.id === dub.mode)?.title})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {secondsLeft > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black tabular-nums">
              ⏱️ {secondsLeft}ث
            </span>
          )}
          {isHost && dub.phase !== 'setup' && (
            <button
              type="button"
              onClick={() => onSendAction({ type: 'dub_play_again' })}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black cursor-pointer"
            >
              تغيير المشهد 🔄
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-100 text-xs font-black cursor-pointer"
          >
            خروج
          </button>
        </div>
      </div>

      {/* PHASE 1: SETUP (Mode + Scene + Character Assignment) */}
      {dub.phase === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Mode & Scene Catalog */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-3xl bg-white border-2 border-amber-200 p-5 space-y-4 shadow-sm">
              <h2 className="text-base font-black text-[#23140E]">١. اختر نظام الجولة:</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MODE_LABELS.map((m) => {
                  const selected = dub.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        SoundFX.playTileSelect();
                        onSendAction({ type: 'dub_set_config', mode: m.id, sceneId: dub.sceneId });
                      }}
                      className={`p-3.5 rounded-2xl border-2 text-right space-y-1 transition ${
                        selected
                          ? 'bg-amber-50 border-orange-500 shadow-sm'
                          : 'bg-[#FFFDF9] border-amber-100 hover:border-amber-300'
                      } ${isHost ? 'cursor-pointer' : 'opacity-85 cursor-default'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-[#23140E]">{m.title}</span>
                        <span className="text-[11px] font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B4E40] leading-relaxed">{m.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scene Picker */}
            <div className="rounded-3xl bg-white border-2 border-amber-200 p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-black text-[#23140E]">٢. مكتبة المشاهد الإنجليزية الحقيقية:</h2>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-orange-500 text-white'
                          : 'bg-[#FFF8EE] text-[#5A3E32] border border-amber-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {filteredScenes.map((sc) => {
                  const picked = dub.sceneId === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        SoundFX.playClick();
                        onSendAction({ type: 'dub_set_config', mode: dub.mode, sceneId: sc.id });
                      }}
                      className={`rounded-2xl border-2 p-3 text-right flex items-start gap-3 transition ${
                        picked
                          ? 'bg-amber-50 border-orange-500 shadow-sm'
                          : 'bg-[#FFFDF9] border-amber-100 hover:border-amber-300'
                      } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="w-16 h-16 rounded-xl bg-[#23140E] overflow-hidden shrink-0 flex items-center justify-center">
                        {sc.thumbnailUrl ? (
                          <img
                            src={sc.thumbnailUrl}
                            alt={sc.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-6 h-6 text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="text-xs font-black text-[#23140E] truncate">{sc.title}</div>
                        <div className="text-[10px] font-bold text-orange-700 truncate">
                          {sc.workTitle} · {sc.clipEndSec - sc.clipStartSec}ث
                        </div>
                        <p className="text-[11px] text-[#6B4E40] line-clamp-2">{sc.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Character Roles & Start Button */}
          <div className="lg:col-span-5 rounded-3xl bg-white border-2 border-amber-200 p-5 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-black text-[#23140E]">٣. توزيع شخصيات المشهد المختار:</h2>
              <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3.5 text-xs space-y-1">
                <div className="font-black text-orange-800">{currentScene.title}</div>
                <div className="text-[#5A3E32]">{currentScene.description}</div>
              </div>

              <div className="space-y-2.5">
                {currentScene.characters.map((char) => {
                  const assignedId = dub.assignments[char.id];
                  const assignedPlayer = room.players.find((p) => p.id === assignedId);
                  const isMine = assignedId === localPlayerId;
                  return (
                    <div
                      key={char.id}
                      className={`rounded-2xl border-2 p-3 flex items-center justify-between gap-2 ${
                        isMine ? 'bg-amber-50 border-orange-400' : 'bg-[#FFFDF9] border-amber-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-10 rounded-full shrink-0"
                          style={{ backgroundColor: char.roleColor }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-black text-[#23140E] truncate">
                            {char.name} ({char.originalName})
                          </div>
                          <div className="text-[10px] text-[#6B4E40]">
                            تظهر في الثانية {char.cueStartSec}–{char.cueEndSec}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {assignedPlayer && (
                          <span className="text-xs font-black text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl">
                            {assignedPlayer.name}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onSendAction({ type: 'dub_pick_character', characterId: char.id })
                          }
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer ${
                            isMine
                              ? 'bg-emerald-500 text-white'
                              : 'bg-orange-100 hover:bg-orange-200 text-orange-900'
                          }`}
                        >
                          {isMine ? 'دورك ✓' : 'اختر الدور'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  SoundFX.playTileSelect();
                  onSendAction({ type: 'dub_start_watch' });
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-l from-orange-500 via-red-500 to-amber-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>عرض المشهد الأصلي بالإنجليزي للجميع 🎬</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#FFF8EE] border border-amber-200 text-center text-xs font-bold text-[#5A3E32]">
                بانتظار المضيف لبدء عرض المشهد الإنجليزي...
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIDEO STAGE (Watch Original / Write Script / Performing / Ruined It) */}
      {(dub.phase === 'watch_original' ||
        dub.phase === 'write_script' ||
        dub.phase === 'performing' ||
        dub.phase === 'ruined_it') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Synchronized Cinema Player */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative rounded-3xl overflow-hidden bg-black border-4 border-[#23140E] shadow-2xl">
              <video
                ref={videoRef}
                src={currentScene.videoUrl}
                poster={currentScene.thumbnailUrl}
                playsInline
                crossOrigin="anonymous"
                className="w-full aspect-video object-contain bg-black"
              />

              {/* Live Character Cue Overlay */}
              {activeCueChar && (
                <div
                  className="absolute top-3 right-3 z-20 px-3.5 py-1.5 rounded-full text-white text-xs font-black shadow-lg flex items-center gap-2 animate-pulse"
                  style={{ backgroundColor: activeCueChar.roleColor }}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>
                    دور: {activeCueChar.name}
                    {room.players.find((p) => p.id === dub.assignments[activeCueChar.id])
                      ? ` — (${
                          room.players.find((p) => p.id === dub.assignments[activeCueChar.id])?.name
                        })`
                      : ''}
                  </span>
                </div>
              )}

              {/* Countdown Overlay */}
              {countdownNum !== null && (
                <div className="absolute inset-0 z-30 bg-black/70 flex flex-col items-center justify-center text-white">
                  <div className="text-7xl font-black text-amber-400 animate-bounce">
                    {countdownNum}
                  </div>
                  <p className="text-sm font-black mt-2">جهّز صوتك... بنبدأ التصوير!</p>
                </div>
              )}

              {/* Subtitle / Dialogue Overlay during Ruined It */}
              {dub.phase === 'ruined_it' && dub.replayMode === 'dubbed' && (
                <div className="absolute bottom-3 inset-x-4 z-20 text-center">
                  <div className="inline-block bg-black/80 backdrop-blur-sm border border-amber-400/50 text-amber-100 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black shadow-xl max-w-full">
                    🎙️ {dub.takes[activeReplayTakeIdx]?.playerName || 'الممثل'}: «
                    {dub.takes[activeReplayTakeIdx]?.scriptText || 'هبد مباشر 😂'}»
                  </div>
                </div>
              )}
            </div>

            {/* Video Transport Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white border border-amber-200 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const vid = videoRef.current;
                    if (!vid) return;
                    if (vid.paused) {
                      if (
                        vid.currentTime < currentScene.clipStartSec ||
                        vid.currentTime >= currentScene.clipEndSec
                      ) {
                        vid.currentTime = currentScene.clipStartSec;
                      }
                      void vid.play();
                      setVideoPlaying(true);
                    } else {
                      vid.pause();
                      setVideoPlaying(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-orange-500 text-white font-black inline-flex items-center gap-1 cursor-pointer"
                >
                  {videoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{videoPlaying ? 'إيقاف مؤقت' : 'تشغيل المقطع'}</span>
                </button>
                <span className="font-mono font-bold text-[#6B4E40] tabular-nums">
                  {Math.max(0, Math.floor(currentVideoSec - currentScene.clipStartSec))}ث /{' '}
                  {currentScene.clipEndSec - currentScene.clipStartSec}ث
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-bold text-[#5A3E32]">
                {dub.phase === 'watch_original' || dub.replayMode === 'original' ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    <span>الصوت الأصلي (إنجليزي)</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-rose-500" />
                    <span>المشهد مكتوم للدوبلاج العربي</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Stage Panel */}
          <div className="lg:col-span-5 rounded-3xl bg-white border-2 border-amber-200 p-5 space-y-4 shadow-sm">
            {dub.phase === 'watch_original' && (
              <>
                <h2 className="text-lg font-black text-[#23140E]">شاهدوا المشهد الأصلي 👀</h2>
                <p className="text-xs text-[#5A3E32] leading-relaxed">
                  ركزوا على تعابير الشخصيات وحركة الشفايف وتوقيت الانفعال عشان تهبدون حوار عربي مضحك يركب عليه صح!
                </p>
                <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3.5 space-y-2">
                  <div className="text-xs font-black text-orange-700">شخصيات المشهد:</div>
                  {currentScene.characters.map((c) => (
                    <div key={c.id} className="text-xs text-[#23140E] flex items-center justify-between">
                      <span className="font-black">• {c.name}</span>
                      <span className="text-[11px] text-[#6B4E40]">{c.englishHint}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onSendAction({ type: 'dub_set_ready' })}
                    className={`w-full py-3 rounded-xl font-black text-xs cursor-pointer ${
                      dub.readyPlayerIds.includes(localPlayerId)
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-gradient-to-l from-teal-500 to-emerald-500 text-white'
                    }`}
                  >
                    {dub.readyPlayerIds.includes(localPlayerId)
                      ? `جاهز! (${dub.readyPlayerIds.length}/${room.players.length}) ✓`
                      : 'فهمت المشهد، جاهز للدوبلاج! ✅'}
                  </button>
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => onSendAction({ type: 'dub_skip_watch' })}
                      className="w-full py-3 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <SkipForward className="w-4 h-4" />
                      <span>الانتقال لمرحلة الدوبلاج الآن</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {dub.phase === 'write_script' && (
              <>
                <h2 className="text-lg font-black text-[#23140E]">اكتب حوار الهبد العربي ✍️</h2>
                <p className="text-xs text-[#5A3E32]">
                  {myAssignedChar
                    ? `أنت تدبلج شخصية: ${myAssignedChar.name} — اكتب سطرين بالعربي تركب على المشهد!`
                    : 'ألف حواراً مضحكاً بالعربي يناسب انفعال الشخصية!'}
                </p>

                <textarea
                  rows={4}
                  value={scriptDraft}
                  onChange={(e) => setScriptDraft(e.target.value)}
                  placeholder="مثال: يا ولد وش اللي خلاك تفتح الثلاجة بدون إذني؟ والله ما تروح فيها!"
                  className="w-full rounded-2xl bg-[#FFF8EE] border-2 border-amber-200 p-3.5 text-sm text-[#23140E] focus:outline-none focus:border-orange-500"
                />

                <div className="flex flex-wrap gap-1.5">
                  {[
                    'يا ساتر! وش هالمصيبة اللي طاحت علينا؟',
                    'اسمعني زين، القهوة بردت وأنا ما بعد تقهويت!',
                    'ورّني شطارتك قدّام الكاميرا الحين 😂',
                  ].map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setScriptDraft(idea)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[#5A3E32] hover:bg-amber-100 cursor-pointer"
                    >
                      + {idea}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      SoundFX.playCorrect();
                      onSendAction({ type: 'dub_submit_script', script: scriptDraft });
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-l from-teal-500 to-emerald-500 text-white font-black text-xs cursor-pointer"
                  >
                    حفظ النص وتحديد كـ «جاهز للأداء» ✅
                  </button>
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => onSendAction({ type: 'dub_skip_watch' })}
                      className="w-full py-2.5 rounded-xl bg-orange-500 text-white font-black text-xs cursor-pointer"
                    >
                      ابدأ مرحلة المايك والتسجيل للجميع 🎙️
                    </button>
                  )}
                </div>
              </>
            )}

            {dub.phase === 'performing' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-[#23140E]">استوديو المايك المباشر 🎙️</h2>
                  <span className="text-xs font-black text-orange-700 bg-amber-100 px-2.5 py-1 rounded-full">
                    {dub.takes.length} / {room.players.length} أدّوا
                  </span>
                </div>

                {(scriptDraft || dub.scriptsByPlayer[localPlayerId]) && (
                  <div className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-3 text-xs">
                    <span className="font-black text-orange-700">نصّك المقترح: </span>
                    <span className="text-[#23140E]">
                      {scriptDraft || dub.scriptsByPlayer[localPlayerId]}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-[#6B4E40]">
                    أو اكتب تعليقك/ارتجالك السريع مع التسجيل:
                  </label>
                  <input
                    type="text"
                    value={scriptDraft}
                    onChange={(e) => setScriptDraft(e.target.value)}
                    placeholder="وش بتقول في المشهد..."
                    className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 px-3 py-2 text-xs text-[#23140E]"
                  />
                </div>

                <div className="flex flex-col gap-2.5">
                  {!isRecording ? (
                    <button
                      type="button"
                      disabled={uploadingTake || countdownNum !== null}
                      onClick={() => void startLiveRecordingWithCountdown()}
                      className="w-full py-4 rounded-2xl bg-gradient-to-l from-rose-500 via-red-500 to-orange-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                    >
                      <Mic className="w-5 h-5" />
                      <span>
                        {uploadingTake
                          ? 'جاري رفع الدوبلاج...'
                          : myTake
                            ? 'إعادة تسجيل صوتي بالدوبلاج 🎙️'
                            : 'ابدأ التسجيل الصوتي (عد تنازلي 3..2..1) 🎙️'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopLiveRecording}
                      className="w-full py-4 rounded-2xl bg-rose-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg animate-pulse cursor-pointer"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      <span>إيقاف وحفظ الدوبلاج ({recordSeconds}ث / 30ث)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={uploadingTake}
                    onClick={() => void uploadRecordedTake(undefined, 6)}
                    className="w-full py-2.5 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-200 text-[#5A3E32] font-black text-xs cursor-pointer"
                  >
                    إرسال الأداء بالنص فقط بدون مايك ✍️
                  </button>
                </div>

                {micError && (
                  <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                    {micError}
                  </p>
                )}

                {myTake && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 space-y-1.5">
                    <div className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>تم اعتماد مشاركتك بنجاح!</span>
                    </div>
                    {myTake.audioDataUrl && (
                      <audio controls src={myTake.audioDataUrl} className="w-full h-8" />
                    )}
                  </div>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={() => onSendAction({ type: 'dub_go_ruined_it' })}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 text-white font-black text-sm cursor-pointer shadow-md"
                  >
                    انتهينا! شغل عرض «خربنا المشهد» للجميع 🎬😂
                  </button>
                )}
              </>
            )}

            {dub.phase === 'ruined_it' && (
              <>
                <div className="rounded-2xl bg-gradient-to-l from-rose-500 to-orange-500 text-white p-3.5 text-center space-y-1">
                  <div className="text-base font-black">خربنا المشهد | RUINED IT! 😂🎬</div>
                  <div className="text-[11px] opacity-95">
                    قارنوا بين المشهد الأصلي بالإنجليزي وبين هبد الشباب بالعربي!
                  </div>
                </div>

                <audio ref={takeAudioRef} className="w-full h-9" controls />

                {/* Switch Original vs Arabic Dubbed */}
                {isHost && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSendAction({ type: 'dub_set_replay', replayMode: 'original' })
                      }
                      className={`py-2.5 rounded-xl text-xs font-black cursor-pointer ${
                        dub.replayMode === 'original'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#FFF8EE] text-[#5A3E32] border border-amber-200'
                      }`}
                    >
                      🔊 المشهد الأصلي
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSendAction({ type: 'dub_set_replay', replayMode: 'dubbed' })
                      }
                      className={`py-2.5 rounded-xl text-xs font-black cursor-pointer ${
                        dub.replayMode !== 'original'
                          ? 'bg-orange-600 text-white'
                          : 'bg-[#FFF8EE] text-[#5A3E32] border border-amber-200'
                      }`}
                    >
                      🎙️ دوبلاجنا الخربان
                    </button>
                  </div>
                )}

                {/* List of Takes */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {dub.takes.length === 0 ? (
                    <p className="text-xs text-[#7C5D4F] text-center py-4">
                      لا توجد تسجيلات صوتية مرفوعة في هذه الجولة.
                    </p>
                  ) : (
                    dub.takes.map((t: DubTakeRecord, idx: number) => (
                      <div
                        key={t.id}
                        onClick={() => setActiveReplayTakeIdx(idx)}
                        className={`rounded-2xl border p-2.5 flex items-center justify-between gap-2 cursor-pointer transition ${
                          idx === activeReplayTakeIdx
                            ? 'bg-amber-50 border-orange-400'
                            : 'bg-[#FFFDF9] border-amber-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CharacterAvatar
                            avatarId={t.playerAvatar}
                            backgroundColor={t.playerAvatarBg}
                            size={30}
                            interactive={false}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-black text-[#23140E] truncate">
                              {t.playerName} {t.characterName ? `(${t.characterName})` : ''}
                            </div>
                            <div className="text-[11px] text-[#6B4E40] truncate">
                              {t.scriptText}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-orange-700 shrink-0">
                          {t.audioDataUrl ? '🔊 تشغيل' : '✍️ نص'}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {isHost && (
                  <button
                    type="button"
                    onClick={() => onSendAction({ type: 'dub_go_voting' })}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-l from-teal-500 to-emerald-500 text-white font-black text-sm cursor-pointer shadow-md"
                  >
                    الانتقال للتصويت واختيار الأفضل 🗳️
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* PHASE 6: VOTING (No Self-Vote Enforced) */}
      {dub.phase === 'voting' && (
        <div className="rounded-3xl bg-white border-2 border-amber-300 p-6 space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-[#23140E]">تصويت الجمهور — اختر أبطال الجولة 🗳️</h2>
              <p className="text-xs text-[#6B4E40] mt-1">
                صوّت للاعبين الآخرين في الفئات الخمس (ممنوع التصويت لنفسك!).
              </p>
            </div>
            <span className="text-xs font-black bg-amber-100 text-orange-800 px-3 py-1 rounded-full">
              صوّت {Object.keys(dub.votes).length} من {room.players.length}
            </span>
          </div>

          {dub.votes[localPlayerId] ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-[#23140E]">تم اعتماد تصويتك بنجاح! 🎉</h3>
              <p className="text-xs text-[#6B4E40]">بانتظار تصويت بقية اللاعبين لإعلان النتائج...</p>
              {isHost && (
                <button
                  type="button"
                  onClick={() => onSendAction({ type: 'dub_finalize_results' })}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-black text-xs cursor-pointer"
                >
                  إعلان النتائج الآن ⚡
                </button>
              )}
            </div>
          ) : otherPlayers.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm font-bold text-[#5A3E32]">أنت وحدك في الغرفة حالياً — يمكن المضيف إعلان النتيجة مباشرة.</p>
              {isHost && (
                <button
                  type="button"
                  onClick={() => onSendAction({ type: 'dub_finalize_results' })}
                  className="px-6 py-3 rounded-xl bg-orange-500 text-white font-black text-sm cursor-pointer"
                >
                  عرض النتيجة والملخص 🏆
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DUB_VOTE_CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    className="rounded-2xl bg-[#FFF8EE] border border-amber-200 p-4 space-y-2.5"
                  >
                    <div className="text-sm font-black text-[#23140E]">
                      {cat.emoji} {cat.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {room.players
                        .filter((p) => !p.isJudge)
                        .map((p) => {
                          const isSelf = p.id === localPlayerId;
                          const selected = myVotes[cat.id] === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={isSelf}
                              onClick={() => {
                                SoundFX.playClick();
                                setVoteError('');
                                setMyVotes((prev) => ({ ...prev, [cat.id]: p.id }));
                              }}
                              title={isSelf ? 'لا يمكنك التصويت لنفسك' : p.name}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition ${
                                isSelf
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                  : selected
                                    ? 'bg-orange-500 text-white border-orange-600 shadow-sm cursor-pointer'
                                    : 'bg-white text-[#23140E] border-amber-200 hover:border-orange-400 cursor-pointer'
                              }`}
                            >
                              <CharacterAvatar
                                avatarId={p.avatar}
                                backgroundColor={p.avatarBg}
                                size={22}
                                interactive={false}
                              />
                              <span>{p.name}</span>
                              {isSelf && <span className="text-[10px]">(أنت)</span>}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>

              {voteError && (
                <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-center">
                  {voteError}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (Object.keys(myVotes).length === 0) {
                      setVoteError('اختر لاعباً في تصنيف واحد على الأقل قبل إرسال تصويتك!');
                      return;
                    }
                    SoundFX.playCorrect();
                    onSendAction({ type: 'dub_cast_vote', votes: myVotes });
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-sm cursor-pointer shadow-md"
                >
                  اعتماد وإرسال تصويتي ✅
                </button>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => onSendAction({ type: 'dub_finalize_results' })}
                    className="px-5 py-3.5 rounded-2xl bg-[#FFF8EE] border border-amber-300 text-orange-900 font-black text-xs cursor-pointer"
                  >
                    إنهاء التصويت وعرض النتائج
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* PHASE 7: RESULTS PODIUM + FUNNY TITLES + ACHIEVEMENTS */}
      {dub.phase === 'results' && (
        <div className="rounded-3xl bg-white border-2 border-amber-300 p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-2xl sm:text-3xl font-black text-[#23140E]">نتائج جولة مايك الدوبلاج 🏆</h2>
            <p className="text-xs text-[#6B4E40]">ألقاب وإنجازات ونقاط تضاف لرصيدكم في المنصة!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {(dub.roundAwards || []).map((aw, index) => {
              const p = room.players.find((pl) => pl.id === aw.playerId);
              const isWinner = aw.playerId === dub.winnerPlayerId;
              return (
                <div
                  key={aw.playerId}
                  className={`rounded-2xl p-4 border-2 flex items-center justify-between gap-3 ${
                    isWinner
                      ? 'bg-gradient-to-l from-amber-50 to-orange-50 border-orange-400 shadow-md'
                      : 'bg-[#FFFDF9] border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <CharacterAvatar
                        avatarId={p?.avatar || 'char_01'}
                        backgroundColor={p?.avatarBg}
                        size={48}
                        mood={isWinner ? 'win' : 'idle'}
                        interactive={false}
                      />
                      {isWinner && (
                        <Crown className="w-5 h-5 text-amber-500 absolute -top-2 -right-1" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-[#23140E] flex items-center gap-1.5">
                        <span>#{index + 1}</span>
                        <span className="truncate">{aw.playerName}</span>
                      </div>
                      <div className="text-xs font-black text-orange-700 mt-0.5">{aw.title}</div>
                      {aw.achievement && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1">
                          <Award className="w-3 h-3" />
                          <span>إنجاز: {aw.achievement}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <div className="text-lg font-black text-orange-600 tabular-nums">
                      +{aw.points}
                    </div>
                    <div className="text-[10px] font-bold text-[#7C5D4F]">نقطة</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {isHost ? (
              <>
                <button
                  type="button"
                  onClick={() => onSendAction({ type: 'dub_play_again' })}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-sm flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>مشهد إنجليزي جديد وجولة جديدة 🎬</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendAction({ type: 'return_to_lobby' })}
                  className="px-5 py-3.5 rounded-2xl bg-[#FFF8EE] border border-amber-200 text-[#5A3E32] font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>العودة للوبي الغرفة</span>
                </button>
              </>
            ) : (
              <div className="text-xs font-bold text-[#6B4E40]">
                بانتظار المضيف لبدء مشهد جديد أو العودة للوبي...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
