/* ============================================================
   bow.js — Trial I: the weight of heaven (rhythm + stamina)
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;
  const U = SV.util;
  const art = SV.art;
  const audio = SV.audio;
  const $ = (s) => document.querySelector(s);
  const G = () => SV.game;

  const PHASES = [
    { key: "lift", hits: 4, speed: 1.12, zone: 1.06, drain: 1, label: "phaseLift", prompt: "bowPromptLift" },
    { key: "bend", hits: 5, speed: 1.3, zone: 0.9, drain: 1.14, label: "phaseBend", prompt: "bowPromptBend" },
    { key: "string", hits: 3, speed: 1.5, zone: 0.8, drain: 1.3, label: "phaseString", prompt: "bowPromptString" },
  ];
  const TOTAL = PHASES.reduce((a, p) => a + p.hits, 0);

  const el = {};
  function cache() {
    if (el.ready) return;
    el.prompt = $("#bowPrompt");
    el.stamina = $("#staminaFill");
    el.staminaVal = $("#staminaVal");
    el.progress = $("#progressFill");
    el.progressVal = $("#progressVal");
    el.ready = true;
  }

  function t(k) { return SV.i18n.t(k); }

  const bow = {
    enter(opts) {
      cache();
      const d = G().DIFF[SV.settings.difficulty].bow;
      this.d = d;
      this.phase = 0;
      this.phaseHits = 0;
      this.hits = 0;
      this.maxStamina = d.start;
      this.stamina = d.start;
      this.progress = 0;
      this.bend = 0;
      this.needle = U.rand(0.5, 2.6);
      this.dir = 1;
      this.zone = this.needle + 1.4;
      this.speed = d.speed * PHASES[0].speed;
      this.zoneW = d.zone * PHASES[0].zone;
      this.feedback = "";
      this.feedbackT = 0;
      this.feedbackGood = true;
      this.flash = 0;
      this.flashRed = 0;
      this.won = false;
      this.winT = 0;
      this.done = false;
      this.failed = false;
      this.entry = 0;
      this.perfect = 0;
      this.misses = 0;
      this.t0 = performance.now();
      this.promptKey = PHASES[0].prompt;
      this.lastPress = 0;
      this.pulse = 0;
      this.hitFx = [];
      this.refreshText();
      this.syncHUD(true);
      G().paused = false;
    },

    exit() {},

    refreshText() {
      cache();
      if (el.prompt) el.prompt.textContent = t(this.promptKey || "bowPrompt");
    },

    update(dt, time) {
      if (this.failed) return;
      if (this.won) {
        this.winT += dt;
        this.flash = Math.max(0, this.flash - dt * 1.6);
        if (this.winT > 2.2 && !this.done) {
          this.done = true;
          const run = G().run;
          if (run) {
            run.bow.perfect = this.perfect;
            run.bow.misses = this.misses;
            run.bow.time = performance.now() - this.t0;
          }
          G().afterBow();
        }
        return;
      }

      const d = this.d;
      const ph = PHASES[this.phase];
      this.entry = Math.min(1, this.entry + dt * 2.2);
      this.needle += this.speed * this.dir * dt;
      if (this.needle > Math.PI * 2) this.needle -= Math.PI * 2;
      this.stamina -= d.drain * ph.drain * dt;
      this.progress = this.hits / TOTAL;
      this.bend = U.damp(this.bend, this.progress * 0.95, 6.5, dt);
      this.feedbackT = Math.max(0, this.feedbackT - dt);
      this.flash = Math.max(0, this.flash - dt * 2.2);
      this.flashRed = Math.max(0, this.flashRed - dt * 1.8);
      this.pulse = Math.max(0, this.pulse - dt * 3);

      for (let i = this.hitFx.length - 1; i >= 0; i--) {
        this.hitFx[i].life -= dt;
        if (this.hitFx[i].life <= 0) this.hitFx.splice(i, 1);
      }

      if (this.stamina <= 0) {
        this.stamina = 0;
        this.failed = true;
        this.syncHUD(true);
        setTimeout(() => {
          if (G().screen === "bow") G().showFail("bow");
        }, 420);
        return;
      }

      if (this.stamina < 28 && !this._heart) {
        this._heart = true;
        audio.sfx("heartbeat");
        setTimeout(() => { this._heart = false; }, 1200);
      }

      this.syncHUD(false);
    },

    syncHUD(force) {
      cache();
      if (!el.stamina) return;
      const sp = U.clamp(this.stamina / this.maxStamina, 0, 1);
      el.stamina.style.width = (sp * 100).toFixed(1) + "%";
      el.progress.style.width = (this.progress * 100).toFixed(1) + "%";
      if (force || this._lastStam !== Math.round(this.stamina)) {
        this._lastStam = Math.round(this.stamina);
        el.staminaVal.textContent = String(Math.round(this.stamina));
      }
      if (force || this._lastProg !== Math.round(this.progress * 100)) {
        this._lastProg = Math.round(this.progress * 100);
        el.progressVal.textContent = this._lastProg + "%";
      }
    },

    onDown() {
      if (G().paused) return;
      this.press();
    },

    onKey(code) {
      if (code === "Space" || code === "Enter" || code === "ArrowUp") {
        if (G().paused) return;
        this.press();
      }
    },

    press() {
      if (this.won || this.failed) return;
      const now = performance.now();
      if (now - this.lastPress < 90) return;
      this.lastPress = now;

      const delta = Math.abs(U.normAngle(this.needle - this.zone));
      const half = this.zoneW / 2;
      if (delta <= half) {
        this.hit(delta <= this.zoneW * 0.2);
      } else {
        this.miss();
      }
    },

    hit(perfect) {
      const ph = PHASES[this.phase];
      this.hits += 1;
      this.phaseHits += 1;
      if (perfect) this.perfect += 1;
      this.stamina = Math.min(this.maxStamina, this.stamina + (perfect ? 5.5 : 3.4));
      this.feedback = t(perfect ? "fbPerfect" : "fbGood");
      this.feedbackGood = true;
      this.feedbackT = 0.85;
      this.flash = perfect ? 0.9 : 0.5;
      this.pulse = 1;
      this.hitFx.push({ a: this.needle, life: 0.5, perfect });
      G().shake.add(perfect ? 1.6 : 0.8);
      audio.sfx(perfect ? "perfect" : "pluck", { note: Math.min(16, 2 + this.hits * 1.5) });
      if (!perfect && Math.random() < 0.4) audio.sfx("creak");
      if (navigator.vibrate && !SV.reduceMotion()) navigator.vibrate(perfect ? 12 : 7);

      this.zone = this.needle + this.dir * (0.85 + Math.random() * 0.75);
      this.speed = Math.min(this.d.speed * 1.75, this.speed * 1.02);

      if (this.phaseHits >= ph.hits) {
        if (this.phase >= PHASES.length - 1) {
          this.win();
        } else {
          this.phase += 1;
          this.phaseHits = 0;
          const np = PHASES[this.phase];
          this.speed = this.d.speed * np.speed;
          this.zoneW = this.d.zone * np.zone;
          this.zone = this.needle + this.dir * 1.2;
          this.promptKey = np.prompt;
          this.refreshText();
          this.flash = 0.6;
          this.hits = Math.min(this.hits, TOTAL - 1);
          audio.sfx("creak");
          G().shake.add(3);
          this.hitFx.push({ a: this.needle, life: 0.8, perfect: true, big: true });
        }
      }
      this.syncHUD(true);
    },

    miss() {
      this.stamina -= this.d.miss;
      this.misses += 1;
      this.feedback = t("fbMiss");
      this.feedbackGood = false;
      this.feedbackT = 1;
      this.flashRed = 1;
      G().shake.add(6);
      audio.sfx("thud");
      if (navigator.vibrate && !SV.reduceMotion()) navigator.vibrate([8, 30, 8]);
      this.syncHUD(true);
    },

    win() {
      this.won = true;
      this.winT = 0;
      this.progress = 1;
      this.bend = 1;
      this.promptKey = "bowStrung";
      this.refreshText();
      this.flash = 1;
      G().shake.add(7);
      audio.sfx("conch");
      audio.sfx("success");
      audio.sfx("crowd");
      for (let i = 0; i < 3; i++) {
        setTimeout(() => audio.sfx("perfect"), i * 130);
      }
      this.syncHUD(true);
    },

    render(ctx, w, h, time) {
      const pal = SV.colors();
      const d = this.d || G().DIFF[SV.settings.difficulty].bow;
      art.hall(ctx, w, h, time, { dim: 0.4 });

      // On short landscape phones the wheel must leave room for the
      // compact header and the bottom HUD.
      const short = h < 460;
      const r = U.clamp(Math.min(w, h) * (short ? 0.222 : 0.265), short ? 78 : 104, 246);
      const cx = w * 0.5;
      // Sit a touch below centre so the heading never covers the top arc.
      const cy = h * (short ? 0.5 : 0.54);
      art.mandala(ctx, cx, cy, Math.min(w, h) * 0.42, time, 0.07, 0.012);
      const entry = U.easeOutCubic(this.entry);
      const beat = audio.beatPhase();
      const beatPulse = Math.pow(1 - Math.abs(beat * 2 - 1), 6);

      // bow behind the chakra
      ctx.save();
      ctx.globalAlpha = entry;
      ctx.translate(0, (1 - entry) * 34);
      art.bow(ctx, cx + r * 0.12, cy, r * 0.78, this.bend, { alpha: 0.9 });
      ctx.restore();

      // ring
      ctx.save();
      ctx.globalAlpha = entry;

      // outer progress ring
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 17, 0, 6.283);
      ctx.stroke();
      if (this.progress > 0) {
        ctx.strokeStyle = pal.gold;
        ctx.lineCap = "round";
        ctx.shadowColor = pal.gold;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 17, -Math.PI / 2, -Math.PI / 2 + this.progress * Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // base ring
      ctx.strokeStyle = rgba(pal.gold, pal.mode === "light" ? 0.55 : 0.26);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.283);
      ctx.stroke();

      // ticks
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const long = i % 5 === 0;
        ctx.strokeStyle = rgba(pal.gold, pal.mode === "light" ? (long ? 0.6 : 0.32) : (long ? 0.34 : 0.16));
        ctx.lineWidth = long ? 1.2 : 0.7;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (r - (long ? 9 : 5)), cy + Math.sin(a) * (r - (long ? 9 : 5)));
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
      }

      // beat halo
      ctx.strokeStyle = rgba(pal.gold, 0.06 + beatPulse * 0.1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6 + beatPulse * 5, 0, 6.283);
      ctx.stroke();

      // gold zone
      if (!this.won) {
        const start = this.zone - this.zoneW / 2;
        const end = this.zone + this.zoneW / 2;

        // dark underlay keeps the gold arc legible against the bright hall
        ctx.strokeStyle = pal.mode === "light" ? "rgba(70,44,16,0.46)" : "rgba(5,3,10,0.6)";
        ctx.lineWidth = 18;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, end);
        ctx.stroke();

        const zg = ctx.createLinearGradient(
          cx + Math.cos(start) * r, cy + Math.sin(start) * r,
          cx + Math.cos(end) * r, cy + Math.sin(end) * r
        );
        zg.addColorStop(0, rgba(pal.goldDeep, 0.5));
        zg.addColorStop(0.5, rgba(pal.goldHi, 0.98));
        zg.addColorStop(1, rgba(pal.goldDeep, 0.5));
        ctx.strokeStyle = zg;
        ctx.lineWidth = 12;
        ctx.lineCap = "butt";
        ctx.shadowColor = pal.gold;
        ctx.shadowBlur = 18 + this.pulse * 16;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, end);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // inner sheen
        ctx.strokeStyle = rgba("#fff8e4", 0.55);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start + 0.015, end - 0.015);
        ctx.stroke();

        // edge markers and an outer bead point at the sweet spot
        ctx.strokeStyle = rgba(pal.goldHi, 0.72);
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 2; k++) {
          const a = k === 0 ? start : end;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10));
          ctx.lineTo(cx + Math.cos(a) * (r + 23), cy + Math.sin(a) * (r + 23));
          ctx.stroke();
        }
        const beadA = this.zone;
        ctx.fillStyle = pal.goldHi;
        ctx.shadowColor = pal.gold;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(beadA) * (r + 30), cy + Math.sin(beadA) * (r + 30), 3, 0, 6.283);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = pal.goldHi;
        ctx.lineWidth = 4;
        ctx.shadowColor = pal.gold;
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.283);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // hit sparks on the rim
      for (let i = 0; i < this.hitFx.length; i++) {
        const f = this.hitFx[i];
        const k = f.life / (f.big ? 0.8 : 0.5);
        ctx.globalAlpha = k;
        ctx.strokeStyle = f.perfect ? pal.goldHi : pal.gold;
        ctx.lineWidth = (f.big ? 3 : 1.5) * k;
        ctx.beginPath();
        ctx.arc(cx, cy, r + (1 - k) * (f.big ? 50 : 22), f.a - 0.09, f.a + 0.09);
        ctx.stroke();
      }
      ctx.globalAlpha = entry;

      // needle
      if (!this.won) {
        const nx = cx + Math.cos(this.needle) * r;
        const ny = cy + Math.sin(this.needle) * r;
        const trail = 10;
        for (let i = 0; i < trail; i++) {
          const a0 = this.needle - (i / trail) * 0.3;
          const a1 = this.needle - ((i + 1) / trail) * 0.3;
          ctx.strokeStyle = rgba(pal.goldHi, (1 - i / trail) * 0.35);
          ctx.lineWidth = 2 * (1 - i / trail) + 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, r, a0, a1);
          ctx.stroke();
        }
        const ng = ctx.createLinearGradient(cx, cy, nx, ny);
        ng.addColorStop(0, rgba(pal.gold, 0.1));
        ng.addColorStop(0.7, rgba(pal.gold, 0.7));
        ng.addColorStop(1, pal.goldHi);
        ctx.strokeStyle = ng;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.fillStyle = pal.goldHi;
        ctx.shadowColor = pal.goldHi;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(nx, ny, 5.5, 0, 6.283);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // hub
      SV.fx.glow(ctx, cx, cy, r * 0.22, pal.gold, 0.35);
      ctx.fillStyle = rgba(pal.goldHi, 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, 6.283);
      ctx.fill();

      // success rings
      if (this.won) {
        const k = U.clamp(this.winT / 1.4, 0, 1);
        for (let i = 0; i < 3; i++) {
          const rr = r + k * (60 + i * 46);
          ctx.strokeStyle = rgba(pal.goldHi, (1 - k) * 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, 6.283);
          ctx.stroke();
        }
        SV.fx.glow(ctx, cx, cy, r * 2.2, pal.gold, 0.25 * (1 - k * 0.4));
      }
      ctx.restore();

      // feedback
      if (this.feedbackT > 0) {
        const k = U.clamp(this.feedbackT / 0.85, 0, 1);
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = this.feedbackGood ? pal.goldHi : pal.accent;
        ctx.font = '600 ' + Math.round(U.clamp(r * 0.16, 16, 30)) + 'px "Cormorant Garamond", Georgia, serif';
        ctx.shadowColor = this.feedbackGood ? pal.gold : pal.accent;
        ctx.shadowBlur = 16;
        ctx.fillText(this.feedback, cx, cy + r * 1.24 - (1 - k) * 14);
        ctx.restore();
      }

      if (this.won) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const k = U.clamp(this.winT / 0.7, 0, 1);
        ctx.globalAlpha = k;
        ctx.fillStyle = pal.goldHi;
        ctx.font = '500 ' + Math.round(U.clamp(r * 0.13, 16, 26)) + 'px "Cormorant Garamond", Georgia, serif';
        ctx.shadowColor = pal.gold;
        ctx.shadowBlur = 22;
        ctx.fillText(t("bowStrung"), cx, cy + r * 1.26);
        ctx.restore();
      }

      // flash
      if (this.flash > 0) {
        ctx.fillStyle = rgba(pal.goldHi, this.flash * 0.07);
        ctx.fillRect(0, 0, w, h);
      }
      if (this.flashRed > 0) {
        const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(1, rgba(pal.accent, this.flashRed * 0.32));
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        G().shake.add(this.flashRed * 0.6);
      }
      if (this.stamina < 30 && !this.won && !this.failed) {
        const pulse = 0.06 + Math.abs(Math.sin(time * 3.4)) * 0.05;
        const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(1, rgba(pal.accent, pulse));
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }
    },
  };

  function rgba(hex, a) { return U.rgba(hex, a); }

  SV.game.scenes.bow = bow;
})();
