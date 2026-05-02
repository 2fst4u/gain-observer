import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Vite config for gain-visualiser.
//
// Notes:
// - nec2.js is loaded dynamically at runtime from /nec2.js (served from public/).
//   It is NOT imported by the bundle so Vite won't try to transform it.
// - We mark three/examples as transpile-friendly via optimizeDeps for dev.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'HF Gain Visualiser',
        short_name: 'Gain Observer',
        description: 'HF antenna gain visualiser — 3D radiation patterns powered by NEC-2 WebAssembly.',
        theme_color: '#0c0f14',
        background_color: '#0c0f14',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        // Increase the limit for WASM files if necessary
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
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
