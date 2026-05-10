## 2024-05-10 - Bumping coverage threshold
**Learning:** Adding new test files can alter the total codebase line count, which may cause a slight reduction in overall `lines` percentage (e.g., from 59% to 58%) even when `branches` or `functions` coverage increases.
**Action:** Always verify final thresholds using `npm run test -- --coverage` and manually update vitest configuration thresholds (e.g. `lines` coverage from `69` to `70`) rather than chasing individual coverage numbers blindly.
