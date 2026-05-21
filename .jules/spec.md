## 2024-10-24 - Mocking Worker in React Hooks Tests

**Learning:** When using `vi.stubGlobal('Worker', MockWorker)` in React hook tests, mock workers stored in an array for assertions need to be explicitly typed when retrieved (e.g., `as MockWorker`) because `unknown` will naturally trigger ESLint's `@typescript-eslint/no-unsafe-member-access` or `@typescript-eslint/no-explicit-any` rules if typed as `any`.
**Action:** Use a well-defined class for `MockWorker` and cast instances back to it when asserting, avoiding `any` entirely to pass strict linting.
