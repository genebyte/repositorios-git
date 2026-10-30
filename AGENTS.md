# AGENTS.md

Vanilla HTML + p5.js + ml5.js sketch, split across three independently owned features. No `package.json`, bundler, test runner, linter, or CI — dependencies are CDN script tags in `index.html`.

## Run

- Serve the folder over HTTP; `file://` blocks camera access and `ml5.handPose` will fail:
  `python -m http.server 8000` (or `npx serve .`), then open `http://localhost:8000`.
- Both CDN pins must stay reachable: p5 `2.3.3` (jsDelivr) and ml5 `1.4.0` (unpkg). ml5 also fetches TF.js model weights at runtime, so first load needs network.
- `ml5` must load after `p5`, and every feature file must load before `sketcj.js`.

## Feature contract (the seam between the three owners)

Each feature is one file exposing `init(canvas)`, `update()`, `draw()`, `getState()`; `HandPoseFeature` in `js/handpose.js` is the reference implementation.

- `init({ width, height })` — async one-time setup.
- `update()` — per-frame state refresh, no drawing.
- `draw()` — per-frame rendering of that feature's own visuals only.
- `getState()` — plain data for other features; never p5 objects.

`sketcj.js` is the composition root: canvas creation plus an `update()`/`draw()` loop over `FEATURES`. It is the only shared file, so keep it to wiring — adding a feature is one entry in `FEATURES`, nothing else.

Ownership: `js/handpose.js` owns webcam + model + hand rendering; `js/gamelogic.js` owns rules and **interprets** gestures; `js/ui.js` owns chrome/HUD. Handpose publishes landmarks only — do not move gesture classification into `handpose.js`.

## Coordinates and camera

- `getState().hands[]` is in canvas screen space, already mirrored (`x = width - x`). Consumers never un-mirror.
- Each hand: `landmarks[21]` (MediaPipe order: 0 wrist, 4/8/12/16/20 fingertips), `points[name]`, `palm`, `bounds`, `handedness`.
- Never draw the camera frame. `createCapture` injects a `<video>` element, so `video.hide()` is mandatory — without it the camera appears on screen even if `image(video, ...)` is never called.
- Skeleton topology is by landmark index (`BONES` in `js/handpose.js`); smoothing resets when the hand count changes because detection order is not stable across frames.

## Current state

`js/gamelogic.js` and `js/ui.js` are still empty placeholders, and only `HandPoseFeature` is wired into `FEATURES`. Work on the handpose branch stays inside `js/handpose.js` plus the one wiring line.

## Git

Branches: `main`, `develop`, `release/0.1.0` (currently checked out). No remote configured. Commit messages are free-form Spanish so far; conventional commits are fine going forward.
