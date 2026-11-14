/* ============================================================
   main.js — UI wiring, story flow, settings, modal, shortcuts
   ============================================================ */
(function () {
  "use strict";
  const SV = window.SV;
  const U = SV.util;
  const G = SV.game;
  const audio = SV.audio;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const t = (k, v) => SV.i18n.t(k, v);

  const modal = {
    open: false,
    view: "codex",
    tab: "craft",
    pausedGame: false,
    lastFocus: null,
  };

  let prologueIndex = 0;

  const SLIDES = [
    { shloka: "prologueShloka1", title: "prologueTitle1", body: "prologueBody1" },
    { shloka: "prologueShloka2", title: "prologueTitle2", body: "prologueBody2" },
    { shloka: "prologueShloka3", title: "prologueTitle3", body: "prologueBody3" },
  ];

  /* ---------- story ---------- */

  function renderPrologue(animate) {
    const slide = SLIDES[prologueIndex] || SLIDES[0];
    const label = $("#prologueLabel");
    const shloka = $("#prologueShloka");
    const title = $("#prologueTitle");
    const body = $("#prologueBody");
    const dots = $("#prologueDots");
    if (!label) return;
    label.textContent = t("prologueLabel");
    shloka.textContent = t(slide.shloka);
    title.textContent = t(slide.title);
    body.textContent = t(slide.body);
    dots.innerHTML = SLIDES.map((s, i) => '<span class="' + (i === prologueIndex ? "is-on" : "") + '"></span>').join("");
    const nextSpan = $("#prologueNext span");
    if (nextSpan) nextSpan.textContent = prologueIndex === SLIDES.length - 1 ? t("beginTrial") : t("continue");
    G.storyIndex = prologueIndex;
    if (animate) {
      const card = $(".story-card[aria-hidden], .screen--story .story-card");
      if (card) {
        card.style.animation = "none";
        void card.offsetWidth;
        card.style.animation = "";
      }
    }
  }

  // The oracle: a remembered lesson that asks "what do you see?" before the last trial.
  const oracle = { answered: false, last: 0 };

  function renderInterlude() {
    const label = $("#interludeLabel");
    if (!label) return;
    const drona = G.interludeKind === "drona";
    const pre = drona ? "drona" : "interlude";
    label.textContent = t(pre + "Label");
    $("#interludeShloka").textContent = t(pre + "Shloka");
    $("#interludeTitle").textContent = t(pre + "Title");
    $("#interludeBody").textContent = t(pre + "Body1");
    $("#interludeBody2").textContent = drona ? (oracle.answered ? t("dronaBody2") : "") : t("interludeBody2");

    const box = $("#oracle");
    const next = $("#interludeNext");
    box.hidden = !drona;
    next.disabled = drona && !oracle.answered;
    next.classList.toggle("is-locked", next.disabled);
    if (!drona) return;

    $("#oracleQ").textContent = t("oracleQ");
    const opts = $("#oracleOpts");
    opts.innerHTML = [1, 2, 3]
      .map((n) => '<button type="button" class="oracle-opt" data-n="' + n + '">' + t("oracleA" + n) + "</button>")
      .join("");
    const reply = $("#oracleReply");
    reply.textContent = oracle.last ? t("oracleR" + oracle.last) : "";
    reply.classList.toggle("is-right", oracle.last === 3);
    opts.querySelectorAll(".oracle-opt").forEach((b) => {
      const n = Number(b.dataset.n);
      if (oracle.last === n) b.classList.add(n === 3 ? "is-right" : "is-wrong");
      b.addEventListener("click", () => answerOracle(n));
    });
  }

  function answerOracle(n) {
    if (oracle.answered) return;
    oracle.last = n;
    audio.sfx(n === 3 ? "garland" : "pluck");
    if (n === 3) oracle.answered = true;
    renderInterlude();
    if (n === 3) {
      const next = $("#interludeNext");
      if (next) next.focus({ preventScroll: true });
    }
  }

  function startTrials() {
    audio.unlock();
    if (!G.run) G.newRun();
    audio.sfx("conch");
    G.toBow();
  }

  /* ---------- modal building ---------- */

  function craftBody() {
    let grid = "";
    for (let i = 1; i <= 15; i++) {
      if (!SV.i18n.dicts.en["craft" + i + "Title"]) continue;
      grid += '<article class="feature"><h4>' + t("craft" + i + "Title") + "</h4><p>" + t("craft" + i + "Desc") + "</p></article>";
    }
    return (
      '<p class="modal-lead">' + t("craftIntro") + "</p>" +
      '<div class="feature-grid">' + grid + "</div>" +
      '<p class="credit-line">' + t("credits") + "</p>"
    );
  }

  function taleBody() {
    return (
      "<h3>" + t("tale1Title") + "</h3><p>" + t("tale1Body") + "</p>" +
      '<h3 style="margin-top:20px">' + t("tale2Title") + "</h3><p>" + t("tale2Body") + "</p>" +
      '<p class="modal-note">' + t("tale3Body") + "</p>" +
      '<p class="credit-line">' + t("credits") + "</p>"
    );
  }

  function settingsBody() {
    const volume = Math.round(SV.settings.volume);
    const opt = (v, label, current) => '<option value="' + v + '"' + (v === current ? " selected" : "") + ">" + label + "</option>";
    return (
      '<p class="modal-lead">' + t("settingsIntro") + "</p>" +
      '<div class="settings-block">' +
        '<label class="setting-row"><span class="setting-copy"><strong>' + t("labelTheme") + "</strong></span>" +
          '<select data-set="theme">' + opt("dark", t("themeDark"), SV.settings.theme) + opt("light", t("themeLight"), SV.settings.theme) + "</select></label>" +
        '<label class="setting-row"><span class="setting-copy"><strong>' + t("labelLang") + "</strong></span>" +
          '<select data-set="lang">' + opt("en", "English", SV.settings.lang) + opt("hi", "हिन्दी", SV.settings.lang) + opt("hinglish", "Hinglish", SV.settings.lang) + "</select></label>" +
        '<label class="setting-row"><span class="setting-copy"><strong>' + t("labelMusic") + "</strong></span>" +
          '<input type="checkbox" data-set="music"' + (SV.settings.music ? " checked" : "") + "></label>" +
        '<label class="setting-row"><span class="setting-copy"><strong>' + t("labelSfx") + "</strong></span>" +
          '<input type="checkbox" data-set="sfx"' + (SV.settings.sfx ? " checked" : "") + "></label>" +
        '<div class="setting-row"><span class="setting-copy"><strong>' + t("labelVolume") + "</strong></span>" +
          '<input type="range" min="0" max="100" value="' + volume + '" data-set="volume" style="max-width:150px"></div>' +
        '<label class="setting-row"><span class="setting-copy"><strong>' + t("labelMotion") + "</strong><small>" + t("motionDesc") + "</small></span>" +
          '<input type="checkbox" data-set="motion"' + (SV.settings.reduceMotion ? " checked" : "") + "></label>" +
        '<label class="setting-row"><span class="setting-copy"><strong>' + t("labelReflection") + "</strong><small>" + t("reflectionDesc") + "</small></span>" +
          '<input type="checkbox" data-set="reflection"' + (SV.settings.simpleReflection ? " checked" : "") + "></label>" +
        '<div class="setting-row"><span class="setting-copy"><strong>' + t("labelReset") + "</strong><small>" + t("resetDesc") + "</small></span>" +
          '<button class="btn btn--ghost" type="button" data-action="reset">' + t("resetBtn") + "</button></div>" +
      "</div>"
    );
  }

  function howBody() {
    let list = "";
    for (let i = 1; i <= 5; i++) {
      list +=
        '<div class="flow-item"><span class="flow-num">' + i + '</span><div><h4>' +
        t("how" + i + "Title") + "</h4><p>" + t("how" + i + "Desc") + "</p></div></div>";
    }
    return '<p class="modal-lead">' + t("howIntro") + '</p><div class="flow-list">' + list + "</div>";
  }

  function pauseBody() {
    return (
      "<p>" + t("pauseBody") + "</p>" +
      '<div class="cta-row" style="justify-content:flex-start">' +
        '<button class="btn btn--primary" type="button" data-action="resume">' + t("resume") + "</button>" +
        '<button class="btn btn--ghost" type="button" data-action="restart">' + t("restart") + "</button>" +
        '<button class="btn btn--ghost" type="button" data-action="quit">' + t("quit") + "</button>" +
      "</div>"
    );
  }

  function modalConfig() {
    if (modal.view === "how") return { kicker: "Swayamvara", title: t("howTitle"), body: howBody(), tabs: false };
    if (modal.view === "pause") return { kicker: "Swayamvara", title: t("pauseTitle"), body: pauseBody(), tabs: false };
    if (modal.view === "settings") modal.tab = "settings";
    if (modal.tab === "settings") return { kicker: "Swayamvara", title: t("settingsTitle"), body: settingsBody(), tabs: true };
    if (modal.tab === "tale") return { kicker: "Swayamvara", title: t("taleTitle"), body: taleBody(), tabs: true };
    return { kicker: "Swayamvara", title: t("craftTitle"), body: craftBody(), tabs: true };
  }

  function renderModal() {
    if (!modal.open) return;
    const cfg = modalConfig();
    $("#modalKicker").textContent = cfg.kicker;
    $("#modalTitle").textContent = cfg.title;
    $("#modalBody").innerHTML = cfg.body;
    const tabs = $("#modalTabs");
    tabs.hidden = !cfg.tabs;
    tabs.querySelectorAll("[role=tab]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.tab === modal.tab));
    });
    wireModalBody();
  }

  function wireModalBody() {
    const body = $("#modalBody");
    body.querySelectorAll("[data-set]").forEach((el) => {
      const key = el.dataset.set;
      const evt = el.type === "range" ? "input" : "change";
      el.addEventListener(evt, () => {
        if (key === "theme") {
          SV.setTheme(el.value);
          applyThemeUI();
          renderModal();
        } else if (key === "lang") {
          setLanguage(el.value);
        } else if (key === "music") {
          setMusic(el.checked);
          updateAudioUI();
        } else if (key === "sfx") {
          SV.settings.sfx = el.checked;
          audio.setSfx(el.checked);
          SV.saveSettings();
          updateAudioUI();
        } else if (key === "volume") {
          setVolume(Number(el.value));
        } else if (key === "motion") {
          SV.settings.reduceMotion = el.checked;
          SV.saveSettings();
        } else if (key === "reflection") {
          SV.settings.simpleReflection = el.checked;
          SV.saveSettings();
          G.toast(t("settingsSaved"));
        }
      });
    });
  }

  function openModal(view, tab) {
    if (!$("#failLayer").hidden) return;
    modal.open = true;
    modal.view = view;
    if (tab) modal.tab = tab;
    modal.lastFocus = document.activeElement;
    $("#modal").hidden = false;
    document.body.classList.add("is-paused");
    if (!G.paused && ["bow", "pool", "fish"].includes(G.screen)) {
      G.setPaused(true);
      modal.pausedGame = true;
    } else {
      modal.pausedGame = false;
    }
    releaseInputs();
    renderModal();
    setTimeout(() => {
      const btn = $("#modalClose");
      if (btn) btn.focus({ preventScroll: true });
    }, 40);
  }

  function closeModal() {
    if (!modal.open) return;
    modal.open = false;
    $("#modal").hidden = true;
    document.body.classList.remove("is-paused");
    if (modal.pausedGame) {
      G.setPaused(false);
      modal.pausedGame = false;
    }
    if (modal.lastFocus && modal.lastFocus.focus) {
      try { modal.lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function releaseInputs() {
    SV.input.down = false;
    SV.input.keys.clear();
    if (G.scenes.pool) {
      G.scenes.pool.btnHeld = false;
      G.scenes.pool.pointerHold = false;
      G.scenes.pool.holding = false;
    }
    if (G.scenes.fish && G.scenes.fish.cancelDraw) G.scenes.fish.cancelDraw();
    const sb = $("#steadyBtn");
    if (sb) sb.classList.remove("is-held");
    const lb = $("#looseBtn");
    if (lb) lb.classList.remove("is-held");
  }

  function togglePause() {
    if (!["bow", "pool", "fish"].includes(G.screen)) return;
    if (!$("#failLayer").hidden) return;
    if (modal.open) {
      if (modal.view === "pause") closeModal();
      return;
    }
    openModal("pause");
  }

  /* ---------- audio + appearance ---------- */

  function setVolume(v) {
    SV.settings.volume = U.clamp(Math.round(v), 0, 100);
    audio.setVolume(SV.settings.volume);
    SV.saveSettings();
    const out = $("#volumeOut");
    const range = $("#volumeRange");
    if (out) out.textContent = SV.settings.volume + "%";
    if (range) range.value = SV.settings.volume;
    updateAudioUI();
  }

  function setMusic(on) {
    SV.settings.music = !!on;
    SV.saveSettings();
    if (on) audio.toggleMusic(true);
    else audio.toggleMusic(false);
    const dot = $("#musicDot");
    if (dot) dot.classList.toggle("is-live", !!(on && audio.playing));
    const mt = $("#musicToggle");
    if (mt) mt.checked = !!on;
    G.toast(on ? t("musicOn") : t("musicOff"));
  }

  function updateAudioUI() {
    const mt = $("#musicToggle");
    const st = $("#sfxToggle");
    const vol = $("#volumeRange");
    const out = $("#volumeOut");
    const dot = $("#musicDot");
    if (mt) mt.checked = !!SV.settings.music;
    if (st) st.checked = !!SV.settings.sfx;
    if (vol) vol.value = Math.round(SV.settings.volume);
    if (out) out.textContent = Math.round(SV.settings.volume) + "%";
    if (dot) dot.classList.toggle("is-live", !!(SV.settings.music && audio.playing));
  }

  function applyThemeUI() {
    const mode = document.documentElement.dataset.theme;
    const btn = $("#themeBtn");
    if (btn) btn.setAttribute("aria-label", t(mode === "dark" ? "themeToLight" : "themeToDark"));
  }

  function setLanguage(lang) {
    SV.setLang(lang);
    SV.i18n.apply();
    syncStaticUI();
    renderPrologue(false);
    renderInterlude();
    G.refreshText();
    G.renderTitleDefaults();
    updateAudioUI();
    if (modal.open) renderModal();
  }

  function setDifficulty(key) {
    SV.settings.difficulty = key;
    SV.saveSettings();
    $$(".diff").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.diff === key)));
    const desc = $("#diffDesc");
    if (desc) {
      desc.textContent = t(key === "katha" ? "diffDescKatha" : key === "maharathi" ? "diffDescMaharathi" : "diffDescYoddha");
    }
    G.best = SV.store.get("best", {}) || {};
    G.updateBestLine();
  }

  function syncStaticUI() {
    $$(".diff").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.diff === SV.settings.difficulty)));
    $$("#langSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === SV.settings.lang)));
    const desc = $("#diffDesc");
    if (desc) {
      desc.textContent = t(
        SV.settings.difficulty === "katha" ? "diffDescKatha" :
        SV.settings.difficulty === "maharathi" ? "diffDescMaharathi" : "diffDescYoddha"
      );
    }
    updateAudioUI();
    applyThemeUI();
    G.updateBestLine();
    G.renderTitleDefaults();
  }

  /* ---------- boot ---------- */

  function boot() {
    SV.setTheme(SV.settings.theme, true);
    SV.setLang(SV.settings.lang, true);
    SV.i18n.apply();

    const canvas = $("#stage");
    SV.stage.init(canvas);
    SV.input.init(canvas);

    G.init();
    G.best = SV.store.get("best", {}) || {};

    SV.input.handlers = {
      down(x, y, e) {
        if (modal.open || G.paused) return;
        if (G.scene && G.scene.onDown) G.scene.onDown(x, y, e);
      },
      move(x, y, e) {
        if (modal.open) return;
        if (G.scene && G.scene.onMove) G.scene.onMove(x, y, e);
      },
      up(x, y, e) {
        if (modal.open) return;
        if (G.scene && G.scene.onUp) G.scene.onUp(x, y, e);
      },
      keydown(code, e) {
        if (modal.open || G.paused) return;
        if (G.scene && G.scene.onKey) G.scene.onKey(code, e);
      },
      keyup(code, e) {
        if (G.scene && G.scene.onKeyUp) G.scene.onKeyUp(code, e);
      },
    };

    // story + hud copy
    renderPrologue(false);
    renderInterlude();
    syncStaticUI();

    // title actions
    $("#startBtn").addEventListener("click", () => {
      audio.unlock();
      prologueIndex = 0;
      renderPrologue(false);
      G.begin();
    });
    $("#howBtn").addEventListener("click", () => openModal("how"));
    $("#exploreLink").addEventListener("click", () => openModal("codex", "craft"));
    $("#codexBtn").addEventListener("click", () => openModal("codex", "craft"));
    $("#endingExplore").addEventListener("click", () => openModal("codex", "craft"));
    $("#brandBtn").addEventListener("click", () => {
      if (modal.open) closeModal();
      if (G.screen === "title") return;
      G.quitToTitle();
    });

    // difficulty
    $$(".diff").forEach((b) => {
      b.addEventListener("click", () => {
        setDifficulty(b.dataset.diff);
        audio.sfx("pluck");
      });
    });

    // story navigation
    $("#prologueNext").addEventListener("click", () => {
      audio.unlock();
      if (prologueIndex < SLIDES.length - 1) {
        prologueIndex += 1;
        renderPrologue(true);
        audio.sfx("pluck");
      } else {
        startTrials();
      }
    });
    $("#prologueSkip").addEventListener("click", startTrials);
    document.addEventListener("sv:interlude", () => {
      oracle.answered = false;
      oracle.last = 0;
      renderInterlude();
    });
    $("#interludeNext").addEventListener("click", () => {
      audio.sfx("conch");
      if (G.interludeKind === "drona") G.toFish();
      else G.toPool();
    });

    // ending
    $("#replayBtn").addEventListener("click", () => {
      audio.unlock();
      prologueIndex = 0;
      renderPrologue(false);
      G.begin();
    });
    $("#shareBtn").addEventListener("click", () => G.copyResult());

    // topbar
    $("#themeBtn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      SV.setTheme(next);
      applyThemeUI();
      audio.sfx("bubble");
    });
    $("#musicBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      const pop = $("#audioPop");
      const show = pop.hidden;
      pop.hidden = !show;
      $("#musicBtn").setAttribute("aria-expanded", String(show));
      if (show) updateAudioUI();
    });
    $("#audioClose").addEventListener("click", () => {
      $("#audioPop").hidden = true;
      $("#musicBtn").setAttribute("aria-expanded", "false");
    });
    document.addEventListener("click", (e) => {
      const pop = $("#audioPop");
      const btn = $("#musicBtn");
      if (pop.hidden) return;
      if (pop.contains(e.target) || btn.contains(e.target)) return;
      pop.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });
    $("#musicToggle").addEventListener("change", (e) => setMusic(e.target.checked));
    $("#sfxToggle").addEventListener("change", (e) => {
      SV.settings.sfx = e.target.checked;
      audio.setSfx(e.target.checked);
      SV.saveSettings();
      updateAudioUI();
    });
    $("#volumeRange").addEventListener("input", (e) => setVolume(Number(e.target.value)));

    // language segmented control
    $$("#langSeg button").forEach((b) => {
      b.addEventListener("click", () => {
        setLanguage(b.dataset.lang);
        audio.sfx("bubble");
      });
    });

    // modal tabs + close + backdrop
    $("#modalTabs").querySelectorAll("[role=tab]").forEach((b) => {
      b.addEventListener("click", () => {
        modal.tab = b.dataset.tab;
        renderModal();
      });
    });
    $("#modalClose").addEventListener("click", closeModal);
    $("#modal").addEventListener("click", (e) => {
      if (e.target === $("#modal")) closeModal();
    });
    $("#modalBody").addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]");
      if (!action) return;
      const a = action.dataset.action;
      if (a === "resume") closeModal();
      else if (a === "restart") {
        closeModal();
        G.retryTrial();
      } else if (a === "quit") {
        closeModal();
        G.quitToTitle();
      } else if (a === "reset") {
        if (window.confirm(t("resetConfirm"))) {
          SV.store.remove("best");
          SV.store.remove("settings");
          window.location.reload();
        }
      }
    });

    // pause
    $("#pauseBtn").addEventListener("click", togglePause);
    document.addEventListener("sv:togglepause", togglePause);
    document.addEventListener("sv:autopause", () => {
      if (["bow", "pool", "fish"].includes(G.screen) && !modal.open && $("#failLayer").hidden) {
        openModal("pause");
      }
    });

    // global keys
    window.addEventListener("keydown", (e) => {
      const tag = (document.activeElement && document.activeElement.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "select" || tag === "textarea";

      if (e.code === "Escape") {
        if (!$("#failLayer").hidden) {
          G.quitToTitle();
          return;
        }
        if (modal.open) {
          closeModal();
          return;
        }
        togglePause();
        return;
      }
      if (modal.open) return;
      if (typing) return;

      if (e.code === "KeyM") {
        setMusic(!SV.settings.music);
      } else if (e.code === "KeyE") {
        openModal("codex", "craft");
      } else if (e.code === "Enter" && G.screen === "title") {
        const active = document.activeElement;
        if (active && active.tagName === "BUTTON") return;
        $("#startBtn").click();
      }
    });

    // first gesture unlocks audio (browsers require it)
    const unlock = () => {
      audio.unlock();
      updateAudioUI();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

    // keep the little music dot honest
    setInterval(updateAudioUI, 900);

    audio.setIntensity(1);
    updateAudioUI();

    // stop holding states if the tab loses focus
    window.addEventListener("blur", () => {
      releaseInputs();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
