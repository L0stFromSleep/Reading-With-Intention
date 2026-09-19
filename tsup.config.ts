import { defineConfig } from "tsup";

export default defineConfig([
  // Bundler-friendly builds: ESM + CJS, with type declarations, for anyone
  // importing this from Node/a bundler (Vite, webpack, Next, ...).
  {
    entry: { index: "src/index.ts", react: "src/react.tsx" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["react"],
  },
  // Zero-bundler build: a single minified <script>-taggable file exposing
  // `window.ReadingWithIntention` — for sites with no build step at all.
  // (React isn't included here since the vanilla core doesn't need it.)
  {
    entry: { index: "src/index.ts" },
    format: ["iife"],
    globalName: "ReadingWithIntention",
    minify: true,
    sourcemap: true,
    dts: false,
  },
]);
