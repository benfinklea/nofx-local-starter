import { test, expect } from '@playwright/test';

test.describe('Navigation Links Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Check if we need to login first
    const loginForm = await page.locator('form').first();
    if (await loginForm.isVisible()) {
      console.log('Login form detected, attempting login...');

      // Fill in test credentials (adjust as needed)
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'testpassword');
      await page.click('button[type="submit"]');

      // Wait for navigation after login
      await page.waitForURL('**/runs', { timeout: 10000 });
    }
  });

  test('should test all main navigation links', async ({ page }) => {
    // Wait for the main application to load
    await page.waitForSelector('[data-testid="app-shell"], nav, header', { timeout: 15000 });

    const navigationLinks = [
      { path: '/#/', name: 'Dashboard' },
      { path: '/#/runs', name: 'Runs' },
      { path: '/#/runs/new', name: 'New Run' },
      { path: '/#/models', name: 'Models' },
      { path: '/#/projects', name: 'Projects' },
      { path: '/#/settings', name: 'Settings' },
      { path: '/#/dlq', name: 'DLQ' },
      { path: '/#/builder', name: 'Builder' },
      { path: '/#/dev', name: 'Dev Links' },
      { path: '/#/dev/tools', name: 'Dev Tools' },
      { path: '/#/dev/navigation', name: 'Navigation Console' }
    ];

    for (const link of navigationLinks) {
      console.log(`Testing navigation to: ${link.name} (${link.path})`);

      try {
        // Navigate to the path
        await page.goto(link.path, { waitUntil: 'networkidle', timeout: 10000 });

        // Wait a moment for the page to render
        await page.waitForTimeout(1000);

        // Take a screenshot for debugging
        await page.screenshot({ path: `test-results/${link.name.replace(/[^a-zA-Z0-9]/g, '-')}.png` });

        // Check if we got an error or 404
        const errorText = await page.textContent('body');
        const hasError = errorText?.includes('404') ||
                        errorText?.includes('Error') ||
                        errorText?.includes('Not Found') ||
                        errorText?.includes('Something went wrong');

        if (hasError) {
          console.error(`❌ Error found on ${link.name}: Page contains error content`);
        } else {
          console.log(`✅ ${link.name} loaded successfully`);
        }

        // Verify the page actually changed (URL should match)
        const currentURL = page.url();
        expect(currentURL).toContain(link.path.replace('/#', ''));

      } catch (error) {
        console.error(`❌ Failed to navigate to ${link.name}: ${error}`);
        throw error;
      }
    }
  });

  test('should test conditional responses navigation', async ({ page }) => {
    // Wait for the main application to load
    await page.waitForSelector('[data-testid="app-shell"], nav, header', { timeout: 15000 });

    // Test responses routes (only if uiFlags.responses is true)
    const responsesLinks = [
      { path: '/#/responses', name: 'Responses Dashboard' },
      { path: '/#/responses/test-id', name: 'Responses Run Detail' }
    ];

    for (const link of responsesLinks) {
      console.log(`Testing conditional navigation to: ${link.name} (${link.path})`);

      try {
        await page.goto(link.path, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(1000);

        // Take a screenshot
        await page.screenshot({ path: `test-results/${link.name.replace(/[^a-zA-Z0-9]/g, '-')}.png` });

        const currentURL = page.url();
        const errorText = await page.textContent('body');

        // If responses feature is disabled, we might get redirected or see an error
        // That's okay - we just want to make sure the route doesn't crash the app
        if (errorText?.includes('404') || errorText?.includes('Not Found')) {
          console.log(`ℹ️  ${link.name} - Route not available (likely feature flag disabled)`);
        } else {
          console.log(`✅ ${link.name} handled properly`);
        }

      } catch (error) {
        console.error(`❌ Failed to test ${link.name}: ${error}`);
      }
    }
  });

  test('should find and test actual navigation elements', async ({ page }) => {
    // Wait for the main application to load
    await page.waitForSelector('[data-testid="app-shell"], nav, header', { timeout: 15000 });

    // Look for common navigation patterns
    const navSelectors = [
      'nav a',
      '[role="navigation"] a',
      'header a',
      '.nav-link',
      '.navigation a',
      'aside a',
      '[data-testid*="nav"] a',
      'ul li a'
    ];

    let foundNavLinks = [];

    for (const selector of navSelectors) {
      const links = await page.locator(selector).all();
      if (links.length > 0) {
        console.log(`Found ${links.length} navigation links with selector: ${selector}`);

        for (let i = 0; i < links.length; i++) {
          try {
            const href = await links[i].getAttribute('href');
            const text = await links[i].textContent();

            if (href && text && !foundNavLinks.some(l => l.href === href)) {
              foundNavLinks.push({ href, text: text.trim(), selector });
            }
          } catch (e) {
            // Skip if we can't get attributes
          }
        }
      }
    }

    console.log(`Found ${foundNavLinks.length} unique navigation links:`);
    foundNavLinks.forEach(link => {
      console.log(`  - "${link.text}" -> ${link.href}`);
    });

    // Test each found navigation link
    for (const link of foundNavLinks.slice(0, 10)) { // Limit to first 10 to avoid timeout
      if (link.href.startsWith('#') || link.href.startsWith('/')) {
        console.log(`Testing actual nav link: "${link.text}" -> ${link.href}`);

        try {
          await page.goto(link.href.startsWith('#') ? link.href : `/#${link.href}`, {
            waitUntil: 'networkidle',
            timeout: 10000
          });

          await page.waitForTimeout(1000);

          const errorText = await page.textContent('body');
          const hasError = errorText?.includes('404') ||
                          errorText?.includes('Error') ||
                          errorText?.includes('Not Found');

          if (hasError) {
            console.error(`❌ Navigation link "${link.text}" leads to error page`);
          } else {
            console.log(`✅ Navigation link "${link.text}" works`);
          }

        } catch (error) {
          console.error(`❌ Failed to test navigation link "${link.text}": ${error}`);
        }
      }
    }
  });
});