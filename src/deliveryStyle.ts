// Rendering-side mappings for the "Reading with Intention" delivery layer:
// how an Intensity/Emotion (however your app decides one — a heuristic over
// dialogue tags, hand-authored timing data, a TTS API's own prosody output,
// whatever) turns into typography. Pure and DOM-free — safe to call from
// anywhere, including outside a browser.

import type { Emotion, Intensity } from "./types.js";

export const INTENSITY_LABELS: Record<Intensity, string> = {
  [-2]: "Whisper",
  [-1]: "Quiet",
  [0]: "Normal",
  [1]: "Raised",
  [2]: "Shout",
};

export const EMOTION_LABELS: Record<Emotion, string> = {
  neutral: "Neutral",
  angry: "Angry",
  sad: "Sad",
  afraid: "Afraid",
  happy: "Happy",
  surprised: "Surprised",
};

const INTENSITY_SCALE: Record<Intensity, number> = {
  [-2]: 0.82,
  [-1]: 0.9,
  [0]: 1,
  [1]: 1.15,
  [2]: 1.35,
};

/** Font-size multiplier for a given intensity — 1 (unchanged) when absent. */
export function intensityScale(intensity?: Intensity): number {
  return INTENSITY_SCALE[intensity ?? 0];
}

// The real "Caption with Intention" system ties weight to *pitch* — this
// library only models a single volume-like Intensity axis, so every level
// gets its own weight rather than a binary bold/regular: a whisper reads
// visibly lighter than normal, a shout visibly heavier than raised.
const INTENSITY_WEIGHT: Record<Intensity, number> = {
  [-2]: 300,
  [-1]: 400,
  [0]: 400,
  [1]: 600,
  [2]: 800,
};

/** Font weight for a given intensity — lighter for whisper/quiet, heavier for raised/shout. */
export function intensityWeight(intensity?: Intensity): number {
  return INTENSITY_WEIGHT[intensity ?? 0];
}

// Signed vertical "jump" (px) a word makes for the instant it's spoken.
// Shouted words jump up (negative = translateY up), whispered words sink
// down (positive); a normal-intensity word doesn't move, so the effect
// reads as emphasis rather than constant motion.
const INTENSITY_JUMP_PX: Record<Intensity, number> = {
  [-2]: 5,
  [-1]: 2,
  [0]: 0,
  [1]: -5,
  [2]: -11,
};

/** Vertical jump offset (px) for a given intensity — 0 (no motion) when absent/normal. */
export function intensityJumpPx(intensity?: Intensity): number {
  return INTENSITY_JUMP_PX[intensity ?? 0];
}

/** CSS class for a given emotion, or null for neutral/absent (no class needed). */
export function emotionClass(emotion?: Emotion): string | null {
  return emotion && emotion !== "neutral" ? `rwi-emotion-${emotion}` : null;
}
