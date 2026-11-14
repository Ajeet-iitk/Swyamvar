/* ============================================================
   fx.js — particle fields, glows, screen shake
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;

  function rgba(hex, a) {
    if (!hex) return "rgba(255,255,255," + a + ")";
    if (hex.indexOf("rgba") === 0 || hex.indexOf("rgb") === 0) return hex;
    let h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  SV.util.rgba = rgba;

  class Field {
    constructor(max) {
      this.items = [];
      this.max = max || 260;
    }

    clear() { this.items.length = 0; }

    add(p) {
      if (this.items.length >= this.max) this.items.shift();
      p.seed = Math.random() * 100;
      this.items.push(p);
    }

    embers(n, w, h, opts) {
      const o = opts || {};
      for (let i = 0; i < n; i++) {
        this.add({
          type: "ember",
          x: SV.util.rand(0, w),
          y: SV.util.rand(0, h),
          vx: SV.util.rand(-6, 6),
          vy: SV.util.rand(9, 30) * (o.speed || 1),
          size: SV.util.rand(0.8, 2.4),
          life: SV.util.rand(4, 12),
          maxLife: 12,
          alpha: SV.util.rand(0.25, 0.8),
          hue: Math.random() < 0.3 ? "gold" : "orange",
          phase: SV.util.rand(0, 6.28),
        });
      }
    }

    petals(n, w, h, opts) {
      const o = opts || {};
      for (let i = 0; i < n; i++) {
        this.add({
          type: "petal",
          x: SV.util.rand(0, w),
          y: SV.util.rand(-h * 0.3, h * 0.4),
          vx: SV.util.rand(-12, 12),
          vy: SV.util.rand(22, 58) * (o.speed || 1),
          size: SV.util.rand(3, 7),
          rot: SV.util.rand(0, 6.28),
          vr: SV.util.rand(-1.4, 1.4),
          life: SV.util.rand(7, 16),
          maxLife: 16,
          alpha: SV.util.rand(0.45, 0.95),
          color: Math.random() < 0.6 ? "gold" : "marigold",
        });
      }
    }

    motes(n, w, h, opts) {
      const o = opts || {};
      for (let i = 0; i < n; i++) {
        this.add({
          type: "mote",
          x: SV.util.rand(0, w),
          y: SV.util.rand(0, h),
          vx: SV.util.rand(-5, 5),
          vy: SV.util.rand(-6, 6),
          size: SV.util.rand(0.6, 1.8),
          life: SV.util.rand(5, 14),
          maxLife: 14,
          alpha: SV.util.rand(0.12, 0.55) * (o.alpha || 1),
          phase: SV.util.rand(0, 6.28),
        });
      }
    }

    burst(x, y, color, n, speed, opts) {
      const o = opts || {};
      for (let i = 0; i < n; i++) {
        const a = SV.util.rand(0, Math.PI * 2);
        const sp = SV.util.rand(speed * 0.2, speed);
        this.add({
          type: "spark",
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (o.lift || 0),
          size: SV.util.rand(1, 3.2),
          life: SV.util.rand(0.35, 1.1),
          maxLife: 1.1,
          alpha: 1,
          color: color || "gold",
          gravity: o.gravity != null ? o.gravity : 180,
        });
      }
    }

    ring(x, y, color, maxR, life, width) {
      this.add({
        type: "ring",
        x, y, r: 2, maxR: maxR || 120, life: life || 1,
        maxLife: life || 1, color: color || "gold",
        width: width || 2, alpha: 1,
      });
    }

    update(dt, t) {
      const arr = this.items;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life -= dt;
        if (p.life <= 0) { arr.splice(i, 1); continue; }
        switch (p.type) {
          case "ember":
            p.y -= p.vy * dt;
            p.x += (p.vx + Math.sin(t * 0.9 + p.seed) * 8) * dt;
            break;
          case "mote":
            p.x += (p.vx + Math.sin(t * 0.4 + p.seed) * 3) * dt;
            p.y += (p.vy + Math.cos(t * 0.32 + p.seed) * 3) * dt;
            break;
          case "petal":
            p.x += (p.vx + Math.sin(t * 1.1 + p.seed) * 22) * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
            break;
          case "spark":
            p.vy += p.gravity * dt;
            p.vx *= 0.985;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            break;
          case "ring":
            p.r += (p.maxR - p.r) * Math.min(1, dt * 5.5) + dt * 40;
            break;
          default:
            break;
        }
      }
    }

    draw(ctx, pal) {
      const arr = this.items;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        const lifeT = SV.util.clamp(p.life / p.maxLife, 0, 1);
        switch (p.type) {
          case "ember": {
            const alpha = p.alpha * Math.min(1, lifeT * 2) * (0.6 + Math.sin(p.life * 6 + p.seed) * 0.4);
            const col = p.hue === "gold" ? pal.goldHi : pal.ember;
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 6.283);
            ctx.fill();
            ctx.globalAlpha = alpha * 0.22;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2.6, 0, 6.283);
            ctx.fill();
            break;
          }
          case "mote": {
            ctx.globalAlpha = Math.max(0, p.alpha * Math.min(1, lifeT * 3) * (0.55 + Math.sin(p.life * 2 + p.seed) * 0.45));
            ctx.fillStyle = pal.goldHi;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 6.283);
            ctx.fill();
            break;
          }
          case "petal": {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, p.alpha * Math.min(1, lifeT * 2.5));
            ctx.fillStyle = p.color === "gold" ? pal.gold : pal.ember;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.42, 0, 0, 6.283);
            ctx.fill();
            ctx.globalAlpha *= 0.45;
            ctx.strokeStyle = pal.goldHi;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(-p.size, 0);
            ctx.lineTo(p.size, 0);
            ctx.stroke();
            ctx.restore();
            break;
          }
          case "spark": {
            ctx.globalAlpha = Math.max(0, lifeT * p.alpha);
            ctx.fillStyle = p.color === "gold" ? pal.goldHi : p.color === "red" ? pal.accent : p.color === "teal" ? pal.teal : pal.gold;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.5 + lifeT * 0.8), 0, 6.283);
            ctx.fill();
            break;
          }
          case "ring": {
            const k = 1 - p.life / p.maxLife;
            ctx.globalAlpha = Math.max(0, (1 - k) * 0.7);
            ctx.strokeStyle = p.color === "gold" ? pal.gold : p.color === "red" ? pal.accent : pal.teal;
            ctx.lineWidth = p.width * (1 - k * 0.6);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.stroke();
            break;
          }
          default:
            break;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  class Shake {
    constructor() {
      this.amount = 0;
      this.t = 0;
      this.x = 0;
      this.y = 0;
    }
    add(a) {
      if (SV.reduceMotion()) return;
      this.amount = Math.min(18, this.amount + a);
    }
    update(dt) {
      this.t += dt;
      this.amount *= Math.exp(-dt * 6.5);
      if (this.amount < 0.05) this.amount = 0;
      this.x = Math.sin(this.t * 57) * this.amount;
      this.y = Math.cos(this.t * 43) * this.amount * 0.7;
    }
    apply(ctx) {
      ctx.translate(this.x, this.y);
    }
    reset() { this.amount = 0; this.x = 0; this.y = 0; }
  }

  /* radial glow painted with a cached sprite for cheapness */
  const glowCache = new Map();
  function glow(ctx, x, y, radius, color, alpha) {
    const key = color + "|" + Math.round(radius);
    let c = glowCache.get(key);
    if (!c) {
      c = document.createElement("canvas");
      const s = Math.max(8, Math.round(radius * 2));
      c.width = s;
      c.height = s;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, rgba(color, 0.9));
      grad.addColorStop(0.25, rgba(color, 0.45));
      grad.addColorStop(0.6, rgba(color, 0.12));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      glowCache.set(key, c);
      if (glowCache.size > 60) {
        const first = glowCache.keys().next().value;
        glowCache.delete(first);
      }
    }
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(c, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  SV.fx = { Field, Shake, glow, rgba };
})();
