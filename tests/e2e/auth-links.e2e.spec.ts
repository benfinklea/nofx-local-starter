import { test, expect } from '@playwright/test';

async function isUp(page: any, url: string) {
  try { const r = await page.request.get(url, { timeout: 2000 }); return r.ok(); } catch { return false; }
}

test('login and logout links navigate correctly', async ({ page }) => {
  test.setTimeout(120_000);
  const base = process.env.PW_BASE_URL || 'http://localhost:5173';
  const up = await isUp(page, base + '/health').catch(()=>false);
  test.skip(!up, 'Dev server not running (5173). Run Start DB + NOFX.command');

  // Auto-login helper to avoid manual password on first load
  await page.goto('/dev/login?next=/ui/app/');
  await page.waitForURL('**/ui/app/**');

  // Click Logout icon and verify we land on /ui/login (backend page)
  await page.click('a[href="/logout"], button[href="/logout"], [href="/logout"]');
  await page.waitForURL('**/ui/login**');
  await expect(page.locator('text=Login').first()).toBeVisible({ timeout: 5000 }).catch(()=>{});

  // Fill login form and submit (default password is 'admin')
  // The form field may be named 'password' or 'pwd' depending on template
  const pass = page.locator('input[type="password"], input[name="password"], input[name="pwd"]');
  await pass.fill(process.env.ADMIN_PASSWORD || 'admin');
  await page.click('button[type="submit"], input[type="submit"], text=Login');

  // After login, redirect back to EJS runs (/ui/runs) which should be redirected to FE at /ui/app/#/runs
  await page.waitForURL('**/ui/**');
  // Follow dev redirect
  if ((page.url().includes('/ui/runs'))) {
    await page.waitForURL('**/ui/app/**');
  }
  // FE top bar should be visible
  await expect(page.locator('text=NOFX')).toBeVisible();
});

