# Reading with Intention

Word-by-word, audio-follows-text highlighting for reading UIs — inspired by
[Caption with Intention](https://www.captionwithintention.org/), the
Academy Award (Sci-Tech) recognized captioning system built for deaf and
hard-of-hearing audiences. That system rests on three ideas:

- **Attribution** — color-code each speaker so it's instantly clear who's talking.
- **Synchronization** — reveal/highlight text in time with the audio, word by word.
- **Intonation** — vary the typography (size, weight) with delivery: volume and pitch.

This package brings the same three ideas to reading UIs in general — an
audiobook player, a read-aloud feature, a karaoke-style transcript, anything
that needs to show *which word is being read right now, and how* — as a
small, framework-neutral core (plain DOM, zero dependencies) with an
optional React binding.

It does not do speech synthesis, timing generation, or emotion detection —
you bring the timing (from a TTS API's word-boundary events, a pre-generated
`.json` timing sidecar, whatever) and, optionally, per-word intensity/emotion
data. This library turns that into highlighted, expressive text.

> **Status:** not yet published to npm. For now, install directly from this branch:
> `npm install github:L0stFromSleep/The-Brilliant-Emporium#reading-with-intention`

## Install

```bash
npm install reading-with-intention
```

```js
import { createHighlighter } from "reading-with-intention";
import "reading-with-intention/style.css";
```

## Zero-bundler quick start

No build step, no framework — just a `<script>` tag and the stylesheet.
See the full runnable version in [`examples/vanilla/index.html`](examples/vanilla/index.html).

```html
<link rel="stylesheet" href="https://unpkg.com/reading-with-intention/dist/style.css" />
<script src="https://unpkg.com/reading-with-intention/dist/index.global.js"></script>

<div id="reader" class="rwi">
  <p>Okay, just breathe. We're almost out.</p>
</div>

<script>
  const { createHighlighter } = ReadingWithIntention;
  const highlighter = createHighlighter(document.getElementById("reader"));
  highlighter.setHighlight({ wordIndex: 2, color: "#5ec8ff", intensity: -1, jump: true });
</script>
```

## Quick start (vanilla, via npm)

```js
import { createHighlighter } from "reading-with-intention";
import "reading-with-intention/style.css";

const container = document.querySelector("#reader");
container.classList.add("rwi"); // scopes the default stylesheet

// Word-wraps every <p> inside `container` once, and returns tokens
// (word/sentence boundaries) computed straight from what's actually
// rendered there.
const highlighter = createHighlighter(container);

// However you're tracking playback (an <audio> timeupdate, a TTS
// onboundary event, …), call setHighlight with the word index to light up:
highlighter.setHighlight({
  wordIndex: 12,
  color: "#5ec8ff",   // this speaker's color
  intensity: 2,        // -2 (whisper) .. 2 (shout)
  emotion: "afraid",   // "neutral" | "angry" | "sad" | "afraid" | "happy" | "surprised"
  jump: true,          // let the word jump/dip as it's spoken
  overlap: false,      // grow via font-size (push neighbors) instead of transform (can overlap)
});

// Clear when playback stops:
highlighter.setHighlight(null);
```

## Quick start (React)

```tsx
import { useState } from "react";
import { ReadingWithIntention, type HighlightState } from "reading-with-intention/react";
import "reading-with-intention/style.css";

function Reader({ html }: { html: string }) {
  const [highlight, setHighlight] = useState<HighlightState>(null);
  // ...drive setHighlight from your own audio/TTS playback loop...
  return <ReadingWithIntention className="rwi" html={html} highlight={highlight} />;
}
```

## Mapping your own timing data to word indices

If your timing data isn't already "one entry per word," `mapSegmentsToWordRanges`
lines up a list of text-chunk-level segments (one per dialogue line, one per
TTS utterance, whatever granularity you have) against a highlighter's tokens:

```js
import { mapSegmentsToWordRanges, rangeAtMs } from "reading-with-intention";

const ranges = mapSegmentsToWordRanges(highlighter.tokens, [
  { text: "Okay, just breathe.", startMs: 0, endMs: 1400, speakerId: "kira", intensity: -1 },
  { text: '"RUN!" she screamed.', startMs: 1400, endMs: 2200, speakerId: "voice", intensity: 2, emotion: "afraid" },
]);

audioEl.ontimeupdate = () => {
  const ms = audioEl.currentTime * 1000;
  const range = rangeAtMs(ranges, ms);
  if (!range) return;
  const fraction = (ms - range.startMs) / (range.endMs - range.startMs);
  const wordIndex = range.wordStart + Math.floor(fraction * (range.wordEnd - range.wordStart));
  highlighter.setHighlight({
    wordIndex,
    color: colorFor(range.speakerId),
    intensity: range.intensity,
    emotion: range.emotion,
  });
};
```

Already have per-word timing (e.g. from a TTS API's word-boundary events)?
Skip the mapping step and call `setHighlight` directly with each word's
index as it's spoken.

## API

### `createHighlighter(container: HTMLElement): Highlighter`

Word-wraps every `<p>` inside `container` in a `<span class="rwi-w">` —
preserving every other tag (links, `<em>`, images, …) — and computes
`tokens` (word + sentence boundaries, with char offsets into a synthesized
`plainText`) directly from what's rendered, so they're always consistent
with what's on screen.

- `.tokens: TokenizedText` — read-only; use with `mapSegmentsToWordRanges` / `wordIndexAtChar`.
- `.setHighlight(state: HighlightState): void` — move (or clear, with `null`) the highlight.
- `.destroy(): void` — clears any active highlight. Call before you replace/unmount the container's own content.

### `HighlightState`

```ts
type HighlightState = {
  wordIndex: number;
  color?: string;       // any CSS color; omitted = the stylesheet's default accent
  intensity?: Intensity; // -2..2, default 0 (normal)
  emotion?: Emotion;     // default "neutral"
  overlap?: boolean;     // grow via transform (can overlap a neighbor) instead of font-size (reflows)
  jump?: boolean;        // one-shot vertical jump/dip as the word is highlighted
  letterJump?: boolean;  // (requires jump) animate each character in a stagger instead of the whole word
} | null;
```

### Delivery mappings (`deliveryStyle`)

Pure, DOM-free functions turning an `Intensity`/`Emotion` into typography —
useful if you want to preview or reuse the mappings outside the highlighter:
`intensityScale`, `intensityWeight`, `intensityJumpPx`, `emotionClass`,
plus `INTENSITY_LABELS` / `EMOTION_LABELS` for UI (e.g. a settings picker).

### Text tokenization (`textHighlight`)

`tokenizeText(paragraphs)`, `wordIndexAtChar`, `mapSegmentsToWordRanges`,
`rangeAtMs` — the same pure math `createHighlighter` uses internally,
exposed for when you need word/sentence boundaries before anything is
mounted (e.g. building TTS request chunks up front).

## Styling

`reading-with-intention/style.css` ships sensible defaults, scoped under a
`.rwi` class you apply to your container, and themeable via CSS custom
properties:

```css
.rwi {
  --rwi-accent: 210 90% 60%; /* "H S% L%" triplet */
}
```

Prefer to own the CSS yourself? The classes (`rwi-sentence`, `rwi-word`,
`rwi-overlap`, `rwi-jump`, `rwi-char`, `rwi-emotion-*`) and custom properties
(`--rwi-sentence-bg`, `--rwi-word-bg`, `--rwi-scale`, `--rwi-word-scale`,
`--rwi-weight`, `--rwi-jump`) are documented in `src/style.css` — copy and
adapt it instead of importing the package's stylesheet.

## Accessibility

The jump/dip animation is wrapped in `@media (prefers-reduced-motion:
no-preference)` and is skipped entirely for anyone whose OS requests
reduced motion — appropriate for a feature descended from an accessibility
technology in the first place.

## Examples

- [`examples/vanilla/index.html`](examples/vanilla/index.html) — zero-bundler, plain HTML/JS, drives the highlighter off `requestAnimationFrame` against hardcoded timing data (stand-in for a real TTS/audio source).

## Development

```bash
npm install
npm run build      # tsup -> dist/{index,react}.{js,cjs,d.ts} + dist/index.global.js (minified IIFE)
npm run typecheck
```

## What this is *not*

This is an independent, open-source reinterpretation of Caption with
Intention's public design principles (color attribution, synchronized
reveal, variable typography for volume/pitch) for reading UIs — it is not
affiliated with, endorsed by, or a redistribution of the official Caption
with Intention design system, fonts, or After Effects templates. See
[captionwithintention.org](https://www.captionwithintention.org/) for the
original.

## License

MIT
