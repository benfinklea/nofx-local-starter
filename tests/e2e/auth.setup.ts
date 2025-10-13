import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth', 'admin.json');

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication...');

  // In test/dev mode, use the /dev/login endpoint which auto-sets admin cookie
  await page.goto('/dev/login', { waitUntil: 'networkidle' });

  // Wait a moment for cookie to be set and redirects to complete
  await page.waitForTimeout(1000);

  // Verify we're logged in by checking for admin cookie
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