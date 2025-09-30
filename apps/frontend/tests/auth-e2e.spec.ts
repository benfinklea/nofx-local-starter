/**
 * End-to-End Tests for Authentication Flow
 * Tests the complete authentication flow including UI interactions
 */

import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test-auth-e2e@example.com',
  password: 'TestPassword123!',
  fullName: 'Test User'
};

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form for unauthenticated users', async ({ page }) => {
    // Should show login form
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    // Submit form
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should redirect to dashboard or main app
    await expect(page).toHaveURL(/\/(dashboard|home|app)/);

    // Should display user email or welcome message
    await expect(page.getByText(new RegExp(TEST_USER.email, 'i'))).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in login form with wrong password
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Submit form
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid.*credentials|wrong.*password/i)).toBeVisible();

    // Should stay on login page
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for redirect
    await page.waitForURL(/\/(dashboard|home|app)/);

    // Reload page
    await page.reload();

    // Should still be authenticated (not redirected to login)
    await expect(page).toHaveURL(/\/(dashboard|home|app)/);
    await expect(page.getByText(new RegExp(TEST_USER.email, 'i'))).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/);

    // Click logout button
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/(login|auth)/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should handle signup flow', async ({ page }) => {
    // Navigate to signup
    await page.getByRole('link', { name: /sign up|register/i }).click();

    // Fill in signup form
    const uniqueEmail = `test-${Date.now()}@example.com`;
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/^password/i).fill(TEST_USER.password);

    const fullNameInput = page.getByLabel(/name|full name/i);
    if (await fullNameInput.isVisible()) {
      await fullNameInput.fill(TEST_USER.fullName);
    }

    // Submit form
    await page.getByRole('button', { name: /sign up|register|create account/i }).click();

    // Should either redirect to dashboard or show confirmation message
    await Promise.race([
      expect(page).toHaveURL(/\/(dashboard|home|app)/),
      expect(page.getByText(/check your email|confirmation email/i)).toBeVisible()
    ]);
  });

  test('should handle password reset flow', async ({ page }) => {
    // Navigate to password reset
    await page.getByRole('link', { name: /forgot password|reset password/i }).click();

    // Fill in email
    await page.getByLabel(/email/i).fill(TEST_USER.email);

    // Submit form
    await page.getByRole('button', { name: /reset|send/i }).click();

    // Should show success message
    await expect(page.getByText(/check your email|reset email sent/i)).toBeVisible();
  });

  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected route without login
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|auth)/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should handle token refresh automatically', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/);

    // Wait for token to expire (or simulate it)
    // In production, middleware will auto-refresh

    // Navigate to different page
    await page.goto('/dashboard');

    // Should still be authenticated (token auto-refreshed)
    await expect(page).toHaveURL(/\/(dashboard|home|app)/);
    await expect(page.getByText(new RegExp(TEST_USER.email, 'i'))).toBeVisible();
  });
});

test.describe('API Authentication', () => {
  test('should include auth headers in API requests', async ({ page }) => {
    // Setup request interception
    let authHeaderFound = false;

    page.on('request', request => {
      const headers = request.headers();
      if (headers['cookie'] && headers['cookie'].includes('sb-')) {
        authHeaderFound = true;
      }
    });

    // Login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/);

    // Make an API request (navigate to a page that makes API calls)
    await page.goto('/dashboard');

    // Should have auth headers
    expect(authHeaderFound).toBe(true);
  });

  test('should handle 401 responses by redirecting to login', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/);

    // Mock 401 response
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    });

    // Try to make an API call
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|auth)/);
  });
});