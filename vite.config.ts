import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Vite config for gain-visualiser.
//
// Notes:
// - nec2.js is loaded dynamically at runtime from /nec2.js (served from public/).
//   It is NOT imported by the bundle so Vite won't try to transform it.
// - We mark three/examples as transpile-friendly via optimizeDeps for dev.
//
// Cache-busting strategy (PWA + Cloudflare Pages):
// - HTTP layer  : public/_headers sets Cache-Control: no-cache for the SPA shell,
//                 service worker, manifest and unhashed public files; /assets/* gets
//                 immutable (content-addressed by Vite hash).
// - SW layer    : buildId is injected into the Workbox precache manifest as a
//                 revision entry so the generated sw.js always differs between
//                 Cloudflare deployments even when no source files changed.
//                 CF_PAGES_COMMIT_SHA is set automatically during CF Pages builds;
//                 we fall back to an ISO timestamp for local dev.
// - SW lifecycle: clientsClaim + cleanupOutdatedCaches ensure the new SW takes
//                 control of all open tabs immediately and evicts stale caches.

const buildId: string = process.env.CF_PAGES_COMMIT_SHA ?? new Date().toISOString();

export default defineConfig({
  define: {
    // Exposed to app code as __BUILD_ID__ (declared in src/vite-env.d.ts).
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Take control of all tabs immediately after activation so users
        // don't remain on a stale bundle until their next hard reload.
        clientsClaim: true,
        // Purge precaches from old SW versions to free storage and avoid
        // serving mixed old/new assets.
        cleanupOutdatedCaches: true,
        // Include a build-specific revision so the SW manifest changes on
        // every Cloudflare deployment, guaranteeing browsers fetch a new sw.js.
        additionalManifestEntries: [
          { url: 'index.html', revision: buildId },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  worker: {
    format: 'iife',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
