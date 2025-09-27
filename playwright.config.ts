import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Global test timeout
  timeout: 60_000,

  // Expect timeout for assertions
  expect: {
    timeout: 10_000
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    // Add JUnit reporter for CI integration
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }]] : [])
  ],

  // Global test configuration
  use: {
    // Base URL for tests
    baseURL: process.env.PW_BASE_URL || process.env.NODE_ENV === 'production'
      ? 'https://nofx-control-plane.vercel.app'
      : 'http://localhost:3000',

    // Browser settings
    headless: !!process.env.CI,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Record video on failure
    video: 'retain-on-failure',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Default timeouts
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: !process.env.CI,

    // Browser context options
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  },

  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

  // Test projects for different browsers
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },

    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Chrome tests
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use prepared auth state
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Firefox tests
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // WebKit tests (Safari)
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'test',
      RESPONSES_RUNTIME_MODE: 'stub',
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-results/',

  // Test metadata
  metadata: {
    'test-environment': process.env.NODE_ENV || 'development',
    'base-url': process.env.PW_BASE_URL || 'http://localhost:3000',
    'browser-versions': 'Chrome, Firefox, Safari',
  },
});

