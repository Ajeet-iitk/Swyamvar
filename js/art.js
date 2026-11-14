/* ============================================================
   art.js — procedural miniature-painting scenes
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;
  const U = SV.util;
  const rgba = SV.util.rgba;

  const art = {};

  function hash(i) {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ---------- arch / pillar ---------- */

  function archPath(ctx, cx, baseY, halfW, height) {
    ctx.beginPath();
    ctx.moveTo(cx - halfW, baseY);
    ctx.lineTo(cx - halfW, baseY - height * 0.54);
    ctx.quadraticCurveTo(cx - halfW * 1.01, baseY - height * 0.84, cx, baseY - height);
    ctx.quadraticCurveTo(cx + halfW * 1.01, baseY - height * 0.84, cx + halfW, baseY - height * 0.54);
    ctx.lineTo(cx + halfW, baseY);
  }

  function pillar(ctx, x, baseY, width, height, pal, alpha) {
    const top = baseY - height;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const g = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
    g.addColorStop(0, pal.hall);
    g.addColorStop(0.42, pal.arch);
    g.addColorStop(0.6, pal.arch);
    g.addColorStop(1, pal.hall);
    ctx.fillStyle = g;
    ctx.fillRect(x - width / 2, top, width, height);

    ctx.fillStyle = pal.arch;
    ctx.fillRect(x - width * 0.72, top - 14, width * 1.44, 14);
    ctx.fillRect(x - width * 0.72, baseY - 16, width * 1.44, 16);
    ctx.fillRect(x - width * 0.6, top + height * 0.42, width * 1.2, 8);

    ctx.strokeStyle = rgba(pal.gold, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.3, top + 8);
    ctx.lineTo(x - width * 0.3, baseY - 18);
    ctx.moveTo(x + width * 0.3, top + 8);
    ctx.lineTo(x + width * 0.3, baseY - 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function lampPositions(w, h) {
    const arr = [];
    const n = w < 620 ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const x = w * (0.12 + (i / (n - 1 || 1)) * 0.76);
      const len = h * (0.11 + hash(i + 7) * 0.13);
      arr.push({ x, y: len, sway: 0.6 + hash(i + 2) * 0.8, phase: hash(i + 11) * 6.28 });
    }
    return arr;
  }

  function buildHall(w, h, pal) {
    const dpr = Math.min(SV.stage.dpr || 1, 1.6);
    const c = document.createElement("canvas");
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal.bgTop);
    g.addColorStop(0.56, pal.bgMid);
    g.addColorStop(1, pal.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // warm light behind the dais
    SV.fx.glow(ctx, w * 0.5, h * 0.42, Math.max(w, h) * 0.55, pal.gold, 0.12);
    SV.fx.glow(ctx, w * 0.5, h * 0.72, Math.max(w, h) * 0.35, pal.ember, 0.08);

    const floorY = h * 0.8;

    // distant arches, receding
    for (let i = 2; i >= 0; i--) {
      const k = 1 - i * 0.13;
      const halfW = Math.min(w * 0.4, h * 0.52) * k;
      const height = h * 0.76 * k;
      archPath(ctx, w * 0.5, floorY, halfW, height);
      ctx.strokeStyle = rgba(pal.archLine, i === 0 ? 0.5 : 0.26);
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.stroke();

      if (i === 0) {
        ctx.save();
        archPath(ctx, w * 0.5, floorY, halfW * 0.92, height * 0.955);
        ctx.clip();
        const inner = ctx.createLinearGradient(0, floorY - height, 0, floorY);
        inner.addColorStop(0, rgba(pal.gold, 0.045));
        inner.addColorStop(0.6, "rgba(255,255,255,0)");
        ctx.fillStyle = inner;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    // side pillars
    const pw = Math.max(30, w * 0.045);
    pillar(ctx, w * 0.065, floorY + 12, pw, h * 0.62, pal, 0.95);
    pillar(ctx, w * 0.935, floorY + 12, pw, h * 0.62, pal, 0.95);
    if (w > 900) {
      pillar(ctx, w * 0.2, floorY + 6, pw * 0.62, h * 0.5, pal, 0.7);
      pillar(ctx, w * 0.8, floorY + 6, pw * 0.62, h * 0.5, pal, 0.7);
    }

    // hanging lamps (bowls + chains)
    lampPositions(w, h).forEach((lp) => {
      ctx.strokeStyle = rgba(pal.gold, 0.26);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(lp.x, 0);
      ctx.lineTo(lp.x, lp.y);
      ctx.stroke();

      ctx.fillStyle = rgba(pal.goldDeep, 0.8);
      ctx.beginPath();
      ctx.moveTo(lp.x - 11, lp.y);
      ctx.quadraticCurveTo(lp.x, lp.y + 14, lp.x + 11, lp.y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = rgba(pal.gold, 0.5);
      ctx.beginPath();
      ctx.moveTo(lp.x - 11, lp.y);
      ctx.quadraticCurveTo(lp.x, lp.y + 14, lp.x + 11, lp.y);
      ctx.stroke();
    });

    // floor
    const fg = ctx.createLinearGradient(0, floorY - 25, 0, h);
    fg.addColorStop(0, rgba(pal.gold, 0.05));
    fg.addColorStop(0.35, pal.hall);
    fg.addColorStop(1, pal.crowd);
    ctx.fillStyle = fg;
    ctx.fillRect(0, floorY - 25, w, h - floorY + 25);

    // floor inlay lines
    ctx.strokeStyle = rgba(pal.gold, 0.1);
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const yy = floorY + (h - floorY) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(w * 0.04, yy);
      ctx.lineTo(w * 0.96, yy);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(w * 0.5, floorY - 10);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();

    // crowd silhouettes, two ranks
    const crowdAlpha = pal.mode === "light" ? [0.38, 0.54] : [0.7, 0.92];
    for (let rank = 0; rank < 2; rank++) {
      const count = Math.ceil(w / (rank === 0 ? 52 : 78));
      const baseY = floorY + (rank === 0 ? 18 : 58);
      const scale = rank === 0 ? 0.8 : 1.15;
      ctx.fillStyle = rgba(pal.crowd, crowdAlpha[rank]);
      for (let i = 0; i < count; i++) {
        const x = (i + 0.5) * (w / count) + (hash(i + rank * 21) - 0.5) * 18;
        const s = (0.8 + hash(i + 5) * 0.45) * scale;
        const hy = baseY - 26 * s;
        // shoulders
        ctx.beginPath();
        ctx.ellipse(x, baseY + 4, 23 * s, 17 * s, 0, Math.PI, 0);
        ctx.fill();
        // head
        ctx.beginPath();
        ctx.arc(x, hy, 9.5 * s, 0, 6.283);
        ctx.fill();
        // turban
        ctx.beginPath();
        ctx.ellipse(x, hy - 6 * s, 9.5 * s, 6.8 * s, 0, Math.PI, 0);
        ctx.fill();
        if (hash(i + 40) > 0.55) {
          ctx.strokeStyle = rgba(pal.gold, 0.14);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(x, hy, 10 * s, Math.PI * 1.1, Math.PI * 1.7);
          ctx.stroke();
        }
      }
    }

    // foreground fade
    const ff = ctx.createLinearGradient(0, h * 0.82, 0, h);
    ff.addColorStop(0, "rgba(0,0,0,0)");
    ff.addColorStop(1, rgba(pal.mode === "dark" ? "#05030a" : "#7a5a32", 0.5));
    ctx.fillStyle = ff;
    ctx.fillRect(0, h * 0.8, w, h * 0.2);

    return c;
  }

  const hallCache = { key: "", canvas: null };

  art.hall = function hall(ctx, w, h, t, opts) {
    const o = opts || {};
    const pal = SV.colors();
    const key = Math.round(w) + "x" + Math.round(h) + ":" + pal.mode;
    if (hallCache.key !== key) {
      hallCache.canvas = buildHall(w, h, pal);
      hallCache.key = key;
    }
    ctx.drawImage(hallCache.canvas, 0, 0, w, h);

    // flickering flames over cached bowls
    const lamps = lampPositions(w, h);
    for (let i = 0; i < lamps.length; i++) {
      const lp = lamps[i];
      const flick = 0.7 + Math.sin(t * 8 + lp.phase) * 0.16 + Math.sin(t * 13.7 + lp.phase * 3) * 0.1;
      const fy = lp.y + 1;
      SV.fx.glow(ctx, lp.x, fy - 3, 40 * flick, pal.ember, 0.5);
      ctx.fillStyle = pal.goldHi;
      ctx.beginPath();
      ctx.ellipse(lp.x, fy - 2, 2.3, 5.4 * flick, 0, 0, 6.283);
      ctx.fill();
    }

    // drifting light shafts
    if (!o.noShafts) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = pal.mode === "dark" ? 0.035 : 0.05;
      for (let i = 0; i < 3; i++) {
        const sx = w * (0.3 + i * 0.2) + Math.sin(t * 0.12 + i) * 40;
        const grd = ctx.createLinearGradient(sx, 0, sx + w * 0.06, h);
        grd.addColorStop(0, rgba(pal.gold, 0.8));
        grd.addColorStop(1, rgba(pal.gold, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + w * 0.13, 0);
        ctx.lineTo(sx + w * 0.3, h);
        ctx.lineTo(sx + w * 0.1, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (o.dim) {
      ctx.fillStyle = rgba("#05030a", o.dim);
      ctx.fillRect(0, 0, w, h);
    }
  };

  /* ---------- mandala ---------- */

  art.mandala = function mandala(ctx, cx, cy, r, t, alpha, speed) {
    const pal = SV.colors();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * (speed == null ? 0.03 : speed));
    ctx.globalAlpha = alpha == null ? 0.2 : alpha;
    ctx.strokeStyle = pal.gold;
    ctx.lineWidth = 0.8;

    for (let ring = 0; ring < 4; ring++) {
      const rr = r * (0.36 + ring * 0.19);
      const petals = 8 + ring * 4;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, 6.283);
      ctx.stroke();
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(rr * 0.11, 0, rr * 0.12, rr * 0.045, 0, 0, 6.283);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.setLineDash([2, 9]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 6.283);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ---------- diya ---------- */

  art.diya = function diya(ctx, x, y, s, t, phase) {
    const pal = SV.colors();
    const fl = 0.75 + Math.sin(t * 9 + (phase || 0)) * 0.18 + Math.sin(t * 15.3 + (phase || 0) * 2) * 0.07;
    SV.fx.glow(ctx, x, y - 6 * s, 34 * s * fl, pal.ember, 0.55);
    ctx.fillStyle = rgba(pal.goldDeep, 0.9);
    ctx.beginPath();
    ctx.ellipse(x, y, 12 * s, 4.5 * s, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = pal.goldHi;
    ctx.beginPath();
    ctx.ellipse(x, y - 3 * s, 2.1 * s, 5.5 * s * fl, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = rgba("#ffffff", 0.85);
    ctx.beginPath();
    ctx.ellipse(x, y - 4.5 * s, 0.9 * s, 2.6 * s * fl, 0, 0, 6.283);
    ctx.fill();
  };

  /* ---------- fish + wheel ---------- */

  art.fishEyeOffset = function fishEyeOffset(size, angle) {
    const ex = size * 0.36;
    const ey = -size * 0.045;
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: ex * c - ey * s, y: ex * s + ey * c };
  };

  art.fish = function fish(ctx, cx, cy, size, angle, opts) {
    const pal = SV.colors();
    const o = opts || {};
    const s = size;
    const alpha = o.alpha == null ? 1 : o.alpha;
    const ghost = !!o.ghost;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    // wheel
    if (o.wheel !== false) {
      const wr = s * 0.66;
      ctx.save();
      ctx.globalAlpha = alpha * (ghost ? 0.35 : 0.5);
      ctx.strokeStyle = rgba(pal.gold, ghost ? 0.4 : 0.62);
      ctx.lineWidth = Math.max(0.8, s * 0.008);
      ctx.beginPath();
      ctx.arc(0, 0, wr, 0, 6.283);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, wr * 0.9, 0, 6.283);
      ctx.stroke();
      const spokes = 12;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * wr * 0.16, Math.sin(a) * wr * 0.16);
        ctx.lineTo(Math.cos(a) * wr, Math.sin(a) * wr);
        ctx.stroke();
        // blade
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * wr, Math.sin(a) * wr);
        ctx.lineTo(Math.cos(a + 0.16) * wr * 1.06, Math.sin(a + 0.16) * wr * 1.06);
        ctx.lineTo(Math.cos(a + 0.05) * wr * 1.2, Math.sin(a + 0.05) * wr * 1.2);
        ctx.closePath();
        ctx.fillStyle = rgba(pal.goldDeep, 0.5);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, wr * 0.16, 0, 6.283);
      ctx.fillStyle = rgba(pal.goldDeep, 0.85);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.goldHi, 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // tail fan
    const tail = ctx.createLinearGradient(-s * 0.5, 0, -s * 0.8, 0);
    tail.addColorStop(0, pal.gold);
    tail.addColorStop(1, rgba(pal.goldDeep, 0.85));
    ctx.fillStyle = ghost ? rgba(pal.teal, 0.35) : tail;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, 0);
    ctx.quadraticCurveTo(-s * 0.62, -s * 0.14, -s * 0.8, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.7, -s * 0.02, -s * 0.8, 0.3 * s);
    ctx.quadraticCurveTo(-s * 0.62, s * 0.14, -s * 0.42, 0);
    ctx.closePath();
    ctx.fill();

    // dorsal fin
    ctx.fillStyle = rgba(ghost ? pal.teal : pal.gold, 0.85);
    ctx.beginPath();
    ctx.moveTo(s * 0.06, -s * 0.24);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.45, -s * 0.34, -s * 0.26);
    ctx.quadraticCurveTo(-s * 0.18, -s * 0.2, -s * 0.05, -s * 0.18);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.save();
    if (!ghost) {
      ctx.shadowColor = rgba(pal.gold, 0.65);
      ctx.shadowBlur = s * 0.14;
    }
    const bg = ctx.createLinearGradient(-s * 0.2, -s * 0.34, s * 0.24, s * 0.32);
    if (ghost) {
      bg.addColorStop(0, rgba(pal.teal, 0.4));
      bg.addColorStop(1, rgba(pal.teal, 0.1));
    } else {
      bg.addColorStop(0, pal.goldHi);
      bg.addColorStop(0.42, pal.gold);
      bg.addColorStop(1, pal.goldDeep);
    }
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(s * 0.52, 0);
    ctx.bezierCurveTo(s * 0.47, -s * 0.17, s * 0.32, -s * 0.28, s * 0.06, -s * 0.29);
    ctx.bezierCurveTo(-s * 0.2, -s * 0.3, -s * 0.38, -s * 0.2, -s * 0.46, -s * 0.08);
    ctx.lineTo(-s * 0.46, s * 0.08);
    ctx.bezierCurveTo(-s * 0.38, s * 0.2, -s * 0.2, s * 0.29, s * 0.06, s * 0.27);
    ctx.bezierCurveTo(s * 0.32, s * 0.25, s * 0.47, s * 0.16, s * 0.52, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // outline
    ctx.strokeStyle = ghost ? rgba(pal.teal, 0.5) : rgba(pal.goldHi, 0.7);
    ctx.lineWidth = Math.max(0.7, s * 0.006);
    ctx.beginPath();
    ctx.moveTo(s * 0.52, 0);
    ctx.bezierCurveTo(s * 0.47, -s * 0.17, s * 0.32, -s * 0.28, s * 0.06, -s * 0.29);
    ctx.bezierCurveTo(-s * 0.2, -s * 0.3, -s * 0.38, -s * 0.2, -s * 0.46, -s * 0.08);
    ctx.stroke();

    // scales
    if (!ghost) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s * 0.5, 0);
      ctx.bezierCurveTo(s * 0.44, -s * 0.24, s * 0.2, -s * 0.29, 0, -s * 0.27);
      ctx.bezierCurveTo(-s * 0.24, -s * 0.24, -s * 0.4, -s * 0.13, -s * 0.43, 0);
      ctx.bezierCurveTo(-s * 0.4, s * 0.13, -s * 0.24, s * 0.26, 0, s * 0.26);
      ctx.bezierCurveTo(s * 0.2, s * 0.27, s * 0.44, s * 0.22, s * 0.5, 0);
      ctx.clip();
      ctx.strokeStyle = rgba(pal.goldDeep, 0.45);
      ctx.lineWidth = Math.max(0.5, s * 0.004);
      for (let row = -2; row <= 2; row++) {
        for (let col = -2; col <= 2; col++) {
          ctx.beginPath();
          ctx.arc(-s * 0.04 + col * s * 0.15, row * s * 0.1 + (col % 2) * s * 0.045, s * 0.075, 0.15, Math.PI - 0.15);
          ctx.stroke();
        }
      }
      ctx.restore();

      // pectoral fin
      ctx.fillStyle = rgba(pal.goldHi, 0.45);
      ctx.beginPath();
      ctx.ellipse(s * 0.1, s * 0.12, s * 0.09, s * 0.04, -0.5, 0, 6.283);
      ctx.fill();

      // gill
      ctx.strokeStyle = rgba(pal.goldDeep, 0.55);
      ctx.beginPath();
      ctx.arc(s * 0.3, 0, s * 0.15, Math.PI * 0.62, Math.PI * 1.38);
      ctx.stroke();

      // mouth
      ctx.strokeStyle = rgba(pal.goldDeep, 0.7);
      ctx.beginPath();
      ctx.moveTo(s * 0.51, -s * 0.01);
      ctx.quadraticCurveTo(s * 0.47, s * 0.02, s * 0.44, s * 0.05);
      ctx.stroke();
    }

    // eye
    const eyeR = s * (o.eyeR || 0.062);
    ctx.save();
    ctx.shadowColor = rgba(ghost ? pal.teal : pal.goldHi, 0.9);
    ctx.shadowBlur = s * 0.1;
    ctx.fillStyle = ghost ? rgba(pal.teal, 0.5) : pal.goldHi;
    ctx.beginPath();
    ctx.arc(s * 0.36, -s * 0.045, eyeR * 1.5, 0, 6.283);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = ghost ? rgba(pal.teal, 0.8) : "#1a0d05";
    ctx.beginPath();
    ctx.arc(s * 0.36, -s * 0.045, eyeR, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = ghost ? pal.teal : "#ffe9bd";
    ctx.beginPath();
    ctx.arc(s * 0.345, -s * 0.062, eyeR * 0.38, 0, 6.283);
    ctx.fill();

    // bright targeting ring when asked (trial III)
    if (o.highlight) {
      const er = eyeR * (2 + Math.sin(o.time * 5) * 0.25);
      ctx.strokeStyle = rgba(pal.teal, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s * 0.36, -s * 0.045, er, 0, 6.283);
      ctx.stroke();
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.arc(s * 0.36, -s * 0.045, er * 1.7, 0, 6.283);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ---------- bow ---------- */

  art.bow = function bow(ctx, cx, cy, scale, bend, opts) {
    const pal = SV.colors();
    const o = opts || {};
    const s = scale;
    const pull = U.clamp(bend, 0, 1);
    const alpha = o.alpha == null ? 1 : o.alpha;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = alpha;

    const topY = -s * 1.18;
    const botY = s * 1.18;
    const belly = -s * 0.46 - pull * s * 0.06;
    const tipX = -s * 0.1 + pull * s * 0.05;

    // limbs
    const limbGrad = ctx.createLinearGradient(cx - s * 0.5, 0, cx + s * 0.2, 0);
    limbGrad.addColorStop(0, pal.goldDeep);
    limbGrad.addColorStop(0.5, pal.gold);
    limbGrad.addColorStop(1, pal.goldHi);
    ctx.strokeStyle = o.ghost ? rgba(pal.teal, 0.45) : limbGrad;
    ctx.lineWidth = Math.max(3, s * 0.055);
    ctx.lineCap = "round";
    if (!o.ghost) {
      ctx.shadowColor = rgba(pal.gold, 0.55);
      ctx.shadowBlur = s * 0.12;
    }

    ctx.beginPath();
    ctx.moveTo(tipX, topY);
    ctx.quadraticCurveTo(belly - s * 0.28, -s * 0.55, belly, 0);
    ctx.quadraticCurveTo(belly - s * 0.28, s * 0.55, tipX, botY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // inlay line
    ctx.strokeStyle = rgba(pal.goldHi, 0.55);
    ctx.lineWidth = Math.max(0.7, s * 0.012);
    ctx.beginPath();
    ctx.moveTo(tipX + s * 0.02, topY + s * 0.03);
    ctx.quadraticCurveTo(belly - s * 0.24, -s * 0.54, belly + s * 0.02, 0);
    ctx.quadraticCurveTo(belly - s * 0.24, s * 0.54, tipX + s * 0.02, botY - s * 0.03);
    ctx.stroke();

    // string
    const nockX = s * 0.28 + pull * s * 0.62;
    ctx.strokeStyle = rgba(pal.goldHi, 0.82);
    ctx.lineWidth = Math.max(1, s * 0.011);
    ctx.beginPath();
    ctx.moveTo(tipX, topY);
    ctx.lineTo(nockX, 0);
    ctx.lineTo(tipX, botY);
    ctx.stroke();

    // bound grip
    ctx.strokeStyle = rgba(pal.goldDeep, 0.95);
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(belly - s * 0.03, -s * 0.16);
    ctx.lineTo(belly - s * 0.03, s * 0.16);
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.goldHi, 0.4);
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(belly - s * 0.07, i * s * 0.045);
      ctx.lineTo(belly + s * 0.01, i * s * 0.045 + s * 0.012);
      ctx.stroke();
    }

    // grip glow
    SV.fx.glow(ctx, belly, 0, s * 0.34, pal.gold, 0.22 + pull * 0.2);

    // hands
    if (o.hands !== false) {
      const handR = Math.max(4, s * 0.055);
      ctx.fillStyle = rgba(pal.goldHi, 0.9);
      ctx.beginPath();
      ctx.arc(belly, 0, handR, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = rgba(pal.gold, 0.9);
      ctx.beginPath();
      ctx.arc(nockX + s * 0.02, 0, handR * 0.9, 0, 6.283);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ---------- oil surface ---------- */

  const bubbleSeeds = [];
  for (let i = 0; i < 26; i++) {
    bubbleSeeds.push({ x: hash(i + 3), y: hash(i + 9), r: 1 + hash(i + 17) * 4, sp: 0.02 + hash(i + 23) * 0.05, ph: hash(i + 31) * 6.28 });
  }

  art.oil = function oil(ctx, w, h, t, opts) {
    const pal = SV.colors();
    const o = opts || {};
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal.poolTop);
    g.addColorStop(0.35, pal.poolMid);
    g.addColorStop(1, pal.poolBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // slow swirls
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 4; i++) {
      const cx = w * (0.2 + 0.2 * i) + Math.sin(t * 0.18 + i) * 40;
      const cy = h * (0.3 + 0.15 * i) + Math.cos(t * 0.13 + i) * 30;
      const rr = Math.min(w, h) * (0.18 + i * 0.06);
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      sg.addColorStop(0, rgba(pal.poolHi, 0.22));
      sg.addColorStop(0.6, rgba(pal.poolHi, 0.06));
      sg.addColorStop(1, rgba(pal.poolHi, 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.7, Math.sin(t * 0.1 + i) * 0.3, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();

    // warm glints
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 12; i++) {
      const x = ((hash(i + 2) * w + t * (6 + i * 2)) % (w + 80)) - 40;
      const y = h * (0.12 + hash(i + 12) * 0.76);
      const len = 18 + hash(i + 5) * 60;
      const a = 0.04 + Math.sin(t * 0.8 + i) * 0.03;
      ctx.strokeStyle = rgba(pal.poolHi, Math.max(0, a));
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + Math.sin(t + i) * 3);
      ctx.stroke();
    }
    ctx.restore();

    // bubbles
    for (let i = 0; i < bubbleSeeds.length; i++) {
      const b = bubbleSeeds[i];
      const y = ((b.y * h - t * b.sp * h * 0.6) % h + h) % h;
      const x = b.x * w + Math.sin(t * 0.6 + b.ph) * 14;
      ctx.strokeStyle = rgba(pal.poolHi, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, 6.283);
      ctx.stroke();
      ctx.fillStyle = rgba(pal.poolHi, 0.1);
      ctx.beginPath();
      ctx.arc(x, y, b.r * 0.8, 0, 6.283);
      ctx.fill();
    }

    if (!o.noVignette) {
      const v = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(0.7, "rgba(0,0,0,0.18)");
      v.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    }
  };

  /* ---------- reticle ---------- */

  art.reticle = function reticle(ctx, x, y, r, t, opts) {
    const pal = SV.colors();
    const o = opts || {};
    const color = o.color || pal.gold;
    const clarity = o.clarity || 0;
    const locked = !!o.locked;
    const danger = !!o.danger;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = o.alpha == null ? 0.95 : o.alpha;

    // clarity halo
    if (clarity > 0) {
      ctx.strokeStyle = rgba(pal.teal, 0.55);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + clarity * Math.PI * 2);
      ctx.stroke();
    }

    // rotating dashed outer ring
    ctx.save();
    ctx.rotate(t * 0.42);
    ctx.strokeStyle = rgba(danger ? pal.accent : color, 0.5);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, 6.283);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // main ring
    ctx.strokeStyle = rgba(locked ? pal.teal : danger ? pal.accent : color, 0.9);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 6.283);
    ctx.stroke();

    // ticks
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
      ctx.lineTo(Math.cos(a) * (r + 7), Math.sin(a) * (r + 7));
      ctx.stroke();
    }

    // crosshair
    ctx.strokeStyle = rgba(locked ? pal.teal : color, 0.75);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, 0); ctx.lineTo(-r * 0.18, 0);
    ctx.moveTo(r * 0.18, 0); ctx.lineTo(r * 0.55, 0);
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, -r * 0.18);
    ctx.moveTo(0, r * 0.18); ctx.lineTo(0, r * 0.55);
    ctx.stroke();

    ctx.fillStyle = rgba(locked ? pal.teal : pal.goldHi, 0.95);
    ctx.beginPath();
    ctx.arc(0, 0, 1.9, 0, 6.283);
    ctx.fill();

    SV.fx.glow(ctx, 0, 0, r * 1.5, locked ? pal.teal : color, 0.12);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ---------- pole + reflection hint ---------- */

  art.pole = function pole(ctx, x, topY, bottomY, s, alpha) {
    const pal = SV.colors();
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.5 : alpha;
    const g = ctx.createLinearGradient(x - s, 0, x + s, 0);
    g.addColorStop(0, rgba(pal.goldDeep, 0.15));
    g.addColorStop(0.5, rgba(pal.gold, 0.5));
    g.addColorStop(1, rgba(pal.goldDeep, 0.15));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.5, s);
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();
    for (let i = 1; i < 7; i++) {
      const y = topY + (bottomY - topY) * (i / 7);
      ctx.strokeStyle = rgba(pal.gold, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - s * 2.6, y);
      ctx.lineTo(x + s * 2.6, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- archer silhouette ---------- */

  art.archer = function archer(ctx, x, y, scale, opts) {
    const pal = SV.colors();
    const o = opts || {};
    const s = scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;

    // body
    ctx.fillStyle = o.color || rgba(pal.crowd, 0.96);
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, 0);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.42, -s * 0.22, -s * 0.72);
    ctx.quadraticCurveTo(-s * 0.16, -s * 0.9, 0, -s * 0.92);
    ctx.quadraticCurveTo(s * 0.18, -s * 0.9, s * 0.22, -s * 0.7);
    ctx.quadraticCurveTo(s * 0.26, -s * 0.4, s * 0.14, 0);
    ctx.closePath();
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(0, -s * 1.05, s * 0.16, 0, 6.283);
    ctx.fill();
    // topknot
    ctx.beginPath();
    ctx.arc(0, -s * 1.22, s * 0.07, 0, 6.283);
    ctx.fill();

    // arms + bow
    ctx.strokeStyle = rgba(pal.gold, 0.5);
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-s * 0.14, -s * 0.78);
    ctx.lineTo(-s * 0.55, -s * 0.6);
    ctx.moveTo(s * 0.14, -s * 0.78);
    ctx.lineTo(s * 0.5, -s * 0.55);
    ctx.stroke();

    ctx.strokeStyle = rgba(pal.gold, 0.65);
    ctx.lineWidth = Math.max(1.2, s * 0.028);
    ctx.beginPath();
    ctx.arc(-s * 0.62, -s * 0.55, s * 0.5, -1.15, -0.15);
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.goldHi, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 1.02);
    ctx.lineTo(-s * 0.76, -s * 0.44);
    ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ---------- light rays ---------- */

  art.rays = function rays(ctx, w, h, t, alpha) {
    const pal = SV.colors();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha == null ? 0.05 : alpha;
    ctx.translate(w * 0.5, h * 0.28);
    for (let i = 0; i < 7; i++) {
      ctx.rotate(Math.PI * 2 / 7 + Math.sin(t * 0.07 + i) * 0.04);
      const grd = ctx.createLinearGradient(0, 0, 0, -Math.max(w, h) * 0.8);
      grd.addColorStop(0, rgba(pal.gold, 0.9));
      grd.addColorStop(1, rgba(pal.gold, 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(-w * 0.02, 0);
      ctx.lineTo(w * 0.02, 0);
      ctx.lineTo(w * 0.11, -Math.max(w, h) * 0.8);
      ctx.lineTo(-w * 0.11, -Math.max(w, h) * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- story tableaus ---------- */

  art.tableau = function tableau(ctx, w, h, index, t) {
    const pal = SV.colors();
    art.hall(ctx, w, h, t, { dim: 0.12, noShafts: true });

    if (index === 0) {
      // the dais and the empty seat of the contest
      const cx = w * 0.5;
      const baseY = h * 0.66;
      ctx.fillStyle = rgba(pal.goldDeep, 0.32);
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 40, Math.min(w * 0.3, 260), 26, 0, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.gold, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 40, Math.min(w * 0.26, 220), 20, 0, 0, 6.283);
      ctx.stroke();
      art.mandala(ctx, cx, baseY - 90, Math.min(w, h) * 0.24, t, 0.14, 0.01);
      art.diya(ctx, cx - Math.min(w, h) * 0.25, baseY + 30, 1.1, t, 1);
      art.diya(ctx, cx + Math.min(w, h) * 0.25, baseY + 30, 1.1, t, 3);
    } else if (index === 1) {
      // the pole, the wheel, the pool
      const cx = w * 0.52;
      const topY = h * 0.14;
      art.pole(ctx, cx, topY, h * 0.72, Math.max(2, Math.min(w, h) * 0.006), 0.45);
      art.fish(ctx, cx, topY + Math.min(w, h) * 0.08, Math.min(w, h) * 0.12, -0.12, { alpha: 0.9, wheel: true });
      const pg = ctx.createRadialGradient(cx, h * 0.8, 10, cx, h * 0.8, Math.min(w, h) * 0.36);
      pg.addColorStop(0, rgba(pal.poolHi, 0.35));
      pg.addColorStop(0.6, rgba(pal.gold, 0.08));
      pg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.82, Math.min(w, h) * 0.4, Math.min(w, h) * 0.13, 0, 0, 6.283);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const rx = cx + Math.cos(t * 0.3 + i * 1.6) * 60;
        const ry = h * 0.82 + Math.sin(t * 0.3 + i * 1.6) * 14;
        ctx.strokeStyle = rgba(pal.poolHi, 0.13);
        ctx.beginPath();
        ctx.ellipse(rx, ry, 20 + i * 8, 4 + i * 2, 0, 0, 6.283);
        ctx.stroke();
      }
    } else if (index === 2) {
      // the archer at the pool, seen from behind
      art.mandala(ctx, w * 0.5, h * 0.42, Math.min(w, h) * 0.3, t, 0.1, 0.008);
      art.archer(ctx, w * 0.5, h * 0.79, Math.min(w, h) * 0.15, { alpha: 0.9 });
      const pg = ctx.createRadialGradient(w * 0.5, h * 0.9, 20, w * 0.5, h * 0.9, Math.min(w, h) * 0.4);
      pg.addColorStop(0, rgba(pal.poolHi, 0.3));
      pg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pg;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
    } else if (index === 3) {
      // Karna alone, lit by a single lamp
      ctx.fillStyle = rgba("#05030a", 0.35);
      ctx.fillRect(0, 0, w, h);
      art.diya(ctx, w * 0.5, h * 0.38, 1.6, t, 1);
      art.archer(ctx, w * 0.5, h * 0.84, Math.min(w, h) * 0.18, { alpha: 0.95 });
      ctx.fillStyle = rgba(pal.accent, 0.05);
      ctx.fillRect(0, 0, w, h);
    } else if (index === 4) {
      // ending
      SV.fx.glow(ctx, w * 0.5, h * 0.42, Math.max(w, h) * 0.45, pal.gold, 0.22);
      art.mandala(ctx, w * 0.5, h * 0.45, Math.min(w, h) * 0.4, t, 0.22, 0.02);
      art.rays(ctx, w, h, t, 0.05);
    }
  };

  SV.art = art;
})();
