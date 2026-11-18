class JamrSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('jamr_sound_enabled') : null;
      this.enabled = saved !== 'false';
    } catch {
      this.enabled = true;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('jamr_sound_enabled', val ? 'true' : 'false');
      }
    } catch {
      // ignore storage errors
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled) this.playClick();
    return this.enabled;
  }

  private getCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0,
    freqEnd?: number
  ) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + duration);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // ignore audio errors
    }
  }

  playClick() {
    this.tone(620, 0.06, 'triangle', 0.08, 0, 420);
  }

  playTileSelect() {
    this.tone(440, 0.09, 'sine', 0.1, 0, 660);
    this.tone(660, 0.09, 'triangle', 0.07, 0.05, 880);
  }

  playTick(isUrgent = false) {
    if (isUrgent) {
      this.tone(920, 0.08, 'square', 0.07, 0, 720);
    } else {
      this.tone(540, 0.045, 'sine', 0.05);
    }
  }

  playCorrect() {
    this.tone(523.25, 0.12, 'triangle', 0.13, 0);
    this.tone(659.25, 0.12, 'triangle', 0.13, 0.09);
    this.tone(783.99, 0.24, 'triangle', 0.14, 0.18);
  }

  playWrong() {
    this.tone(240, 0.18, 'sawtooth', 0.1, 0, 180);
    this.tone(175, 0.28, 'sawtooth', 0.1, 0.14, 120);
  }

  playLifeline() {
    this.tone(440, 0.1, 'sine', 0.1, 0);
    this.tone(554.37, 0.1, 'sine', 0.1, 0.07);
    this.tone(659.25, 0.1, 'sine', 0.1, 0.14);
    this.tone(880, 0.22, 'triangle', 0.12, 0.21);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, idx === notes.length - 1 ? 0.45 : 0.13, 'triangle', 0.14, idx * 0.1);
    });
  }

  playWin() {
    this.playVictory();
  }

  playHoneycomb() {
    this.tone(392, 0.1, 'sine', 0.1, 0);
    this.tone(587.33, 0.16, 'triangle', 0.12, 0.07);
  }

  playNight() {
    this.tone(220, 0.35, 'sine', 0.09, 0, 140);
    this.tone(164.81, 0.45, 'sine', 0.08, 0.2, 110);
  }

  playGong() {
    this.tone(146.83, 0.9, 'triangle', 0.16, 0, 138);
    this.tone(220, 0.75, 'sine', 0.1, 0.02, 200);
  }

  playMicBeep() {
    this.tone(880, 0.09, 'sine', 0.09, 0);
    this.tone(1174.66, 0.12, 'sine', 0.09, 0.1);
  }

  playMemeSound() {
    this.tone(330, 0.1, 'square', 0.09, 0, 494);
    this.tone(494, 0.12, 'square', 0.09, 0.09, 659);
    this.tone(880, 0.2, 'sawtooth', 0.08, 0.18, 440);
  }
}

export const SoundFX = new JamrSoundEngine();
