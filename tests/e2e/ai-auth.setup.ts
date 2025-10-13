/**
 * AI Testing - Enhanced Authentication Setup for Playwright
 * Creates authenticated sessions for automated testing
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { ApiTestHelper } from '../ai-testing/ApiTestHelper';

const authFile = path.join(__dirname, '.auth', 'ai-admin.json');

setup('ai-authenticate', async ({ page }) => {
  console.log('🤖 AI Testing: Setting up authentication...');

  // For now, use the simple dev login approach
  // TODO: Implement proper API authentication when auth-v2 endpoints are available
  await page.goto('/dev/login', { waitUntil: 'networkidle' });

  // Wait a moment for cookie to be set and redirects to complete
  await page.waitForTimeout(1000);

  // Verify we're logged in by checking for admin cookie
  const cookies = await page.context().cookies();
  const adminCookie = cookies.find(cookie => cookie.name === 'admin');

  if (adminCookie) {
    console.log('✅ AI authentication successful');
  } else {
    console.log('⚠️  No admin cookie found, but saving state anyway');
  }

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
  console.log(`💾 Saved AI authentication state to ${authFile}`);
});

setup.describe.configure({ mode: 'serial' });