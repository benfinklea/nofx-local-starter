import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const TEST_USER = {
  email: 'ben+nofx1@volacci.com',
  password: 'dabgub-raCgu5-watrut'
};

test('Quick login test', async ({ page }) => {
  await page.goto(BASE_URL);

  // Fill in credentials
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);

  // Submit
  await page.locator('button[type="submit"]').click();

  // Wait for success message
  await expect(page.getByText(/login successful|success/i)).toBeVisible({ timeout: 5000 });

  // Wait a bit for redirect
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'login-result.png', fullPage: true });

  console.log('Current URL:', page.url());
  console.log('Page title:', await page.title());

  // Check if we can see any app content (TopBar text, page content, etc.)
  const pageText = await page.textContent('body');
  console.log('Page contains NOFX:', pageText?.includes('NOFX'));
  console.log('Page contains logout:', pageText?.toLowerCase().includes('logout'));
});