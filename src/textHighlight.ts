// Pure text tokenization + timing math — no DOM required. Useful for
// building TTS request chunks, or precomputing word/sentence boundaries
// before anything is rendered. `createHighlighter` (highlighter.ts) computes
// its own tokens straight from the live DOM instead, guaranteed consistent
// with what's on screen — prefer that when you already have a container to
// render into, and reach for these only when you need tokens with nothing
// mounted yet.

import type { Emotion, Intensity } from "./types.js";

export type WordToken = {
  text: string;
  charStart: number;
  charEnd: number;
  paragraphIndex: number;
  sentenceIndex: number;
};

export type SentenceToken = {
  paragraphIndex: number;
  charStart: number;
  charEnd: number;
  wordStart: number;
  wordEnd: number; // exclusive
};

export type TokenizedText = {
  paragraphs: string[];
  /** Paragraphs joined with a single space — the char-offset base every mode measures against. */
  plainText: string;
  words: WordToken[];
  sentences: SentenceToken[];
};

const SENTENCE_RE = /[^.!?…]+[.!?…]*/g;
const WORD_RE = /\S+/g;

/** Split plain text into paragraphs on blank lines. A convenience for callers who have raw text, not markup. */
export function textToParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Tokenize an array of plain-text paragraphs into words + sentences, with char offsets into `plainText`. */
export function tokenizeText(paragraphs: string[]): TokenizedText {
  const words: WordToken[] = [];
  const sentences: SentenceToken[] = [];
  let cursor = 0;

  paragraphs.forEach((para, pIdx) => {
    if (pIdx > 0) cursor += 1; // the joining space between paragraphs in plainText
    const paraStart = cursor;
    const sentMatches = para.match(SENTENCE_RE) ?? [para];
    let localOffset = 0;
    for (const sentText of sentMatches) {
      if (sentText.trim()) {
        const sentCharStart = paraStart + localOffset;
        const wordStart = words.length;
        WORD_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = WORD_RE.exec(sentText))) {
          words.push({
            text: m[0],
            charStart: sentCharStart + m.index,
            charEnd: sentCharStart + m.index + m[0].length,
            paragraphIndex: pIdx,
            sentenceIndex: sentences.length,
          });
        }
        sentences.push({
          paragraphIndex: pIdx,
          charStart: sentCharStart,
          charEnd: sentCharStart + sentText.length,
          wordStart,
          wordEnd: words.length,
        });
      }
      localOffset += sentText.length;
    }
    cursor = paraStart + para.length;
  });

  return { paragraphs, plainText: paragraphs.join(" "), words, sentences };
}

/** The word token containing (or nearest after) a given char offset into `plainText`. -1 if there are no words. */
export function wordIndexAtChar(tokens: TokenizedText, charOffset: number): number {
  const { words } = tokens;
  if (words.length === 0) return -1;
  let lo = 0;
  let hi = words.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].charEnd <= charOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type TimingSegment = {
  speakerId?: string;
  text: string;
  startMs: number;
  endMs: number;
  intensity?: Intensity;
  emotion?: Emotion;
};

export type SpeakerRange = {
  wordStart: number;
  wordEnd: number; // exclusive
  startMs: number;
  endMs: number;
  speakerId?: string;
  intensity?: Intensity;
  emotion?: Emotion;
};

/**
 * Line up an ordered list of timing segments (each just a chunk of this same
 * text's plain content, in order — e.g. one per dialogue line or TTS
 * utterance) against `tokens`, by walking both in lockstep and advancing by
 * each segment's text length. Segment text doesn't need to byte-for-byte
 * match `tokens.plainText` (a hand-edited transcript, minor TTS
 * normalization, etc.) — this is a length-based approximation, good enough
 * for "which word is playing right now."
 */
export function mapSegmentsToWordRanges(tokens: TokenizedText, segments: TimingSegment[]): SpeakerRange[] {
  const total = tokens.plainText.length;
  let cursor = 0;
  const ranges: SpeakerRange[] = [];
  for (const seg of segments) {
    const len = seg.text.trim().length;
    const start = Math.min(cursor, total);
    const end = Math.min(cursor + len, total);
    const wordStart = wordIndexAtChar(tokens, start);
    const wordEndAt = wordIndexAtChar(tokens, Math.max(end - 1, start));
    const wordEnd = Math.max(wordStart, wordEndAt) + 1;
    ranges.push({
      wordStart, wordEnd, startMs: seg.startMs, endMs: seg.endMs, speakerId: seg.speakerId,
      intensity: seg.intensity, emotion: seg.emotion,
    });
    cursor = end + 1; // +1 for the inter-paragraph/segment joining space
  }
  return ranges;
}

/** The range active at a given playback time, via binary search on startMs. */
export function rangeAtMs(ranges: SpeakerRange[], ms: number): SpeakerRange | null {
  if (ranges.length === 0) return null;
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ranges[mid].startMs <= ms) lo = mid;
    else hi = mid - 1;
  }
  return ranges[lo];
}
