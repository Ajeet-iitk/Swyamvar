/* ============================================================
   pool.js — reflection engine + Trial II: the mirror that lies
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;
  const U = SV.util;
  const art = SV.art;
  const audio = SV.audio;
  const $ = (s) => document.querySelector(s);
  const G = () => SV.game;
  const rgba = U.rgba;

  /* ---------- shared reflection buffer ---------- */

  SV.reflect = {
    makeBuffer() {
      const canvas = document.createElement("canvas");
      return { canvas, ctx: canvas.getContext("2d"), css: 0, scale: 0 };
    },

    renderFish(buf, size, angle, opts) {
      const o = opts || {};
      const css = Math.ceil(size * 2.6);
      const scale = Math.min(1.55, Math.max(1, (SV.stage.dpr || 1) * 0.85));
      if (buf.css !== css || buf.scale !== scale) {
        buf.css = css;
        buf.scale = scale;
        buf.canvas.width = Math.round(css * scale);
        buf.canvas.height = Math.round(css * scale);
        buf.ctx = buf.canvas.getContext("2d");
      }
      const g = buf.ctx;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.clearRect(0, 0, css, css);
      g.save();
      g.translate(css / 2, css / 2);
      g.scale(1, -1);
      art.fish(g, 0, 0, size, angle, {
        wheel: o.wheel !== false,
        highlight: !!o.highlight,
        eyeR: 0.075,
        alpha: 1,
        time: o.time || 0,
      });
      g.restore();
      return buf;
    },

    eyeOffset(size, angle) {
      const ax = size * 0.36;
      const ay = size * 0.045;
      const c = Math.cos(angle), s = Math.sin(angle);
      return { x: ax * c + ay * s, y: -ax * s + ay * c };
    },

    blit(ctx, buf, cx, cy, destSize, t, strength, energy, alpha) {
      const b = buf.canvas;
      if (!b.width) return;
      const strips = 62;
      const stepY = b.height / strips;
      ctx.save();
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      for (let i = 0; i < strips; i++) {
        const sy = i * stepY;
        const sh = Math.min(stepY + 2, b.height - sy);
        const dy = cy - destSize / 2 + (i / strips) * destSize;
        const ph = i * 0.32 + t * 1.7;
        const off = (Math.sin(ph) * 0.62 + Math.sin(ph * 1.73 + 0.7) * 0.38) * strength * (1 + energy * 1.4);
        ctx.drawImage(
          b,
          0, sy, b.width, sh,
          cx - destSize / 2 + off, dy, destSize, destSize / strips + 1.2
        );
      }
      ctx.restore();
    },
  };

  /* ---------- Trial II ---------- */

  const el = {};
  function cache() {
    if (el.ready) return;
    el.prompt = $("#poolPrompt");
    el.breath = $("#breathFill");
    el.breathVal = $("#breathVal");
    el.clarity = $("#clarityVal");
    el.steady = $("#steadyBtn");
    el.ready = true;
    if (el.steady) {
      el.steady.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (G().screen === "pool") {
          audio.unlock();
          pool.btnHeld = true;
          el.steady.classList.add("is-held");
        }
      });
      window.addEventListener("pointerup", () => {
        pool.btnHeld = false;
        if (el.steady) el.steady.classList.remove("is-held");
      });
      window.addEventListener("pointercancel", () => {
        pool.btnHeld = false;
        if (el.steady) el.steady.classList.remove("is-held");
      });
      el.steady.addEventListener("keydown", (e) => {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          if (G().screen === "pool") {
            pool.btnHeld = true;
            el.steady.classList.add("is-held");
          }
        }
      });
      el.steady.addEventListener("keyup", () => {
        pool.btnHeld = false;
        el.steady.classList.remove("is-held");
      });
    }
  }

  function t(k) { return SV.i18n.t(k); }

  const pool = {
    enter(opts) {
      cache();
      this.d = G().DIFF[SV.settings.difficulty].pool;
      this.buf = this.buf || SV.reflect.makeBuffer();
      this.buf.css = 0;
      const vw = SV.stage.w || window.innerWidth;
      const vh = SV.stage.h || window.innerHeight;
      this.pointer = { x: vw / 2, y: vh / 2 };
      // Start away from the eye: the player must find the mirrored sight.
      this.reticle = { x: vw / 2, y: vh / 2 };
      this.drift = { x: 0, y: 0 };
      this.push = { x: 0, y: 0 };
      this.wobble = 0;
      this.breath = 100;
      this.clarity = 0;
      this.holding = false;
      this.btnHeld = false;
      this.pointerHold = false;
      this.exhaust = 0;
      this._left = false;
      this._hinted = false;
      this.ripples = [];
      this.rippleT = 2.2;
      this.time = 0;
      this.done = false;
      this.doneT = 0;
      this.gaspT = 0;
      this.gasps = 0;
      this.locked = false;
      this.t0 = performance.now();
      this.energy = 0;
      this.refreshText();
      this.syncHUD(true);
      this.spawnRipple(true);
      if (el.steady) el.steady.classList.remove("is-held");
      G().paused = false;
    },

    exit() {
      this.holding = false;
      this.btnHeld = false;
      this.pointerHold = false;
      if (el.steady) el.steady.classList.remove("is-held");
    },

    refreshText() {
      cache();
      if (el.prompt) el.prompt.textContent = t("poolPrompt");
    },

    layout(w, h) {
      const size = U.clamp(Math.min(w, h) * 0.56, 208, 540);
      const cx = w * 0.5;
      const cy = h * 0.44;
      const angle = Math.sin(this.time * 0.17) * 0.05 - 0.02;
      const eyeOff = SV.reflect.eyeOffset(size, angle);
      const swayX = Math.sin(this.time * 0.31) * 4;
      const swayY = Math.cos(this.time * 0.24) * 3;
      const tol = U.clamp(size * 0.135, 26, 66) * this.d.tol;
      return {
        size, cx, cy, angle,
        eye: { x: cx + eyeOff.x + swayX, y: cy + eyeOff.y + swayY },
        tol,
        dest: size * 2.6,
        swayX, swayY,
      };
    },

    spawnRipple(initial) {
      const w = SV.stage.w, h = SV.stage.h;
      const L = this.layout(w, h);
      const size = L.tol * 6;
      const x = initial ? L.eye.x + U.rand(-90, 90) : U.rand(w * 0.25, w * 0.75);
      const y = initial ? L.eye.y + U.rand(-70, 110) : U.rand(h * 0.25, h * 0.72);
      this.ripples.push({
        x, y,
        r: 4,
        max: U.rand(Math.min(w, h) * 0.16, Math.min(w, h) * 0.42),
        life: 2.8,
        maxLife: 2.8,
        strength: U.rand(0.7, 1.3),
      });
      if (Math.random() < 0.5) audio.sfx("bubble");
    },

    update(dt, time) {
      this.time += dt;
      const w = SV.stage.w, h = SV.stage.h;
      if (!w) return;
      this.doneT += dt;

      if (this.done) {
        if (this.doneT > 2.0 && !this._left) {
          this._left = true;
          const run = G().run;
          if (run) {
            run.pool.time = performance.now() - this.t0;
            run.pool.gasps = this.gasps;
          }
          G().toFish();
        }
        return;
      }

      const d = this.d;
      this.gaspT = Math.max(0, this.gaspT - dt);
      this.exhaust = Math.max(0, this.exhaust - dt);

      // keyboard aiming
      const keys = SV.input.keys;
      let kx = 0, ky = 0;
      if (keys.has("ArrowLeft") || keys.has("KeyA")) kx -= 1;
      if (keys.has("ArrowRight") || keys.has("KeyD")) kx += 1;
      if (keys.has("ArrowUp") || keys.has("KeyW")) ky -= 1;
      if (keys.has("ArrowDown") || keys.has("KeyS")) ky += 1;
      if (kx || ky) {
        this.pointer.x = U.clamp(this.pointer.x + kx * 420 * dt, 0, w);
        this.pointer.y = U.clamp(this.pointer.y + ky * 420 * dt, 0, h);
      }

      // steady — Shift, the button, or holding anywhere on the pool
      const shift = keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("Space");
      const wantHold = shift || this.btnHeld || this.pointerHold;
      this.holding = wantHold && this.breath > 1 && this.exhaust <= 0;
      if (this.holding) {
        this.breath -= d.holdDrain * dt;
        if (this.breath <= 0) {
          this.breath = 0;
          this.holding = false;
          this.exhaust = 0.9;
          this.breath = 0;
          this.gasp();
        }
      } else {
        this.breath = Math.min(100, this.breath + d.regen * dt);
      }
      if (el.steady) el.steady.classList.toggle("is-held", this.holding);

      // drift
      const amp = Math.min(w, h) * 0.042 * d.drift * (this.holding ? 0.3 : 1);
      const tx = Math.sin(time * 0.41 + 1.2) * amp + Math.sin(time * 0.87) * amp * 0.45;
      const ty = Math.cos(time * 0.33) * amp * 0.8 + Math.sin(time * 0.71 + 0.4) * amp * 0.3;
      this.drift.x = U.damp(this.drift.x, tx, 2.2, dt);
      this.drift.y = U.damp(this.drift.y, ty, 2.2, dt);

      this.wobble = Math.max(0, this.wobble - dt * 1.4);
      this.push.x = U.damp(this.push.x, 0, 3, dt);
      this.push.y = U.damp(this.push.y, 0, 3, dt);

      const mirrorX = w - this.pointer.x;
      const mirrorY = SV.settings.simpleReflection ? this.pointer.y : h - this.pointer.y;
      const wobX = Math.sin(time * 17) * this.wobble * 14;
      const wobY = Math.cos(time * 13) * this.wobble * 14;
      const targetX = U.clamp(mirrorX + this.drift.x + this.push.x + wobX, 26, w - 26);
      const targetY = U.clamp(mirrorY + this.drift.y + this.push.y + wobY, 26, h - 26);

      if (this.holding) {
        this.reticle.x = U.damp(this.reticle.x, targetX, 12, dt);
        this.reticle.y = U.damp(this.reticle.y, targetY, 12, dt);
      } else {
        this.reticle.x = U.damp(this.reticle.x, targetX, 7.5, dt);
        this.reticle.y = U.damp(this.reticle.y, targetY, 7.5, dt);
      }

      // ripples
      this.rippleT -= dt;
      if (this.rippleT <= 0) {
        this.rippleT = d.rippleEvery * U.rand(0.75, 1.25);
        this.spawnRipple(false);
      }
      let energy = 0;
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.life -= dt;
        r.r += (r.max - r.r) * Math.min(1, dt * 1.6) + 30 * dt;
        if (r.life <= 0) {
          this.ripples.splice(i, 1);
          continue;
        }
        energy += (1 - r.life / r.maxLife) * 0.35;
        // push the sight when the ripple passes under it
        if (!r.hit && Math.abs(U.dist(r.x, r.y, this.reticle.x, this.reticle.y) - r.r) < 14) {
          r.hit = true;
          const ang = Math.atan2(this.reticle.y - r.y, this.reticle.x - r.x);
          const force = (this.holding ? 2.5 : 8) * r.strength * d.drift;
          this.push.x += Math.cos(ang) * force;
          this.push.y += Math.sin(ang) * force;
          this.wobble = Math.min(1, this.wobble + 0.35);
          G().shake.add(1.2);
        }
      }
      this.energy = U.clamp(energy, 0, 1.4);

      // clarity — sight must rest on the eye *while* the breath is held
      const L = this.layout(w, h);
      const dist = U.dist(this.reticle.x, this.reticle.y, L.eye.x, L.eye.y);
      const onEye = dist < L.tol;
      if (onEye && this.holding) {
        this.clarity = Math.min(1, this.clarity + dt / d.clarity);
      } else {
        const decay = onEye ? 0.35 : 1;
        this.clarity = Math.max(0, this.clarity - (dt / (d.clarity * 2.4)) * decay);
      }
      if (onEye && !this.holding && !this._hinted) {
        this._hinted = true;
        G().toast(t("poolTeaching"));
      }
      if (this.clarity >= 1) this.complete();

      this.syncHUD(false);
    },

    gasp() {
      this.gasps += 1;
      this.wobble = 1;
      this.push.x += U.rand(-18, 18);
      this.push.y += U.rand(-18, 18);
      this.spawnRipple(false);
      audio.sfx("bubble");
      audio.sfx("thud");
      G().shake.add(3);
      if (performance.now() - (this.lastGaspToast || 0) > 6000) {
        this.lastGaspToast = performance.now();
        G().toast(t("poolGasp"));
      }
    },

    complete() {
      if (this.done) return;
      this.done = true;
      this.doneT = 0;
      this.locked = true;
      this.clarity = 1;
      audio.sfx("success");
      audio.sfx("perfect");
      G().shake.add(4);
      this.pointerHold = false;
      if (el.steady) el.steady.classList.remove("is-held");
      this.syncHUD(true);
    },

    syncHUD(force) {
      cache();
      if (!el.breath) return;
      const b = U.clamp(this.breath, 0, 100);
      el.breath.style.width = b.toFixed(1) + "%";
      if (force || this._lastBreath !== Math.round(b)) {
        this._lastBreath = Math.round(b);
        el.breathVal.textContent = String(this._lastBreath);
      }
      const c = Math.round(this.clarity * 100);
      if (force || this._lastClarity !== c) {
        this._lastClarity = c;
        el.clarity.textContent = c + "%";
      }
    },

    onDown(x, y) {
      this.pointerHold = true;
      this.pointer.x = x;
      this.pointer.y = y;
    },
    onMove(x, y) {
      this.pointer.x = x;
      this.pointer.y = y;
    },
    onUp() {
      this.pointerHold = false;
    },
    onKey(code, e) {
      if (code === "Space") this.btnHeld = true;
      if (code === "ShiftLeft" || code === "ShiftRight") this.btnHeld = true;
      if (e && e.preventDefault) e.preventDefault();
    },
    onKeyUp(code) {
      if (code === "Space" || code === "ShiftLeft" || code === "ShiftRight") {
        this.btnHeld = false;
        if (el.steady) el.steady.classList.remove("is-held");
      }
    },

    render(ctx, w, h, time) {
      const pal = SV.colors();
      const L = this.layout(w, h);
      this.buf = this.buf || SV.reflect.makeBuffer();

      art.oil(ctx, w, h, time, { noVignette: true });

      // reflected ceiling: arches and lamp sparks
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = pal.gold;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const rr = Math.min(w, h) * (0.34 + i * 0.1);
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.42, rr, rr * 0.5, 0, Math.PI * 1.06, Math.PI * 1.94);
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const lx = w * (0.16 + i * 0.11) + Math.sin(time * 0.4 + i) * 8;
        const ly = h * (0.14 + (i % 3) * 0.07);
        SV.fx.glow(ctx, lx, ly, 22, pal.ember, 0.25);
        ctx.fillStyle = pal.goldHi;
        ctx.beginPath();
        ctx.arc(lx, ly, 1.5, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();

      // the reflected pole
      art.pole(ctx, L.cx + L.swayX, L.cy - L.size * 1.15, L.cy + L.size * 0.15, Math.max(1.5, L.size * 0.009), 0.16);

      // the fish, distorted by the oil
      SV.fx.glow(ctx, L.cx, L.cy, L.size * 1.15, pal.gold, 0.12);
      SV.reflect.renderFish(this.buf, L.size, L.angle, { time });
      SV.reflect.blit(ctx, this.buf, L.cx + L.swayX, L.cy + L.swayY, L.dest, time, 2.6 + this.energy * 3.2, this.energy, 0.94);

      // blend the reflection into the oil
      const mask = ctx.createRadialGradient(L.cx, L.cy, L.size * 0.32, L.cx, L.cy, L.dest * 0.48);
      mask.addColorStop(0, "rgba(0,0,0,0)");
      mask.addColorStop(0.72, rgba(pal.poolMid, 0.08));
      mask.addColorStop(1, rgba(pal.poolTop, 0.72));
      ctx.fillStyle = mask;
      ctx.fillRect(L.cx - L.dest / 2, L.cy - L.dest / 2, L.dest, L.dest);

      // target shimmer
      if (!this.done) {
        const pulse = 0.5 + Math.sin(time * 2.2) * 0.5;
        ctx.save();
        ctx.strokeStyle = rgba(pal.teal, 0.1 + pulse * 0.12 + this.clarity * 0.12);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 7]);
        ctx.beginPath();
        ctx.arc(L.eye.x, L.eye.y, L.tol * (1 + pulse * 0.05), 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        SV.fx.glow(ctx, L.eye.x, L.eye.y, L.tol * 1.4, pal.teal, 0.06 + this.clarity * 0.16);
      }

      // ripples
      for (let i = 0; i < this.ripples.length; i++) {
        const r = this.ripples[i];
        const k = r.life / r.maxLife;
        ctx.strokeStyle = rgba(pal.poolHi, k * 0.3 * r.strength);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.82, 0.2, 0, 6.283);
        ctx.stroke();
        ctx.strokeStyle = rgba(pal.poolHi, k * 0.12 * r.strength);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r * 0.93, r.r * 0.76, 0.2, 0, 6.283);
        ctx.stroke();
      }

      // steam
      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.strokeStyle = pal.poolHi;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const sx = w * (0.16 + i * 0.17);
        ctx.beginPath();
        for (let y = h * 0.9; y > h * 0.32; y -= 12) {
          const x = sx + Math.sin(y * 0.02 + time * 0.7 + i) * 18;
          if (y === h * 0.9) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // sight line
      if (!this.done) {
        const lg = ctx.createLinearGradient(this.reticle.x, this.reticle.y, this.reticle.x, h);
        lg.addColorStop(0, rgba(pal.teal, 0.22));
        lg.addColorStop(1, rgba(pal.teal, 0));
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.reticle.x, this.reticle.y);
        ctx.lineTo(this.reticle.x, h);
        ctx.stroke();
      }

      // foreground hands / bow, out of focus
      const fg = ctx.createRadialGradient(w * 0.5, h * 1.08, 20, w * 0.5, h * 1.08, Math.min(w, h) * 0.55);
      fg.addColorStop(0, rgba("#05030a", 0.55));
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, h * 0.72, w, h * 0.28);

      // reticle
      if (!this.done) {
        const onEye = U.dist(this.reticle.x, this.reticle.y, L.eye.x, L.eye.y) < L.tol;
        art.reticle(ctx, this.reticle.x, this.reticle.y, U.clamp(Math.min(w, h) * 0.028, 15, 24), time, {
          color: pal.teal,
          clarity: this.clarity,
          locked: this.holding && onEye,
          danger: this.breath < 20,
        });
      } else {
        const k = U.clamp(this.doneT / 1.2, 0, 1);
        ctx.strokeStyle = rgba(pal.goldHi, 0.7 * (1 - k * 0.4));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(L.eye.x, L.eye.y, L.tol + k * 120, 0, 6.283);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = pal.goldHi;
        ctx.font = '500 21px "Cormorant Garamond", Georgia, serif';
        ctx.globalAlpha = U.clamp(this.doneT / 0.5, 0, 1);
        ctx.fillText(t("poolLocked"), w / 2, h * 0.3);
        ctx.globalAlpha = 1;
      }

      // low-breath vignette
      if (this.breath < 26 && !this.done) {
        const pulse = 0.05 + Math.abs(Math.sin(time * 3)) * 0.06;
        const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(1, rgba(pal.accent, pulse));
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }

      // frame vignette
      const v = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.48)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
  };

  SV.game.scenes.pool = pool;
})();
