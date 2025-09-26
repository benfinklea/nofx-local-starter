/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Cloud Migration Tests',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/*.test.ts',
    '<rootDir>/**/*.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'api/**/*.ts',
    'apps/frontend/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000, // 30 seconds for cloud tests
  maxWorkers: 2, // Limit parallel execution for API tests
  setupFilesAfterEnv: ['<rootDir>/setup.ts']
};