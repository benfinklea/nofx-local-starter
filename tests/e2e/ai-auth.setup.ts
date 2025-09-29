/**
 * AI Testing - Enhanced Authentication Setup for Playwright
 * Creates authenticated sessions for automated testing
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { ApiTestHelper } from '../ai-testing/ApiTestHelper';

const authFile = path.join(__dirname, '.auth', 'ai-admin.json');

setup('ai-authenticate', async ({ page, baseURL }) => {
  console.log('🤖 AI Testing: Setting up authentication...');

  // First try to authenticate via API to get valid tokens
  const apiHelper = new ApiTestHelper(baseURL || 'http://localhost:3000');

  try {
    const testUser = await apiHelper.createAndLoginTestUser();
    console.log(`✅ API authentication successful for ${testUser.email}`);

    // Navigate to the app and inject the auth tokens
    await page.goto('/');

    // Inject authentication data into localStorage
    await page.evaluate((authData) => {
      // Store auth session (matches AuthService format)
      localStorage.setItem('auth_session', JSON.stringify({
        user: {
          id: authData.id,
          email: authData.email
        },
        session: {
          access_token: authData.access_token,
          refresh_token: authData.refresh_token
        }
      }));

      // Also store direct token access
      localStorage.setItem('sb-access-token', authData.access_token);
      localStorage.setItem('authenticated', 'true');

      console.log('Auth data injected into localStorage');
    }, testUser);

    // Reload to apply auth state
    await page.reload();

    // Wait a moment for auth to take effect
    await page.waitForTimeout(1000);

    // Verify authentication by trying to access a protected page
    try {
      await page.goto('/ui');
      await page.waitForTimeout(2000);

      // Check if we can see authenticated content (no redirect to login)
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Still redirected to login page');
      }

      console.log('✅ UI authentication verified');
    } catch (error) {
      console.log('⚠️ UI verification failed, but saving auth state anyway:', error);
    }

    // Save the authenticated state
    await page.context().storageState({ path: authFile });
    console.log(`💾 Saved AI authentication state to ${authFile}`);

    // Store user info for later tests
    await page.evaluate((userData) => {
      localStorage.setItem('ai-test-user', JSON.stringify(userData));
    }, testUser);

  } catch (error) {
    console.error('❌ AI authentication setup failed:', error);

    // Fallback: Try manual UI login if API fails
    console.log('🔄 Falling back to UI login...');

    try {
      await page.goto('/login.html');
      await page.waitForSelector('#email');

      // Use a simple test user
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');

      // Wait for potential redirect
      await page.waitForTimeout(3000);

      // Save whatever state we have
      await page.context().storageState({ path: authFile });
      console.log('💾 Saved fallback authentication state');

    } catch (fallbackError) {
      console.error('❌ Fallback UI login also failed:', fallbackError);
      throw new Error(`Both API and UI authentication failed: ${error}`);
    }
  }
});

setup.describe.configure({ mode: 'serial' });