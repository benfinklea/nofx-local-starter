import { test, expect } from '@playwright/test';

// Production URL
let PROD_URL = 'https://nofx-local-starter.vercel.app';

const TEST_USER = {
  email: 'ben+nofx1@volacci.com',
  password: 'dabgub-raCgu5-watrut'
};

test.describe('Run Detail and Execution Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Get latest deployment
    await page.goto(PROD_URL);
  });

  test('1. Login and click on first run to see details', async ({ page }) => {
    // Login
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    // Wait for runs page
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'run-test-1-runs-list.png', fullPage: true });

    console.log('Current URL:', page.url());

    // Find and click first run
    const firstRunLink = page.locator('a[href*="/runs/"]').first();
    const runHref = await firstRunLink.getAttribute('href');
    console.log('First run link:', runHref);

    await firstRunLink.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'run-test-1-run-detail.png', fullPage: true });

    // Check for error message
    const errorMessage = await page.locator('text=/The string did not match|Error|not found/i').count();
    console.log('Error messages found:', errorMessage);

    // Check for run details
    const hasRunId = await page.locator('text=/Run ID|ID:/i').count();
    const hasStatus = await page.locator('text=/Status|queued|running|completed/i').count();

    console.log('Has run ID:', hasRunId > 0 ? '✅' : '❌');
    console.log('Has status:', hasStatus > 0 ? '✅' : '❌');
    console.log('Has errors:', errorMessage > 0 ? '❌' : '✅');

    const pageText = await page.textContent('body');
    console.log('Page text (first 300 chars):', pageText?.substring(0, 300));
  });

  test('2. Create new run and watch it execute', async ({ page }) => {
    // Login
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);

    // Click New Run button
    const newRunButton = page.getByRole('button', { name: /new run/i });
    await newRunButton.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'run-test-2-new-run-form.png', fullPage: true });

    // Fill in run form
    const goalInput = page.getByLabel(/goal|prompt|task/i).first();
    await goalInput.fill('Write a haiku about testing');

    await page.screenshot({ path: 'run-test-2-new-run-filled.png', fullPage: true });

    // Submit
    const submitButton = page.locator('button[type="submit"]').or(page.getByRole('button', { name: /create|start|submit/i }));
    await submitButton.click();

    // Wait for redirect to run detail or runs list
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('After create URL:', currentUrl);

    await page.screenshot({ path: 'run-test-2-after-create.png', fullPage: true });

    // Check if run was created
    if (currentUrl.includes('/runs/')) {
      console.log('✅ Redirected to run detail page');

      // Wait and check for status changes
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'run-test-2-run-executing.png', fullPage: true });

      const pageText = await page.textContent('body');

      // Check for various statuses
      const hasQueued = pageText?.toLowerCase().includes('queued');
      const hasRunning = pageText?.toLowerCase().includes('running');
      const hasCompleted = pageText?.toLowerCase().includes('completed');
      const hasSteps = pageText?.toLowerCase().includes('step');

      console.log('Status found:');
      console.log('  Queued:', hasQueued ? '✅' : '❌');
      console.log('  Running:', hasRunning ? '✅' : '❌');
      console.log('  Completed:', hasCompleted ? '✅' : '❌');
      console.log('  Has steps:', hasSteps ? '✅' : '❌');

      // Wait longer to see execution
      await page.waitForTimeout(10000);
      await page.screenshot({ path: 'run-test-2-run-after-10s.png', fullPage: true });

      const updatedText = await page.textContent('body');
      console.log('After 10 seconds:', updatedText?.substring(0, 500));
    } else {
      console.log('❌ Did not redirect to run detail');
      const pageText = await page.textContent('body');
      console.log('Page text:', pageText?.substring(0, 500));
    }
  });

  test('3. Check console errors during run detail view', async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Login and navigate
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);

    // Click first run
    const firstRunLink = page.locator('a[href*="/runs/"]').first();
    await firstRunLink.click();
    await page.waitForTimeout(5000);

    console.log('=== CONSOLE ERRORS ===');
    if (consoleErrors.length === 0) {
      console.log('  ✅ No console errors!');
    } else {
      consoleErrors.forEach(err => console.log('  ❌', err));
    }

    console.log('=== NETWORK ERRORS ===');
    if (networkErrors.length === 0) {
      console.log('  ✅ No network errors!');
    } else {
      networkErrors.forEach(err => console.log('  ❌', err));
    }

    await page.screenshot({ path: 'run-test-3-errors.png', fullPage: true });
  });
});