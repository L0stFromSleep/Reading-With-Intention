/**
 * Delivery volume/loudness, on a 5-step scale. -2 is a whisper, 2 is a
 * shout. 0 (or omitted) is normal and renders unchanged.
 */
export type Intensity = -2 | -1 | 0 | 1 | 2;

/**
 * Delivery emotion. "neutral" (or omitted) renders unchanged.
 */
export type Emotion = "neutral" | "angry" | "sad" | "afraid" | "happy" | "surprised";
