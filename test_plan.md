1.  **Extract Chart.js computation logic to a separate file.**
    - Create `src/components/Charts/swrChartUtils.ts` (or similar).
    - Move `xBounds`, `yMax`, `stats`, and dataset generation logic into pure functions that can be tested separately without rendering React components. This includes extracting the `useMemo` bodies out of `SWRChart.tsx`.
    - Alternatively, implement custom hooks if they need to be stateful, but plain functions passing inputs are cleaner. Let's look at `useMemo` blocks.
2.  **Refactor `SWRChart.tsx`.**
    - Import the new functions from `swrChartUtils.ts`.
    - Use these functions inside the `useMemo` hooks, keeping the dependency arrays the same to maintain performance.
    - This will significantly reduce the size and complexity of `SWRChart.tsx`.
3.  **Run tests.**
    - Ensure all existing tests in `tests/bandwidth.test.tsx` pass.
4.  **Complete pre-commit steps.**
    - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
