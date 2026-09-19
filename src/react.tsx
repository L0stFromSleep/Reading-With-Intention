import { useEffect, useMemo, useRef } from "react";
import { createHighlighter, type HighlightState } from "./highlighter.js";

export type { HighlightState };

export type ReadingWithIntentionProps = {
  /** HTML to render (paragraphs, links, `<em>`, images, … — anything). Only the text inside `<p>` elements is word-wrapped. */
  html: string;
  /** Which word/sentence to highlight right now, and how — `null` clears it. */
  highlight: HighlightState;
  /** Called once per `html` change with this instance's tokens (word/sentence boundaries) — e.g. to build TTS request chunks or map external timing data to word indices. */
  onTokens?: (tokens: ReturnType<typeof createHighlighter>["tokens"]) => void;
  className?: string;
};

/**
 * Renders `html` and keeps a `createHighlighter` instance in sync with it —
 * word-wrapping happens once per `html` change; highlighting is applied
 * imperatively (no re-render) as `highlight` changes.
 */
export function ReadingWithIntention({ html, highlight, onTokens, className }: ReadingWithIntentionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlighterRef = useRef<ReturnType<typeof createHighlighter> | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const h = createHighlighter(root);
    highlighterRef.current = h;
    onTokens?.(h.tokens);
    return () => {
      h.destroy();
      highlighterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  useEffect(() => {
    highlighterRef.current?.setHighlight(highlight);
  }, [highlight]);

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
