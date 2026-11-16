import React, { useEffect, useRef, useState } from 'react';
import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Radio } from 'lucide-react';
import { Player } from '../../types/jamr';
import { JamrSocketClient } from '../../network/socketClient';
import { VoicePeerState, VoiceSignalMessage, WebRtcVoiceMesh } from '../../utils/webrtcVoice';
import { SoundFX } from '../../utils/soundFx';

interface VoiceChatBarProps {
  players: Player[];
  localPlayerId: string;
  socketClient: JamrSocketClient | null;
  compact?: boolean;
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({
  players,
  localPlayerId,
  socketClient,
  compact = false,
}) => {
  const [voiceActive, setVoiceActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState('');
  const [peerStates, setPeerStates] = useState<Record<string, VoicePeerState>>({});

  const meshRef = useRef<WebRtcVoiceMesh | null>(null);

  useEffect(() => {
    const mesh = new WebRtcVoiceMesh(
      localPlayerId,
      (payload) => socketClient?.send(payload),
      (states) => setPeerStates(states)
    );
    meshRef.current = mesh;

    const unsubscribe = socketClient?.onVoiceSignal((raw) => {
      void mesh.handleSignal(raw as unknown as VoiceSignalMessage);
    });

    return () => {
      unsubscribe?.();
      mesh.stop();
    };
  }, [localPlayerId, socketClient]);

  const toggleVoiceJoin = async () => {
    SoundFX.playClick();
    setError('');
    if (voiceActive) {
      meshRef.current?.stop();
      setVoiceActive(false);
      setMuted(false);
      setDeafened(false);
      return;
    }

    try {
      await meshRef.current?.start(players.map((p) => p.id));
      setVoiceActive(true);
    } catch (err) {
      setVoiceActive(false);
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'تم رفض إذن المايكروفون! اسمح للمتصفح بالوصول إلى المايك لتفعيل الدردشة الصوتية.'
          : err instanceof Error
            ? err.message
            : 'تعذر تشغيل المايكروفون.'
      );
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    meshRef.current?.setMuted(next);
  };

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    meshRef.current?.setDeafened(next);
  };

  const activeSpeakersCount = Object.values(peerStates).filter((s) => s.connected).length;

  return (
    <div
      className={`rounded-2xl border-2 transition-all ${
        voiceActive
          ? 'bg-emerald-50/90 border-emerald-300 shadow-sm'
          : 'bg-[#FFF8EE] border-amber-200'
      } ${compact ? 'p-2.5' : 'p-3.5'} space-y-2`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${voiceActive ? 'text-emerald-600 animate-pulse' : 'text-orange-500'}`} />
          <span className="text-xs font-black text-[#23140E]">
            الدردشة الصوتية المباشرة {voiceActive ? `(متصل · ${Math.max(1, activeSpeakersCount)})` : '(المايك مغلق)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {voiceActive && (
            <>
              <button
                type="button"
                onClick={toggleMute}
                title={muted ? 'فتح المايك' : 'كتم المايك'}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1 cursor-pointer ${
                  muted
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-white text-emerald-700 border border-emerald-200'
                }`}
              >
                {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{muted ? 'مكتوم' : 'المايك مفتوح'}</span>
              </button>

              <button
                type="button"
                onClick={toggleDeafen}
                title={deafened ? 'تشغيل السماعة' : 'كتم السماعة'}
                className={`p-1.5 rounded-xl border text-xs cursor-pointer ${
                  deafened
                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-white text-[#5A3E32] border-amber-200'
                }`}
              >
                {deafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void toggleVoiceJoin()}
            className={`px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-xs ${
              voiceActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-gradient-to-l from-teal-500 to-emerald-500 text-white'
            }`}
          >
            {voiceActive ? <PhoneOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{voiceActive ? 'إنهاء الصوت' : 'تفعيل المايك والتحدث'}</span>
          </button>
        </div>
      </div>

      {/* Live Speaking Indicator Badges */}
      {voiceActive && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {players.map((p) => {
            const st = peerStates[p.id];
            const isSpeaking = Boolean(st?.speaking && !st?.muted);
            const isConnected = Boolean(st?.connected);
            return (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition ${
                  isSpeaking
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                    : isConnected
                      ? 'bg-white text-[#23140E] border-emerald-200'
                      : 'bg-white/60 text-[#7C5D4F] border-amber-200/70'
                }`}
              >
                {st?.muted ? (
                  <MicOff className="w-3 h-3 text-rose-500" />
                ) : (
                  <Mic className={`w-3 h-3 ${isSpeaking ? 'text-white' : 'text-emerald-600'}`} />
                )}
                <span>{p.name}</span>
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
};
