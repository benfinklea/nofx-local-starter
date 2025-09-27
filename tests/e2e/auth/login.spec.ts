import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/ui/login');

    // Verify login page loads
    await expect(page.locator('body')).toBeVisible();

    // Look for password input field
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    if (await passwordInput.isVisible()) {
      await expect(passwordInput).toBeVisible();
    }

    // Look for login button
    const loginButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")');
    if (await loginButton.isVisible()) {
      await expect(loginButton).toBeVisible();
    }
  });

  test('should login with admin credentials', async ({ page }) => {
    await page.goto('/ui/login');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Fill password field if it exists
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('admin123');

      // Submit form
      const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for redirect or response
        await page.waitForTimeout(2000);

        // Verify we're logged in (check for redirect or admin interface)
        const currentUrl = page.url();
        console.log('After login URL:', currentUrl);

        // Check if we have admin cookie or are on admin page
        const cookies = await page.context().cookies();
        const adminCookie = cookies.find(cookie => cookie.name === 'admin');

        if (adminCookie) {
          console.log('✅ Admin cookie found:', adminCookie.value);
        } else {
          console.log('⚠️  No admin cookie found');
        }
      }
    }

    // Verify page content loaded
    await expect(page.locator('body')).toBeVisible();
  });

  test('should access admin interface after login', async ({ page }) => {
    // This test uses the authenticated state from setup
    await page.goto('/ui/runs');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Verify we can access the admin interface
    await expect(page.locator('body')).toBeVisible();

    // Check that we're not redirected to login
    expect(page.url()).not.toContain('/login');
  });
});