## 2024-05-18 - Missing vitest coverage dependency and unhandled rejection

**Learning:** `pnpm test --coverage` requires `@vitest/coverage-v8` but it wasn't in `package.json`. Also, components using `ResizeObserver` (like `@react-three/fiber` canvas) throw exceptions if it's not present globally in `jsdom`.

**Action:** Added `@vitest/coverage-v8` to `devDependencies` and mocked `ResizeObserver` globally in `vitest.setup.ts`.
