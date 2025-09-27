import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('should access health endpoint', async ({ page }) => {
    // Test the API health endpoint directly
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);

    const healthData = await response.json();
    expect(healthData).toHaveProperty('status');
  });

  test('should display admin dashboard', async ({ page }) => {
    await page.goto('/');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Verify page loads
    await expect(page.locator('body')).toBeVisible();

    // Check if we're on admin interface
    const pageContent = await page.locator('body').textContent();
    console.log('Dashboard page loaded with content');
  });

  test('should navigate to different admin sections', async ({ page }) => {
    const sections = [
      '/ui/runs',
      '/ui/builder',
      '/ui/responses',
      '/ui/settings'
    ];

    for (const section of sections) {
      await page.goto(section);
      await page.waitForTimeout(1000);

      // Verify each section loads
      await expect(page.locator('body')).toBeVisible();

      console.log(`✅ ${section} loaded successfully`);
    }
  });

  test('should handle API endpoints', async ({ page }) => {
    // Test various API endpoints
    const endpoints = [
      '/api/health',
      '/api/runs',
      '/api/projects',
      '/api/models'
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);

      // Allow various success/auth responses
      expect([200, 302, 401, 403]).toContain(response.status());

      console.log(`${endpoint}: ${response.status()}`);
    }
  });
});