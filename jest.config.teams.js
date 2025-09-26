/**
 * Jest Configuration for Team Management Tests
 * Bulletproof test suite configuration
 */

module.exports = {
  displayName: 'Team Management Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/api/routes/__tests__/teams*.test.ts',
    '**/services/email/__tests__/team*.test.ts',
    '**/auth/__tests__/team*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/api/routes/teams.ts',
    'src/services/email/teamEmails.ts',
    'src/features/emails/TeamInviteEmail.tsx',
    'src/auth/middleware.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 30000,
  maxWorkers: '50%',
  bail: false,
  verbose: true,
  detectOpenHandles: false,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};