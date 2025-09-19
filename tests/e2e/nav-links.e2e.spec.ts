import { test, expect } from '@playwright/test';

async function isUp(page: any, url: string) {
  try { const r = await page.request.get(url, { timeout: 2000 }); return r.ok(); } catch { return false; }
}

test('top bar FE nav links route inside app', async ({ page }) => {
  const base = process.env.PW_BASE_URL || 'http://localhost:5173';
  const up = await isUp(page, base + '/health').catch(()=>false);
  test.skip(!up, 'Dev server not running (5173). Run Start DB + NOFX.command');

  await page.goto('/dev/login?next=/ui/app/');
  await page.waitForURL('**/ui/app/**');

  // Runs
  await page.click('a:has-text("Runs")');
  await expect(page).toHaveURL(/.*\/ui\/app\/.*#\/runs/);

  // Models
  await page.click('a:has-text("Models")');
  await expect(page).toHaveURL(/.*\/ui\/app\/.*#\/models/);

  // Settings
  await page.click('a:has-text("Settings")');
  await expect(page).toHaveURL(/.*\/ui\/app\/.*#\/settings/);
});

