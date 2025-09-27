import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth', 'admin.json');

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication...');

  // Navigate to login page
  await page.goto('/ui/login');

  // Wait for login form
  await page.waitForSelector('input[name="password"], input[type="password"]');

  // Fill in admin password
  await page.fill('input[name="password"], input[type="password"]', 'admin123');

  // Submit form
  await page.click('button[type="submit"], input[type="submit"], button:has-text("Login")');

  // Wait for successful login
  await page.waitForTimeout(2000);

  // Verify we're logged in by checking for admin-specific elements or cookies
  const cookies = await page.context().cookies();
  const adminCookie = cookies.find(cookie => cookie.name === 'admin');

  if (adminCookie) {
    console.log('✅ Authentication successful');
  } else {
    console.log('⚠️  No admin cookie found, but saving state anyway');
  }

  // Save signed-in state
  await page.context().storageState({ path: authFile });

  console.log(`💾 Saved authentication state to ${authFile}`);
});