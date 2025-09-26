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
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/api/routes/teams.ts',
    'src/services/email/teamEmails.ts',
    'src/features/emails/TeamInviteEmail.tsx',
    'src/auth/middleware.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/teams.setup.ts'],
  testTimeout: 30000,
  maxWorkers: '50%',
  bail: false,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  errorOnDeprecated: true,
};