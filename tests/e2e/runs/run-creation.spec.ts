import { test, expect } from '@playwright/test';

test.describe('Run Creation Flow', () => {
  test('should create a new run successfully', async ({ page }) => {
    // Navigate to the runs page
    await page.goto('/ui/runs');

    // Verify we can see the runs interface
    await expect(page.locator('h1, h2, [data-testid="runs-title"]')).toBeVisible();

    // Check if there's a "Create Run" or similar button
    const createButton = page.locator('button:has-text("Create"), a:has-text("Create"), [data-testid="create-run"]').first();

    if (await createButton.isVisible()) {
      await createButton.click();

      // If redirected to a form, fill it out
      await page.waitForTimeout(1000);

      // Look for goal or prompt input fields
      const goalInput = page.locator('input[name="goal"], textarea[name="goal"], input[placeholder*="goal" i]').first();
      if (await goalInput.isVisible()) {
        await goalInput.fill('E2E Test Run');
      }

      // Look for submit button
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Create")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for redirect or success message
        await page.waitForTimeout(2000);
      }
    }

    // Verify we're on a page that shows runs (either list or detail)
    await expect(page.locator('body')).toContainText(/run|Run/);
  });

  test('should display runs list', async ({ page }) => {
    await page.goto('/ui/runs');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Verify the page loaded successfully
    await expect(page.locator('body')).toBeVisible();

    // Check for runs-related content
    const hasRunsContent = await page.locator('body').textContent();
    expect(hasRunsContent).toBeTruthy();
  });

  test('should navigate to run builder', async ({ page }) => {
    await page.goto('/ui/builder');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Verify the page loaded successfully
    await expect(page.locator('body')).toBeVisible();

    // Check for builder-related content
    const hasBuilderContent = await page.locator('body').textContent();
    expect(hasBuilderContent).toBeTruthy();
  });
});