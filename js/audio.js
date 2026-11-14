/* ============================================================
   audio.js — generative tanpura, tabla, plucks and SFX
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;

  const A = {
    ctx: null,
    master: null,
    musicBus: null,
    sfxBus: null,
    reverb: null,
    reverbSend: null,
    droneGain: null,
    noise: null,
    playing: false,
    timer: null,
    step: 0,
    nextTime: 0,
    bpm: 76,
    intensity: 1,
    startTime: 0,
    started: false,
    _lastBeatStep: -1,
    droneNodes: [],
  };

  const SCALE = [0, 1, 3, 5, 7, 8, 10]; // Bhairavi-ish
  const ROOT = 146.83; // D3

  function now() { return A.ctx ? A.ctx.currentTime : 0; }

  function gainNode(value) {
    const g = A.ctx.createGain();
    g.gain.value = value;
    return g;
  }

  function makeNoise() {
    const len = A.ctx.sampleRate * 2;
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeReverb() {
    const seconds = 2.2;
    const len = Math.floor(A.ctx.sampleRate * seconds);
    const buf = A.ctx.createBuffer(2, len, A.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8) * (1 - t * 0.3);
      }
    }
    const conv = A.ctx.createConvolver();
    conv.buffer = buf;
    const wet = gainNode(0.32);
    conv.connect(wet);
    wet.connect(A.master);
    return conv;
  }

  A.init = function init() {
    if (A.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    A.ctx = new Ctx();
    A.master = gainNode(0.9);
    A.master.connect(A.ctx.destination);

    A.reverb = makeReverb();
    A.noise = makeNoise();

    A.musicBus = gainNode(0.0);
    A.sfxBus = gainNode(0.0);

    const musicSend = gainNode(0.5);
    A.musicBus.connect(A.master);
    A.musicBus.connect(musicSend);
    musicSend.connect(A.reverb);

    const sfxSend = gainNode(0.35);
    A.sfxBus.connect(A.master);
    A.sfxBus.connect(sfxSend);
    sfxSend.connect(A.reverb);

    A.setVolume(SV.settings.volume);
    A.setSfx(SV.settings.sfx);
    A.started = true;
  };

  A.unlock = function unlock() {
    A.init();
    if (!A.ctx) return Promise.resolve();
    if (A.ctx.state === "suspended") {
      return A.ctx.resume().then(() => {
        if (SV.settings.music && !A.playing) A.startMusic();
      }).catch(() => {});
    }
    if (SV.settings.music && !A.playing) A.startMusic();
    return Promise.resolve();
  };

  A.setVolume = function setVolume(percent) {
    if (!A.ctx) return;
    const v = SV.util.clamp(percent / 100, 0, 1);
    const target = 0.62 * Math.pow(v, 1.25);
    A.musicBus.gain.setTargetAtTime(target, now(), 0.15);
  };

  A.setSfx = function setSfx(on) {
    if (!A.ctx) return;
    A.sfxBus.gain.setTargetAtTime(on ? 0.72 : 0, now(), 0.08);
  };

  /* ---------- instruments ---------- */

  function pluck(freq, time, dur, level, bus) {
    if (!A.ctx) return;
    const out = bus || A.musicBus;
    const t = time || now();
    const g = A.ctx.createGain();
    const f = A.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(Math.min(5200, freq * 7), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.6), t + dur * 0.72);
    f.Q.value = 0.6;

    const o1 = A.ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(freq, t);

    const o2 = A.ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(freq * 2.005, t);
    const g2 = gainNode(0.22);
    o2.connect(g2);

    const o3 = A.ctx.createOscillator();
    o3.type = "sine";
    o3.frequency.setValueAtTime(freq * 3.01, t);
    const g3 = gainNode(0.08);
    o3.connect(g3);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * 0.55, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o1.connect(g);
    g2.connect(g);
    g3.connect(g);
    g.connect(f);
    f.connect(out);

    o1.start(t); o2.start(t); o3.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    o3.stop(t + dur + 0.05);
  }

  function drum(f0, f1, dur, level, time, bright) {
    if (!A.ctx) return;
    const t = time || now();
    const o = A.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur * 0.9);

    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);

    if (bright) {
      const src = A.ctx.createBufferSource();
      src.buffer = A.noise;
      src.playbackRate.value = 1.4;
      const bp = A.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2100;
      bp.Q.value = 0.8;
      const ng = A.ctx.createGain();
      ng.gain.setValueAtTime(level * 0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      src.connect(bp); bp.connect(ng); ng.connect(A.musicBus);
      src.start(t); src.stop(t + 0.1);
    }
    g.connect(A.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function bell(freq, time, level) {
    if (!A.ctx) return;
    const t = time || now();
    [1, 2.01, 3.98, 5.4].forEach((mult, i) => {
      const o = A.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * mult;
      const g = A.ctx.createGain();
      const lv = level * (0.5 / (i + 1));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lv, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2 - i * 0.3);
      o.connect(g);
      g.connect(A.musicBus);
      o.start(t); o.stop(t + 2.4);
    });
  }

  function drone() {
    if (!A.ctx || A.droneGain) return;
    A.droneGain = gainNode(0.14);
    const lp = A.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 820;
    lp.Q.value = 0.4;
    A.droneGain.connect(lp);
    lp.connect(A.musicBus);

    const strings = [1, 1.5, 2, 2.0, 3];
    strings.forEach((mult, i) => {
      const o = A.ctx.createOscillator();
      o.type = i === 4 ? "triangle" : "sawtooth";
      o.frequency.value = ROOT * mult * (1 + (i - 2) * 0.0009);
      const g = gainNode(i === 3 ? 0.045 : 0.075);
      const pan = A.ctx.createStereoPanner ? A.ctx.createStereoPanner() : null;
      if (pan) {
        pan.pan.value = (i / (strings.length - 1)) * 1.2 - 0.6;
        o.connect(g); g.connect(pan); pan.connect(A.droneGain);
      } else {
        o.connect(g); g.connect(A.droneGain);
      }
      // slow breathing
      const lfo = A.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.035 + i * 0.012;
      const lg = gainNode(0.35);
      lfo.connect(lg); lg.connect(g.gain);
      o.start();
      lfo.start();
      A.droneNodes.push(o, lfo);
    });
  }

  function scheduleStep(step, time) {
    const beat = step % 16;
    const bar = Math.floor(step / 16);

    // tanpura pluck cycle
    if (beat % 4 === 0) {
      const tones = [1, 1.5, 2, 2];
      const mult = tones[(beat / 4) % tones.length];
      pluck(ROOT * mult * 2, time, 2.4, 0.05);
    }

    if (A.intensity >= 2) {
      // tabla
      if (beat === 0) drum(104, 52, 0.34, 0.16, time, true);
      if (beat === 4) drum(150, 70, 0.24, 0.11, time, true);
      if (beat === 8) drum(104, 52, 0.32, 0.14, time, true);
      if (beat === 12) drum(160, 78, 0.2, 0.1, time, true);
      if (beat === 6 || beat === 14) drum(300, 180, 0.08, 0.05, time, false);
      if (beat === 11 || beat === 15) drum(340, 210, 0.06, 0.04, time, false);
    }

    // melody
    const melodyProb = A.intensity >= 3 ? 0.5 : A.intensity >= 2 ? 0.34 : 0.22;
    if (beat % 2 === 0 && Math.random() < melodyProb) {
      const octave = Math.random() < 0.3 ? 2 : 1;
      const deg = SCALE[Math.floor(Math.random() * SCALE.length)];
      const freq = ROOT * 2 * Math.pow(2, deg / 12) * octave;
      pluck(freq, time, 1.5 + Math.random() * 0.8, A.intensity >= 3 ? 0.075 : 0.055);
    }

    if (bar % 8 === 0 && step === 0) {
      bell(ROOT * 2, time, 0.055);
    }
  }

  A.tick = function tick() {
    if (!A.ctx || !A.playing) return;
    const stepDur = 60 / A.bpm / 4;
    while (A.nextTime < A.ctx.currentTime + 0.2) {
      scheduleStep(A.step, A.nextTime);
      A.step = (A.step + 1) % 64;
      A.nextTime += stepDur;
    }
  };

  A.startMusic = function startMusic() {
    A.init();
    if (!A.ctx || A.playing) return;
    A.playing = true;
    A.startTime = A.ctx.currentTime;
    A.step = 0;
    A.nextTime = A.ctx.currentTime + 0.1;
    drone();
    A.tick();
    A.timer = setInterval(() => A.tick(), 45);
  };

  A.stopMusic = function stopMusic() {
    A.playing = false;
    if (A.timer) {
      clearInterval(A.timer);
      A.timer = null;
    }
    if (A.droneGain) {
      const d = A.droneGain;
      A.droneGain = null;
      try {
        d.gain.setTargetAtTime(0, now(), 0.25);
        setTimeout(() => { try { d.disconnect(); } catch (e) {} }, 900);
      } catch (e) {}
    }
    if (A.droneNodes.length) {
      const nodes = A.droneNodes;
      A.droneNodes = [];
      setTimeout(() => {
        nodes.forEach((n) => { try { n.stop(); } catch (e) {} });
      }, 700);
    }
  };

  A.toggleMusic = function toggleMusic(on) {
    SV.settings.music = !!on;
    SV.saveSettings();
    if (on) {
      A.unlock().then(() => A.startMusic());
    } else {
      A.stopMusic();
    }
    return SV.settings.music;
  };

  A.setIntensity = function setIntensity(level) {
    A.intensity = SV.util.clamp(level, 1, 3);
  };

  A.beatPhase = function beatPhase() {
    if (!A.ctx || !A.playing) return 0;
    const beatDur = 60 / A.bpm;
    const t = A.ctx.currentTime - A.startTime;
    return (t / beatDur) % 1;
  };

  /* ---------- SFX ---------- */

  A.sfx = function sfx(name, opts) {
    if (!A.ctx || !SV.settings.sfx) return;
    const t = now() + 0.005;
    const o = opts || {};

    switch (name) {
      case "pluck": {
        const deg = SCALE[Math.floor(Math.random() * SCALE.length)] || 0;
        const freq = ROOT * 4 * Math.pow(2, (o.note != null ? o.note : deg) / 12);
        pluck(freq, t, 1.1, 0.16, A.sfxBus);
        break;
      }
      case "perfect": {
        pluck(ROOT * 4, t, 1.4, 0.18, A.sfxBus);
        pluck(ROOT * 6, t + 0.07, 1.2, 0.12, A.sfxBus);
        break;
      }
      case "creak": {
        const src = A.ctx.createBufferSource();
        src.buffer = A.noise;
        src.playbackRate.value = 0.6;
        const bp = A.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(220, t);
        bp.frequency.exponentialRampToValueAtTime(520, t + 0.35);
        bp.Q.value = 6;
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.07, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        src.connect(bp); bp.connect(g); g.connect(A.sfxBus);
        src.start(t); src.stop(t + 0.45);
        break;
      }
      case "twang": {
        [1, 1.008, 2].forEach((m, i) => {
          const osc = A.ctx.createOscillator();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(180 * m, t);
          osc.frequency.exponentialRampToValueAtTime(70 * m, t + 0.35);
          const lp = A.ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 1400;
          const g = A.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.11 / (i + 1), t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
          osc.connect(lp); lp.connect(g); g.connect(A.sfxBus);
          osc.start(t); osc.stop(t + 0.75);
        });
        const src = A.ctx.createBufferSource();
        src.buffer = A.noise;
        const hp = A.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 1200;
        const ng = A.ctx.createGain();
        ng.gain.setValueAtTime(0.05, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        src.connect(hp); hp.connect(ng); ng.connect(A.sfxBus);
        src.start(t); src.stop(t + 0.12);
        break;
      }
      case "clang": {
        const partials = [523, 731, 1097, 1580, 2210];
        partials.forEach((f, i) => {
          const osc = A.ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = f * (1 + Math.random() * 0.004);
          const g = A.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.075 / (i + 1), t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6 - i * 0.07);
          osc.connect(g); g.connect(A.sfxBus);
          osc.start(t); osc.stop(t + 0.7);
        });
        const src = A.ctx.createBufferSource();
        src.buffer = A.noise;
        const bp = A.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 2400;
        bp.Q.value = 2;
        const ng = A.ctx.createGain();
        ng.gain.setValueAtTime(0.09, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        src.connect(bp); bp.connect(ng); ng.connect(A.sfxBus);
        src.start(t); src.stop(t + 0.18);
        break;
      }
      case "bubble": {
        const osc = A.ctx.createOscillator();
        osc.type = "sine";
        const f = 180 + Math.random() * 420;
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.09);
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(g); g.connect(A.sfxBus);
        osc.start(t); osc.stop(t + 0.14);
        break;
      }
      case "shatter": {
        const src = A.ctx.createBufferSource();
        src.buffer = A.noise;
        const hp = A.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(800, t);
        hp.frequency.exponentialRampToValueAtTime(4200, t + 0.5);
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        src.connect(hp); hp.connect(g); g.connect(A.sfxBus);
        src.start(t); src.stop(t + 0.85);
        [1568, 2093, 2637, 3136].forEach((f, i) => {
          pluck(f, t + i * 0.02, 1.6, 0.05, A.sfxBus);
        });
        break;
      }
      case "success": {
        [0, 4, 7, 12, 16].forEach((semi, i) => {
          pluck(ROOT * 4 * Math.pow(2, semi / 12), t + i * 0.11, 2.2, 0.1, A.sfxBus);
        });
        bell(ROOT * 4, t + 0.3, 0.06);
        break;
      }
      case "fail": {
        drum(90, 40, 0.7, 0.22, t, true);
        const osc = A.ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.9);
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
        osc.connect(g); g.connect(A.sfxBus);
        osc.start(t); osc.stop(t + 1.05);
        break;
      }
      case "crowd": {
        const src = A.ctx.createBufferSource();
        src.buffer = A.noise;
        src.loop = true;
        const bp = A.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 700;
        bp.Q.value = 0.6;
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.6);
        g.gain.linearRampToValueAtTime(0.0001, t + 2.4);
        src.connect(bp); bp.connect(g); g.connect(A.sfxBus);
        src.start(t); src.stop(t + 2.5);
        break;
      }
      case "conch": {
        const osc = A.ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.linearRampToValueAtTime(330, t + 0.5);
        const lp = A.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1200;
        lp.Q.value = 3;
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        const vib = A.ctx.createOscillator();
        vib.frequency.value = 5.2;
        const vg = A.ctx.createGain();
        vg.gain.value = 4;
        vib.connect(vg); vg.connect(osc.frequency);
        osc.connect(lp); lp.connect(g); g.connect(A.sfxBus);
        osc.start(t); vib.start(t);
        osc.stop(t + 1.9); vib.stop(t + 1.9);
        break;
      }
      case "whoosh": {
        const src = A.ctx.createBufferSource();
        src.buffer = A.noise;
        const bp = A.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(400, t);
        bp.frequency.exponentialRampToValueAtTime(2200, t + 0.25);
        bp.Q.value = 1.4;
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        src.connect(bp); bp.connect(g); g.connect(A.sfxBus);
        src.start(t); src.stop(t + 0.4);
        break;
      }
      case "thud": {
        drum(120, 45, 0.4, 0.16, t, true);
        break;
      }
      case "heartbeat": {
        drum(70, 38, 0.18, 0.18, t, false);
        drum(64, 34, 0.22, 0.1, t + 0.2, false);
        break;
      }
      case "garland": {
        [0, 3, 7, 10, 12, 15].forEach((semi, i) => {
          pluck(ROOT * 6 * Math.pow(2, semi / 12), t + i * 0.09, 1.8, 0.07, A.sfxBus);
        });
        break;
      }
      case "oil": {
        const src = A.ctx.createBufferSource();
        src.buffer = A.noise;
        src.loop = true;
        const lp = A.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 320;
        const g = A.ctx.createGain();
        const dur = Number(o.duration) > 0 ? Number(o.duration) : 2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.2);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        src.connect(lp); lp.connect(g); g.connect(A.sfxBus);
        src.start(t); src.stop(t + dur + 0.1);
        break;
      }
      default:
        break;
    }
  };

  A.stopAll = function stopAll() {
    A.stopMusic();
    if (A.ctx && A.ctx.state === "running" && A.ctx.suspend) {
      A.ctx.suspend().catch(() => {});
    }
  };

  SV.audio = A;
})();
