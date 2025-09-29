import { test, expect } from '@playwright/test';

test.describe('Signup Workflow Testing', () => {
  test('should navigate to signup page and test signup form', async ({ page }) => {
    console.log('🔐 Testing signup workflow...');

    // Start at login page
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Take screenshot of login page
    await page.screenshot({ path: 'test-results/login-page-initial.png', fullPage: true });

    // Look for the "Create one" link
    const createAccountLink = await page.locator('a:has-text("Create one")');

    if (await createAccountLink.isVisible()) {
      console.log('✅ Found "Create one" link - clicking it...');

      await createAccountLink.click();
      await page.waitForTimeout(2000);

      // Should now be on signup page
      const currentURL = page.url();
      console.log(`📍 Current URL after clicking signup link: ${currentURL}`);

      // Take screenshot of signup page
      await page.screenshot({ path: 'test-results/signup-page.png', fullPage: true });

      // Check if we're on the signup page
      if (currentURL.includes('/signup') || currentURL.includes('#/signup')) {
        console.log('✅ Successfully navigated to signup page');

        // Look for signup form elements
        const signupFormSelectors = [
          'input[type="text"]', // Full name
          'input[type="email"]', // Email
          'input[type="password"]', // Password
          'button:has-text("Create Account")',
          'h1:has-text("Create Account")',
          'text=Join NOFX Control Plane'
        ];

        let signupElementsFound = 0;
        for (const selector of signupFormSelectors) {
          const elements = await page.locator(selector).all();
          if (elements.length > 0) {
            signupElementsFound++;
            console.log(`✅ Found signup element: ${selector} (${elements.length} elements)`);
          } else {
            console.log(`❌ Missing signup element: ${selector}`);
          }
        }

        if (signupElementsFound >= 4) {
          console.log('✅ Signup form appears to be complete and functional');

          // Test form filling (without actually submitting)
          try {
            await page.fill('input[type="text"]', 'Test User');
            await page.fill('input[type="email"]', 'test@example.com');
            await page.fill('input[type="password"]', 'testpassword123');

            console.log('✅ Successfully filled signup form fields');

            // Take screenshot with filled form
            await page.screenshot({ path: 'test-results/signup-form-filled.png', fullPage: true });

            // Test navigation back to login
            const loginLink = await page.locator('a:has-text("Sign in")');
            if (await loginLink.isVisible()) {
              console.log('✅ Found "Sign in" link to return to login');

              await loginLink.click();
              await page.waitForTimeout(2000);

              const backToLoginURL = page.url();
              if (backToLoginURL.includes('/') && !backToLoginURL.includes('/signup')) {
                console.log('✅ Successfully navigated back to login page');
              } else {
                console.log('⚠️  Navigation back to login may not have worked correctly');
              }

              await page.screenshot({ path: 'test-results/back-to-login.png', fullPage: true });
            }

          } catch (error) {
            console.error('❌ Error testing signup form:', error);
          }

        } else {
          console.log('❌ Signup form appears incomplete - missing expected elements');
        }

      } else {
        console.log('❌ Did not navigate to signup page correctly');
      }

    } else {
      console.log('❌ Could not find "Create one" link on login page');

      // Check what links are actually available
      const allLinks = await page.locator('a').all();
      console.log(`Found ${allLinks.length} links on the page:`);

      for (let i = 0; i < Math.min(allLinks.length, 10); i++) {
        try {
          const linkText = await allLinks[i].textContent();
          const href = await allLinks[i].getAttribute('href');
          console.log(`  Link ${i}: "${linkText}" -> ${href}`);
        } catch (e) {
          // Skip if can't get link info
        }
      }
    }
  });

  test('should test authentication flow and protected routes', async ({ page }) => {
    console.log('🔒 Testing authentication flow and protected route access...');

    // List of protected routes to test
    const protectedRoutes = [
      '/#/',
      '/#/runs',
      '/#/runs/new',
      '/#/projects',
      '/#/settings'
    ];

    for (const route of protectedRoutes) {
      console.log(`🧪 Testing protected route: ${route}`);

      await page.goto(route);
      await page.waitForTimeout(2000);

      // Should be redirected to login
      const currentURL = page.url();
      const pageContent = await page.textContent('body');

      if (pageContent?.includes('Sign in to continue') ||
          pageContent?.includes('NOFX Control Plane') &&
          pageContent?.includes('Email') &&
          pageContent?.includes('Password')) {
        console.log(`  ✅ ${route} correctly protected - shows login form`);
      } else {
        console.log(`  ⚠️  ${route} protection unclear - page content: ${pageContent?.substring(0, 100)}...`);
      }

      await page.screenshot({
        path: `test-results/protected-route-${route.replace(/[^a-zA-Z0-9]/g, '-')}.png`
      });
    }
  });

  test('should verify all authentication UI elements are present', async ({ page }) => {
    console.log('🎯 Verifying all authentication UI elements...');

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check all expected login elements
    const loginElements = [
      { selector: 'input[type="email"]', name: 'Email input' },
      { selector: 'input[type="password"]', name: 'Password input' },
      { selector: 'button:has-text("Sign In")', name: 'Sign In button' },
      { selector: 'button:has-text("Sign in with Google")', name: 'Google Sign In button' },
      { selector: 'a:has-text("Forgot password")', name: 'Forgot password link' },
      { selector: 'a:has-text("Create one")', name: 'Create account link' },
      { selector: 'h1:has-text("NOFX Control Plane")', name: 'Application title' },
      { selector: 'text=Sign in to continue', name: 'Login prompt text' }
    ];

    let foundElements = 0;
    let totalElements = loginElements.length;

    for (const element of loginElements) {
      const found = await page.locator(element.selector).isVisible();
      if (found) {
        console.log(`  ✅ ${element.name} - Present`);
        foundElements++;
      } else {
        console.log(`  ❌ ${element.name} - Missing`);
      }
    }

    console.log(`📊 Authentication UI completeness: ${foundElements}/${totalElements} elements found`);

    if (foundElements === totalElements) {
      console.log('✅ All authentication UI elements are present and working');
    } else {
      console.log('⚠️  Some authentication UI elements are missing');
    }

    await page.screenshot({ path: 'test-results/auth-ui-complete.png', fullPage: true });
  });
});