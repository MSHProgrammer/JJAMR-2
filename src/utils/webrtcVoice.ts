export interface VoicePeerState {
  playerId: string;
  connected: boolean;
  speaking: boolean;
  muted?: boolean;
}

export interface VoiceSignalMessage {
  fromId: string;
  toId?: string;
  signal?: {
    type?: 'offer' | 'answer' | 'candidate' | 'join' | 'leave';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
  voiceActive?: boolean;
  muted?: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRtcVoiceMesh {
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private speakingIntervals = new Map<string, number>();
  private audioCtx: AudioContext | null = null;
  private muted = false;
  private deafened = false;
  private active = false;
  private localPlayerId: string;
  private sendSignal: (msg: Record<string, unknown>) => void;
  private onPeersUpdate: (states: Record<string, VoicePeerState>) => void;
  private peerStates: Record<string, VoicePeerState> = {};

  constructor(
    localPlayerId: string,
    sendSignal: (msg: Record<string, unknown>) => void,
    onPeersUpdate: (states: Record<string, VoicePeerState>) => void
  ) {
    this.localPlayerId = localPlayerId;
    this.sendSignal = sendSignal;
    this.onPeersUpdate = onPeersUpdate;
  }

  public isActive() {
    return this.active;
  }

  public async start(roomPlayerIds: string[]): Promise<void> {
    if (this.active) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('متصفحك لا يدعم التقاط المايكروفون.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.localStream = stream;
    this.active = true;
    this.muted = false;

    this.monitorSpeaking(this.localPlayerId, stream);
    this.updatePeerState(this.localPlayerId, {
      playerId: this.localPlayerId,
      connected: true,
      speaking: false,
      muted: false,
    });

    // Notify everyone in room that our voice mic is active
    this.sendSignal({
      type: 'voice_signal',
      signal: { type: 'join' },
      voiceActive: true,
      muted: false,
    });

    // Establish peer connections deterministically (lower ID initiates offer)
    for (const remoteId of roomPlayerIds) {
      if (!remoteId || remoteId === this.localPlayerId) continue;
      if (this.localPlayerId < remoteId) {
        await this.createOfferForPeer(remoteId);
      }
    }
  }

  public stop(): void {
    if (this.active) {
      this.sendSignal({
        type: 'voice_signal',
        signal: { type: 'leave' },
        voiceActive: false,
      });
    }
    this.active = false;
    this.peers.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore
      }
    });
    this.peers.clear();

    this.audioElements.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        // ignore
      }
    });
    this.audioElements.clear();

    this.speakingIntervals.forEach((id) => clearInterval(id));
    this.speakingIntervals.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.peerStates = {};
    this.onPeersUpdate({});
  }

  public setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
    this.updatePeerState(this.localPlayerId, {
      playerId: this.localPlayerId,
      connected: this.active,
      speaking: nextMuted ? false : Boolean(this.peerStates[this.localPlayerId]?.speaking),
      muted: nextMuted,
    });
    this.sendSignal({
      type: 'voice_signal',
      signal: { type: 'join' },
      voiceActive: this.active,
      muted: nextMuted,
    });
  }

  public setDeafened(nextDeafened: boolean): void {
    this.deafened = nextDeafened;
    this.audioElements.forEach((el) => {
      el.muted = nextDeafened;
    });
  }

  public async handleSignal(msg: VoiceSignalMessage): Promise<void> {
    const remoteId = msg.fromId;
    if (!remoteId || remoteId === this.localPlayerId) return;

    if (msg.voiceActive === false || msg.signal?.type === 'leave') {
      this.cleanupPeer(remoteId);
      return;
    }

    if (typeof msg.muted === 'boolean') {
      this.updatePeerState(remoteId, {
        ...(this.peerStates[remoteId] || { playerId: remoteId, connected: true, speaking: false }),
        muted: msg.muted,
      });
    }

    if (!this.active) return;

    const sig = msg.signal;
    if (!sig) return;

    if (sig.type === 'join') {
      if (this.localPlayerId < remoteId && !this.peers.has(remoteId)) {
        await this.createOfferForPeer(remoteId);
      }
      return;
    }

    if (sig.type === 'offer' && sig.sdp) {
      const pc = this.ensurePeerConnection(remoteId);
      await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal({
        type: 'voice_signal',
        toId: remoteId,
        signal: { type: 'answer', sdp: pc.localDescription || answer },
        voiceActive: true,
        muted: this.muted,
      });
      return;
    }

    if (sig.type === 'answer' && sig.sdp) {
      const pc = this.peers.get(remoteId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
      }
      return;
    }

    if (sig.type === 'candidate' && sig.candidate) {
      const pc = this.peers.get(remoteId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(sig.candidate)).catch(() => {});
      }
    }
  }

  private async createOfferForPeer(remoteId: string): Promise<void> {
    const pc = this.ensurePeerConnection(remoteId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal({
      type: 'voice_signal',
      toId: remoteId,
      signal: { type: 'offer', sdp: pc.localDescription || offer },
      voiceActive: true,
      muted: this.muted,
    });
  }

  private ensurePeerConnection(remoteId: string): RTCPeerConnection {
    const existing = this.peers.get(remoteId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(remoteId, pc);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'voice_signal',
          toId: remoteId,
          signal: { type: 'candidate', candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      let audio = this.audioElements.get(remoteId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.muted = this.deafened;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.audioElements.set(remoteId, audio);
      }
      audio.srcObject = remoteStream;
      void audio.play().catch(() => {});

      this.monitorSpeaking(remoteId, remoteStream);
      this.updatePeerState(remoteId, {
        playerId: remoteId,
        connected: true,
        speaking: false,
        muted: Boolean(this.peerStates[remoteId]?.muted),
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupPeer(remoteId);
      }
    };

    return pc;
  }

  private cleanupPeer(remoteId: string) {
    const pc = this.peers.get(remoteId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      this.peers.delete(remoteId);
    }
    const el = this.audioElements.get(remoteId);
    if (el) {
      el.pause();
      el.srcObject = null;
      el.remove();
      this.audioElements.delete(remoteId);
    }
    const interval = this.speakingIntervals.get(remoteId);
    if (interval) {
      clearInterval(interval);
      this.speakingIntervals.delete(remoteId);
    }
    const copy = { ...this.peerStates };
    delete copy[remoteId];
    this.peerStates = copy;
    this.onPeersUpdate(copy);
  }

  private monitorSpeaking(playerId: string, stream: MediaStream) {
    try {
      const AudioContextCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextCtor();
      }
      const ctx = this.audioCtx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const existingInterval = this.speakingIntervals.get(playerId);
      if (existingInterval) clearInterval(existingInterval);

      const timer = window.setInterval(() => {
        if (!this.active) return;
        if (playerId === this.localPlayerId && this.muted) {
          if (this.peerStates[playerId]?.speaking) {
            this.updatePeerState(playerId, {
              ...this.peerStates[playerId],
              speaking: false,
            });
          }
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const speakingNow = avg > 18;
        if (Boolean(this.peerStates[playerId]?.speaking) !== speakingNow) {
          this.updatePeerState(playerId, {
            playerId,
            connected: true,
            speaking: speakingNow,
            muted: this.peerStates[playerId]?.muted,
          });
        }
      }, 180);

      this.speakingIntervals.set(playerId, timer);
    } catch {
      // AudioContext unavailable
    }
  }

  private updatePeerState(playerId: string, state: VoicePeerState) {
    this.peerStates = {
      ...this.peerStates,
      [playerId]: state,
    };
    this.onPeersUpdate(this.peerStates);
  }
}
