/* ============================================================
   core.js — utilities, storage, settings, palette, input, stage
   ============================================================ */
(function () {
  "use strict";
  const SV = (window.SV = window.SV || {});

  /* ---------- math / helpers ---------- */
  const util = {
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    damp(a, b, lambda, dt) { return util.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    smoothstep(a, b, x) {
      const t = util.clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    rand(a = 0, b = 1) { return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(util.rand(a, b + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    normAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },
    // shortest signed difference a-b
    angleDelta(a, b) { return util.normAngle(a - b); },
    easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
    easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    easeOutBack(t) {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    formatTime(ms) {
      const s = Math.max(0, ms / 1000);
      const m = Math.floor(s / 60);
      const r = s - m * 60;
      return m + ":" + (r < 10 ? "0" : "") + r.toFixed(1);
    },
    prefersReducedMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    urduSafe: null,
  };
  SV.util = util;

  /* ---------- storage ---------- */
  const PREFIX = "svy.";
  const store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (e) { /* private mode */ }
    },
    remove(key) {
      try { window.localStorage.removeItem(PREFIX + key); } catch (e) {}
    },
  };
  SV.store = store;

  /* ---------- settings ---------- */
  const DEFAULTS = {
    lang: "en",
    theme: "dark",
    difficulty: "yoddha",
    music: true,
    sfx: true,
    volume: 46,
    simpleReflection: false,
    reduceMotion: false,
    seenHow: false,
  };

  const loaded = store.get("settings", {});
  const settings = Object.assign({}, DEFAULTS, loaded && typeof loaded === "object" ? loaded : {});
  if (!["en", "hi", "hinglish"].includes(settings.lang)) settings.lang = "en";
  if (!["dark", "light"].includes(settings.theme)) settings.theme = "dark";
  if (!["katha", "yoddha", "maharathi"].includes(settings.difficulty)) settings.difficulty = "yoddha";
  settings.volume = util.clamp(Number(settings.volume) || 0, 0, 100);
  settings.reduceMotion = !!settings.reduceMotion || util.prefersReducedMotion();
  settings.simpleReflection = !!settings.simpleReflection;
  SV.settings = settings;

  SV.saveSettings = function saveSettings() {
    store.set("settings", {
      lang: settings.lang,
      theme: settings.theme,
      difficulty: settings.difficulty,
      music: settings.music,
      sfx: settings.sfx,
      volume: settings.volume,
      simpleReflection: settings.simpleReflection,
      reduceMotion: settings.reduceMotion,
      seenHow: settings.seenHow,
    });
  };

  SV.setTheme = function setTheme(name, silent) {
    settings.theme = name === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = settings.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", settings.theme === "light" ? "#f8f0df" : "#0a0611");
    SV.saveSettings();
    if (!silent) document.dispatchEvent(new CustomEvent("sv:theme", { detail: settings.theme }));
  };

  SV.setLang = function setLang(lang, silent) {
    settings.lang = ["en", "hi", "hinglish"].includes(lang) ? lang : "en";
    const root = document.documentElement;
    root.classList.remove("lang-en", "lang-hi", "lang-hinglish");
    root.classList.add("lang-" + settings.lang);
    root.lang = settings.lang === "hi" ? "hi" : "en";
    SV.saveSettings();
    if (!silent) document.dispatchEvent(new CustomEvent("sv:lang", { detail: settings.lang }));
  };

  /* remembers whether the user wants motion */
  SV.reduceMotion = function reduceMotion() {
    return settings.reduceMotion || util.prefersReducedMotion();
  };

  /* ---------- palette ---------- */
  const palettes = {
    dark: {
      mode: "dark",
      bgTop: "#0a0613",
      bgMid: "#140b20",
      bgBot: "#1e1029",
      hall: "#120a1c",
      hallLight: "#24132f",
      arch: "#2c1838",
      archLine: "#573162",
      gold: "#e8c07d",
      goldHi: "#fff2cd",
      goldDeep: "#9c6a26",
      ember: "#ff9a52",
      ember2: "#ffd28a",
      text: "#f5e9d6",
      muted: "#a996bb",
      teal: "#6fdfcd",
      accent: "#e0603f",
      shadow: "rgba(0,0,0,0.55)",
      crowd: "#0a0511",
      line: "rgba(232,192,125,0.22)",
      poolTop: "#1d0d05",
      poolMid: "#3a1a08",
      poolBot: "#60300d",
      poolHi: "#e0a04b",
      poolDeep: "#120803",
      glass: "rgba(255,255,255,0.06)",
      white: "#fffaf0",
    },
    light: {
      mode: "light",
      bgTop: "#fbf4e5",
      bgMid: "#f3e4ca",
      bgBot: "#e7d1af",
      hall: "#f2e2c7",
      hallLight: "#fbf1de",
      arch: "#dfc6a1",
      archLine: "#b58e58",
      gold: "#a9741f",
      goldHi: "#7c5010",
      goldDeep: "#8a5c15",
      ember: "#c2662c",
      ember2: "#a97a25",
      text: "#2c1c12",
      muted: "#7a6350",
      teal: "#1c7d76",
      accent: "#b23d26",
      shadow: "rgba(70,44,16,0.35)",
      crowd: "#a1845c",
      line: "rgba(122,84,33,0.24)",
      poolTop: "#2a1407",
      poolMid: "#4a2309",
      poolBot: "#74400f",
      poolHi: "#f0bd6c",
      poolDeep: "#1a0c04",
      glass: "rgba(90,58,24,0.06)",
      white: "#fffaf0",
    },
  };
  SV.palettes = palettes;
  SV.colors = function colors() {
    return palettes[document.documentElement.dataset.theme] || palettes.dark;
  };

  /* ---------- stage ---------- */
  const stage = {
    canvas: null,
    ctx: null,
    w: 0,
    h: 0,
    dpr: 1,
    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.resize();
      let frame = null;
      window.addEventListener("resize", () => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { this.resize(); });
      });
      window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 220));
      return this;
    },
    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = w;
      this.h = h;
      this.dpr = dpr;
      if (!this.canvas) return;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      if (SV.game && SV.game.resize) SV.game.resize(w, h);
    },
  };
  SV.stage = stage;

  /* ---------- input ---------- */
  const input = {
    x: 0,
    y: 0,
    down: false,
    pointerType: "mouse",
    keys: new Set(),
    handlers: {},
    enabled: true,
    _canvas: null,
    _last: 0,
    init(canvas) {
      this._canvas = canvas;
      this.x = window.innerWidth / 2;
      this.y = window.innerHeight / 2;

      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const p = pos(e);
        this.x = p.x; this.y = p.y;
        this.down = true;
        this.pointerType = e.pointerType || "mouse";
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        if (this.enabled && this.handlers.down) this.handlers.down(p.x, p.y, e);
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener("pointermove", (e) => {
        const p = pos(e);
        this.x = p.x; this.y = p.y;
        this.pointerType = e.pointerType || "mouse";
        if (this.enabled && this.handlers.move) this.handlers.move(p.x, p.y, e);
      }, { passive: true });

      const release = (e) => {
        if (!this.down) return;
        this.down = false;
        if (this.enabled && this.handlers.up) this.handlers.up(this.x, this.y, e);
      };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);

      window.addEventListener("keydown", (e) => {
        if (e.repeat) return;
        const tag = (document.activeElement && document.activeElement.tagName || "").toLowerCase();
        if (tag === "input" || tag === "select" || tag === "textarea") return;
        this.keys.add(e.code);
        if (this.enabled && this.handlers.keydown) this.handlers.keydown(e.code, e);
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
          e.preventDefault();
        }
      });

      window.addEventListener("keyup", (e) => {
        this.keys.delete(e.code);
        if (this.enabled && this.handlers.keyup) this.handlers.keyup(e.code, e);
      });

      window.addEventListener("blur", () => {
        this.down = false;
        this.keys.clear();
        document.body.classList.add("is-blurred");
      });
      window.addEventListener("focus", () => document.body.classList.remove("is-blurred"));
    },
    has(code) { return this.keys.has(code); },
    hover(x, y) { this.x = x; this.y = y; },
  };
  SV.input = input;

  /* ---------- tiny event bus ---------- */
  const listeners = {};
  SV.on = function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => SV.off(evt, fn);
  };
  SV.off = function off(evt, fn) {
    const arr = listeners[evt];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  };
  SV.emit = function emit(evt, data) {
    (listeners[evt] || []).slice().forEach((fn) => {
      try { fn(data); } catch (err) { console.error(err); }
    });
  };
})();
