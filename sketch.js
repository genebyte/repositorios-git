/**
 * Composition root — the only file shared by the three owners.
 * Keep it small: wiring only, no feature logic.
 *
 * Each feature lives in its own file and implements the same contract:
 *   init({ width, height }) -> Promise<void>
 *   update()                -> void
 *   draw()                  -> void
 *   getState()              -> object (plain data, no p5 objects)
 *
 * Handpose branch: only HandPoseFeature is wired in. Add the other features
 * to FEATURES as their files land — one line per feature, nothing else.
 */

const FEATURES = [HandPoseFeature];

const activeFeatures = [];

async function setup() {
  createCanvas(640, 480);
  for (const feature of FEATURES) {
    await feature.init({ width, height });
    activeFeatures.push(feature);
  }
}

function draw() {
  background(14, 16, 22);
  for (const feature of activeFeatures) {
    feature.update();
    feature.draw();
  }
}
