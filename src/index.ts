export type { Emotion, Intensity } from "./types.js";

export {
  EMOTION_LABELS,
  INTENSITY_LABELS,
  emotionClass,
  intensityJumpPx,
  intensityScale,
  intensityWeight,
} from "./deliveryStyle.js";

export {
  mapSegmentsToWordRanges,
  rangeAtMs,
  textToParagraphs,
  tokenizeText,
  wordIndexAtChar,
} from "./textHighlight.js";
export type { SentenceToken, SpeakerRange, TimingSegment, TokenizedText, WordToken } from "./textHighlight.js";

export { createHighlighter } from "./highlighter.js";
export type { HighlightState, Highlighter } from "./highlighter.js";
