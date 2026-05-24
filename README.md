# HF Antenna Gain Visualiser

**Live App:** [www.gain.observer](https://www.gain.observer/)

A 3D, responsive, physics-accurate visualiser for HF antenna radiation patterns, powered by NEC-2 compiled to WebAssembly.

While this repository is fully open source and developers are welcome to fork or clone it to run locally, the primary way to use the application is via the hosted URL at **[www.gain.observer](https://www.gain.observer/)**.

Current scope (Phase 1): horizontal dipoles, inverted Vs, sloping Vs, delta loops, terminated delta loops, vertical whips, and inverted-Ls, 1.8–30 MHz, real-ground support, offset feed points, feedlines & baluns, comparison mode, SWR/polar cut charts, dark/light theming, metric/imperial toggle.

## Stack

- React 19 + Vite + TypeScript (strict)
- Three.js / React Three Fiber / drei (3D)
- Zustand + Immer (state)
- Chart.js + react-chartjs-2 (2D plots)
- NEC-2 (`nec2c` by N. Kyriazis, GPL v3) via Emscripten → WebAssembly
- Vitest (physics validation + unit tests)

## Local Development

If you wish to contribute or run the application locally, you can clone or fork the repository.

Prerequisites:

- Node.js 20+ (recommended 22)
- Emscripten SDK (only required when rebuilding the Wasm binary)

```bash
npm ci             # install dependencies strictly from lockfile
npm run dev        # start Vite dev server
npm run lint       # run ESLint
npm run test       # run unit + NEC-2 integration tests
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
