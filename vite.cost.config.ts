// Builds scripts/bench-cost.ts (+ the engine, + core) into one Node module under node_modules/.cache so `pnpm bench:cost` runs without a TS loader.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@core': fileURLToPath(new URL('./core/ts', import.meta.url)) } },
  build: {
    ssr: 'scripts/bench-cost.ts', outDir: 'node_modules/.cache/bench-cost', emptyOutDir: true, target: 'node18', minify: false,
    rollupOptions: { output: { entryFileNames: 'bench-cost.mjs', format: 'es' } },
  },
  ssr: { noExternal: true },
});
