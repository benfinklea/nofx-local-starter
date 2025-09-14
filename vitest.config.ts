import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.unit.test.ts'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text','json','json-summary','lcov'],
      reportsDirectory: 'coverage'
    }
  }
});
