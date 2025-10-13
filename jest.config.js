/* eslint-disable @typescript-eslint/no-unsafe-assignment */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/cloud-migration/',
    '<rootDir>/tests/chaos/',
    '<rootDir>/node_modules/',
    '<rootDir>/apps/frontend/node_modules/'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: '50%',
  verbose: false, // Changed to false for cleaner output when running many tests
  // Enable test result caching for faster incremental runs
  cache: true,
  cacheDirectory: '.jest-cache',
  // Test hardening configurations
  bail: false, // Changed to false - run all tests even if some fail
  detectOpenHandles: true, // Detect handles keeping Jest from exiting
  forceExit: true, // Force exit after tests complete
  // Increase the timeout for the entire test run (in milliseconds)
  // This is different from testTimeout which is per-test
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noImplicitReturns: true
      },
      diagnostics: {
        warnOnly: false,
        // Only ignore codes that are truly unavoidable in test environment
        // 6133: unused variable (often false positives in test setup)
        // 7017: try-catch binding (common in error handling tests)
        ignoreCodes: [6133, 7017]
      }
    }]
  }
};
