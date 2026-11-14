/* ============================================================
   draupadi.js — Draupadi in 3D: a procedural bride in wedding red,
   wearing her varmala. A tiny software renderer on canvas 2D —
   lathe surfaces + sphere chains, projected and depth-sorted.
   Drag to turn · wheel / pinch to zoom · arrows turn the view.
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;
  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- palette ---------- */
  const SKIN = [233, 186, 150];
  const SKIN_D = [214, 160, 124];
  const HAIR = [26, 15, 19];
  const GOLD = [228, 176, 66];
  const RED = [168, 18, 46];
  const RED_L = [198, 34, 62];
  const CHOLI = [140, 20, 46];
  const KUMKUM = [190, 30, 48];
  const GREEN = [48, 128, 74];
  const FLOWERS = [
    [255, 150, 30],  // marigold
    [255, 205, 60],  // yellow marigold
    [232, 70, 124],  // rose
    [255, 120, 20],  // deep marigold
    [255, 246, 228], // jasmine
    [214, 52, 100],  // rose
  ];

  /* ---------- seeded noise so the model never changes between visits ---------- */
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- profile helpers ---------- */
  function profileAt(rings, y, key) {
    const n = rings.length;
    const desc = rings[0].y > rings[n - 1].y;
    for (let i = 0; i < n - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      const hi = desc ? a : b, lo = desc ? b : a;
      if (y <= hi.y && y >= lo.y) {
        const t = hi.y === lo.y ? 0 : (y - lo.y) / (hi.y - lo.y);
        return lerp(lo[key], hi[key], t);
      }
    }
    return y > Math.max(rings[0].y, rings[n - 1].y) ? (desc ? rings[0][key] : rings[n - 1][key]) : (desc ? rings[n - 1][key] : rings[0][key]);
  }

  /* ---------- model ---------- */

  // skirt (lehenga): waist to hem
  const SKIRT = [
    [1.0, 0.14], [0.95, 0.17], [0.88, 0.205], [0.78, 0.25], [0.66, 0.30], [0.54, 0.355],
    [0.42, 0.405], [0.30, 0.45], [0.20, 0.49], [0.12, 0.52], [0.06, 0.535], [0.02, 0.545],
  ].map((r) => ({ y: r[0], rx: r[1], rz: r[1] }));

  // torso (blouse, midriff, shoulders, neck)
  const TORSO = [
    [1.0, 0.12, 0.09], [1.07, 0.125, 0.095], [1.16, 0.135, 0.115], [1.24, 0.145, 0.125],
    [1.31, 0.155, 0.105], [1.365, 0.18, 0.088], [1.395, 0.12, 0.075], [1.425, 0.05, 0.05], [1.52, 0.042, 0.045],
  ].map((r) => ({ y: r[0], rx: r[1], rz: r[2] }));

  // dupatta drape rows below the head (y, rx, rz, cz)
  const DRAPE = [
    [1.50, 0.115, 0.12, -0.01], [1.42, 0.19, 0.15, -0.02], [1.30, 0.24, 0.17, -0.03],
    [1.15, 0.25, 0.19, -0.04], [1.00, 0.265, 0.21, -0.05], [0.89, 0.275, 0.23, -0.055], [0.865, 0.275, 0.23, -0.055],
  ].map((r) => ({ y: r[0], rx: r[1], rz: r[2], cz: r[3] }));

  const HEAD = { x: 0, y: 1.6, z: 0.005, rx: 0.082, ry: 0.108, rz: 0.092 };

  function build() {
    seed = 7;
    const V = [];
    const polys = [];
    const spheres = [];
    const addV = (x, y, z) => { V.push(x, y, z); return V.length / 3 - 1; };

    const tint = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
    const css = (c) => "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")";

    function sphere(x, y, z, r, col, metal, soft) {
      const v = addV(x, y, z);
      spheres.push({
        v, r, m: !!metal,
        base: css(col),
        hi: css(tint(col, soft ? 1.1 : 1.3).map((n) => Math.min(255, n + (soft ? 10 : 28)))),
        lo: css(tint(col, soft ? 0.72 : 0.42)),
      });
      return v;
    }

    function orientSign(a, b, c, d, center) {
      const n = cross4(a, b, c, d);
      const mx = (V[a * 3] + V[b * 3] + V[c * 3] + V[d * 3]) / 4 - center[0];
      const my = (V[a * 3 + 1] + V[b * 3 + 1] + V[c * 3 + 1] + V[d * 3 + 1]) / 4 - center[1];
      const mz = (V[a * 3 + 2] + V[b * 3 + 2] + V[c * 3 + 2] + V[d * 3 + 2]) / 4 - center[2];
      return n[0] * mx + n[1] * my + n[2] * mz >= 0 ? 1 : -1;
    }
    function cross4(a, b, c, d) {
      const ux = V[c * 3] - V[a * 3], uy = V[c * 3 + 1] - V[a * 3 + 1], uz = V[c * 3 + 2] - V[a * 3 + 2];
      const wx = V[d * 3] - V[b * 3], wy = V[d * 3 + 1] - V[b * 3 + 1], wz = V[d * 3 + 2] - V[b * 3 + 2];
      return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
    }

    // surface of revolution around a vertical axis; front of the figure is +z
    function lathe(rings, segs, o) {
      const R = rings.length;
      const idx = [];
      for (let i = 0; i < R; i++) {
        const rg = rings[i];
        idx.push([]);
        for (let j = 0; j < segs; j++) {
          const a = (j / segs) * TAU;
          const mod = o.mod ? o.mod(i, a) : 1;
          idx[i].push(addV((rg.cx || 0) + rg.rx * mod * Math.sin(a), rg.y, (rg.cz || 0) + rg.rz * mod * Math.cos(a)));
        }
      }
      for (let i = 0; i < R - 1; i++) {
        for (let j = 0; j < segs; j++) {
          const a = idx[i][j], b = idx[i][(j + 1) % segs], c = idx[i + 1][(j + 1) % segs], d = idx[i + 1][j];
          if (o.keep && !o.keep(i, j, segs)) continue;
          const col = o.color(i, j, segs);
          const cen = o.center || [rings[i].cx || 0, (rings[i].y + rings[i + 1].y) / 2, rings[i].cz || 0];
          polys.push({ a, b, c, d, col, m: col[3] ? 1 : 0, s: orientSign(a, b, c, d, cen), alpha: 1 });
        }
      }
    }

    /* --- ground petals, a ring of flowers at her feet --- */
    for (let k = 0; k < 46; k++) {
      const a = (k / 46) * TAU + rnd() * 0.1;
      const rr = 0.78 + rnd() * 0.32;
      const col = FLOWERS[k % FLOWERS.length];
      sphere(Math.sin(a) * rr, 0.012, Math.cos(a) * rr, 0.017 + rnd() * 0.012, col, false);
    }

    /* --- lehenga --- */
    lathe(SKIRT, 72, {
      center: [0, 0.5, 0],
      mod: (i, a) => (i >= SKIRT.length - 2 ? 1 + 0.018 * Math.sin(a * 18) : 1),
      color: (i, j) => {
        const y = (SKIRT[i].y + SKIRT[i + 1].y) / 2;
        if (y < 0.1) return [GOLD[0], GOLD[1], GOLD[2], 1];
        if (y > 0.11 && y < 0.17) return [220, 164, 66, 1];
        if (y > 0.955) return [GOLD[0], GOLD[1], GOLD[2], 1];
        const s = j % 9;
        if (y > 0.2 && y < 0.62 && (s === 0 || s === 1)) return [218, 164, 62, 1];
        if (y > 0.26 && y < 0.5 && s === 4) return [196, 138, 52, 1];
        const pleat = j % 2 ? 0.93 : 1.04;
        return [RED[0] * pleat, RED[1] * pleat, RED[2] * pleat, 0];
      },
    });

    /* --- gold kamarbandh (waist belt) --- */
    lathe(
      [
        { y: 1.035, rx: 0.132, rz: 0.108 },
        { y: 1.0, rx: 0.14, rz: 0.115 },
        { y: 0.965, rx: 0.15, rz: 0.12 },
      ],
      36,
      { center: [0, 1.0, 0], color: (i, j) => (j % 4 === 0 ? [248, 210, 110, 1] : [GOLD[0], GOLD[1], GOLD[2], 1]) }
    );

    /* --- torso, choli, midriff, neck --- */
    lathe(TORSO, 52, {
      center: [0, 1.2, 0],
      color: (i, j, segs) => {
        const y = (TORSO[i].y + TORSO[i + 1].y) / 2;
        if (y < 1.068) return [SKIN[0], SKIN[1], SKIN[2], 0];
        if (y < 1.09) return [GOLD[0], GOLD[1], GOLD[2], 1];
        if (y < 1.36) {
          return [CHOLI[0], CHOLI[1], CHOLI[2], 0];
        }
        return [SKIN[0], SKIN[1], SKIN[2], 0];
      },
    });

    /* --- head (ellipsoid with a softly narrowing chin) --- */
    const headRings = (scale, dz) => {
      const rings = [];
      for (let k = 0; k <= 24; k++) {
        const ph = -Math.PI / 2 + (k / 24) * Math.PI;
        const sn = Math.sin(ph), cs = Math.cos(ph);
        const narrow = sn < 0 ? 1 + 0.34 * sn : 1;
        rings.push({
          y: HEAD.y + HEAD.ry * scale * sn,
          rx: Math.max(1e-4, HEAD.rx * scale * cs * narrow),
          rz: Math.max(1e-4, HEAD.rz * scale * cs * (sn < 0 ? 1 + 0.12 * sn : 1)),
          cz: HEAD.z + dz,
        });
      }
      return rings;
    };
    const hr = headRings(1, 0);
    lathe(hr, 44, {
      center: [0, HEAD.y, HEAD.z],
      color: () => [SKIN[0], SKIN[1], SKIN[2], 0],
    });
    // hair: covers crown, sides and back, leaving the face open
    const hh = headRings(1.065, -0.006);
    lathe(hh, 44, {
      center: [0, HEAD.y, HEAD.z],
      keep: (i, j, segs) => {
        const ph = -Math.PI / 2 + ((i + 0.5) / 24) * Math.PI;
        const a = ((j + 0.5) / segs) * TAU;
        const ny = Math.sin(ph);
        const nz = Math.cos(ph) * Math.cos(a);
        const nx = Math.cos(ph) * Math.sin(a);
        if (ny < -0.1) return nz < -0.25;
        // forehead + face window; the hair parts at the centre
        if (nz > 0.4 && ny < 0.6) return false;
        return true;
      },
      color: (i, j) => {
        const sheen = i > 15 && (j % 7 === 0) ? 1.6 : 1;
        return [HAIR[0] * sheen, HAIR[1] * sheen, HAIR[2] * sheen, 0];
      },
    });

    /* --- face --- */
    const fz = (x, y, grow) => {
      const nx = x / HEAD.rx, ny = (y - HEAD.y) / HEAD.ry;
      const k = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));
      return HEAD.z + HEAD.rz * k + (grow || 0);
    };
    for (const sx of [-1, 1]) {
      // eyes: white, iris, kajal
      sphere(sx * 0.03, 1.612, fz(sx * 0.03, 1.612, 0.0), 0.0135, [250, 244, 238], false);
      sphere(sx * 0.03, 1.612, fz(sx * 0.03, 1.612, 0.0075), 0.0082, [44, 24, 20], false);
      sphere(sx * 0.0315, 1.6135, fz(sx * 0.03, 1.612, 0.0125), 0.0028, [255, 255, 255], false);
      sphere(sx * 0.0425, 1.609, fz(sx * 0.0425, 1.609, 0.002), 0.0048, [18, 10, 12], false); // kajal wing
      sphere(sx * 0.0205, 1.609, fz(sx * 0.0205, 1.609, 0.002), 0.0036, [18, 10, 12], false);
      // brows
      for (let k = 0; k < 4; k++) {
        const bx = sx * (0.02 + k * 0.0125);
        const by = 1.641 + Math.sin(k * 0.8) * 0.004 - (k === 3 ? 0.003 : 0);
        sphere(bx, by, fz(bx, by, 0.001), 0.0042, [28, 16, 18], false);
      }
      // cheeks: faint blush
      sphere(sx * 0.047, 1.575, fz(sx * 0.047, 1.575, -0.007), 0.0135, [240, 172, 148], false);
      // ears
      sphere(sx * 0.082, 1.597, 0.002, 0.016, SKIN_D, false);
      // jhumka earrings
      sphere(sx * 0.0865, 1.579, 0.004, 0.0075, GOLD, true);
      for (let k = 0; k < 3; k++) sphere(sx * 0.0865, 1.566 - k * 0.0095, 0.004, 0.0058, GOLD, true);
      sphere(sx * 0.0865, 1.527, 0.004, 0.0135, [246, 200, 96], true);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        sphere(sx * 0.0865 + Math.cos(a) * 0.0095, 1.511, 0.004 + Math.sin(a) * 0.0095, 0.0048, [252, 246, 236], false);
      }
    }
    sphere(0, 1.589, fz(0, 1.589, 0.0035), 0.0105, SKIN_D, false); // nose tip
    sphere(0, 1.6, fz(0, 1.6, 0.0005), 0.0072, SKIN_D, false);
    // lips
    sphere(0, 1.545, fz(0, 1.545, 0.0008), 0.0098, [176, 36, 62], false);
    sphere(0, 1.5365, fz(0, 1.5365, 0.0006), 0.0108, [196, 52, 76], false);
    sphere(-0.0115, 1.5415, fz(-0.0115, 1.5415, -0.0004), 0.0062, [168, 34, 58], false);
    sphere(0.0115, 1.5415, fz(0.0115, 1.5415, -0.0004), 0.0062, [168, 34, 58], false);
    // bindi
    sphere(0, 1.647, fz(0, 1.647, 0.002), 0.0072, KUMKUM, false);
    // nath
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      sphere(-0.021 + Math.cos(a) * 0.0105, 1.5745 + Math.sin(a) * 0.0105, fz(-0.021, 1.5745, 0.005), 0.0032, GOLD, true);
    }
    sphere(-0.021, 1.5625, fz(-0.021, 1.5625, 0.007), 0.0052, [252, 246, 236], false);
    // maang tikka
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      const y = lerp(1.712, 1.675, t);
      sphere(0, y, fz(0, Math.min(y, 1.7), 0.0045), 0.0042, GOLD, true);
    }
    sphere(0, 1.6665, fz(0, 1.6665, 0.0055), 0.0105, [246, 200, 96], true);
    sphere(0, 1.6665, fz(0, 1.6665, 0.0125), 0.0045, [190, 28, 52], false);

    /* --- choker + rani haar --- */
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * TAU;
      sphere(Math.sin(a) * 0.05, 1.455, Math.cos(a) * 0.052, 0.0068, k % 5 === 0 ? [190, 28, 52] : GOLD, true);
    }
    for (let k = 0; k <= 22; k++) {
      const s = (k / 22) * 2 - 1;
      const y = 1.405 - 0.135 * (1 - s * s);
      const rx = profileAt(TORSO, y, "rx"), rz = profileAt(TORSO, y, "rz");
      const x = s * 0.092;
      const z = rz * Math.sqrt(Math.max(0.05, 1 - (x / rx) * (x / rx))) + 0.012;
      sphere(x, y, z, k % 4 === 0 ? 0.0085 : 0.0062, k % 4 === 0 ? [30, 140, 100] : GOLD, true);
    }
    {
      const y = 1.27;
      const z = profileAt(TORSO, y, "rz") + 0.018;
      sphere(0, y - 0.02, z, 0.0095, GOLD, true);
      sphere(0, y - 0.04, z + 0.002, 0.0145, [196, 30, 56], true);
      sphere(0, y - 0.0405, z + 0.012, 0.005, [255, 235, 235], false);
    }

    /* --- the varmala: marigold, rose and jasmine --- */
    const bez = (p0, c, p1, t) => {
      const u = 1 - t;
      return [
        u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
        u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
        u * u * p0[2] + 2 * u * t * c[2] + t * t * p1[2],
      ];
    };
    const SL = [-0.118, 1.43, 0.012], SR = [0.118, 1.43, 0.012];
    const BOT = [0, 0.8, 0.305];
    const CL = [-0.2, 1.05, 0.285], CR = [0.2, 1.05, 0.285];
    const NB = [0, 1.47, -0.14];
    let fi = 0;
    function garlandAlong(p0, c, p1, spacing) {
      const pts = [];
      for (let k = 0; k <= 80; k++) pts.push(bez(p0, c, p1, k / 80));
      let acc = spacing;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        acc += seg;
        if (acc >= spacing) {
          acc = 0;
          const col = FLOWERS[fi % FLOWERS.length];
          const jitter = 0.0015 + rnd() * 0.003;
          sphere(b[0] + (rnd() - 0.5) * jitter * 2, b[1], b[2] + (rnd() - 0.5) * jitter * 2, 0.0315 + rnd() * 0.004, col, false);
          if (fi % 3 === 1) {
            // a green leaf peeping out, and a tiny gold bead at the centre
            sphere(b[0] * 1.06, b[1] - 0.004, b[2] + 0.017, 0.016, GREEN, false);
            sphere(b[0], b[1], b[2] + 0.026, 0.0065, [250, 224, 130], true);
          }
          fi++;
        }
      }
    }
    garlandAlong(SL, CL, BOT, 0.039);
    garlandAlong(SR, CR, BOT, 0.039);
    garlandAlong(SL, NB, SR, 0.04);
    // flowered knot + hanging tassels at the bottom
    sphere(0, 0.795, 0.322, 0.043, [232, 70, 124], false);
    sphere(0, 0.795, 0.352, 0.02, [255, 246, 228], false);
    for (const tx of [-0.045, 0, 0.045]) {
      const len = tx === 0 ? 0.3 : 0.22;
      for (let k = 0; k < 12; k++) {
        const y = 0.77 - (k / 11) * len;
        const z = profileAt(SKIRT, y, "rx") + 0.045;
        const col = k === 11 ? [196, 30, 56] : k % 3 === 0 ? [255, 246, 228] : FLOWERS[k % 4];
        sphere(tx, y, z, k === 11 ? 0.016 : 0.014, col, false);
      }
    }

    /* --- arms: shoulder → elbow → hand holding the garland --- */
    const tubeSpheres = (p0, p1, r0, r1, colFn, metalFn) => {
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      const step = Math.max(0.0035, Math.min(r0, r1) * 0.3);
      const n = Math.max(1, Math.ceil(len / step));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const mt = metalFn ? metalFn(t) : false;
        sphere(lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t), lerp(p0[2], p1[2], t), lerp(r0, r1, t), colFn(t), mt, !mt);
      }
    };
    for (const sx of [-1, 1]) {
      const SH = [sx * 0.19, 1.365, 0.0];
      const EL = [sx * 0.255, 1.1, 0.025];
      const hand = bez(sx < 0 ? SL : SR, sx < 0 ? CL : CR, BOT, 0.62);
      const WR = [hand[0] + sx * 0.012, hand[1] + 0.03, hand[2] - 0.034];
      // upper arm: choli sleeve then skin
      tubeSpheres(SH, EL, 0.038, 0.03, (t) => (t < 0.42 ? CHOLI : SKIN), (t) => t > 0.4 && t < 0.46);
      // forearm
      tubeSpheres(EL, WR, 0.03, 0.021, () => SKIN, null);
      // chuda: red and ivory bangles with gold kangan
      for (let k = 0; k < 9; k++) {
        const t = 0.6 + k * 0.045;
        const p = [lerp(EL[0], WR[0], t), lerp(EL[1], WR[1], t), lerp(EL[2], WR[2], t)];
        const col = k % 3 === 2 ? GOLD : k % 2 ? [255, 244, 228] : [196, 24, 50];
        sphere(p[0], p[1], p[2], 0.0265 - t * 0.004, col, k % 3 === 2);
      }
      // hand
      sphere(hand[0], hand[1], hand[2], 0.029, SKIN, false);
      sphere(hand[0] + sx * 0.012, hand[1] + 0.012, hand[2] + 0.022, 0.015, SKIN, false);
      sphere(hand[0] - sx * 0.004, hand[1] - 0.018, hand[2] + 0.018, 0.0155, SKIN, false);
      sphere(hand[0] - sx * 0.008, hand[1] - 0.034, hand[2] + 0.012, 0.0125, SKIN, false);
      // mehendi on the back of the hand
      for (let k = 0; k < 5; k++) {
        sphere(hand[0] + (k - 2) * 0.006, hand[1] + 0.012 - Math.abs(k - 2) * 0.004, hand[2] + 0.027, 0.0034, [120, 40, 24], false);
      }
    }

    /* --- the long braid, over the dupatta, with jasmine --- */
    {
      const pts = [];
      const N = 34;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const y = lerp(1.49, 0.74, t);
        const rz = profileAt(DRAPE, clamp(y, 0.865, 1.5), "rz");
        const z = -(rz + 0.05) - 0.01 + (y < 0.86 ? 0 : 0);
        const x = Math.sin(t * 7) * 0.012 * t;
        pts.push([x, y, z]);
      }
      for (let k = 0; k <= N; k++) {
        const p = pts[k];
        const t = k / N;
        const r = lerp(0.034, 0.017, t);
        sphere(p[0], p[1], p[2], r, k % 6 === 5 ? GOLD : HAIR, k % 6 === 5);
        if (k % 3 === 1) {
          sphere(p[0] + 0.012, p[1], p[2] - 0.016, 0.0095, [255, 248, 232], false);
          sphere(p[0] - 0.012, p[1] - 0.012, p[2] - 0.016, 0.0095, [255, 248, 232], false);
        }
      }
      const last = pts[N];
      for (let k = 0; k < 4; k++) sphere(last[0], last[1] - 0.02 - k * 0.012, last[2], 0.012 - k * 0.0012, k === 3 ? KUMKUM : GOLD, true);
    }

    /* --- dupatta: a draped, gently moving veil --- */
    const HEADROWS = 6;
    const dupRows = [];
    for (let k = 0; k < HEADROWS; k++) {
      const ph = ((78 - k * 19.2) * Math.PI) / 180;
      dupRows.push({
        y: HEAD.y + HEAD.ry * 1.12 * Math.sin(ph),
        rx: Math.max(0.004, HEAD.rx * 1.18 * Math.cos(ph)),
        rz: Math.max(0.004, HEAD.rz * 1.16 * Math.cos(ph)),
        cz: HEAD.z - 0.012,
        hw: 0.44 * Math.PI,
        wave: 0,
      });
    }
    DRAPE.forEach((r, i) => {
      dupRows.push({
        y: r.y, rx: r.rx, rz: r.rz, cz: r.cz,
        hw: lerp(0.5, 0.6, i / (DRAPE.length - 1)) * Math.PI,
        wave: 0.012 + 0.02 * (i / (DRAPE.length - 1)),
      });
    });
    const DJ = 30;
    const dupIdx = [];
    const dupPos = (i, j, t) => {
      const r = dupRows[i];
      const u = (j / (DJ - 1)) * 2 - 1;
      const a = Math.PI + u * r.hw;
      const fold = r.wave ? 1 + r.wave * 4 * Math.sin(a * 6 + i * 0.9 + t * 1.3) + r.wave * 2 * Math.sin(a * 11 - t * 0.9 + i) : 1;
      return [r.rx * fold * Math.sin(a), r.y + (r.wave ? Math.sin(a * 4 + t * 1.1 + i) * r.wave * 0.5 : 0), r.cz + r.rz * fold * Math.cos(a)];
    };
    for (let i = 0; i < dupRows.length; i++) {
      dupIdx.push([]);
      for (let j = 0; j < DJ; j++) {
        const p = dupPos(i, j, 0);
        dupIdx[i].push(addV(p[0], p[1], p[2]));
      }
    }
    for (let i = 0; i < dupRows.length - 1; i++) {
      for (let j = 0; j < DJ - 1; j++) {
        const border = j === 0 || j === DJ - 2 || i >= dupRows.length - 2;
        const zari = i === HEADROWS + 1 && j % 2 === 0;
        const col = border || zari
          ? [GOLD[0], GOLD[1], GOLD[2], 1]
          : [RED_L[0] * (j % 2 ? 0.95 : 1.03), RED_L[1], RED_L[2], 0];
        polys.push({ a: dupIdx[i][j], b: dupIdx[i][j + 1], c: dupIdx[i + 1][j + 1], d: dupIdx[i + 1][j], col, m: col[3] ? 1 : 0, s: 0, alpha: 0.95 });
      }
    }
    const updateDupatta = (t) => {
      for (let i = HEADROWS; i < dupRows.length; i++) {
        for (let j = 0; j < DJ; j++) {
          const p = dupPos(i, j, t);
          const v = dupIdx[i][j] * 3;
          V[v] = p[0]; V[v + 1] = p[1]; V[v + 2] = p[2];
        }
      }
    };

    return { V: new Float32Array(V), polys, spheres, updateDupatta };
  }

  /* ---------- lighting ---------- */
  const L = (() => {
    const l = [-0.45, 0.55, 0.7];
    const n = Math.hypot(l[0], l[1], l[2]);
    return [l[0] / n, l[1] / n, l[2] / n];
  })();
  const Hh = (() => {
    const h = [L[0], L[1], L[2] + 1];
    const n = Math.hypot(h[0], h[1], h[2]);
    return [h[0] / n, h[1] / n, h[2] / n];
  })();

  /* ---------- viewer ---------- */

  let active = null;

  function mount(canvas, opts) {
    opts = opts || {};
    unmount();
    const model = build();
    const V = model.V;
    const nv = V.length / 3;
    const PX = new Float32Array(nv), PY = new Float32Array(nv), PZ = new Float32Array(nv);
    const SX = new Float32Array(nv), SY = new Float32Array(nv), KK = new Float32Array(nv);
    const polys = model.polys, spheres = model.spheres;
    const NP = polys.length, NS = spheres.length, N = NP + NS;
    const key = new Float32Array(N);
    const order = new Array(N);
    for (let i = 0; i < N; i++) order[i] = i;
    const cmp = (p, q) => key[q] - key[p];

    const ctx = canvas.getContext("2d");
    const D = 4.2;
    const reduce = SV.reduceMotion && SV.reduceMotion();

    const st = {
      yaw: opts.yaw || 0, pitch: opts.pitch == null ? 0.07 : opts.pitch, zoom: opts.zoom || 1, zoomT: opts.zoom || 1,
      vel: 0, auto: opts.auto == null ? !reduce : !!opts.auto, idleUntil: 0, t: 0, last: 0, raf: 0,
      W: 0, H: 0, dpr: 1, dead: false,
    };
    const pointers = new Map();
    let pinch = 0;

    const petals = [];
    for (let i = 0; i < 26; i++) {
      petals.push({ x: Math.random(), y: Math.random(), vy: 0.04 + Math.random() * 0.07, ph: Math.random() * 6, sz: 3 + Math.random() * 4, c: FLOWERS[i % FLOWERS.length], rot: Math.random() * 6 });
    }

    function size() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(200, Math.round(r.width)), h = Math.max(240, Math.round(r.height));
      if (w !== st.W || h !== st.H || dpr !== st.dpr) {
        st.W = w; st.H = h; st.dpr = dpr;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
    }

    function frame(now) {
      if (st.dead) return;
      st.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - st.last) / 1000)) || 0;
      st.last = now;
      if (document.hidden) return;
      size();
      step(dt, now);
      draw();
    }

    function step(dt, now) {
      st.t += dt;
      const dragging = pointers.size > 0;
      if (!dragging) {
        st.yaw += st.vel * dt;
        st.vel *= Math.exp(-3 * dt);
        if (st.auto && now > st.idleUntil) st.yaw += 0.34 * dt;
      }
      st.pitch += (clamp(st.pitch, -0.3, 0.32) - st.pitch) * Math.min(1, dt * 8);
      st.zoom += (st.zoomT - st.zoom) * (1 - Math.exp(-8 * dt));
      if (!reduce) model.updateDupatta(st.t);
      petals.forEach((p) => {
        p.y += p.vy * dt;
        p.rot += dt * 1.4;
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
      });
    }

    function draw() {
      const { W, H, dpr } = st;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const zoom = st.zoom;
      const focusY = lerp(0.86, 1.46, smooth((zoom - 1) / 2.0));
      const pxPerM = Math.min((H * 0.82) / 1.82, (W * 0.9) / 1.34) * zoom;
      const F = pxPerM * D;
      const cx = W / 2;
      const cy0 = H * 0.465;

      const cyaw = Math.cos(st.yaw), syaw = Math.sin(st.yaw);
      const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);

      // transform every vertex
      for (let i = 0, o = 0; i < nv; i++, o += 3) {
        const x = V[o], y = V[o + 1] - focusY, z = V[o + 2];
        const x1 = x * cyaw + z * syaw;
        const z1 = -x * syaw + z * cyaw;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        PX[i] = x1; PY[i] = y2; PZ[i] = z2;
        const k = F / (D - z2);
        KK[i] = k;
        SX[i] = cx + x1 * k;
        SY[i] = cy0 - y2 * k;
      }
      const proj = (x, y, z) => {
        y -= focusY;
        const x1 = x * cyaw + z * syaw, z1 = -x * syaw + z * cyaw;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const k = F / (D - z2);
        return [cx + x1 * k, cy0 - y2 * k, k];
      };

      // halo (prabha) behind her head, and warm glow
      const head = proj(0, 1.62, 0);
      const haloR = 0.42 * head[2];
      const glow = ctx.createRadialGradient(head[0], head[1], 4, head[0], head[1], Math.max(haloR * 2.2, 60));
      glow.addColorStop(0, "rgba(255,196,110,0.34)");
      glow.addColorStop(1, "rgba(255,196,110,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(head[0], head[1] - haloR * 0.05);
      ctx.strokeStyle = "rgba(240,190,110,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, haloR, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "rgba(240,190,110,0.28)";
      ctx.beginPath(); ctx.arc(0, 0, haloR * 1.12, 0, TAU); ctx.stroke();
      ctx.rotate(st.t * 0.12);
      ctx.strokeStyle = "rgba(240,190,110,0.45)";
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU;
        const r0 = haloR * 1.16, r1 = haloR * (i % 3 === 0 ? 1.34 : 1.26);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();

      // ground shadow + ring
      const ring = (r, fill, stroke, lw) => {
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * TAU;
          const p = proj(Math.sin(a) * r, 0, Math.cos(a) * r);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
      };
      ring(0.95, "rgba(10,4,16,0.28)");
      ring(0.62, "rgba(10,4,16,0.35)");
      ring(1.04, null, "rgba(240,190,110,0.42)", 1.2);
      ring(0.72, null, "rgba(240,190,110,0.2)", 1);

      // depth keys
      for (let i = 0; i < NP; i++) {
        const p = polys[i];
        key[i] = D - (PZ[p.a] + PZ[p.b] + PZ[p.c] + PZ[p.d]) / 4;
      }
      for (let i = 0; i < NS; i++) key[NP + i] = D - PZ[spheres[i].v];
      order.sort(cmp);

      ctx.lineJoin = "round";
      for (let oi = 0; oi < N; oi++) {
        const id = order[oi];
        if (id >= NP) {
          const sp2 = spheres[id - NP];
          const v = sp2.v;
          const rad = sp2.r * KK[v];
          const x = SX[v], y = SY[v];
          if (rad < 0.9) {
            ctx.fillStyle = sp2.base;
            ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
          } else {
            const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.08, x, y, rad);
            g.addColorStop(0, sp2.hi);
            g.addColorStop(0.55, sp2.base);
            g.addColorStop(1, sp2.lo);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, TAU);
            ctx.fill();
            if (sp2.m && rad > 2) {
              ctx.fillStyle = "rgba(255,248,222,0.75)";
              ctx.beginPath();
              ctx.arc(x - rad * 0.34, y - rad * 0.4, rad * 0.2, 0, TAU);
              ctx.fill();
            }
          }
          continue;
        }

        const p = polys[id];
        const a = p.a, b = p.b, c = p.c, d = p.d;
        // normal from the diagonals, in view space
        const ux = PX[c] - PX[a], uy = PY[c] - PY[a], uz = PZ[c] - PZ[a];
        const wx = PX[d] - PX[b], wy = PY[d] - PY[b], wz = PZ[d] - PZ[b];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-12) continue;
        nx /= nl; ny /= nl; nz /= nl;
        if (p.s !== 0) { nx *= p.s; ny *= p.s; nz *= p.s; }
        const toCam = nx * (-PX[a]) + ny * (-PY[a]) + nz * (D - PZ[a]);
        if (toCam <= 0) {
          if (p.s !== 0) continue;
          nx = -nx; ny = -ny; nz = -nz;
        }

        const ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        const col = p.col;
        let k = (p.m ? 0.4 : 0.4) + (p.m ? 0.5 : 0.72) * ndl;
        const rim = Math.pow(1 - Math.max(0, nz), 2.6) * 0.16;
        let r = col[0] * k + 255 * rim * 0.35;
        let g = col[1] * k + 200 * rim * 0.3;
        let bl = col[2] * k + 120 * rim * 0.2;
        if (p.m) {
          const sp3 = Math.pow(Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]), 40) * 85;
          r += sp3; g += sp3 * 0.92; bl += sp3 * 0.7;
        }
        const fill = "rgb(" + (r > 255 ? 255 : r | 0) + "," + (g > 255 ? 255 : g | 0) + "," + (bl > 255 ? 255 : bl | 0) + ")";
        if (p.alpha < 1) ctx.globalAlpha = p.alpha;
        ctx.fillStyle = fill;
        ctx.strokeStyle = fill;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(SX[a], SY[a]);
        ctx.lineTo(SX[b], SY[b]);
        ctx.lineTo(SX[c], SY[c]);
        ctx.lineTo(SX[d], SY[d]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (p.alpha < 1) ctx.globalAlpha = 1;
      }

      // drifting petals (screen space, in front)
      ctx.save();
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        const px = (p.x + Math.sin(st.t * 0.6 + p.ph) * 0.03) * W;
        const py = p.y * H;
        ctx.translate(px, py);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = "rgb(" + p.c[0] + "," + p.c[1] + "," + p.c[2] + ")";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.sz, p.sz * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.rotate(-p.rot);
        ctx.translate(-px, -py);
      }
      ctx.restore();
    }

    /* ---------- input ---------- */
    const onDown = (e) => {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      st.vel = 0;
      canvas.classList.add("is-grabbing");
      if (pointers.size === 2) pinch = pinchDist();
      e.preventDefault();
    };
    const onMove = (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 1) {
        st.yaw += dx * 0.011;
        st.pitch = clamp(st.pitch + dy * 0.004, -0.3, 0.32);
        st.vel = dx * 0.011 * 40;
      } else if (pointers.size === 2) {
        const nd = pinchDist();
        if (pinch > 0 && nd > 0) st.zoomT = clamp(st.zoomT * (nd / pinch), 1, 3.2);
        pinch = nd;
      }
    };
    const onUp = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        canvas.classList.remove("is-grabbing");
        st.idleUntil = performance.now() + 2500;
      }
      pinch = 0;
    };
    const pinchDist = () => {
      const v = Array.from(pointers.values());
      return v.length >= 2 ? Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) : 0;
    };
    const onWheel = (e) => {
      st.zoomT = clamp(st.zoomT * Math.exp(-e.deltaY * 0.0012), 1, 3.2);
      e.preventDefault();
    };
    const onKey = (e) => {
      if (e.code === "ArrowLeft") { ctl.turn(-1); e.preventDefault(); }
      else if (e.code === "ArrowRight") { ctl.turn(1); e.preventDefault(); }
      else if (e.code === "ArrowUp" || e.code === "Equal") { ctl.zoomBy(1.25); e.preventDefault(); }
      else if (e.code === "ArrowDown" || e.code === "Minus") { ctl.zoomBy(0.8); e.preventDefault(); }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKey);

    const ctl = {
      turn(dir) { st.vel = dir * 3.2; st.idleUntil = performance.now() + 2500; },
      zoomBy(f) { st.zoomT = clamp(st.zoomT * f, 1, 3.2); },
      toggleAuto() { st.auto = !st.auto; st.idleUntil = 0; return st.auto; },
      isAuto() { return st.auto; },
      reset() { st.yaw = Math.round(st.yaw / TAU) * TAU; st.vel = 0; st.pitch = 0.07; st.zoomT = 1; st.idleUntil = performance.now() + 2500; },
      destroy() {
        st.dead = true;
        cancelAnimationFrame(st.raf);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("keydown", onKey);
      },
    };

    size();
    st.last = performance.now();
    st.raf = requestAnimationFrame(frame);
    active = ctl;
    return ctl;
  }

  function unmount() {
    if (active) { active.destroy(); active = null; }
  }

  SV.draupadi = { mount, unmount, _build: build };
})();
