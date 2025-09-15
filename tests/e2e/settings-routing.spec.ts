import { test, expect } from '@playwright/test';
import crypto from 'crypto';

function adminCookie(secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret'){
  const value = '1';
  const sig = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}|${sig}`;
}

test.describe('Settings routing UI', () => {
  test('shows model dropdowns and adds order entries', async ({ page, context }) => {
    // Attach admin cookie
    await context.addCookies([{ name: 'nofx_admin', value: adminCookie(), domain: 'localhost', path: '/' }]);

    await page.goto('http://localhost:3000/ui/settings');

    // Dropdowns (native select) should be present
    const docsSelect = page.locator('#docsSelect');
    const reasoningSelect = page.locator('#reasoningSelect');
    const codegenSelect = page.locator('#codegenSelect');
    await expect(docsSelect).toBeVisible();
    await expect(reasoningSelect).toBeVisible();
    await expect(codegenSelect).toBeVisible();

    // Ensure they have options loaded
    await expect(docsSelect.locator('option')).toHaveCount(1, { timeout: 1000 }).catch(async () => {
      const c = await docsSelect.locator('option').count();
      expect(c).toBeGreaterThan(0);
    });
    await expect(reasoningSelect.locator('option')).toHaveCount(1, { timeout: 1000 }).catch(async () => {
      const c = await reasoningSelect.locator('option').count();
      expect(c).toBeGreaterThan(0);
    });
    await expect(codegenSelect.locator('option')).toHaveCount(1, { timeout: 1000 }).catch(async () => {
      const c = await codegenSelect.locator('option').count();
      expect(c).toBeGreaterThan(0);
    });

    // Add one option to each
    const addDocs = page.locator("button:has-text('Add')").nth(0);
    const addReasoning = page.locator("button:has-text('Add')").nth(1);
    const addCodegen = page.locator("button:has-text('Add')").nth(2);

    await docsSelect.selectOption({ index: 0 });
    await addDocs.click();
    await reasoningSelect.selectOption({ index: 0 });
    await addReasoning.click();
    await codegenSelect.selectOption({ index: 0 });
    await addCodegen.click();

    // Lists should show at least one entry each
    const docsCount = await page.locator('#docsOrder li').count();
    const reasoningCount = await page.locator('#reasoningOrder li').count();
    const codegenCount = await page.locator('#codegenOrder li').count();
    expect(docsCount).toBeGreaterThan(0);
    expect(reasoningCount).toBeGreaterThan(0);
    expect(codegenCount).toBeGreaterThan(0);

    // Save
    await page.click('button:has-text("Save")');
    await expect(page.locator('#status')).toContainText('Saved');
  });
});
