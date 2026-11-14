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
          fish.fire();
        }
      });
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
      this.finishedEye = null;
      this._left = false;
      this.buildArrows();
      this.refreshText();
      this.syncHUD(true);
      G().paused = false;
    },

    exit() {},

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

      // spin
      const speed = this.baseSpeed * this.assist * (1 + Math.sin(time * 0.8) * 0.16);
      this.angle += speed * dt;
      if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;

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

    fire() {
      if (G().paused || this.done || this.failed || this.cooldown > 0 || this.shot) return;
      const w = SV.stage.w, h = SV.stage.h;
      const L = this.layout(w, h);
      const eye = this.eyeNow(L);
      const dist = U.dist(this.reticle.x, this.reticle.y, eye.x, eye.y);
      const hit = dist <= L.hitR;
      this.cooldown = 0.4;
      this.shots += 1;
      audio.sfx("whoosh");
      audio.sfx("twang");
      this.shot = {
        from: { x: this.reticle.x, y: h + 30 },
        to: { x: this.reticle.x, y: this.reticle.y },
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
      this.ghosts.push({ x: eye.x, y: eye.y, life: 4.2, maxLife: 4.2, angle: this.angle });
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
        setTimeout(() => {
          if (G().screen === "fish") G().showFail("fish");
        }, 750);
      }
    },

    onDown(x, y) {
      this.pointerDown = { x, y, t: performance.now() };
    },

    onMove(x, y) {
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointerDown = null;
    },

    onUp(x, y) {
      if (!this.pointerDown) return;
      const d = this.pointerDown;
      this.pointerDown = null;
      if (performance.now() - d.t < 450 && U.dist(d.x, d.y, x, y) < 16) {
        this.fire();
      }
    },

    onKey(code, e) {
      if (code === "Space" || code === "Enter") {
        if (e && e.preventDefault) e.preventDefault();
        this.fire();
      }
    },
    onKeyUp() {},

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
        ctx.restore();
      }

      // target window around the eye
      if (!this.done && !this.failed) {
        const near = U.dist(this.reticle.x, this.reticle.y, eye.x, eye.y) < L.hitR;
        ctx.save();
        ctx.strokeStyle = rgba(near ? pal.teal : pal.gold, near ? 0.5 : 0.16);
        ctx.lineWidth = near ? 1.6 : 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, L.hitR, 0, 6.283);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        if (near) SV.fx.glow(ctx, eye.x, eye.y, L.hitR * 1.6, pal.teal, 0.14);
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

      // reticle
      if (!this.done && !this.failed) {
        art.reticle(ctx, this.reticle.x, this.reticle.y, U.clamp(Math.min(w, h) * 0.028, 15, 24), time, {
          color: pal.teal,
          locked: U.dist(this.reticle.x, this.reticle.y, eye.x, eye.y) < L.hitR,
          danger: this.arrowsLeft <= 1,
        });
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
