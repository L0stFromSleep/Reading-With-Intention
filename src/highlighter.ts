// Framework-neutral DOM engine: wraps every word inside a container's <p>
// elements in a <span>, once, then lets you imperatively move a "sentence"
// / "word" highlight across them — cheap even for long documents, since
// each setHighlight() call only ever touches the previous and next active
// elements, never re-renders anything.
//
// Unlike a typical "tokenize the source text, then render markup that
// matches it" pipeline (two parses that have to be kept in sync by
// convention), this reads its word/sentence tokens straight out of the live
// DOM it's about to wrap — there's only one parse, and the tokens it hands
// back are guaranteed to describe exactly what's on screen.

import { emotionClass, intensityJumpPx, intensityScale, intensityWeight } from "./deliveryStyle.js";
import type { Emotion, Intensity } from "./types.js";
import type { SentenceToken, TokenizedText, WordToken } from "./textHighlight.js";

export type HighlightState = {
  /** Index into the highlighter's `tokens.words`. */
  wordIndex: number;
  /** Highlight color for this word/sentence (any valid CSS color). Omitted = the stylesheet's default (--rwi-accent). */
  color?: string;
  /** Delivery volume/intensity for the current word. Omitted = normal. */
  intensity?: Intensity;
  /** Delivery emotion for the current word. Omitted = neutral. */
  emotion?: Emotion;
  /** When true, an emphasized word grows via transform (can visually overlap a neighbor) instead of font-size (reflows, never overlaps). */
  overlap?: boolean;
  /** When true, a non-normal-intensity word does a one-shot vertical jump/dip as it's highlighted. */
  jump?: boolean;
  /** When true (and `jump` is also true), the jump animates each character in a stagger instead of moving the whole word as one block. */
  letterJump?: boolean;
} | null;

export type Highlighter = {
  /** This highlighter's word/sentence tokens, computed directly from `container`'s rendered text. */
  tokens: TokenizedText;
  /** Move the highlight to a new state (or `null` to clear it entirely). */
  setHighlight: (state: HighlightState) => void;
  /**
   * Clears any active highlight (classes/inline styles/split characters).
   * The per-word `<span>` wrapping itself is left in place — call this
   * before you replace or unmount `container`'s content yourself, not as a
   * full DOM-restoring cleanup step.
   */
  destroy: () => void;
};

/** "#rrggbb" -> "rgba(r, g, b, alpha)"; passes non-hex colors (e.g. "hsl(...)", named colors) through unchanged. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const SENTENCE_RE = /[^.!?…]+[.!?…]*/g;
const WORD_RE = /\S+/g;

type WordEl = HTMLElement;

/**
 * Word-wrap every `<p>` inside `container` — preserving every other tag
 * (links, `<em>`, images, …); only text nodes are split into per-word
 * `<span class="rwi-w">`s — and simultaneously build the WordToken/
 * SentenceToken arrays those spans correspond to, from each paragraph's own
 * `textContent` (read before it's mutated).
 */
function wrapWords(container: HTMLElement): { tokens: TokenizedText; wordEls: (WordEl | null)[] } {
  const paragraphEls = Array.from(container.querySelectorAll<HTMLElement>("p"));
  const words: WordToken[] = [];
  const sentences: SentenceToken[] = [];
  const paragraphs: string[] = [];
  let cursor = 0;

  paragraphEls.forEach((p, pIdx) => {
    const paraText = p.textContent ?? "";
    paragraphs.push(paraText);
    if (pIdx > 0) cursor += 1; // joining space, mirroring paragraphs.join(" ")
    const paraStart = cursor;
    const sentMatches = paraText.match(SENTENCE_RE) ?? [paraText];
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
    cursor = paraStart + paraText.length;
  });

  const wordEls: (WordEl | null)[] = new Array(words.length).fill(null);
  let globalIdx = 0;

  const wrapTextNode = (node: Text) => {
    const text = node.data;
    const frag = document.createDocumentFragment();
    let last = 0;
    WORD_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WORD_RE.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement("span");
      span.className = "rwi-w";
      if (globalIdx < words.length) {
        span.dataset.w = String(globalIdx);
        wordEls[globalIdx] = span;
      }
      span.textContent = m[0];
      frag.appendChild(span);
      globalIdx++;
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  };

  const walk = (el: Element) => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) wrapTextNode(child as Text);
      else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element);
    }
  };
  for (const p of paragraphEls) walk(p);

  return { tokens: { paragraphs, plainText: paragraphs.join(" "), words, sentences }, wordEls };
}

