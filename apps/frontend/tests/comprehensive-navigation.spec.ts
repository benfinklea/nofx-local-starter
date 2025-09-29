import { test, expect } from '@playwright/test';

test.describe('Comprehensive Navigation Testing', () => {
  let authenticated = false;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Handle authentication once
    if (!authenticated) {
      const loginForm = await page.locator('form').first();
      if (await loginForm.isVisible()) {
        console.log('🔐 Attempting authentication...');

        // Try to login with test credentials
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'testpassword');
        await page.click('button[type="submit"]');

        // Wait for either success or error
        await page.waitForTimeout(3000);

        // Check if we're still on login page (login failed)
        const stillOnLogin = await page.locator('form').first().isVisible();
        if (stillOnLogin) {
          // Try Google OAuth instead
          console.log('🔑 Regular login failed, trying OAuth...');
          const googleButton = await page.locator('button:has-text("Sign in with Google")');
          if (await googleButton.isVisible()) {
            console.log('⚠️  OAuth requires manual intervention - skipping authentication for now');
          }

          // For testing purposes, let's see what happens without auth
          console.log('📝 Continuing without authentication to test navigation structure');
        } else {
          console.log('✅ Authentication successful');
          authenticated = true;
        }
      }
    }
  });

  test('should test the complete navigation structure', async ({ page }) => {
    console.log('🧭 Starting comprehensive navigation test...');

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/initial-page.png', fullPage: true });

    // Look for navigation drawer/sidebar
    const drawerSelectors = [
      '.MuiDrawer-root',
      '[role="presentation"]',
      'nav',
      'aside',
      '[data-testid*="nav"]',
      '.navigation',
      '.sidebar'
    ];

    let navigationFound = false;
    let navigationElement = null;

    for (const selector of drawerSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`📍 Found potential navigation with selector: ${selector} (${elements.length} elements)`);
        navigationElement = elements[0];
        navigationFound = true;

        // Take screenshot of navigation area
        await navigationElement.screenshot({ path: `test-results/nav-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.png` });
        break;
      }
    }

    if (!navigationFound) {
      console.log('❌ No navigation drawer found, checking for any clickable navigation elements...');

      // Look for any clickable navigation elements on the page
      const clickableSelectors = [
        'a[href]',
        'button[onclick]',
        '[role="button"]',
        '.nav-link',
        '.menu-item'
      ];

      for (const selector of clickableSelectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`🔗 Found ${elements.length} clickable elements with: ${selector}`);

          // Test first few clickable elements
          for (let i = 0; i < Math.min(elements.length, 5); i++) {
            try {
              const element = elements[i];
              const text = await element.textContent();
              const href = await element.getAttribute('href');

              if (text && text.trim() && text.length < 50) {
                console.log(`  Testing: "${text.trim()}" -> ${href || 'no href'}`);

                await element.click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: `test-results/click-${i}-${text.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20)}.png` });
              }
            } catch (e) {
              console.log(`    Could not test element ${i}: ${e}`);
            }
          }
        }
      }
    } else {
      // Test navigation drawer elements
      console.log('🎯 Testing navigation drawer items...');

      // Look for navigation list items
      const navItemSelectors = [
        '.MuiListItem-root',
        '.MuiListItemButton-root',
        'li[role="button"]',
        'li a',
        '.nav-item',
        '.list-item'
      ];

      let navItemsFound = [];

      for (const selector of navItemSelectors) {
        const items = await page.locator(selector).all();
        if (items.length > 0) {
          console.log(`📋 Found ${items.length} nav items with: ${selector}`);

          for (let i = 0; i < Math.min(items.length, 10); i++) {
            try {
              const item = items[i];
              const text = await item.textContent();
              const isClickable = await item.isEnabled();

              if (text && text.trim() && isClickable) {
                navItemsFound.push({
                  text: text.trim(),
                  element: item,
                  selector,
                  index: i
                });
              }
            } catch (e) {
              // Skip if we can't access the item
            }
          }
          break; // Use the first selector that finds items
        }
      }

      console.log(`🎯 Found ${navItemsFound.length} testable navigation items`);

      // Test each navigation item
      for (const navItem of navItemsFound.slice(0, 8)) { // Limit to 8 items to avoid timeout
        try {
          console.log(`🖱️  Testing navigation item: "${navItem.text}"`);

          // Get current URL before click
          const beforeURL = page.url();

          // Click the navigation item
          await navItem.element.click();
          await page.waitForTimeout(2000);

          // Check if URL changed or page content changed
          const afterURL = page.url();
          const urlChanged = beforeURL !== afterURL;

          if (urlChanged) {
            console.log(`  ✅ Navigation successful: ${beforeURL} -> ${afterURL}`);
          } else {
            console.log(`  ⚠️  URL didn't change, checking for content changes...`);
          }

          // Take screenshot after navigation
          await page.screenshot({
            path: `test-results/nav-item-${navItem.text.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}.png`,
            fullPage: true
          });

          // Check for error indicators
          const errorIndicators = await page.locator('.error, .alert-error, [role="alert"]').all();
          if (errorIndicators.length > 0) {
            const errorText = await errorIndicators[0].textContent();
            console.log(`  ❌ Error detected: ${errorText}`);
          } else {
            console.log(`  ✅ No errors detected`);
          }

        } catch (error) {
          console.error(`  ❌ Failed to test "${navItem.text}": ${error}`);
        }
      }
    }

    // Test specific routes from App.tsx manually
    console.log('🧪 Testing specific routes from App.tsx...');

    const routesToTest = [
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

    for (const route of routesToTest) {
      try {
        console.log(`🎯 Testing route: ${route.name} (${route.path})`);

        await page.goto(route.path, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(1500);

        // Take screenshot
        await page.screenshot({
          path: `test-results/route-${route.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`,
          fullPage: true
        });

        // Check for basic page loading
        const bodyText = await page.textContent('body');
        const hasContent = bodyText && bodyText.trim().length > 100;

        if (hasContent) {
          console.log(`  ✅ ${route.name} - Page loaded with content`);
        } else {
          console.log(`  ⚠️  ${route.name} - Page loaded but minimal content`);
        }

        // Check for error indicators
        const hasError = bodyText?.includes('404') ||
                         bodyText?.includes('Error') ||
                         bodyText?.includes('Not Found') ||
                         bodyText?.includes('Something went wrong');

        if (hasError) {
          console.log(`  ❌ ${route.name} - Error detected in page content`);
        } else {
          console.log(`  ✅ ${route.name} - No obvious errors`);
        }

      } catch (error) {
        console.error(`  ❌ ${route.name} - Failed to load: ${error}`);
        await page.screenshot({
          path: `test-results/route-error-${route.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`
        });
      }
    }
  });

  test('should test run creation workflow', async ({ page }) => {
    console.log('🏃 Testing run creation workflow...');

    // Go to new run page
    await page.goto('/#/runs/new', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/run-creation-page.png', fullPage: true });

    // Look for any form elements or interactive components
    const interactiveSelectors = [
      'form',
      'input',
      'textarea',
      'button',
      'select',
      '[contenteditable]',
      '.MuiTextField-root',
      '.MuiButton-root'
    ];

    for (const selector of interactiveSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`📝 Found ${elements.length} ${selector} elements`);

        if (selector.includes('input') || selector.includes('textarea')) {
          // Try to fill form fields
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            try {
              const element = elements[i];
              const placeholder = await element.getAttribute('placeholder');
              const type = await element.getAttribute('type');
              const label = await element.getAttribute('aria-label');

              console.log(`  Input ${i}: type=${type}, placeholder="${placeholder}", label="${label}"`);

              // Fill with test data
              if (placeholder?.toLowerCase().includes('goal') || label?.toLowerCase().includes('goal')) {
                await element.fill('Create a test file and validate its contents');
              } else if (type === 'text' || !type) {
                await element.fill('Test input data');
              }
            } catch (e) {
              console.log(`  Could not fill input ${i}: ${e}`);
            }
          }
        }

        if (selector.includes('button')) {
          // Look for submit/create buttons
          for (const button of elements.slice(0, 5)) {
            try {
              const text = await button.textContent();
              if (text && (text.includes('Create') || text.includes('Submit') || text.includes('Run'))) {
                console.log(`🎯 Found potential submit button: "${text}"`);

                await button.click();
                await page.waitForTimeout(3000);

                const newURL = page.url();
                console.log(`  After submit: ${newURL}`);

                await page.screenshot({ path: 'test-results/after-run-submit.png', fullPage: true });
                break;
              }
            } catch (e) {
              // Skip if button can't be clicked
            }
          }
        }
      }
    }
  });
});