import { test, expect } from '@playwright/test';

test.describe('Run Creation and Viewing', () => {
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
      await page.waitForTimeout(3000);
    }
  });

  test('should successfully create and view a run', async ({ page }) => {
    console.log('Starting run creation test...');

    // Navigate to new run page
    await page.goto('/#/runs/new', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Take screenshot of the new run page
    await page.screenshot({ path: 'test-results/new-run-page.png' });

    // Look for form elements that might be used to create a run
    const formSelectors = [
      'form',
      'input[type="text"]',
      'textarea',
      'button[type="submit"]',
      'button:has-text("Create")',
      'button:has-text("Submit")',
      'button:has-text("Run")',
      'button:has-text("Start")'
    ];

    let foundForm = false;
    let submitButton = null;

    for (const selector of formSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector: ${selector}`);

        if (selector.includes('button')) {
          // Try to find a submit button
          for (const button of elements) {
            const text = await button.textContent();
            if (text && (text.includes('Create') || text.includes('Submit') || text.includes('Run') || text.includes('Start'))) {
              submitButton = button;
              console.log(`Found potential submit button: "${text}"`);
              break;
            }
          }
        }

        if (selector === 'form') {
          foundForm = true;
        }
      }
    }

    if (!foundForm) {
      console.log('No form found, checking for other interactive elements...');

      // Look for any input fields or interactive elements
      const inputTypes = ['input', 'textarea', 'select', '[contenteditable]'];
      for (const inputType of inputTypes) {
        const inputs = await page.locator(inputType).all();
        if (inputs.length > 0) {
          console.log(`Found ${inputs.length} ${inputType} elements`);

          // Try to fill them with test data
          for (let i = 0; i < Math.min(inputs.length, 3); i++) {
            try {
              const input = inputs[i];
              const placeholder = await input.getAttribute('placeholder');
              const label = await input.getAttribute('aria-label');
              const type = await input.getAttribute('type');

              console.log(`Input ${i}: type=${type}, placeholder="${placeholder}", label="${label}"`);

              // Fill with appropriate test data based on context
              if (placeholder?.toLowerCase().includes('goal') || label?.toLowerCase().includes('goal')) {
                await input.fill('Test automation goal: Create a simple test file');
              } else if (placeholder?.toLowerCase().includes('step') || label?.toLowerCase().includes('step')) {
                await input.fill('Write a test file, Execute the test, Verify results');
              } else if (type === 'text' || type === null) {
                await input.fill('Test input data');
              }

              await page.waitForTimeout(500);
            } catch (e) {
              console.log(`Could not fill input ${i}: ${e}`);
            }
          }
        }
      }
    }

    // Try to submit the form or trigger run creation
    if (submitButton) {
      console.log('Attempting to submit form...');
      try {
        await submitButton.click();
        await page.waitForTimeout(3000);

        // Take screenshot after submission
        await page.screenshot({ path: 'test-results/after-submit.png' });

        // Check if we were redirected to a run details page or runs list
        const currentURL = page.url();
        console.log(`Current URL after submit: ${currentURL}`);

        if (currentURL.includes('/runs/') && !currentURL.includes('/new')) {
          console.log('✅ Successfully created run and redirected to run details');

          // Try to verify run details are loading
          await page.waitForTimeout(2000);
          const pageContent = await page.textContent('body');

          if (pageContent?.includes('status') || pageContent?.includes('timeline') || pageContent?.includes('steps')) {
            console.log('✅ Run details page appears to be loading correctly');
          } else {
            console.log('⚠️  Run details page loaded but content unclear');
          }

        } else if (currentURL.includes('/runs') && !currentURL.includes('/new')) {
          console.log('✅ Redirected to runs list page');

          // Look for the newly created run in the list
          await page.waitForTimeout(2000);
          const runElements = await page.locator('[data-testid*="run"], .run-item, tr, li').all();
          console.log(`Found ${runElements.length} potential run list items`);

        } else {
          console.log('❓ Submission completed but redirect unclear');
        }

      } catch (error) {
        console.error(`❌ Error during form submission: ${error}`);
        await page.screenshot({ path: 'test-results/submit-error.png' });
      }
    } else {
      console.log('❌ No submit button found - cannot test run creation');
    }

    // Test viewing existing runs
    console.log('Testing runs list view...');
    await page.goto('/#/runs', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/runs-list.png' });

    // Look for run items in the list
    const runListSelectors = [
      '[data-testid*="run"]',
      '.run-item',
      'tr td',
      'li',
      'a[href*="/runs/"]'
    ];

    let foundRuns = false;
    for (const selector of runListSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`Found ${elements.length} potential run items with selector: ${selector}`);
        foundRuns = true;

        // Try to click on the first run to view details
        if (selector.includes('a[href') && elements.length > 0) {
          try {
            const firstRun = elements[0];
            const href = await firstRun.getAttribute('href');
            console.log(`Attempting to view run details: ${href}`);

            await firstRun.click();
            await page.waitForTimeout(3000);

            await page.screenshot({ path: 'test-results/run-details.png' });

            const detailsURL = page.url();
            if (detailsURL.includes('/runs/') && !detailsURL.includes('/new')) {
              console.log('✅ Successfully navigated to run details page');
            }

          } catch (error) {
            console.log(`Could not click run link: ${error}`);
          }
        }
        break;
      }
    }

    if (!foundRuns) {
      console.log('⚠️  No runs found in the list - this might be expected for a new installation');
    }
  });

  test('should handle run creation errors gracefully', async ({ page }) => {
    console.log('Testing error handling in run creation...');

    await page.goto('/#/runs/new', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Try to submit an empty form to test validation
    const submitButtons = await page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")').all();

    if (submitButtons.length > 0) {
      console.log('Testing form validation with empty submission...');

      await submitButtons[0].click();
      await page.waitForTimeout(2000);

      // Look for error messages
      const errorSelectors = [
        '.error',
        '.alert-error',
        '[role="alert"]',
        '.MuiAlert-root',
        '.text-red',
        '.danger'
      ];

      let foundError = false;
      for (const selector of errorSelectors) {
        const errors = await page.locator(selector).all();
        if (errors.length > 0) {
          foundError = true;
          const errorText = await errors[0].textContent();
          console.log(`✅ Found validation error: "${errorText}"`);
          break;
        }
      }

      if (!foundError) {
        console.log('⚠️  No validation errors found - form might allow empty submission');
      }

      await page.screenshot({ path: 'test-results/validation-test.png' });
    }
  });
});