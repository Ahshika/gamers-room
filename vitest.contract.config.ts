import { defineConfig } from 'vitest/config';

// Network contract tests against the live portfolio: kept out of `npm test` so CI never depends on them.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/contract/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
