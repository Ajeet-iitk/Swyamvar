/* ============================================================
   fish.js — Trial III: the wheel and the eye (timing + aim)
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

  const ARROW = '<svg viewBox="0 0 24 32" fill="none" aria-hidden="true"><path d="M12 3v23M12 3l-4.5 5.5M12 3l4.5 5.5M6.5 25h11M8.5 27.5 12 31l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const el = {};
  function cache() {
    if (el.ready) return;
    el.prompt = $("#fishPrompt");
    el.row = $("#arrowRow");
    el.loose = $("#looseBtn");
    el.ready = true;
    if (el.loose) {
      el.loose.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (G().screen === "fish") {
          audio.unlock();
          fish.startDraw("btn");
          el.loose.classList.add("is-held");
        }
      });
      const rel = () => {
        el.loose.classList.remove("is-held");
        if (fish.drawing && fish.drawSource === "btn") fish.release();
      };
      window.addEventListener("pointerup", rel);
      window.addEventListener("pointercancel", rel);
    }
  }

  function t(k, v) { return SV.i18n.t(k, v); }

  const fish = {
    enter(opts) {
      cache();
      this.d = G().DIFF[SV.settings.difficulty].fish;
      this.buf = this.buf || SV.reflect.makeBuffer();
      this.buf.css = 0;
      this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      this.reticle = { x: window.innerWidth / 2, y: window.innerHeight * 0.58 };
      this.drift = { x: 0, y: 0 };
      this.angle = U.rand(-Math.PI, Math.PI);
      this.baseSpeed = (Math.PI * 2) / this.d.period;
      this.assist = 1;
      this.arrowsLeft = 5;
      this.arrowsUsed = 0;
      this.misses = 0;
      this.shots = 0;
      this.ghosts = [];
      this.sparks = new SV.fx.Field(160);
      this.shot = null;
      this.done = false;
      this.doneT = 0;
      this.failed = false;
      this.cooldown = 0;
      this.flash = 0;
      this.flashRed = 0;
      this.time = 0;
      this.t0 = performance.now();
      this.missToast = false;
      this.pointerDown = null;
      this.drawing = false;
      this.draw = 0;
      this.drawSource = null;
      this.sway = { x: 0, y: 0 };
      this.dir = 1;
      this.dirTarget = 1;
      this.dirT = U.rand(5, 8);
      this.windPhase = U.rand(0, 20);
      this.wind = 0;
      this.blinkT = 0;
      this.open = 1;
      this.heartT = 0;
      this.landed = null;
      this.finishedEye = null;
      this._left = false;
      this.buildArrows();
      this.refreshText();
      this.syncHUD(true);
      G().paused = false;
    },

    exit() {
      this.cancelDraw();
    },

    buildArrows() {
      cache();
      if (!el.row) return;
      el.row.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        const span = document.createElement("span");
        span.className = "arrow-slot";
        span.innerHTML = ARROW;
        el.row.appendChild(span);
      }
    },

    syncHUD(force) {
      cache();
      if (!el.row) return;
      const slots = el.row.children;
      for (let i = 0; i < slots.length; i++) {
        slots[i].classList.toggle("is-spent", i >= this.arrowsLeft);
      }
      if (force || this._lastArrows !== this.arrowsLeft) {
        this._lastArrows = this.arrowsLeft;
        el.row.setAttribute("aria-label", t("arrowCount", { n: this.arrowsLeft }));
      }
    },

    refreshText() {
      cache();
      if (el.prompt) el.prompt.textContent = t("fishPrompt");
      if (el.loose) el.loose.querySelector("span:last-child").textContent = t("loose");
      this.syncHUD(true);
    },

    layout(w, h) {
      const size = U.clamp(Math.min(w, h) * 0.56, 208, 540);
      const cx = w * 0.5;
      const cy = h * 0.44;
      const swayX = Math.sin(this.time * 0.27) * 3;
      const swayY = Math.cos(this.time * 0.21) * 2.5;
      const hitR = U.clamp(size * 0.118, 22, 64) * this.d.hit;
      return { size, cx, cy, swayX, swayY, hitR, dest: size * 2.6 };
    },

    eyeNow(L) {
      const off = SV.reflect.eyeOffset(L.size, this.angle);
      return { x: L.cx + L.swayX + off.x, y: L.cy + L.swayY + off.y };
    },

    update(dt, time) {
      this.time += dt;
      this.flash = Math.max(0, this.flash - dt * 2);
      this.flashRed = Math.max(0, this.flashRed - dt * 1.8);
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.doneT += dt;
      this.sparks.update(dt, time);

      const w = SV.stage.w, h = SV.stage.h;
      if (!w) return;

      if (this.shot) {
        this.shot.t += dt;
        if (this.shot.t > 0.2 && !this.shot.burst) {
          this.shot.burst = true;
          if (this.shot.hit) {
            this.sparks.burst(this.shot.to.x, this.shot.to.y, "gold", 34, 320, { gravity: 90, lift: 90 });
            this.sparks.burst(this.shot.to.x, this.shot.to.y, "teal", 16, 240, { gravity: 40 });
            this.sparks.ring(this.shot.to.x, this.shot.to.y, "gold", 90, 1, 2);
            audio.sfx("shatter");
            audio.sfx("success");
            G().shake.add(9);
            this.flash = 1;
          } else {
            this.sparks.burst(this.shot.to.x, this.shot.to.y, "gold", 18, 220, { gravity: 240 });
            G().shake.add(3);
          }
        }
        if (this.shot.t > 1.4) this.shot = null;
      }

      if (this.done) {
        if (this.doneT > 2.7 && !this._left) {
          this._left = true;
          const run = G().run;
          if (run) {
            run.fish.arrowsUsed = this.arrowsUsed;
            run.fish.misses = this.misses;
            run.fish.time = performance.now() - this.t0;
          }
          G().finishRun();
        }
        return;
      }
      if (this.failed) return;

      // spin: on harder paths the wheel turns about and runs the other way
      if (this.d.reverse) {
        this.dirT -= dt;
        if (this.dirT <= 0) {
          this.dirT = U.rand(5.5, 9) / (SV.settings.difficulty === "maharathi" ? 1.4 : 1);
          this.dirTarget = -this.dirTarget;
          audio.sfx("whoosh");
        }
        this.dir = U.damp(this.dir, this.dirTarget, 1.3, dt);
      }
      const speed = this.baseSpeed * this.assist * (1 + Math.sin(time * 0.8) * 0.16) * this.dir;
      this.angle = (this.angle + speed * dt + Math.PI * 2) % (Math.PI * 2);

      // the eye opens and closes; only an open eye is a full-sized mark
      this.blinkT += dt;
      const cyc = 2.1;
      const ph = (this.blinkT % cyc) / cyc;
      this.open = U.damp(this.open, ph < this.d.openFrac ? 1 : 0, 14, dt);

      // gusts
      this.windPhase += dt;
      const wp = this.windPhase;
      this.wind = ((Math.sin(wp * 0.23) + 0.6 * Math.sin(wp * 0.61 + 1.3)) / 1.6) * this.d.wind;

      // drawing the string
      if (this.drawing) {
        this.draw += dt / this.d.draw;
        this.heartT -= dt;
        if (this.heartT <= 0 && this.draw > this.d.sweet[1]) {
          this.heartT = 0.45;
          audio.sfx("heartbeat");
        }
        if (this.draw >= 1.5) this.release();
      }
      const st = this.steadiness();
      const swayAmp = Math.min(w, h) * (0.004 + (1 - st) * 0.052);
      const sx = Math.sin(time * 7.3) * 0.6 + Math.sin(time * 12.1 + 1) * 0.4;
      const sy = Math.cos(time * 6.1) * 0.6 + Math.sin(time * 10.7) * 0.4;
      this.sway.x = U.damp(this.sway.x, sx * swayAmp, 18, dt);
      this.sway.y = U.damp(this.sway.y, sy * swayAmp, 18, dt);

      // ghosts fade
      for (let i = this.ghosts.length - 1; i >= 0; i--) {
        this.ghosts[i].life -= dt;
        if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
      }

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

      // drift
      const amp = Math.min(w, h) * 0.022 * this.d.drift;
      const tx = Math.sin(time * 0.5 + 2) * amp;
      const ty = Math.cos(time * 0.37) * amp * 0.8;
      this.drift.x = U.damp(this.drift.x, tx, 2.4, dt);
      this.drift.y = U.damp(this.drift.y, ty, 2.4, dt);

      const mirrorX = w - this.pointer.x;
      const mirrorY = SV.settings.simpleReflection ? this.pointer.y : h - this.pointer.y;
      const targetX = U.clamp(mirrorX + this.drift.x, 24, w - 24);
      const targetY = U.clamp(mirrorY + this.drift.y, 24, h - 24);
      this.reticle.x = U.damp(this.reticle.x, targetX, 9, dt);
      this.reticle.y = U.damp(this.reticle.y, targetY, 9, dt);
    },

    /* ---- draw and release: hold to draw the string, let go to loose ---- */

    startDraw(source) {
      if (G().paused || this.done || this.failed || this.cooldown > 0 || this.shot || this.drawing) return;
      this.drawing = true;
      this.drawSource = source || "key";
      this.draw = 0;
      audio.sfx("creak");
    },

    cancelDraw() {
      this.drawing = false;
      this.draw = 0;
      this.drawSource = null;
      if (el.loose) el.loose.classList.remove("is-held");
    },

    release() {
      if (!this.drawing) return;
      this.drawing = false;
      this.drawSource = null;
      if (el.loose) el.loose.classList.remove("is-held");
      this.fire();
      this.draw = 0;
    },

    // Where the sight really is: the reticle plus the tremble of the arms.
    aimPoint() {
      return { x: this.reticle.x + this.sway.x, y: this.reticle.y + this.sway.y };
    },

    // Steadiness 0..1: poor when loose, best inside the sweet band, shaky when over-drawn.
    steadiness() {
      const sw = this.d.sweet;
      const k = this.draw;
      if (!this.drawing) return 0.15;
      if (k < sw[0]) return 0.15 + 0.85 * (k / sw[0]);
      if (k <= sw[1]) return 1;
      return Math.max(0, 1 - (k - sw[1]) * 3.2);
    },

    // Crosswind carried by the arrow, softened by a strong draw.
    windPx(w, h) {
      return this.wind * Math.min(w, h) * 0.085 * (1 - 0.5 * Math.min(1, this.draw));
    },

    landPoint(w, h) {
      const a = this.aimPoint();
      return { x: a.x + this.windPx(w, h), y: a.y };
    },

    hitRadius(L) {
      const k = this.d.closedK;
      return L.hitR * (k + (1 - k) * this.open);
    },

    fire() {
      if (G().paused || this.done || this.failed || this.cooldown > 0 || this.shot) return;
      const w = SV.stage.w, h = SV.stage.h;
      const L = this.layout(w, h);
      const eye = this.eyeNow(L);
      const land = this.landPoint(w, h);
      const dist = U.dist(land.x, land.y, eye.x, eye.y);
      const hit = dist <= this.hitRadius(L);
      this.landed = { x: land.x, y: land.y };
      this.cooldown = 0.4;
      this.shots += 1;
      audio.sfx("whoosh");
      audio.sfx("twang");
      this.shot = {
        from: { x: this.aimPoint().x, y: h + 30 },
        to: { x: land.x, y: land.y },
        t: 0,
        hit,
      };
      if (hit) this.success(eye);
      else this.miss(eye);
    },

    success(eye) {
      this.arrowsUsed += 1;
      this.done = true;
      this.doneT = 0;
      this.finishedEye = { x: eye.x, y: eye.y };
      this.arrowsLeft = Math.max(0, this.arrowsLeft - 1);
      this.syncHUD(true);
      setTimeout(() => audio.sfx("crowd"), 250);
      setTimeout(() => audio.sfx("conch"), 500);
    },

    miss(eye) {
      this.arrowsLeft -= 1;
      this.arrowsUsed += 1;
      this.misses += 1;
      this.ghosts.push({ x: eye.x, y: eye.y, life: 4.2, maxLife: 4.2, angle: this.angle, land: this.landed });
      this.assist = Math.max(0.55, this.assist - this.d.assistStep);
      this.flashRed = 1;
      G().shake.add(5);
      audio.sfx("clang");
      this.syncHUD(true);
      if (!this.missToast) {
        this.missToast = true;
        G().toast(t("ghostNote"));
      }
      if (this.arrowsLeft <= 0) {
        this.failed = true;
        this.cancelDraw();
        setTimeout(() => {
          if (G().screen === "fish") G().showFail("fish");
        }, 750);
      }
    },

    onDown(x, y) {
      this.pointer.x = x;
      this.pointer.y = y;
      this.startDraw("pointer");
    },

    onMove(x, y) {
      this.pointer.x = x;
      this.pointer.y = y;
    },

    onUp() {
      if (this.drawing && this.drawSource === "pointer") this.release();
    },

    onKey(code, e) {
      if (code === "Space" || code === "Enter") {
        if (e && e.preventDefault) e.preventDefault();
        this.startDraw("key");
      }
    },
    onKeyUp(code) {
      if ((code === "Space" || code === "Enter") && this.drawing && this.drawSource === "key") this.release();
    },

    drawRing(ctx, x, y, r, pal) {
      const sw = this.d.sweet;
      const A0 = -Math.PI / 2;
      const span = Math.PI * 2 / 1.5; // full circle == draw 1.5 (the string slips)
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(x, y, r, A0, A0 + Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.teal, 0.55);
      ctx.beginPath();
      ctx.arc(x, y, r, A0 + sw[0] * span, A0 + sw[1] * span);
      ctx.stroke();
      const over = this.draw > sw[1];
      ctx.strokeStyle = over ? pal.accent : this.draw >= sw[0] ? pal.teal : pal.goldHi;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, A0, A0 + Math.min(1.5, this.draw) * span);
      ctx.stroke();
      ctx.restore();
    },

    drawWind(ctx, w, h, time, pal) {
      if (this.done || this.failed || !this.d.wind) return;
      const y = Math.min(h * 0.3, 214);
      const cx = w / 2;
      const half = 64;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = rgba(pal.gold, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.moveTo(cx, y - 4);
      ctx.lineTo(cx, y + 4);
      ctx.stroke();
      // streaming motes show the direction and force
      const speed = this.wind * 40;
      for (let i = 0; i < 6; i++) {
        const u = (((i / 6 + time * speed * 0.004) % 1) + 1) % 1;
        const px = cx - half + u * half * 2;
        ctx.fillStyle = rgba(pal.goldHi, 0.25 + Math.min(0.6, Math.abs(this.wind) * 0.5));
        ctx.beginPath();
        ctx.arc(px, y + Math.sin(i * 2 + time) * 3, 1.6, 0, 6.283);
        ctx.fill();
      }
      // needle
      const nx = cx + U.clamp(this.wind / 1.4, -1, 1) * half;
      ctx.fillStyle = pal.goldHi;
      ctx.beginPath();
      ctx.moveTo(nx, y - 7);
      ctx.lineTo(nx + 4, y);
      ctx.lineTo(nx, y + 7);
      ctx.lineTo(nx - 4, y);
      ctx.closePath();
      ctx.fill();
      ctx.font = '500 10px "Cinzel", Georgia, serif';
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(pal.gold, 0.7);
      ctx.fillText(t("windLabel").toUpperCase(), cx, y - 14);
      ctx.restore();
    },

    render(ctx, w, h, time) {
      const pal = SV.colors();
      const L = this.layout(w, h);
      this.buf = this.buf || SV.reflect.makeBuffer();
      const eye = this.eyeNow(L);

      art.oil(ctx, w, h, time, { noVignette: true });

      // reflected lamps
      ctx.save();
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 6; i++) {
        const lx = w * (0.18 + i * 0.13) + Math.sin(time * 0.5 + i) * 7;
        const ly = h * (0.17 + (i % 3) * 0.06);
        SV.fx.glow(ctx, lx, ly, 18, pal.ember, 0.24);
        ctx.fillStyle = pal.goldHi;
        ctx.beginPath();
        ctx.arc(lx, ly, 1.3, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();

      art.pole(ctx, L.cx + L.swayX, L.cy - L.size * 1.2, L.cy + L.size * 0.2, Math.max(1.5, L.size * 0.009), 0.15);

      // glow + reflection
      SV.fx.glow(ctx, L.cx, L.cy, L.size * 1.2, pal.gold, 0.13);
      const beat = Math.pow(1 - Math.abs(audio.beatPhase() * 2 - 1), 5);
      SV.fx.glow(ctx, L.cx, L.cy, L.size * 0.25, pal.goldHi, 0.05 + beat * 0.1);

      SV.reflect.renderFish(this.buf, L.size, this.angle, { time });
      SV.reflect.blit(ctx, this.buf, L.cx + L.swayX, L.cy + L.swayY, L.dest, time, 2.4, 0.4 + this.misses * 0.12, 0.95);

      const mask = ctx.createRadialGradient(L.cx, L.cy, L.size * 0.3, L.cx, L.cy, L.dest * 0.48);
      mask.addColorStop(0, "rgba(0,0,0,0)");
      mask.addColorStop(0.75, rgba(pal.poolMid, 0.06));
      mask.addColorStop(1, rgba(pal.poolTop, 0.68));
      ctx.fillStyle = mask;
      ctx.fillRect(L.cx - L.dest / 2, L.cy - L.dest / 2, L.dest, L.dest);

      // the eye's orbit, slowly revealed by misses
      const orbitR = Math.hypot(L.size * 0.36, L.size * 0.045);
      ctx.save();
      ctx.strokeStyle = rgba(pal.gold, 0.07 + Math.min(0.2, this.misses * 0.05));
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 10]);
      ctx.beginPath();
      ctx.arc(L.cx + L.swayX, L.cy + L.swayY, orbitR, 0, 6.283);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ghost marks
      for (let i = 0; i < this.ghosts.length; i++) {
        const gh = this.ghosts[i];
        const k = gh.life / gh.maxLife;
        ctx.save();
        ctx.globalAlpha = k * 0.65;
        ctx.strokeStyle = pal.teal;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(gh.x, gh.y, 8, 0, 6.283);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gh.x - 12, gh.y);
        ctx.lineTo(gh.x + 12, gh.y);
        ctx.moveTo(gh.x, gh.y - 12);
        ctx.lineTo(gh.x, gh.y + 12);
        ctx.stroke();
        if (gh.land) {
          ctx.strokeStyle = pal.goldHi;
          ctx.beginPath();
          ctx.moveTo(gh.land.x - 6, gh.land.y - 6);
          ctx.lineTo(gh.land.x + 6, gh.land.y + 6);
          ctx.moveTo(gh.land.x + 6, gh.land.y - 6);
          ctx.lineTo(gh.land.x - 6, gh.land.y + 6);
          ctx.stroke();
        }
        ctx.restore();
      }

      // target window around the eye
      if (!this.done && !this.failed) {
        const hr = this.hitRadius(L);
        const lp = this.landPoint(w, h);
        const near = U.dist(lp.x, lp.y, eye.x, eye.y) < hr;
        ctx.save();
        ctx.strokeStyle = rgba(near ? pal.teal : pal.gold, (near ? 0.5 : 0.16) + this.open * 0.2);
        ctx.lineWidth = near ? 1.6 : 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, hr, 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        SV.fx.glow(ctx, eye.x, eye.y, L.hitR * (0.7 + this.open * 0.9), pal.goldHi, 0.03 + this.open * 0.12);
        if (near) SV.fx.glow(ctx, eye.x, eye.y, hr * 1.6, pal.teal, 0.14);
      }

      // steam
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = pal.poolHi;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const sx = w * (0.2 + i * 0.2);
        ctx.beginPath();
        for (let y = h * 0.92; y > h * 0.38; y -= 12) {
          const x = sx + Math.sin(y * 0.022 + time * 0.8 + i) * 15;
          if (y === h * 0.92) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // arrow flight
      if (this.shot) {
        const s = this.shot;
        const k = U.clamp(s.t / 0.2, 0, 1);
        const x = U.lerp(s.from.x, s.to.x, U.easeOutCubic(k));
        const y = U.lerp(s.from.y, s.to.y, U.easeOutCubic(k));
        const lag = 34;
        ctx.save();
        const lg = ctx.createLinearGradient(x, y + lag, x, y);
        lg.addColorStop(0, rgba(pal.gold, 0));
        lg.addColorStop(1, rgba(pal.goldHi, 0.9));
        ctx.strokeStyle = lg;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x, y + lag);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = pal.goldHi;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, 6.283);
        ctx.fill();
        ctx.restore();
      }

      this.sparks.draw(ctx, pal);

      // wind gauge
      this.drawWind(ctx, w, h, time, pal);

      // reticle, draw ring and wind-carried landing mark
      if (!this.done && !this.failed) {
        const a = this.aimPoint();
        const lp = this.landPoint(w, h);
        const rr = U.clamp(Math.min(w, h) * 0.028, 15, 24);
        const pk = this.d.predict;
        if (pk > 0 && Math.abs(lp.x - a.x) > 3) {
          ctx.save();
          ctx.globalAlpha = pk;
          ctx.strokeStyle = pal.goldHi;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(lp.x, lp.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(lp.x, lp.y - 6);
          ctx.lineTo(lp.x + 6, lp.y);
          ctx.lineTo(lp.x, lp.y + 6);
          ctx.lineTo(lp.x - 6, lp.y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
        art.reticle(ctx, a.x, a.y, rr, time, {
          color: pal.teal,
          locked: U.dist(lp.x, lp.y, eye.x, eye.y) < this.hitRadius(L),
          danger: this.arrowsLeft <= 1 || (this.drawing && this.draw > this.d.sweet[1]),
        });
        if (this.drawing) this.drawRing(ctx, a.x, a.y, rr + 17, pal);
      }

      // success
      if (this.done) {
        const k = U.clamp(this.doneT / 1.2, 0, 1);
        if (this.finishedEye) {
          SV.fx.glow(ctx, this.finishedEye.x, this.finishedEye.y, 160, pal.goldHi, 0.4 * (1 - k * 0.5));
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = rgba(pal.goldHi, (1 - k) * 0.6);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.finishedEye.x, this.finishedEye.y, 20 + k * (90 + i * 60), 0, 6.283);
            ctx.stroke();
          }
        }
        ctx.fillStyle = rgba(pal.goldHi, U.clamp(this.doneT / 0.6, 0, 1));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '500 24px "Cormorant Garamond", Georgia, serif';
        ctx.shadowColor = pal.gold;
        ctx.shadowBlur = 20;
        ctx.fillText(t("fishHit"), w / 2, h * 0.28);
        ctx.shadowBlur = 0;
      }

      // flashes
      if (this.flash > 0) {
        ctx.fillStyle = rgba(pal.goldHi, this.flash * 0.18);
        ctx.fillRect(0, 0, w, h);
      }
      if (this.flashRed > 0) {
        ctx.fillStyle = rgba(pal.accent, this.flashRed * 0.08);
        ctx.fillRect(0, 0, w, h);
      }

      // vignette
      const v = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
  };

  SV.game.scenes.fish = fish;
})();
