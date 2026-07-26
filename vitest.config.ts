import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      // Floors, not high-water marks. Keep these as round numbers a little
      // below actual coverage: pinning them to the exact current percentage
      // makes every refactor that shifts a line count fail the build and
      // forces unrelated edits to this file. Raise a floor deliberately when
      // coverage has moved up for good, not reflexively in each PR.
      thresholds: {
        statements: 72,
        branches: 64,
        functions: 77,
        lines: 94,
      }
    }
  },
});
