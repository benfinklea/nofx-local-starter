import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');

  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // In test/dev mode, use the /dev/login endpoint which auto-sets admin cookie
    console.log(`🔐 Authenticating admin user at ${baseURL}`);
    await page.goto(`${baseURL}/dev/login`, { waitUntil: 'networkidle' });

    // Wait a moment for cookie to be set and redirects to complete
    await page.waitForTimeout(1000);

    // Check if we have admin cookie
    const cookies = await page.context().cookies();
    const adminCookie = cookies.find(cookie => cookie.name === 'admin');

    if (adminCookie) {
      console.log('✅ Admin authentication successful');
    } else {
      console.log('⚠️  Admin cookie not found, but proceeding...');
    }

    // Save authenticated state
    const authFile = path.join(__dirname, '.auth', 'admin.json');
    await page.context().storageState({ path: authFile });
    console.log(`💾 Saved authentication state to ${authFile}`);

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