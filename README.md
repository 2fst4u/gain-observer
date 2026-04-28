# HF Antenna Gain Visualiser

A 3D, responsive, physics-accurate visualiser for HF antenna radiation patterns, powered by NEC-2 compiled to WebAssembly.

Current scope (Phase 1): horizontal dipoles, 1.8–30 MHz, real-ground support, NVIS and comparison modes, SWR/polar cut charts, dark/light theming, metric/imperial toggle.

## Stack

- React 19 + Vite + TypeScript (strict)
- Three.js / React Three Fiber / drei (3D)
- Zustand + Immer (state)
- Chart.js + react-chartjs-2 (2D plots)
- NEC-2 (`nec2c` by N. Kyriazis, GPL v3) via Emscripten → WebAssembly
- Vitest (physics validation + unit tests)

## Getting started

Prerequisites:
- Node.js 20+ (recommended 22)
- Emscripten SDK (only required when rebuilding the Wasm binary)

```bash
npm install
npm run dev        # start Vite dev server
npm test           # run unit + NEC-2 integration tests
npm run build      # production build
```

## Rebuilding the NEC-2 WebAssembly binary

The compiled `public/nec2.js` / `public/nec2.wasm` are checked in so a `git clone` is enough to run the app. To rebuild:

```bash
source ~/emsdk/emsdk_env.sh
npm run build:nec2
```

Output goes to `public/nec2.{js,wasm}`.

## Licensing

This project is GPL v3 because it statically links `nec2c`, which is itself GPL v3. See LICENSE for the full text.
