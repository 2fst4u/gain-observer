## 2024-10-24 - Mocking Worker in React Hooks Tests

**Learning:** When using `vi.stubGlobal('Worker', MockWorker)` in React hook tests, mock workers stored in an array for assertions need to be explicitly typed when retrieved (e.g., `as MockWorker`) because `unknown` will naturally trigger ESLint's `@typescript-eslint/no-unsafe-member-access` or `@typescript-eslint/no-explicit-any` rules if typed as `any`.
**Action:** Use a well-defined class for `MockWorker` and cast instances back to it when asserting, avoiding `any` entirely to pass strict linting.
## 2026-05-24 - Suppressing React Three Fiber Warnings
**Learning:** When using React Testing Library to test components that render `@react-three/fiber` elements (like `<mesh>`), React will spam the console with warnings about unrecognized HTML tags or incorrect casing. The mock used in `beforeEach` for `console.error` can swallow important actual errors if not careful. The mock function should accept multiple arguments (e.g. `...args`) and forward them via `console.warn(msg, ...args)` rather than just swallowing or printing the first argument.
**Action:** Use a robust `console.error` spy that selectively drops R3F warnings but forwards real errors with full arguments.
