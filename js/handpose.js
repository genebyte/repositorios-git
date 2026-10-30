/**
 * HandPoseFeature — hand detection and skeleton rendering.
 *
 * Shared feature contract (every feature in sketch.js implements the same shape):
 *   init(canvas) -> Promise<void>  one-time async setup, receives { width, height }
 *   update()     -> void           per-frame state refresh, no drawing
 *   draw()       -> void           per-frame rendering, only this feature's visuals
 *   getState()   -> object         plain data for other features, never p5 objects
 *
 * Ownership: this file owns the webcam capture, the ml5 model and the hand
 * skeleton drawing. It knows nothing about game rules or UI chrome; gesture
 * interpretation belongs to gamelogic.js.
 */
const HandPoseFeature = (() => {
  const CONFIG = {
    maxHands: 2,
    mirrored: true, // screen-space coords: moving right moves right on screen
    smoothing: 0.5, // 0 = raw signal, closer to 1 = smoother but laggier
    style: {
      boneWeight: 4,
      jointDiameter: 14,
      wristDiameter: 20,
      // One colour per detected hand, cycled if maxHands grows.
      palette: [
        [122, 224, 255],
        [255, 156, 122],
      ],
    },
  };

  // MediaPipe hand topology in canonical landmark order
  // (0 = wrist, 4 = thumb tip, 8/12/16/20 = index/middle/ring/pinky tips).
  const BONES = [
    [0, 1], [1, 2], [2, 3], [3, 4], // thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // index
    [5, 9], [9, 10], [10, 11], [11, 12], // middle
    [9, 13], [13, 14], [14, 15], [15, 16], // ring
    [13, 17], [17, 18], [18, 19], [19, 20], // pinky
    [0, 17], // palm base
  ];

  const PALM_INDICES = [0, 5, 9, 13, 17];

  let handPose = null;
  let video = null;
  let rawHands = [];
  let previousFrame = null;
  let canvas = { width: 640, height: 480 };

  // Plain data, safe to read from gamelogic.js / ui.js.
  const state = {
    ready: false,
    error: null,
    hands: [],
  };

  async function init(canvasSize) {
    if (canvasSize) canvas = canvasSize;

    try {
      handPose = await ml5.handPose({ maxHands: CONFIG.maxHands });
      video = createCapture(VIDEO, () => {
        handPose.detectStart(video, onHands);
        state.ready = true;
      });
      video.size(canvas.width, canvas.height);
      // hide() keeps the <video> element out of the DOM flow: the camera
      // frame is never displayed, only the skeleton drawn from landmarks.
      video.hide();
    } catch (error) {
      state.error = error;
    }
  }

  function onHands(results) {
    rawHands = Array.isArray(results) ? results : [];
  }

  function update() {
    if (state.error || !state.ready) return;

    const detected = rawHands.filter(
      (hand) => hand && Array.isArray(hand.keypoints) && hand.keypoints.length === BONES.length
    );

    // Hand order is not guaranteed across frames; smoothing across a different
    // hand would smear the skeleton, so reset when the count changes.
    if (!previousFrame || previousFrame.length !== detected.length) previousFrame = null;

    state.hands = detected.map((hand, index) => buildHand(hand, index));
  }

  function buildHand(hand, index) {
    if (!previousFrame) previousFrame = [];
    const previous = previousFrame[index] || null;
    const points = hand.keypoints.map((keypoint, i) => {
      const x = CONFIG.mirrored ? canvas.width - keypoint.x : keypoint.x;
      return { x: blend(previous, i, "x", x), y: blend(previous, i, "y", keypoint.y) };
    });
    previousFrame[index] = points;

    const landmarks = points.map((point, i) => ({
      name: hand.keypoints[i].name || String(i),
      x: point.x,
      y: point.y,
    }));

    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const palm = averageOf(points, PALM_INDICES);

    return {
      handedness: hand.handedness || null,
      landmarks,
      points: Object.fromEntries(landmarks.map((landmark) => [landmark.name, { x: landmark.x, y: landmark.y }])),
      palm,
      bounds: {
        minX: Math.min(...xValues),
        minY: Math.min(...yValues),
        maxX: Math.max(...xValues),
        maxY: Math.max(...yValues),
      },
    };
  }

  function blend(previous, index, axis, value) {
    const previousValue = previous && previous[index] ? previous[index][axis] : undefined;
    if (typeof previousValue !== "number") return value;
    const keep = Math.min(Math.max(CONFIG.smoothing, 0), 0.99);
    return previousValue + (value - previousValue) * (1 - keep);
  }

  function averageOf(points, indices) {
    const total = indices.reduce(
      (acc, i) => ({ x: acc.x + points[i].x, y: acc.y + points[i].y }),
      { x: 0, y: 0 }
    );
    return { x: total.x / indices.length, y: total.y / indices.length };
  }

  function draw() {
    if (state.error) {
      drawError();
      return;
    }

    for (let h = 0; h < state.hands.length; h++) {
      const hand = state.hands[h];
      const [red, green, blue] = CONFIG.style.palette[h % CONFIG.style.palette.length];

      stroke(red, green, blue);
      strokeWeight(CONFIG.style.boneWeight);
      for (const [from, to] of BONES) {
        line(hand.landmarks[from].x, hand.landmarks[from].y, hand.landmarks[to].x, hand.landmarks[to].y);
      }

      noStroke();
      fill(red, green, blue);
      for (let i = 0; i < hand.landmarks.length; i++) {
        const landmark = hand.landmarks[i];
        const diameter = i === 0 ? CONFIG.style.wristDiameter : CONFIG.style.jointDiameter;
        circle(landmark.x, landmark.y, diameter);
      }
    }
  }

  function drawError() {
    noStroke();
    fill(255, 96, 96);
    textAlign(CENTER, CENTER);
    textSize(16);
    text(
      "Hand tracking unavailable.\nServe this folder over http://localhost and allow camera access.",
      canvas.width / 2,
      canvas.height / 2
    );
  }

  function getState() {
    return state;
  }

  return { init, update, draw, getState, CONFIG };
})();
