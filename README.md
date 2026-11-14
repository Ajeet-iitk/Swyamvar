# Draupadi's Swayamvara — The Eye of the Fish

A cinematic, browser-playable retelling of Draupadi's swayamvara from the Mahabharata. Three trials stand between the challenger and the garland: string the divine bow, read the lie of the boiling oil, and pierce the eye of the spinning golden fish.

Everything is drawn and sounded in the browser. There are no image files, no audio files, no frameworks and no build step — only HTML, CSS, vanilla JavaScript, canvas and WebAudio.

**Play:** open `index.html`, or serve the folder locally (see below).

---

## The three trials

| Trial | Scene | What you do |
| --- | --- | --- |
| **I · The Bow** | The Weight of Heaven | Tap, click or press `Space` when the needle crosses the gold arc. Four, five and three clean beats lift, bend and string the bow. Misses and time drain *prana*. |
| **II · The Oil** | The Mirror That Lies | Your sight is reflected in the oil, so aim against the mirror. Rest the reticle on the reflected fish's eye and **hold** (`Shift`, the on-screen button, or press and hold anywhere on the scene) until clarity fills. Breathing out too long makes the oil surge. |
| **III · The Eye** | The Wheel and the Eye | Track the spinning fish and loose an arrow when its eye crosses your reticle. Five arrows. Each miss leaves a ghost mark of the wheel's timing, and the wheel slows briefly so the next shot can be read. |

A full run is short — roughly one to three minutes depending on difficulty and how calmly you shoot.

## Difficulty

| Mode | Mood | Changes |
| --- | --- | --- |
| **Katha** | The story, gently told | Slow needle, generous gold arc, patient oil, slow wheel. |
| **Yoddha** | A warrior's balance | The intended telling: a fair bow, a lying mirror, a wheel with teeth. |
| **Maharathi** | No mercy in the oil | A fast needle, a hungry reflection, a quick wheel and almost no forgiveness. |

Your best run per difficulty is stored in `localStorage` and shown on the title screen. The ending ranks the run from *Sthira* to *Atiratha* using misses, perfect beats, gasps and difficulty.

## Controls

- **Keyboard** — `Space` / `Enter` to strike and loose; `Shift` to steady the oil; `Esc` to pause or close a panel.
- **Mouse** — move to aim; click to strike or loose; hold the left button (or the on-screen *Hold to steady* button) in the oil trial.
- **Touch** — drag to aim; tap anywhere to strike or loose; hold the on-screen steady button in the oil trial.

On phones and coarse pointers the key hints switch automatically to touch wording.

## Languages and themes

- **English**, **हिन्दी** (Devanagari) and **Hinglish**, switchable at any time from the top bar or Settings. The choice persists between visits.
- **Dark** (gold on lacquer) and **light** (parchment and ink) modes. The canvas repaints to match, and the oil and wheel keep their dark, dangerous palette in both themes.
- Language, theme, music, effects, volume, reduced motion and simplified reflection are all remembered in `localStorage`.

## Sound

Tanpura drone, tabla pulse, plucked notes and hall noise are synthesised live with WebAudio. The bow trial is a rhythm game: its pulse is borrowed from the same tabla cycle you hear. The speaker button opens music and effects controls; browsers require a click or tap before audio can start.

## Creative features

- **Procedural art** — arches, diyas, mandalas, the fish, the wheel, the bow, ripples, crowd silhouettes and the title tableau are painted frame by frame on canvas.
- **A living raga** — no audio files; the score is generated from oscillators, filtered noise and envelopes.
- **A diegetic target** — the fish is never seen directly, only in the oil's reflection, as the myth demands.
- **A wheel with a memory** — missed arrows leave ghost marks of the wheel's timing.
- **Rhythm of the bow** — the first trial's beats follow the music rather than a metronome.
- **Hands of every kind** — keyboard, mouse and touch, with reduced-motion and simplified-reflection options.
- **Light and dark** — the entire hall is repainted rather than merely inverted.
- **The myth, held with care** — Karna's rejection is framed as the cruelty it was, while giving him the last of his dignity.

## Accessibility

- Semantic headings, labelled dialogs, live status toast and a skip link.
- Full keyboard play; focus styles are visible.
- A *Reduce motion* setting removes screen shake and most particle motion, and honours `prefers-reduced-motion`.
- A *Simple reflection* setting mirrors only the horizontal axis, making the oil trial easier.
- The interface adapts from 360 px phones to wide desktops, including short landscape phones.

## Run it locally

No install is required.

```powershell
# from this folder
python -m http.server 5173 --bind 127.0.0.1
```

Then open <http://127.0.0.1:5173/>.

Opening `index.html` directly also works. A local server is recommended because browsers treat `file://` pages differently for storage and some font loading. Google Fonts (Cormorant Garamond, Cinzel, Inter, Noto Serif Devanagari) are the only external requests; the game falls back to system serif/sans fonts offline.

## Publish to GitHub Pages

The project is already static and uses relative paths, so no build step is needed.

1. Create a repository and push this folder to the `main` branch.
2. In **Settings → Pages**, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`.
3. Save. The site will be served from `https://<user>.github.io/<repo>/`.

The empty `.nojekyll` file tells GitHub Pages to serve the files as-is. If you publish under a repository subpath, every asset path remains relative, so no configuration is required.

## Project structure

```
.
├─ index.html              # all screens, HUD, modal and script order
├─ assets/
│  └─ favicon.svg          # gold fish-and-eye emblem
├─ css/
│  ├─ base.css             # theme tokens, reset, stage, top bar, controls
│  ├─ ui.css               # screens, title, story cards, modal, HUD
│  └─ game.css             # play chrome, touch hints, responsive tweaks
├─ js/
│  ├─ core.js              # settings, storage, palettes, canvas stage, input
│  ├─ i18n.js              # English / Hindi / Hinglish dictionaries
│  ├─ audio.js             # procedural tanpura, tabla, plucks and SFX
│  ├─ fx.js                # particles, sparks, shake and glow helpers
│  ├─ art.js               # procedural hall, mandala, fish, bow, oil, reticle
│  ├─ game.js              # state machine, difficulty configs, run and rank
│  ├─ bow.js               # Trial I
│  ├─ pool.js              # Trial II
│  ├─ fish.js              # Trial III
│  └─ main.js              # boot, story flow, UI wiring, modals, shortcuts
├─ README.md
└─ .nojekyll
```

## A note on the myth

This is a game, not a scholarly edition. The Sanskrit lines in the story cards are short invocations composed for this telling, not quotations from the Mahabharata. Karna's rejection at the swayamvara is presented critically: the game does not celebrate the insult, and it gives Karna dignity in leaving.

The Mahabharata is a living, plural tradition. Different regions, tellers and lineages remember Draupadi's swayamvara differently; this version follows the most familiar north-Indian telling while trying to hold the characters with care.

## Credits

Design, code, procedural art, synthesis and text made for this project. Typefaces by their respective designers via Google Fonts. No third-party libraries are bundled.
