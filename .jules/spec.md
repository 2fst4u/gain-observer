## 2024-05-10 - Bumping coverage threshold
**Learning:** Adding new test files can alter the total codebase line count, which may cause a slight reduction in overall `lines` percentage (e.g., from 59% to 58%) even when `branches` or `functions` coverage increases.
**Action:** Always verify final thresholds using `npm run test -- --coverage` and manually update vitest configuration thresholds (e.g. `lines` coverage from `69` to `70`) rather than chasing individual coverage numbers blindly.

## 2024-05-15 - Bumping coverage threshold for PolarPlots
**Learning:** React Component Unit Tests for complex charts. When testing ChartJS components that use callbacks in deep properties (like `options.scales.r.ticks.callback`), simulating those specific nested functions in the mocked component allows testing internal branch logic safely without rendering real canvases.
**Action:** Mock `react-chartjs-2` specifically testing the callbacks if necessary, rather than trying to load the full canvas.
