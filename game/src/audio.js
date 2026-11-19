// Asset-free Web Audio: ambience, engines, sirens, weapons, UI and a three-station radio.
import { createRandom, clamp } from './config.js';

export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.volume = 0.65;
    this.noiseBuffer = null;
    this.engineNodes = null;
    this.surfNodes = null;
    this.radioStation = 0;
    this.radioTimer = 0;
    this.radioStep = 0;
    this.radioGain = null;
    this.dialogueDucked = false;
    this.lastSiren = 0;
    this.gullTimer = 9;
    this.random = createRandom(123887);
  }

  ensureContext() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return true;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    try {
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.radioGain = this.context.createGain();
      this.radioGain.gain.value = 0.8;
      this.radioGain.connect(this.master);
      const length = this.context.sampleRate * 2;
      this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = this.random() * 2 - 1;
      this.startSurf();
      return true;
    } catch { return false; }
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master && this.context) this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
  }

  setDialogueDuck(active) {
    this.dialogueDucked = active;
    if (this.radioGain && this.context) this.radioGain.gain.setTargetAtTime(active ? 0.16 : 0.8, this.context.currentTime, 0.16);
  }

  tone(frequency, duration, options = {}) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(Math.max(25, frequency), now);
    if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, options.endFrequency), now + duration);
    const volume = options.volume ?? 0.08;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + (options.attack || 0.008));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(options.destination || this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.025);
  }

  noise(duration, options = {}) {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = options.filter || 'lowpass';
    filter.frequency.value = options.frequency || 1200;
    filter.Q.value = options.q || 0.7;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(options.volume || 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(options.destination || this.master);
    source.start(now, this.random() * 0.8, duration + 0.02);
  }

  startSurf() {
    if (!this.context || this.surfNodes) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const low = this.context.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 520;
    const gain = this.context.createGain();
    gain.gain.value = 0.022;
    source.connect(low);
    low.connect(gain);
    gain.connect(this.master);
    source.start();
    this.surfNodes = { source, gain };
  }

  startEngine() {
    if (!this.ensureContext() || this.engineNodes) return;
    const low = this.context.createOscillator();
    const high = this.context.createOscillator();
    low.type = 'sawtooth';
    high.type = 'square';
    low.frequency.value = 54;
    high.frequency.value = 108;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const gain = this.context.createGain();
    gain.gain.value = 0.025;
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    low.start();
    high.start();
    this.engineNodes = { low, high, filter, gain };
  }

  stopEngine() {
    if (!this.engineNodes) return;
    for (const oscillator of [this.engineNodes.low, this.engineNodes.high]) {
      try { oscillator.stop(); } catch { /* already stopped */ }
    }
    this.engineNodes = null;
  }

  cycleRadio() {
    this.radioStation = (this.radioStation + 1) % 3;
    this.radioStep = 0;
    this.radioTimer = 0;
    const names = ['Radio Brisa — bolero', 'FM Olas — night synth', 'PCM Voz — talk'];
    return names[this.radioStation];
  }

  playRadioStep() {
    const step = this.radioStep++;
    if (this.radioStation === 0) {
      const melody = [220, 261.63, 329.63, 293.66, 246.94, 261.63, 196, 220];
      const bass = [110, 110, 130.81, 98];
      this.tone(melody[step % melody.length], 0.35, { type: 'triangle', volume: 0.018, destination: this.radioGain, attack: 0.04 });
      if (step % 2 === 0) this.tone(bass[(step / 2) % bass.length | 0], 0.45, { type: 'sine', volume: 0.028, destination: this.radioGain });
      if (step % 4 === 2) this.noise(0.035, { filter: 'highpass', frequency: 3500, volume: 0.007, destination: this.radioGain });
    } else if (this.radioStation === 1) {
      const bass = [110, 110, 146.83, 164.81, 110, 220, 196, 146.83];
      this.tone(bass[step % 8], 0.18, { type: 'sawtooth', volume: 0.018, destination: this.radioGain });
      this.tone(bass[step % 8] * 2, 0.13, { type: 'square', volume: step % 2 ? 0.005 : 0.011, destination: this.radioGain });
      if (step % 2 === 0) this.tone(52, 0.11, { endFrequency: 34, volume: 0.05, destination: this.radioGain });
    } else {
      // Speech-like fundamental and two filtered formants, with irregular phrasing.
      this.tone(92 + this.random() * 38, 0.18 + this.random() * 0.12, { type: 'sawtooth', endFrequency: 85 + this.random() * 50, volume: 0.008, destination: this.radioGain, attack: 0.035 });
      this.noise(0.13, { filter: 'bandpass', frequency: 780 + this.random() * 520, q: 5, volume: 0.012, destination: this.radioGain });
      if (step % 9 === 0) this.tone(1180, 0.06, { volume: 0.006, destination: this.radioGain });
    }
  }

  update(deltaTime, game) {
    if (!this.context) return;
    if (this.engineNodes) {
      const speed = Math.abs(game.player.vehicle?.speed || 0);
      const now = this.context.currentTime;
      this.engineNodes.low.frequency.setTargetAtTime(52 + speed * 4.7, now, 0.05);
      this.engineNodes.high.frequency.setTargetAtTime(106 + speed * 9.3, now, 0.05);
      this.engineNodes.filter.frequency.setTargetAtTime(320 + speed * 22, now, 0.08);
      this.engineNodes.gain.gain.setTargetAtTime(game.player.vehicle ? 0.026 : 0.0001, now, 0.1);
    }
    if (game.state === 'playing') {
      this.radioTimer -= deltaTime;
      if (game.player.vehicle && this.radioTimer <= 0) {
        this.playRadioStep();
        const intervals = [0.31, 0.18, 0.24];
        this.radioTimer = intervals[this.radioStation];
      }
      this.gullTimer -= deltaTime;
      if (this.gullTimer <= 0 && game.player.position.z > 140) {
        this.tone(1120, 0.4, { endFrequency: 1780, volume: 0.012, type: 'sine' });
        this.tone(1370, 0.31, { endFrequency: 980, volume: 0.008, type: 'sine' });
        this.gullTimer = 13 + this.random() * 17;
      }
    }
  }

  gunshot(weapon = 'pistola', scale = 1) {
    const duration = weapon === 'escopeta' ? 0.28 : weapon === 'subfusil' ? 0.12 : 0.19;
    this.noise(duration, { filter: 'bandpass', frequency: weapon === 'escopeta' ? 470 : 880, q: 0.8, volume: 0.19 * scale });
    this.tone(weapon === 'escopeta' ? 75 : 110, duration, { endFrequency: 36, type: 'square', volume: 0.12 * scale });
  }
  siren(scale = 1) {
    if (!this.context || this.context.currentTime - this.lastSiren < 0.45) return;
    this.lastSiren = this.context.currentTime;
    this.tone(660, 0.28, { endFrequency: 880, type: 'triangle', volume: 0.026 * scale });
    this.tone(880, 0.45, { endFrequency: 620, type: 'triangle', volume: 0.022 * scale });
  }
  footstep(sprint) { this.noise(0.07, { frequency: sprint ? 190 : 150, volume: sprint ? 0.035 : 0.021 }); }
  crash() { this.noise(0.24, { frequency: 650, volume: 0.14 }); this.tone(72, 0.2, { endFrequency: 32, volume: 0.06 }); }
  explosion() { this.noise(0.8, { frequency: 290, volume: 0.28 }); this.tone(48, 0.65, { endFrequency: 24, volume: 0.24 }); }
  honk() { this.tone(315, 0.19, { type: 'square', volume: 0.026 }); this.tone(392, 0.16, { type: 'square', volume: 0.019 }); }
  reload() { this.noise(0.045, { frequency: 2300, volume: 0.045 }); this.tone(410, 0.05, { volume: 0.02 }); }
  hurt() { this.tone(84, 0.15, { endFrequency: 58, type: 'sawtooth', volume: 0.04 }); }
  uiClick() { this.tone(520, 0.055, { endFrequency: 630, volume: 0.035 }); }
  pickup() { this.tone(620, 0.1, { endFrequency: 920, volume: 0.06 }); }
  wanted() { this.tone(185, 0.16, { endFrequency: 240, type: 'sawtooth', volume: 0.045 }); }
  missionComplete() {
    [220, 277.18, 329.63, 440].forEach((note, index) => {
      window.setTimeout(() => this.tone(note, 0.42, { type: 'triangle', volume: 0.055 }), index * 115);
    });
  }
}
