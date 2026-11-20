// All sound, synthesised with the Web Audio API: an engine loop pitched to road speed, a two-tone
// siren, gunshots from filtered noise bursts, footsteps, gulls, surf, UI clicks, and a
// three-station radio (a bolero, a synthwave loop, a news/talk formant voice). Music ducks under
// dialogue. Nothing is loaded from a file: every voice is an oscillator or a noise buffer.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuffer = null;
  let engine = null;
  let siren = null;
  let radio = null;
  let started = false;
  const state = { volume: 0.7, musicVolume: 0.4, muted: false, station: 0, radioOn: true };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.volume;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = state.musicVolume;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function noise(duration, filterType = 'bandpass', freq = 1200, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    src.connect(filter); filter.connect(gain); gain.connect(sfxGain);
    return { src, filter, gain };
  }

  function tone(type, freq, duration, gain = 0.2, dest = sfxGain, detune = 0) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    osc.connect(g); g.connect(dest);
    return { osc, gain: g };
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  const play = {
    gunshot(id = 'pistol', volume = 1) {
      if (!ensure()) return;
      const now = ctx.currentTime;
      const cfg = id === 'brisa' ? { dur: 0.4, freq: 900, vol: 0.5 } : id === 'shotgun' ? { dur: 0.3, freq: 500, vol: 0.7 } : id === 'smg' ? { dur: 0.12, freq: 1600, vol: 0.4 } : { dur: 0.18, freq: 1400, vol: 0.5 };
      const n = noise(cfg.dur, 'lowpass', cfg.freq, 0.8);
      n.gain.gain.setValueAtTime(cfg.vol * volume, now);
      n.gain.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur);
      n.src.start(now); n.src.stop(now + cfg.dur);
      const t = tone('triangle', 120, cfg.dur, 0.25);
      t.osc.frequency.exponentialRampToValueAtTime(50, now + cfg.dur);
      t.gain.gain.setValueAtTime(0.25 * volume, now);
      t.gain.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur);
      t.osc.start(now); t.osc.stop(now + cfg.dur);
    },
    impact(strength = 1) {
      if (!ensure()) return;
      const now = ctx.currentTime;
      const n = noise(0.2, 'lowpass', 700, 0.6);
      n.gain.gain.setValueAtTime(Math.min(0.5, 0.25 * strength), now);
      n.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      n.src.start(now); n.src.stop(now + 0.2);
    },
    explosion() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      const n = noise(1.4, 'lowpass', 500, 0.4);
      n.gain.gain.setValueAtTime(0.8, now);
      n.gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      n.src.start(now); n.src.stop(now + 1.4);
      const t = tone('sine', 80, 1.2, 0.5);
      t.osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
      t.gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      t.osc.start(now); t.osc.stop(now + 1.2);
    },
    reload() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      for (const [t0, f] of [[0.0, 1800], [0.16, 1100]]) {
        const n = noise(0.05, 'bandpass', f, 4);
        n.gain.gain.setValueAtTime(0.18, now + t0);
        n.gain.gain.exponentialRampToValueAtTime(0.001, now + t0 + 0.05);
        n.src.start(now + t0); n.src.stop(now + t0 + 0.06);
      }
    },
    footstep() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      const n = noise(0.06, 'bandpass', 300 + Math.random() * 200, 2);
      n.gain.gain.setValueAtTime(0.05, now);
      n.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      n.src.start(now); n.src.stop(now + 0.07);
    },
    horn() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      for (const f of [320, 404]) {
        const t = tone('square', f, 0.32, 0.08);
        t.gain.gain.setValueAtTime(0.0, now);
        t.gain.gain.linearRampToValueAtTime(0.07, now + 0.03);
        t.gain.gain.linearRampToValueAtTime(0.0, now + 0.32);
        t.osc.start(now); t.osc.stop(now + 0.34);
      }
    },
    ui() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      const t = tone('square', 880, 0.06, 0.05);
      t.gain.gain.setValueAtTime(0.05, now);
      t.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      t.osc.start(now); t.osc.stop(now + 0.07);
    },
    pickup() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      [660, 880, 1320].forEach((f, i) => {
        const t = tone('triangle', f, 0.12, 0.08);
        t.gain.gain.setValueAtTime(0.0001, now + i * 0.06);
        t.gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.06 + 0.01);
        t.gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.12);
        t.osc.start(now + i * 0.06); t.osc.stop(now + i * 0.06 + 0.13);
      });
    },
  };

  function startEngine() {
    if (!ensure() || engine) return;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(sfxGain);
    osc1.start(); osc2.start();
    engine = { osc1, osc2, filter, gain };
  }

  function startSiren() {
    if (!ensure() || siren) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain); gain.connect(sfxGain);
    osc.start();
    siren = { osc, gain };
  }

  function startRadio() {
    if (!ensure() || radio) return;
    const bus = ctx.createGain();
    bus.gain.value = state.radioOn ? 0.5 : 0;
    bus.connect(musicGain);
    const parts = [];
    // A slow chord pad that loops, plus a sequenced melody line; the station changes the notes.
    const pad = ctx.createOscillator();
    pad.type = 'triangle';
    const padGain = ctx.createGain();
    padGain.gain.value = 0.04;
    pad.connect(padGain); padGain.connect(bus);
    pad.start();
    parts.push({ pad, padGain });
    radio = { bus, parts, melodyTimer: 0.4, step: 0, station: state.station, phase: 0 };
  }

  // The radio step sequencer: notes chosen by the current station. Runs on the game loop via tick.
  const BOLERO = [220, 277.18, 329.63, 329.63, 293.66, 277.18, 246.94, 220];
  const NEON = [130.81, 130.81, 155.56, 196.0, 174.61, 155.56, 130.81, 116.54];
  const ONDA = [164.81, 164.81, 164.81, 164.81, 196.0, 196.0, 146.83, 146.83];

  function radioTick(dt) {
    if (!radio || state.muted) return;
    radio.melodyTimer -= dt;
    if (radio.melodyTimer > 0) return;
    const station = radio.station;
    const notes = station === 0 ? BOLERO : station === 1 ? NEON : ONDA;
    const stepDur = station === 0 ? 0.62 : station === 1 ? 0.28 : 0.5;
    radio.melodyTimer = stepDur;
    const now = ctx.currentTime;
    const f = notes[radio.step % notes.length];
    radio.step += 1;
    if (station === 2) {
      // A filtered formant "voice": a saw carrier with a wobbling bandpass, plus a tick for the news bed.
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 110 + Math.sin(radio.step * 0.7) * 25;
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = 500 + (radio.step % 4) * 220;
      formant.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.08, now + 0.05);
      g.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      osc.connect(formant); formant.connect(g); g.connect(radio.bus);
      osc.start(now); osc.stop(now + 0.42);
      radio.parts[0].pad.frequency.setTargetAtTime(f, now, 0.1);
      return;
    }
    const lead = tone('triangle', f, stepDur * 0.9, 0.05, radio.bus);
    lead.gain.gain.setValueAtTime(0.0001, now);
    lead.gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
    lead.gain.gain.exponentialRampToValueAtTime(0.001, now + stepDur * 0.9);
    lead.osc.start(now); lead.osc.stop(now + stepDur);
    if (station === 1) {
      const bass = tone('square', f / 2, stepDur * 0.5, 0.04, radio.bus);
      bass.gain.gain.setValueAtTime(0.04, now);
      bass.gain.gain.exponentialRampToValueAtTime(0.001, now + stepDur * 0.5);
      bass.osc.start(now); bass.osc.stop(now + stepDur * 0.5);
    }
    radio.parts[0].pad.frequency.setTargetAtTime(f * 0.5, now, 0.2);
  }

  function setWanted(level) {
    if (level > 0) startSiren();
    if (siren) {
      const now = ctx.currentTime;
      siren.gain.gain.setTargetAtTime(level > 0 ? 0.03 + level * 0.006 : 0, now, 0.3);
    }
  }

  const api = {
    play,
    unlock,
    state,
    startEngine,
    tick(dt, world) {
      if (!ensure()) return;
      // Radio station from the player's car.
      const car = world?.playerCar;
      if (car && world.player.inVehicle) {
        startRadio();
        if (radio) radio.station = car.radioStation ?? 0;
        if (radio) radio.bus.gain.setTargetAtTime(state.radioOn && !state.muted ? 0.5 : 0, ctx.currentTime, 0.2);
        radioTick(dt);
      } else if (radio) {
        radio.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
      // Engine pitch follows speed.
      if (world?.player.inVehicle && car) {
        startEngine();
        const speed = Math.abs(car.speed);
        const base = 60 + speed * 3.2;
        engine.osc1.frequency.setTargetAtTime(base, ctx.currentTime, 0.05);
        engine.osc2.frequency.setTargetAtTime(base * 0.5, ctx.currentTime, 0.05);
        engine.filter.frequency.setTargetAtTime(300 + speed * 25, ctx.currentTime, 0.08);
        engine.gain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
      } else if (engine) {
        engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
      // Siren two-tone.
      if (siren) {
        const t = (world?.time ?? 0) * 4.2;
        siren.osc.frequency.setTargetAtTime(650 + Math.sin(t) * 220, ctx.currentTime, 0.05);
      }
      setWanted(world?.police?.wanted ?? 0);
      // Duck the music under dialogue.
      if (musicGain && world?.hud?.subtitleTimer > 0) musicGain.gain.setTargetAtTime(state.musicVolume * 0.3, ctx.currentTime, 0.3);
      else if (musicGain) musicGain.gain.setTargetAtTime(state.musicVolume, ctx.currentTime, 0.4);
    },
    setVolume(v) {
      state.volume = v;
      if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    },
    setMusicVolume(v) {
      state.musicVolume = v;
      if (musicGain) musicGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    },
    motorON() { startEngine(); },
    nextStation() {
      state.station = (state.station + 1) % 3;
      if (radio) radio.station = state.station;
      return state.station;
    },
    updateSiren() {},
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  return api;
}
