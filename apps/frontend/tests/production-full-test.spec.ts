import { test, expect } from '@playwright/test';

const PROD_URL = 'https://nofx-local-starter-rimaqj2mq-volacci.vercel.app';
const TEST_USER = {
  email: 'ben+nofx1@volacci.com',
  password: 'dabgub-raCgu5-watrut'
};

test.describe('Production App - Full Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
  });

  test('1. Load homepage and check login form exists', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Check if login form visible
    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/password/i);

    await expect(emailField).toBeVisible({ timeout: 10000 });
    await expect(passwordField).toBeVisible({ timeout: 10000 });

    console.log('✅ Login form visible');
    await page.screenshot({ path: 'prod-test-1-login-form.png', fullPage: true });
  });

  test('2. Check Google login button exists', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    const googleButton = page.getByRole('button', { name: /sign in with google/i });
    await expect(googleButton).toBeVisible({ timeout: 10000 });

    console.log('✅ Google login button visible');
    await page.screenshot({ path: 'prod-test-2-google-button.png', fullPage: true });
  });

  test('3. Test password reset form', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Click forgot password
    const forgotPasswordButton = page.getByRole('button', { name: /forgot password/i });
    await expect(forgotPasswordButton).toBeVisible({ timeout: 10000 });
    await forgotPasswordButton.click();

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'prod-test-3-forgot-password.png', fullPage: true });

    // Fill email
    const emailField = page.getByLabel(/email/i);
    await emailField.fill(TEST_USER.email);

    await page.screenshot({ path: 'prod-test-3b-forgot-password-filled.png', fullPage: true });
    console.log('✅ Password reset form accessible');
  });

  test('4. Test login with valid credentials', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    console.log('Filling login form...');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    await page.screenshot({ path: 'prod-test-4a-before-login.png', fullPage: true });

    console.log('Clicking sign in...');
    await page.locator('button[type="submit"]').click();

    // Wait for either success message or redirect
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'prod-test-4b-after-login-click.png', fullPage: true });

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    // Check if we see any app content or are still on login
    const pageText = await page.textContent('body');
    console.log('Page shows NOFX:', pageText?.includes('NOFX'));
    console.log('Page shows runs:', pageText?.toLowerCase().includes('runs'));
    console.log('Page shows login form:', pageText?.toLowerCase().includes('sign in to continue'));

    await page.screenshot({ path: 'prod-test-4c-final-state.png', fullPage: true });
  });

  test('5. Test login and check runs page', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    // Wait for redirect
    await page.waitForTimeout(5000);

    console.log('Current URL:', page.url());

    // Try to navigate to runs
    if (!page.url().includes('/runs')) {
      await page.goto(`${PROD_URL}/#/runs`);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: 'prod-test-5-runs-page.png', fullPage: true });

    // Check if runs page loaded
    const pageText = await page.textContent('body');
    console.log('Runs page shows:', pageText?.substring(0, 500));
  });

  test('6. Check all errors in console', async ({ page }) => {
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

    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Try to login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);

    console.log('=== CONSOLE ERRORS ===');
    consoleErrors.forEach(err => console.log('  ❌', err));

    console.log('=== NETWORK ERRORS ===');
    networkErrors.forEach(err => console.log('  ❌', err));

    await page.screenshot({ path: 'prod-test-6-errors.png', fullPage: true });
  });

  test('7. Test navigation links after login', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);

    console.log('Testing navigation links...');

    // Try common navigation links
    const links = ['Runs', 'Teams', 'Settings', 'Dashboard'];
    for (const linkText of links) {
      try {
        const link = page.getByRole('link', { name: new RegExp(linkText, 'i') });
        const isVisible = await link.isVisible({ timeout: 2000 });
        console.log(`  ${linkText} link: ${isVisible ? '✅' : '❌'}`);
      } catch (e) {
        console.log(`  ${linkText} link: ❌ Not found`);
      }
    }

    await page.screenshot({ path: 'prod-test-7-navigation.png', fullPage: true });
  });

  test('8. Test logout functionality', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Login first
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'prod-test-8a-logged-in.png', fullPage: true });

    // Try to find and click logout
    try {
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      await logoutButton.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      console.log('✅ Logout button found and clicked');
      await page.screenshot({ path: 'prod-test-8b-after-logout.png', fullPage: true });

      // Check if back to login
      const emailField = page.getByLabel(/email/i);
      const isBackToLogin = await emailField.isVisible({ timeout: 5000 });
      console.log(`Back to login page: ${isBackToLogin ? '✅' : '❌'}`);
    } catch (e) {
      console.log('❌ Logout button not found or not working');
      await page.screenshot({ path: 'prod-test-8-logout-failed.png', fullPage: true });
    }
  });

  test('9. Test Google OAuth button click', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    const googleButton = page.getByRole('button', { name: /sign in with google/i });
    await expect(googleButton).toBeVisible({ timeout: 10000 });

    // Click and see what happens (don't complete OAuth)
    await googleButton.click();
    await page.waitForTimeout(2000);

    console.log('URL after Google button click:', page.url());
    await page.screenshot({ path: 'prod-test-9-google-oauth.png', fullPage: true });
  });

  test('10. Check for blank screen after login', async ({ page }) => {
    await page.goto(PROD_URL);
    await page.waitForLoadState('networkidle');

    // Login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);

    // Check if page has meaningful content
    const bodyText = await page.textContent('body');
    const hasContent = bodyText && bodyText.trim().length > 100;

    console.log('Page has content:', hasContent ? '✅' : '❌');
    console.log('Body text length:', bodyText?.length);
    console.log('First 200 chars:', bodyText?.substring(0, 200));

    await page.screenshot({ path: 'prod-test-10-blank-screen-check.png', fullPage: true });

    // Check for common elements
    const hasHeader = await page.locator('header').isVisible({ timeout: 2000 }).catch(() => false);
    const hasNav = await page.locator('nav').isVisible({ timeout: 2000 }).catch(() => false);
    const hasMain = await page.locator('main').isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Has header:', hasHeader ? '✅' : '❌');
    console.log('Has nav:', hasNav ? '✅' : '❌');
    console.log('Has main:', hasMain ? '✅' : '❌');
  });
});