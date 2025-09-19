import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    pool: 'forks',
    threads: false,
    // Only run unit tests (*.unit.test.ts) - integration tests should be separate
    include: ['src/**/*.unit.test.ts'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text','json','json-summary','lcov'],
      reportsDirectory: 'coverage'
    }
  }
});
