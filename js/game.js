/* ============================================================
   game.js — state machine, world scenes, run stats, HUD plumbing
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;
  const U = SV.util;
  const art = SV.art;
  const audio = SV.audio;
  const $ = (s) => document.querySelector(s);

  const DIFF = {
    katha: {
      bow: { speed: 1.08, zone: 0.74, drain: 1.55, miss: 6, start: 106, perfect: 0.32 },
      pool: { drift: 0.55, tol: 1.5, holdDrain: 13, regen: 22, clarity: 1.9, rippleEvery: 5.2, wobble: 0.55, wander: 0.5, locks: 1, dropEvery: 6.5, warn: 1.3 },
      fish: { period: 9.8, hit: 1.42, drift: 0.5, assistStep: 0.12, draw: 1.7, sweet: [0.45, 1.05], wind: 0.3, closedK: 0.75, openFrac: 0.8, predict: 0.9, reverse: 0 },
      tier: 0,
    },
    yoddha: {
      bow: { speed: 1.52, zone: 0.46, drain: 2.65, miss: 9, start: 100, perfect: 0.26 },
      pool: { drift: 1, tol: 1, holdDrain: 20, regen: 16, clarity: 2.35, rippleEvery: 3.9, wobble: 1, wander: 1, locks: 2, dropEvery: 4.2, warn: 1.0 },
      fish: { period: 6.7, hit: 1, drift: 0.8, assistStep: 0.08, draw: 1.3, sweet: [0.6, 0.95], wind: 0.8, closedK: 0.5, openFrac: 0.55, predict: 0.45, reverse: 1 },
      tier: 1,
    },
    maharathi: {
      bow: { speed: 2.0, zone: 0.32, drain: 3.5, miss: 12, start: 96, perfect: 0.22 },
      pool: { drift: 1.45, tol: 0.78, holdDrain: 26, regen: 12, clarity: 2.9, rippleEvery: 2.9, wobble: 1.4, wander: 1.5, locks: 3, dropEvery: 2.8, warn: 0.75 },
      fish: { period: 4.9, hit: 0.76, drift: 1.15, assistStep: 0.05, draw: 1.0, sweet: [0.68, 0.9], wind: 1.4, closedK: 0.3, openFrac: 0.4, predict: 0, reverse: 1 },
      tier: 2,
    },
  };

  const G = {
    screen: "title",
    scene: null,
    scenes: {},
    paused: false,
    time: 0,
    last: 0,
    storyIndex: 0,
    transitionTimer: null,
    shake: new SV.fx.Shake(),
    ambient: new SV.fx.Field(260),
    run: null,
    failKind: null,
    best: {},
    dom: {},
    dims: { w: 0, h: 0 },

    init() {
      this.dom = {
        screens: Array.prototype.slice.call(document.querySelectorAll(".screen")),
        veil: $("#veil"),
        rail: $("#trialRail"),
        fail: $("#failLayer"),
        failTitle: $("#failTitle"),
        failBody: $("#failBody"),
        failRetry: $("#failRetry"),
        toast: $("#toast"),
        bestLine: $("#bestLine"),
        bowPrompt: $("#bowPrompt"),
        bowStamina: $("#staminaFill"),
        bowStaminaVal: $("#staminaVal"),
        bowProgress: $("#progressFill"),
        bowProgressVal: $("#progressVal"),
        poolPrompt: $("#poolPrompt"),
        breathFill: $("#breathFill"),
        breathVal: $("#breathVal"),
        clarityVal: $("#clarityVal"),
        steadyBtn: $("#steadyBtn"),
        fishPrompt: $("#fishPrompt"),
        arrowRow: $("#arrowRow"),
        looseBtn: $("#looseBtn"),
        statRank: $("#statRank"),
        statTime: $("#statTime"),
        statArrows: $("#statArrows"),
        statBeats: $("#statBeats"),
        endingBody: $("#endingBody"),
        endingVerse: $("#endingVerse"),
        endingLabel: $("#endingLabel"),
        pauseBtn: $("#pauseBtn"),
      };

      this.best = SV.store.get("best", {}) || {};
      this.ambient.embers(26, window.innerWidth, window.innerHeight, { speed: 0.7 });
      this.ambient.motes(30, window.innerWidth, window.innerHeight, { alpha: 0.7 });

      this.dom.failRetry.addEventListener("click", () => this.retryTrial());
      this.dom.fail.querySelectorAll('[data-action="title"]').forEach((b) => {
        b.addEventListener("click", () => this.quitToTitle());
      });

      this.updateBestLine();
      this.renderTitleDefaults();
      this.startLoop();
      this.go("title", { instant: true });
    },

    /* ---------- navigation ---------- */

    go(name, opts) {
      const o = opts || {};
      if (this.transitionTimer && !o.instant) return;
      const apply = () => {
        this._enter(name, o);
      };
      if (o.instant || SV.reduceMotion() || !this.dom.veil) {
        apply();
        return;
      }
      const veil = this.dom.veil;
      veil.classList.add("is-on");
      this.transitionTimer = setTimeout(() => {
        apply();
        this.transitionTimer = null;
        requestAnimationFrame(() => veil.classList.remove("is-on"));
      }, 280);
    },

    _enter(name, opts) {
      this.dom.screens.forEach((s) => {
        const on = s.dataset.screen === name;
        s.classList.toggle("is-active", on);
        s.setAttribute("aria-hidden", on ? "false" : "true");
      });
      if (this.scene && this.scene.exit) this.scene.exit();
      this.screen = name;
      this.paused = false;
      this.hideFail();
      this.scene = this.scenes[name] || null;
      if (this.scene && this.scene.enter) this.scene.enter(opts || {});
      this.updateRail();
      this.updateAudioIntensity();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (this.dom.pauseBtn) this.dom.pauseBtn.hidden = !["bow", "pool", "fish"].includes(name);
      if (SV.stage.canvas) {
        SV.stage.canvas.classList.toggle("is-aiming", name === "pool" || name === "fish");
      }
      if (this.dom.veil) this.dom.veil.classList.remove("is-on");
    },

    updateRail() {
      const index = this.screen === "bow" ? 1 : this.screen === "pool" ? 2 : this.screen === "fish" ? 3 : 0;
      const rail = this.dom.rail;
      if (!rail) return;
      rail.hidden = index === 0;
      rail.querySelectorAll(".rail-mark").forEach((m) => {
        const n = Number(m.dataset.rail);
        m.classList.toggle("is-active", n === index);
        m.classList.toggle("is-done", n < index);
      });
    },

    updateAudioIntensity() {
      if (this.screen === "fish") audio.setIntensity(3);
      else if (this.screen === "bow" || this.screen === "pool") audio.setIntensity(2);
      else audio.setIntensity(1);
    },

    /* ---------- run flow ---------- */

    newRun() {
      this.run = {
        startedAt: performance.now(),
        bow: { perfect: 0, misses: 0, time: 0 },
        pool: { gasps: 0, time: 0 },
        fish: { arrowsUsed: 0, misses: 0, time: 0 },
        totalTime: 0,
      };
    },

    begin() {
      this.newRun();
      this.storyIndex = 0;
      this.pendingStory = "prologue";
      this.go("prologue");
      audio.setIntensity(1);
    },

    toBow() {
      this.storyIndex = 0;
      if (!this.run) this.newRun();
      // The clock starts with the first trial, not while reading the prologue.
      this.run.startedAt = performance.now();
      this.go("bow");
    },

    afterBow() {
      this.showInterlude("karna");
    },

    toPool() {
      this.go("pool");
    },

    // After the oil, a remembered lesson precedes the last trial.
    afterPool() {
      this.showInterlude("drona");
    },

    showInterlude(kind) {
      this.interludeKind = kind;
      document.dispatchEvent(new CustomEvent("sv:interlude"));
      this.go("interlude");
    },

    toFish() {
      this.go("fish");
    },

    finishRun() {
      if (!this.run) this.newRun();
      this.run.totalTime = performance.now() - this.run.startedAt;
      const d = DIFF[SV.settings.difficulty] || DIFF.yoddha;
      const totalMiss = this.run.bow.misses + this.run.fish.misses + this.run.pool.gasps;
      let score = 100 - this.run.bow.misses * 5 - this.run.fish.misses * 9 + this.run.bow.perfect * 2.5 - this.run.pool.gasps * 1.5;
      score += d.tier * 5;
      let rankKey = "rankSthira";
      if (score >= 112) rankKey = "rankAtiratha";
      else if (score >= 94) rankKey = "rankMaharathi";
      else if (score >= 76) rankKey = "rankYoddha";
      this.run.rank = rankKey;
      this.run.score = score;

      const best = SV.store.get("best", {}) || {};
      const key = SV.settings.difficulty;
      const prev = best[key];
      if (!prev || this.run.totalTime < prev.time) {
        best[key] = {
          time: this.run.totalTime,
          rank: rankKey,
          arrows: this.run.fish.arrowsUsed,
          date: Date.now(),
        };
        SV.store.set("best", best);
      }
      this.best = best;

      this.populateEnding();
      this.go("ending");
      audio.setIntensity(2);
      setTimeout(() => {
        audio.sfx("conch");
        audio.sfx("crowd");
        audio.sfx("garland");
      }, 350);
      this.ambient.petals(46, window.innerWidth, window.innerHeight, { speed: 0.7 });
    },

    populateEnding() {
      const run = this.run || { totalTime: 0, fish: { arrowsUsed: 0 }, rank: "rankSthira" };
      const d = DIFF[SV.settings.difficulty] || DIFF.yoddha;
      const rankKey = run.rank || "rankSthira";
      this.dom.statRank.textContent = SV.i18n.t(rankKey);
      this.dom.statTime.textContent = U.formatTime(run.totalTime);
      this.dom.statArrows.textContent = String(run.fish.arrowsUsed);
      this.dom.statBeats.textContent = String(run.bow.perfect);
      this.dom.endingLabel.textContent = SV.i18n.t("endingLabel");
      this.dom.endingBody.textContent = SV.i18n.t("endingBody");
      this.dom.endingVerse.textContent = SV.i18n.t("endingVerse");
      const epi = rankKey.replace("rank", "");
      const epiTitle = $("#epilogueTitle");
      const epiText = $("#epilogueText");
      if (epiTitle) epiTitle.textContent = SV.i18n.t("epiTitle" + epi);
      if (epiText) epiText.textContent = SV.i18n.t("epi" + epi);
      document.body.dataset.lastRank = rankKey;
      document.body.dataset.lastDiff = SV.settings.difficulty;
      document.body.dataset.lastTier = String(d.tier);
    },

    updateBestLine() {
      if (!this.dom.bestLine) return;
      const key = SV.settings.difficulty;
      const b = (this.best || {})[key];
      if (!b) {
        this.dom.bestLine.textContent = SV.i18n.t("bestNone");
        return;
      }
      const diffName = SV.i18n.t(key === "katha" ? "diffKatha" : key === "maharathi" ? "diffMaharathi" : "diffYoddha");
      this.dom.bestLine.textContent = SV.i18n.t("bestLine", {
        diff: diffName,
        time: U.formatTime(b.time),
        rank: SV.i18n.t(b.rank || "rankSthira"),
      });
    },

    copyResult() {
      const run = this.run;
      if (!run) return;
      const diffKey = SV.settings.difficulty;
      const diffName = SV.i18n.t(diffKey === "katha" ? "diffKatha" : diffKey === "maharathi" ? "diffMaharathi" : "diffYoddha");
      const text = SV.i18n.t("shareTemplate", {
        time: U.formatTime(run.totalTime),
        diff: diffName,
        rank: SV.i18n.t(run.rank || "rankSthira"),
      });
      const done = () => this.toast(SV.i18n.t("shareCopied"));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => this._fallbackCopy(text, done));
      } else {
        this._fallbackCopy(text, done);
      }
    },

    _fallbackCopy(text, done) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) {
        this.toast(text);
      }
    },

    toast(msg) {
      const el = this.dom.toast;
      if (!el) return;
      el.textContent = msg;
      el.classList.add("is-on");
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => el.classList.remove("is-on"), 2600);
    },

    /* ---------- fail / pause ---------- */

    showFail(kind) {
      this.failKind = kind;
      this.paused = true;
      const titleKey = kind === "bow" ? "bowFailTitle" : "fishFailTitle";
      const bodyKey = kind === "bow" ? "bowFailBody" : "fishFailBody";
      this.dom.failTitle.textContent = SV.i18n.t(titleKey);
      this.dom.failBody.textContent = SV.i18n.t(bodyKey);
      this.dom.failRetry.textContent = SV.i18n.t("retry");
      this.whisperN = Math.floor(Math.random() * 3) + 1;
      this.renderWhisper();
      this.dom.fail.hidden = false;
      audio.sfx("fail");
      setTimeout(() => {
        if (!this.dom.fail.hidden) this.dom.failRetry.focus();
      }, 80);
    },

    renderWhisper() {
      const el = $("#failWhisper");
      if (!el || !this.failKind) return;
      el.textContent = SV.i18n.t((this.failKind === "bow" ? "whisperBow" : "whisperFish") + (this.whisperN || 1));
    },

    hideFail() {
      if (this.dom.fail) this.dom.fail.hidden = true;
    },

    retryTrial() {
      this.hideFail();
      this.paused = false;
      if (this.scene && this.scene.enter) this.scene.enter({ retry: true });
      this.failKind = null;
      audio.setIntensity(this.screen === "fish" ? 3 : 2);
    },

    quitToTitle() {
      this.hideFail();
      this.paused = false;
      this.failKind = null;
      this.run = null;
      SV.store.set("last", { abandoned: true });
      this.go("title");
    },

    setPaused(on) {
      if (!["bow", "pool", "fish"].includes(this.screen)) return false;
      this.paused = !!on;
      return this.paused;
    },

    /* ---------- text ---------- */

    refreshText() {
      this.updateBestLine();
      if (this.scene && this.scene.refreshText) this.scene.refreshText();
      if (this.screen === "ending") this.populateEnding();
      if (!this.dom.fail.hidden && this.failKind) {
        const titleKey = this.failKind === "bow" ? "bowFailTitle" : "fishFailTitle";
        const bodyKey = this.failKind === "bow" ? "bowFailBody" : "fishFailBody";
        this.dom.failTitle.textContent = SV.i18n.t(titleKey);
        this.dom.failBody.textContent = SV.i18n.t(bodyKey);
        this.dom.failRetry.textContent = SV.i18n.t("retry");
        this.renderWhisper();
      }
    },

    renderTitleDefaults() {
      if (this.dom.bowPrompt) {
        this.dom.bowPrompt.textContent = SV.i18n.t("bowPrompt");
      }
      if (this.dom.poolPrompt) this.dom.poolPrompt.textContent = SV.i18n.t("poolPrompt");
      if (this.dom.fishPrompt) this.dom.fishPrompt.textContent = SV.i18n.t("fishPrompt");
      if (this.dom.endingBody) {
        this.dom.endingBody.textContent = SV.i18n.t("endingBody");
        this.dom.endingVerse.textContent = SV.i18n.t("endingVerse");
      }
    },

    /* ---------- ambient world ---------- */

    resize(w, h) {
      if (Math.abs(w - this.dims.w) > 120 || Math.abs(h - this.dims.h) > 120) {
        this.ambient.clear();
        const n = w < 700 ? 16 : 26;
        this.ambient.embers(n, w, h, { speed: 0.7 });
        this.ambient.motes(w < 700 ? 18 : 30, w, h, { alpha: 0.7 });
      }
      this.dims = { w, h };
    },

    renderAmbient(ctx, w, h, t) {
      const pal = SV.colors();
      const screen = this.screen;
      if (screen === "title") {
        art.hall(ctx, w, h, t, { dim: 0.18 });
        art.rays(ctx, w, h, t, 0.035);
        art.mandala(ctx, w * 0.5, h * 0.47, Math.min(w, h) * 0.42, t, 0.13, 0.02);
        art.fish(ctx, w * 0.885, h * 0.72, Math.min(w, h) * 0.11, t * 0.09, { alpha: 0.16, wheel: true });
        this.ambient.draw(ctx, pal);
      } else if (screen === "prologue" || screen === "interlude") {
        art.tableau(ctx, w, h, screen === "interlude" ? (this.interludeKind === "drona" ? 2 : 3) : this.storyIndex, t);
        this.ambient.draw(ctx, pal);
      } else if (screen === "ending") {
        art.tableau(ctx, w, h, 4, t);
        this.ambient.draw(ctx, pal);
      } else {
        art.hall(ctx, w, h, t, { dim: 0.2 });
      }
    },

    /* ---------- loop ---------- */

    startLoop() {
      const loop = (now) => {
        const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)) || 0;
        this.last = now;
        this.time += dt;
        this.shake.update(dt);
        if (!this.paused) {
          this.ambient.update(dt, this.time);
          if (this.scene && this.scene.update) this.scene.update(dt, this.time);
        }
        const ctx = SV.stage.ctx;
        if (ctx) {
          const w = SV.stage.w, h = SV.stage.h, dpr = SV.stage.dpr;
          const pal = SV.colors();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = pal.bgTop;
          ctx.fillRect(0, 0, w + 20, h + 20);
          ctx.save();
          this.shake.apply(ctx);
          if (this.scene && this.scene.render) {
            this.scene.render(ctx, w, h, this.time);
          } else {
            this.renderAmbient(ctx, w, h, this.time);
          }
          ctx.restore();
        }
        requestAnimationFrame(loop);
      };
      this.last = performance.now();
      requestAnimationFrame(loop);
    },
  };

  G.DIFF = DIFF;
  G.t = (k, v) => SV.i18n.t(k, v);
  SV.game = G;

  /* auto-pause on hidden tab */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) document.dispatchEvent(new CustomEvent("sv:autopause"));
  });
})();
