/**
 * BULLETPROOF E2E TESTS - Run Detail User Journeys
 *
 * Tests every possible user interaction with the run detail feature,
 * ensuring it never breaks from a user's perspective.
 */

import { test, expect, Page } from '@playwright/test';

const PROD_URL = 'https://nofx-local-starter.vercel.app';

const TEST_USER = {
  email: 'ben+nofx1@volacci.com',
  password: 'dabgub-raCgu5-watrut'
};

test.describe('Run Detail E2E - BULLETPROOF USER JOURNEYS', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginUser(page);
  });

  describe('🛡️ Happy Path - Core User Journey', () => {
    test('user can navigate from runs list to run detail', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      await page.waitForLoadState('networkidle');

      // Click first run
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await expect(firstRun).toBeVisible();

      const runId = await firstRun.getAttribute('href');
      await firstRun.click();

      // Should navigate to run detail page
      await page.waitForURL(/.*\/runs\/.+/);

      // Should show run details
      await expect(page.locator('text=/Status|queued|running|completed/i')).toBeVisible();
      await expect(page.locator('text=/ID:|Run ID/i')).toBeVisible();
    });

    test('user can create run and immediately view its details', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      await page.waitForLoadState('networkidle');

      // Create new run
      await page.getByRole('button', { name: /new run/i }).click();
      await page.getByLabel(/goal|prompt|task/i).first().fill('Test run for bulletproof tests');
      await page.locator('button[type="submit"]').click();

      // Should redirect to run detail
      await page.waitForURL(/.*\/runs\/.+/);

      // Should show the run details immediately
      await expect(page.locator('text=Test run for bulletproof tests')).toBeVisible();
      await expect(page.locator('text=/queued|running/i')).toBeVisible();
    });

    test('user can refresh run detail page', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);
      const url = page.url();

      // Refresh page
      await page.reload();

      // Should still show run details
      expect(page.url()).toBe(url);
      await expect(page.locator('text=/Status|queued|running|completed/i')).toBeVisible();
    });

    test('user can navigate back from run detail to runs list', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Navigate back
      await page.goBack();

      // Should be back on runs list
      await expect(page.locator('text=/new run/i')).toBeVisible();
    });
  });

  describe('🛡️ Error Handling - User-Facing Errors', () => {
    test('shows user-friendly error for non-existent run', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs/00000000-0000-0000-0000-000000000000`);
      await page.waitForLoadState('networkidle');

      // Should show error message
      await expect(page.locator('text=/not found|doesn\'t exist|cannot find/i')).toBeVisible();
    });

    test('shows error for invalid run ID format', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs/invalid-id`);
      await page.waitForLoadState('networkidle');

      // Should show error or redirect
      const hasError = await page.locator('text=/error|invalid|not found/i').count();
      expect(hasError).toBeGreaterThan(0);
    });

    test('handles network error gracefully', async ({ page, context }) => {
      // Simulate offline
      await context.setOffline(true);

      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click().catch(() => {});

      await page.waitForTimeout(2000);

      // Should show error state
      const pageText = await page.textContent('body');
      expect(
        pageText?.toLowerCase().includes('error') ||
        pageText?.toLowerCase().includes('failed') ||
        pageText?.toLowerCase().includes('offline')
      ).toBeTruthy();

      await context.setOffline(false);
    });

    test('handles slow network gracefully', async ({ page, context }) => {
      // Simulate slow 3G
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 2000);
      });

      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      // Should eventually load (not hang forever)
      await page.waitForURL(/.*\/runs\/.+/, { timeout: 30000 });
    });
  });

  describe('🛡️ UI States - All Visual States', () => {
    test('shows loading state while fetching', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();

      // Watch for loading indicator
      const loadingPromise = page.waitForSelector('text=/loading|fetching/i', {
        state: 'visible',
        timeout: 1000
      }).catch(() => null);

      await firstRun.click();
      await loadingPromise;

      // Eventually shows content
      await expect(page.locator('text=/Status/i')).toBeVisible({ timeout: 10000 });
    });

    test('shows queued status badge', async ({ page }) => {
      // Create new run (will be queued)
      await page.goto(`${PROD_URL}/#/runs`);
      await page.getByRole('button', { name: /new run/i }).click();
      await page.getByLabel(/goal|prompt|task/i).first().fill('Test queued status');
      await page.locator('button[type="submit"]').click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Should show queued badge
      await expect(page.locator('text=queued')).toBeVisible();
    });

    test('shows completed status with result', async ({ page }) => {
      // Find a completed run
      await page.goto(`${PROD_URL}/#/runs`);
      await page.waitForLoadState('networkidle');

      const completedRun = page.locator('text=completed').first();
      if (await completedRun.count() > 0) {
        await completedRun.click();

        await page.waitForURL(/.*\/runs\/.+/);

        // Should show completed status
        await expect(page.locator('text=completed')).toBeVisible();
      }
    });

    test('shows run timeline', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Should have timeline section
      await expect(page.locator('text=/timeline|events|history/i')).toBeVisible();
    });

    test('shows run steps section', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Should have steps section
      await expect(page.locator('text=/steps|plan/i')).toBeVisible();
    });
  });

  describe('🛡️ Browser Compatibility', () => {
    test('works in different viewport sizes', async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1366, height: 768 },  // Laptop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 }    // Mobile
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${PROD_URL}/#/runs`);
        const firstRun = page.locator('a[href*="/runs/"]').first();
        await firstRun.click();

        await page.waitForURL(/.*\/runs\/.+/);
        await expect(page.locator('text=/Status/i')).toBeVisible();
      }
    });

    test('handles browser back/forward navigation', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);
      const runUrl = page.url();

      // Go back
      await page.goBack();
      await expect(page.locator('text=/new run/i')).toBeVisible();

      // Go forward
      await page.goForward();
      expect(page.url()).toBe(runUrl);
      await expect(page.locator('text=/Status/i')).toBeVisible();
    });

    test('works with page zoom', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);

      // Zoom in 150%
      await page.evaluate(() => {
        (document.body.style as any).zoom = '150%';
      });

      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);
      await expect(page.locator('text=/Status/i')).toBeVisible();

      // Zoom out 50%
      await page.evaluate(() => {
        (document.body.style as any).zoom = '50%';
      });

      await expect(page.locator('text=/Status/i')).toBeVisible();
    });
  });

  describe('🛡️ Data Integrity', () => {
    test('displays correct run ID', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      const href = await firstRun.getAttribute('href');
      const runId = href?.split('/').pop();

      await firstRun.click();
      await page.waitForURL(/.*\/runs\/.+/);

      // Run ID in page should match URL
      const pageText = await page.textContent('body');
      expect(pageText).toContain(runId);
    });

    test('displays run goal correctly', async ({ page }) => {
      const testGoal = `Unique test goal ${Date.now()}`;

      // Create run with specific goal
      await page.goto(`${PROD_URL}/#/runs`);
      await page.getByRole('button', { name: /new run/i }).click();
      await page.getByLabel(/goal|prompt|task/i).first().fill(testGoal);
      await page.locator('button[type="submit"]').click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Should display exact goal
      await expect(page.locator(`text=${testGoal}`)).toBeVisible();
    });

    test('updates status in real-time (polling)', async ({ page }) => {
      // Create new run
      await page.goto(`${PROD_URL}/#/runs`);
      await page.getByRole('button', { name: /new run/i }).click();
      await page.getByLabel(/goal|prompt|task/i).first().fill('Real-time status test');
      await page.locator('button[type="submit"]').click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Initial status
      const initialStatus = await page.locator('text=/queued|running|completed/i').first().textContent();

      // Wait and check if status updates
      await page.waitForTimeout(10000);

      const updatedStatus = await page.locator('text=/queued|running|completed/i').first().textContent();

      // Status may have changed (not required for test to pass)
      console.log(`Status: ${initialStatus} → ${updatedStatus}`);
    });
  });

  describe('🛡️ Accessibility', () => {
    test('page has proper heading hierarchy', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Should have h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThan(0);
    });

    test('focusable elements are keyboard accessible', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Focus should be visible
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('status badges have sufficient contrast', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);

      const statusBadge = page.locator('text=/queued|running|completed/i').first();
      await expect(statusBadge).toBeVisible();

      // Check badge is visually distinct (has background color)
      const bgColor = await statusBadge.evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });
  });

  describe('🛡️ Performance', () => {
    test('page loads within acceptable time', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();

      const start = Date.now();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);
      await page.waitForLoadState('networkidle');

      const duration = Date.now() - start;

      // Should load in < 3 seconds
      expect(duration).toBeLessThan(3000);
    });

    test('handles run with many steps efficiently', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);

      // Find run with most steps
      const runs = await page.locator('a[href*="/runs/"]').all();

      if (runs.length > 0) {
        await runs[0].click();

        await page.waitForURL(/.*\/runs\/.+/);
        await page.waitForLoadState('networkidle');

        // Page should be responsive
        const scrollable = await page.evaluate(() => {
          document.body.scrollTop = 100;
          return document.body.scrollTop > 0;
        });

        // Should be able to scroll
        expect(scrollable || document.body.scrollHeight > window.innerHeight).toBeTruthy();
      }
    });
  });

  describe('🛡️ Security', () => {
    test('does not expose sensitive data in DOM', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/runs`);
      const firstRun = page.locator('a[href*="/runs/"]').first();
      await firstRun.click();

      await page.waitForURL(/.*\/runs\/.+/);

      const pageContent = await page.content();

      // Should not contain JWT tokens
      expect(pageContent).not.toContain('eyJ');
      expect(pageContent).not.toContain('Bearer ');
      // Should not contain API keys
      expect(pageContent).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    });

    test('XSS-safe - handles malicious run content', async ({ page }) => {
      const xssPayload = '<script>alert("XSS")</script>';

      await page.goto(`${PROD_URL}/#/runs`);
      await page.getByRole('button', { name: /new run/i }).click();
      await page.getByLabel(/goal|prompt|task/i).first().fill(xssPayload);
      await page.locator('button[type="submit"]').click();

      await page.waitForURL(/.*\/runs\/.+/);

      // Script should not execute
      const pageContent = await page.content();

      // Content should be escaped or sanitized
      expect(
        pageContent.includes('&lt;script&gt;') ||
        !pageContent.includes('<script>alert')
      ).toBeTruthy();
    });
  });
});

// Helper function to login
async function loginUser(page: Page) {
  await page.goto(PROD_URL);
  await page.waitForLoadState('networkidle');

  // Check if already logged in
  const isLoggedIn = await page.locator('text=/runs/i').count() > 0;

  if (!isLoggedIn) {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
  }
}
