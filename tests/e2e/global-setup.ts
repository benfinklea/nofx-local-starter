import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');

  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to login page
    console.log(`🔐 Authenticating admin user at ${baseURL}`);
    await page.goto(`${baseURL}/ui/login`);

    // Wait for login form to be available
    await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 30000 });

    // Fill password (using default admin password)
    await page.fill('input[name="password"], input[type="password"]', 'admin123');

    // Submit form
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Login")');

    // Wait for successful login (redirect or success indicator)
    await page.waitForTimeout(2000);

    // Check if we have admin cookie
    const cookies = await page.context().cookies();
    const adminCookie = cookies.find(cookie => cookie.name === 'admin');

    if (adminCookie) {
      console.log('✅ Admin authentication successful');

      // Save authenticated state
      const authFile = path.join(__dirname, '.auth', 'admin.json');
      await page.context().storageState({ path: authFile });
      console.log(`💾 Saved authentication state to ${authFile}`);
    } else {
      console.log('⚠️  Admin cookie not found, but proceeding...');
      // Save state anyway for tests that don't require authentication
      const authFile = path.join(__dirname, '.auth', 'admin.json');
      await page.context().storageState({ path: authFile });
    }

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    // Don't throw - some tests might still work without authentication
    console.log('⚠️  Continuing without authentication...');

    // Save empty state
    const authFile = path.join(__dirname, '.auth', 'admin.json');
    await page.context().storageState({ path: authFile });
  } finally {
    await browser.close();
  }

  console.log('✅ Playwright global setup completed');
}

export default globalSetup;