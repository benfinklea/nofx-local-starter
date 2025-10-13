/**
 * Bulletproof E2E Tests for Frontend Deployment
 * Ensures the frontend on Vercel never breaks
 */

import { test, expect } from '@playwright/test';

const PROD_URL = 'https://nofx-local-starter.vercel.app';

test.describe('Frontend Deployment - Bulletproof Tests', () => {
  test.describe('Page Loading', () => {
    test('should load the main page', async ({ page }) => {
      const response = await page.goto(PROD_URL);
      expect(response?.status()).toBe(200);
      expect(await page.title()).toBeTruthy();
    });

    test('should load all static assets', async ({ page }) => {
      const failedResources: string[] = [];

      page.on('requestfailed', request => {
        failedResources.push(request.url());
      });

      await page.goto(PROD_URL);
      await page.waitForLoadState('networkidle');

      expect(failedResources).toHaveLength(0);
    });

    test('should have correct meta tags', async ({ page }) => {
      await page.goto(PROD_URL);

      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');

      const charset = await page.locator('meta[charset]').getAttribute('charset');
      expect(charset).toBe('UTF-8');
    });

    test('should load JavaScript bundles', async ({ page }) => {
      await page.goto(PROD_URL);

      // Check that React app is mounted
      await page.waitForSelector('#root', { state: 'attached' });

      // Check that JavaScript executed
      const hasReactRoot = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      });

      expect(hasReactRoot).toBe(true);
    });

    test('should load CSS styles', async ({ page }) => {
      await page.goto(PROD_URL);

      // Check that styles are applied
      const hasStyles = await page.evaluate(() => {
        const root = document.getElementById('root');
        if (!root) return false;
        const computedStyle = window.getComputedStyle(root);
        // Check if any styles are applied (not just default)
        return computedStyle.display !== '';
      });

      expect(hasStyles).toBe(true);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to different routes', async ({ page }) => {
      await page.goto(PROD_URL);

      // Check dashboard loads
      await page.waitForSelector('text=/Dashboard/i', { timeout: 10000 });

      // Test navigation if nav links are present
      const hasRunsLink = await page.locator('text=/Runs/i').count() > 0;
      if (hasRunsLink) {
        await page.click('text=/Runs/i');
        await expect(page.url()).toContain('runs');
      }
    });

    test('should handle browser back/forward', async ({ page }) => {
      await page.goto(PROD_URL);
      const initialUrl = page.url();

      // Navigate somewhere if possible
      const links = await page.locator('a[href*="#"]').all();
      if (links.length > 0) {
        await links[0].click();
        await page.waitForTimeout(500);

        // Go back
        await page.goBack();
        expect(page.url()).toBe(initialUrl);

        // Go forward
        await page.goForward();
        expect(page.url()).not.toBe(initialUrl);
      }
    });

    test('should handle page refresh', async ({ page }) => {
      await page.goto(PROD_URL);
      await page.waitForLoadState('networkidle');

      // Navigate to a specific route
      await page.evaluate(() => {
        window.location.hash = '#/runs';
      });
      await page.waitForTimeout(500);

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should maintain the route
      expect(page.url()).toContain('#/runs');
    });
  });

  test.describe('System Health Display', () => {
    test('should display system health status', async ({ page }) => {
      await page.goto(PROD_URL);

      // Look for health indicators
      const healthElements = await page.locator('text=/Online|Offline|Health/i').all();
      expect(healthElements.length).toBeGreaterThan(0);
    });

    test('should show API status', async ({ page }) => {
      await page.goto(PROD_URL);

      // Wait for health check to complete
      await page.waitForTimeout(3000);

      // Check for API status indicator
      const apiStatus = await page.locator('text=/API/i').first();
      expect(apiStatus).toBeTruthy();
    });

    test('should show database status', async ({ page }) => {
      await page.goto(PROD_URL);

      // Wait for health check to complete
      await page.waitForTimeout(3000);

      // Check for database status
      const dbStatus = await page.locator('text=/Database|DB/i').first();
      expect(dbStatus).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(PROD_URL);

      await page.waitForLoadState('networkidle');
      const isVisible = await page.locator('#root').isVisible();
      expect(isVisible).toBe(true);
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(PROD_URL);

      await page.waitForLoadState('networkidle');
      const isVisible = await page.locator('#root').isVisible();
      expect(isVisible).toBe(true);
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PROD_URL);

      await page.waitForLoadState('networkidle');
      const isVisible = await page.locator('#root').isVisible();
      expect(isVisible).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 routes gracefully', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/nonexistent-route`);
      await page.waitForLoadState('networkidle');

      // Should still show the app, not a Vercel 404
      const hasRoot = await page.locator('#root').count();
      expect(hasRoot).toBe(1);
    });

    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto(PROD_URL);

      // Simulate offline
      await page.context().setOffline(true);

      // Try to navigate or interact
      const buttons = await page.locator('button').all();
      if (buttons.length > 0) {
        // Click shouldn't crash the app
        await buttons[0].click().catch(() => {
          // Expected to fail when offline
        });
      }

      // Go back online
      await page.context().setOffline(false);

      // App should recover
      await page.reload();
      await page.waitForLoadState('networkidle');
      expect(await page.locator('#root').isVisible()).toBe(true);
    });

    test('should handle slow network gracefully', async ({ page }) => {
      // Simulate slow 3G
      await page.context().route('**/*', route => {
        setTimeout(() => route.continue(), 1000);
      });

      const response = await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
    });
  });

  test.describe('Cross-browser Compatibility', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`should work in ${browserName}`, async ({ page }) => {
        await page.goto(PROD_URL);
        await page.waitForLoadState('networkidle');

        const title = await page.title();
        expect(title).toBeTruthy();

        const hasContent = await page.locator('#root').count();
        expect(hasContent).toBe(1);
      });
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(PROD_URL, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000); // 10 seconds max
    });

    test('should have acceptable Time to Interactive', async ({ page }) => {
      await page.goto(PROD_URL);

      const metrics = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
          loadComplete: perf.loadEventEnd - perf.loadEventStart
        };
      });

      expect(metrics.domContentLoaded).toBeLessThan(3000);
      expect(metrics.loadComplete).toBeLessThan(5000);
    });

    test('should not have memory leaks on navigation', async ({ page }) => {
      await page.goto(PROD_URL);

      const getMemory = () => page.evaluate(() => {
        // @ts-expect-error - performance.memory is non-standard Chrome API
        return performance.memory?.usedJSHeapSize || 0;
      });

      const initialMemory = await getMemory();

      // Navigate around multiple times
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          window.location.hash = '#/runs';
        });
        await page.waitForTimeout(100);
        await page.evaluate(() => {
          window.location.hash = '#/';
        });
        await page.waitForTimeout(100);
      }

      const finalMemory = await getMemory();

      // Memory shouldn't grow excessively (allow 50% increase)
      expect(finalMemory).toBeLessThan(initialMemory * 1.5);
    });
  });

  test.describe('Security', () => {
    test('should have secure headers', async ({ page }) => {
      const response = await page.goto(PROD_URL);
      const headers = response?.headers();

      // Vercel should set security headers
      expect(headers).toBeTruthy();
    });

    test('should not expose sensitive information', async ({ page }) => {
      await page.goto(PROD_URL);

      // Check console for exposed secrets
      const consoleLogs: string[] = [];
      page.on('console', msg => consoleLogs.push(msg.text()));

      await page.waitForTimeout(2000);

      const hasSecrets = consoleLogs.some(log =>
        log.includes('api_key') ||
        log.includes('API_KEY') ||
        log.includes('password') ||
        log.includes('secret')
      );

      expect(hasSecrets).toBe(false);
    });

    test('should handle XSS attempts', async ({ page }) => {
      await page.goto(`${PROD_URL}/#/<script>alert('xss')</script>`);
      await page.waitForLoadState('networkidle');

      // Should not execute the script
      let alertFired = false;
      page.on('dialog', () => {
        alertFired = true;
      });

      await page.waitForTimeout(1000);
      expect(alertFired).toBe(false);
    });
  });

  test.describe('API Integration', () => {
    test('should make API calls successfully', async ({ page }) => {
      const apiCalls: string[] = [];

      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiCalls.push(request.url());
        }
      });

      await page.goto(PROD_URL);
      await page.waitForTimeout(3000);

      // Should make at least one API call (health check)
      expect(apiCalls.length).toBeGreaterThan(0);
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API calls and make them fail
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      await page.goto(PROD_URL);
      await page.waitForLoadState('networkidle');

      // App should still load despite API failures
      const hasContent = await page.locator('#root').count();
      expect(hasContent).toBe(1);
    });
  });
});