export function createHighlighter(container: HTMLElement): Highlighter {
  const { tokens, wordEls } = wrapWords(container);

  let activeWord: WordEl | null = null;
  let activeSentence: { start: number; end: number; emotionCls: string | null } | null = null;

  function clear() {
    if (activeWord) {
      const prev = activeWord;
      prev.classList.remove("rwi-word", "rwi-overlap", "rwi-jump");
      prev.style.removeProperty("--rwi-word-bg");
      prev.style.removeProperty("--rwi-scale");
      prev.style.removeProperty("--rwi-word-scale");
      prev.style.removeProperty("--rwi-weight");
      prev.style.removeProperty("--rwi-jump");
      // Letter mode temporarily replaces the word's text with one
      // <span class="rwi-char"> per character — flatten back to plain text
      // so the DOM doesn't accumulate stale per-character spans.
      if (prev.querySelector(".rwi-char")) {
        const flat = prev.textContent;
        prev.textContent = flat;
      }
      activeWord = null;
    }
    if (activeSentence) {
      const { start, end, emotionCls } = activeSentence;
      for (let i = start; i < end; i++) {
        const el = wordEls[i];
        if (!el) continue;
        el.classList.remove("rwi-sentence");
        el.style.removeProperty("--rwi-sentence-bg");
        if (emotionCls) el.classList.remove(emotionCls);
      }
      activeSentence = null;
    }
  }

  function setHighlight(state: HighlightState) {
    clear();
    if (!state || state.wordIndex < 0 || state.wordIndex >= tokens.words.length) return;
    const word = tokens.words[state.wordIndex];
    const sentence = tokens.sentences[word.sentenceIndex];
    if (!sentence) return;

    const sentenceBg = state.color ? withAlpha(state.color, 0.22) : undefined;
    const emotionCls = emotionClass(state.emotion);
    for (let i = sentence.wordStart; i < sentence.wordEnd; i++) {
      const el = wordEls[i];
      if (!el) continue;
      el.classList.add("rwi-sentence");
      if (sentenceBg) el.style.setProperty("--rwi-sentence-bg", sentenceBg);
      if (emotionCls) el.classList.add(emotionCls);
    }
    activeSentence = { start: sentence.wordStart, end: sentence.wordEnd, emotionCls };

    // Size/weight/jump emphasis lives on just this one word, for just the
    // moment it's spoken — applied and cleared every call, so it can never
    // stay enlarged past its own turn.
    const wordEl = wordEls[state.wordIndex];
    if (!wordEl) return;
    wordEl.classList.add("rwi-word");
    if (state.color) wordEl.style.setProperty("--rwi-word-bg", state.color);

    const scale = intensityScale(state.intensity);
    const weight = intensityWeight(state.intensity);
    if (scale !== 1) {
      if (state.overlap) {
        wordEl.classList.add("rwi-overlap");
        wordEl.style.setProperty("--rwi-word-scale", String(scale));
      } else {
        wordEl.style.setProperty("--rwi-scale", String(scale));
      }
    }
    if (weight !== 400) wordEl.style.setProperty("--rwi-weight", String(weight));

    const jumpPx = intensityJumpPx(state.intensity);
    if (state.jump && jumpPx !== 0) {
      wordEl.style.setProperty("--rwi-jump", `${jumpPx}px`);
      if (state.letterJump) {
        const text = wordEl.textContent ?? "";
        wordEl.textContent = "";
        for (let ci = 0; ci < text.length; ci++) {
          const charSpan = document.createElement("span");
          charSpan.className = "rwi-char";
          charSpan.style.setProperty("--i", String(ci));
          charSpan.textContent = text[ci];
          wordEl.appendChild(charSpan);
        }
      } else {
        wordEl.classList.add("rwi-jump");
      }
    }
    activeWord = wordEl;
  }

  function destroy() {
    clear();
  }

  return { tokens, setHighlight, destroy };
}
