import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for gain-visualiser.
//
// Notes:
// - nec2.js is loaded dynamically at runtime from /nec2.js (served from public/).
//   It is NOT imported by the bundle so Vite won't try to transform it.
// - We mark three/examples as transpile-friendly via optimizeDeps for dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
});
