/**
 * Playwright Configuration for Team E2E Tests
 * Comprehensive browser testing configuration
 */

import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  testMatch: '**/teams*.e2e.test.ts',

  // Maximum time one test can run
  timeout: 60000,

  // Test retries for flaky tests
  retries: process.env.CI ? 2 : 0,

  // Number of parallel workers
  workers: process.env.CI ? 2 : 4,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/teams-e2e' }],
    ['json', { outputFile: 'test-results/teams-e2e.json' }],
    ['junit', { outputFile: 'test-results/teams-e2e.xml' }],
    ['list'],
  ],

  use: {
    // Base URL for tests
    baseURL: process.env.APP_URL || 'https://nofx-control-plane.vercel.app',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Timeout for each action
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
    },

    // Test with different network conditions
    {
      name: 'slow-network',
      use: {
        ...devices['Desktop Chrome'],
        offline: false,
        downloadThroughput: 50 * 1024, // 50kb/s
        uploadThroughput: 20 * 1024,   // 20kb/s
        latency: 500, // 500ms latency
      },
    },

    // Test with different locales
    {
      name: 'locale-es',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'es-ES',
        timezoneId: 'Europe/Madrid',
      },
    },
    {
      name: 'locale-jp',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
      },
    },
  ],

  // Global setup/teardown
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  // Output folder for test artifacts
  outputDir: 'test-results',

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Preserve test output on CI
  preserveOutput: process.env.CI ? 'failures-only' : 'always',

  // Screenshot options
  expect: {
    // Maximum time expect() should wait
    timeout: 10000,

    toHaveScreenshot: {
      // Threshold for pixel differences
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },

  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: true,
  },
};

export default config;