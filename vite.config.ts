import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // The app logs heavily while debugging. Drop log/debug calls from production
  // builds (they cost time on slow phones); warnings and errors are kept.
  esbuild: mode === 'production' ? { pure: ['console.log', 'console.debug'] } : undefined,
  // Some dependencies (e.g. smiles-drawer) contain mixed ESM + CommonJS syntax.
  // Without this, Rollup can leave `require()` calls in the browser bundle, causing a white screen.
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      // Keep the default behavior (process node_modules) while enabling mixed-module handling.
      include: [/node_modules/],
    },
  },
}));
