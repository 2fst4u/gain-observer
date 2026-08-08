import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      'virtual:pwa-register': resolve(__dirname, './tests/__mocks__/pwa.ts')
    },
    coverage: {
      provider: 'v8',
      // Floors, not high-water marks. Keep these as round numbers a little
      // below actual coverage: pinning them to the exact current percentage
      // makes every refactor that shifts a line count fail the build and
      // forces unrelated edits to this file. Raise a floor deliberately when
      // coverage has moved up for good, not reflexively in each PR.
      thresholds: {
        statements: 73,
        branches: 65,
        functions: 78,
        lines: 95,
      }
    }
  },
});
