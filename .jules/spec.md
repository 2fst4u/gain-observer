## 2024-05-18 - Missing vitest coverage dependency and unhandled rejection

**Learning:** `pnpm test --coverage` requires `@vitest/coverage-v8` but it wasn't in `package.json`. Also, components using `ResizeObserver` (like `@react-three/fiber` canvas) throw exceptions if it's not present globally in `jsdom`.

**Action:** Added `@vitest/coverage-v8` to `devDependencies` and mocked `ResizeObserver` globally in `vitest.setup.ts`.
## 2025-02-12 - StatsReadout coverage and vitest configuration
**Learning:** Adding test files can slightly alter overall codebase lines count. When increasing test coverage for multiple thresholds (e.g. `branches`, `functions`), a slight reduction in overall `lines` percentage (e.g., from 59 to 58) may occur due to total line count recalculation across the project.
**Action:** Always verify test coverage thresholds using `npm run test -- --coverage` after making changes and update `vitest.config.ts` accordingly.
## 2025-02-12 - Fixing Unexpected any Types in StatsReadout
**Learning:** React component test hooks using `@testing-library/react` and TypeScript need to ensure explicit type cast without using `as any` because strict linting rules (`@typescript-eslint/no-explicit-any`) will reject it, causing CI failures.
**Action:** Cast mock results to their specific store interfaces such as `as unknown as import('../src/physics/types').SimulationResult` or `as unknown as import('../src/store/antennaStore').ComparisonSnapshot` rather than `as any`.
## 2024-05-04 - UnitToggle.tsx coverage and vitest configuration
**Learning:** Testing component behaviour interacting directly with Zustand state via `useAntennaStore.setState()` ensures we evaluate application effects rather than isolated mocks. Also, it might be necessary to reset state with `cleanup()` or `afterEach()` hooks when doing continuous updates to components to prevent pollution of consecutive tests.

**Action:** Write test scenarios mapping closely user flows (like toggling an option off and verifying the opposite behaviour occurs and the classname reflects this correctly) instead of internal behaviour.
