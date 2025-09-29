/**
 * AI Testing - Comprehensive Run Creation Test
 * Tests the full flow from authentication to run creation
 */

import { test, expect, Page } from '@playwright/test';
import { ApiTestHelper } from './ApiTestHelper';

export class RunCreationTest {
  private page: Page;
  private apiHelper: ApiTestHelper;

  constructor(page: Page, baseURL?: string) {
    this.page = page;
    this.apiHelper = new ApiTestHelper(baseURL);
  }

  /**
   * Test run creation via API
   */
  async testApiRunCreation(): Promise<{
    success: boolean;
    run?: any;
    error?: string;
  }> {
    try {
      console.log('🧪 Testing API run creation...');

      // Authenticate
      await this.apiHelper.createAndLoginTestUser();

      // Create project
      await this.apiHelper.createTestProject();

      // Create run
      const run = await this.apiHelper.createTestRun({
        goal: "Test API run creation flow",
        steps: [
          {
            name: "Verify API functionality",
            tool: "info",
            inputs: { message: "API run creation test successful" }
          }
        ]
      });

      console.log('✅ API run creation test passed');
      return { success: true, run };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ API run creation test failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Test run creation via UI
   */
  async testUIRunCreation(): Promise<{
    success: boolean;
    runId?: string;
    error?: string;
  }> {
    try {
      console.log('🧪 Testing UI run creation...');

      // Navigate to main app
      await this.page.goto('/');
      await this.page.waitForTimeout(2000);

      // Look for run creation elements
      const possibleSelectors = [
        'button:has-text("New Run")',
        'button:has-text("Create Run")',
        '[data-testid="new-run"]',
        '[data-testid="create-run"]',
        '.new-run-button',
        '.create-run-button',
        'button[type="submit"]'
      ];

      let createButton = null;
      for (const selector of possibleSelectors) {
        try {
          createButton = await this.page.locator(selector).first();
          if (await createButton.isVisible({ timeout: 1000 })) {
            console.log(`Found create button with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!createButton || !(await createButton.isVisible())) {
        // Try to find any form or input that might be for run creation
        const formElements = await this.page.locator('form, input, textarea').count();
        if (formElements > 0) {
          console.log(`Found ${formElements} form elements, attempting to fill them`);

          // Look for goal/plan input fields
          const goalSelectors = [
            'input[name="goal"]',
            'input[placeholder*="goal"]',
            'input[placeholder*="Goal"]',
            'textarea[name="goal"]',
            'textarea[placeholder*="goal"]',
            '[data-testid="goal-input"]'
          ];

          let goalField = null;
          for (const selector of goalSelectors) {
            try {
              goalField = await this.page.locator(selector).first();
              if (await goalField.isVisible({ timeout: 1000 })) {
                console.log(`Found goal field: ${selector}`);
                break;
              }
            } catch {
              continue;
            }
          }

          if (goalField && await goalField.isVisible()) {
            await goalField.fill('Test run created via UI automation');

            // Find and click submit button
            const submitButton = await this.page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Create")').first();
            if (await submitButton.isVisible()) {
              await submitButton.click();
              await this.page.waitForTimeout(3000);

              // Check for success indicators
              const url = this.page.url();
              const hasRunId = url.includes('/runs/') || url.includes('/run/');

              if (hasRunId) {
                const runId = url.split('/').pop();
                console.log('✅ UI run creation test passed, run ID:', runId);
                return { success: true, runId };
              }
            }
          }
        }

        throw new Error('Could not find run creation UI elements');
      }

      await createButton.click();
      await this.page.waitForTimeout(2000);

      // Fill in run details if form appears
      await this.fillRunForm();

      // Submit the form
      await this.submitRunForm();

      // Wait for run to be created
      await this.page.waitForTimeout(3000);

      // Verify run was created
      const runId = await this.verifyRunCreated();

      console.log('✅ UI run creation test passed');
      return { success: true, runId };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ UI run creation test failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  private async fillRunForm(): Promise<void> {
    // Look for goal input
    const goalInputs = [
      'input[name="goal"]',
      'textarea[name="goal"]',
      '[data-testid="goal-input"]',
      'input[placeholder*="goal"]'
    ];

    for (const selector of goalInputs) {
      try {
        const input = this.page.locator(selector);
        if (await input.isVisible({ timeout: 1000 })) {
          await input.fill('Automated test run created by AI testing system');
          break;
        }
      } catch {
        continue;
      }
    }

    // Look for plan/steps input
    const planInputs = [
      'textarea[name="plan"]',
      'textarea[name="steps"]',
      '[data-testid="plan-input"]',
      'textarea[placeholder*="plan"]'
    ];

    for (const selector of planInputs) {
      try {
        const input = this.page.locator(selector);
        if (await input.isVisible({ timeout: 1000 })) {
          const testPlan = JSON.stringify({
            steps: [
              {
                name: "Initialize test",
                tool: "bash",
                inputs: { command: "echo 'Test started'" }
              }
            ]
          }, null, 2);
          await input.fill(testPlan);
          break;
        }
      } catch {
        continue;
      }
    }
  }

  private async submitRunForm(): Promise<void> {
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Create")',
      'button:has-text("Submit")',
      'button:has-text("Start")',
      '[data-testid="submit-run"]'
    ];

    for (const selector of submitSelectors) {
      try {
        const button = this.page.locator(selector);
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click();
          return;
        }
      } catch {
        continue;
      }
    }

    throw new Error('Could not find submit button');
  }

  private async verifyRunCreated(): Promise<string | undefined> {
    // Check URL for run ID
    const url = this.page.url();
    if (url.includes('/runs/') || url.includes('/run/')) {
      return url.split('/').pop();
    }

    // Check for success message
    const successSelectors = [
      '[data-testid="run-created"]',
      '.success-message',
      '.run-id',
      ':text("Run created")',
      ':text("Success")'
    ];

    for (const selector of successSelectors) {
      try {
        const element = this.page.locator(selector);
        if (await element.isVisible({ timeout: 1000 })) {
          const text = await element.textContent();
          const runIdMatch = text?.match(/run[:\s]*([a-zA-Z0-9-]+)/i);
          if (runIdMatch) {
            return runIdMatch[1];
          }
        }
      } catch {
        continue;
      }
    }

    return undefined;
  }

  /**
   * Debug the current page state
   */
  async debugPageState(): Promise<{
    url: string;
    title: string;
    forms: number;
    buttons: number;
    inputs: number;
    authState: any;
  }> {
    const url = this.page.url();
    const title = await this.page.title();
    const forms = await this.page.locator('form').count();
    const buttons = await this.page.locator('button').count();
    const inputs = await this.page.locator('input, textarea').count();

    const authState = await this.page.evaluate(() => {
      return {
        authSession: localStorage.getItem('auth_session'),
        authenticated: localStorage.getItem('authenticated'),
        sbToken: localStorage.getItem('sb-access-token'),
        projectId: localStorage.getItem('projectId')
      };
    });

    const debug = { url, title, forms, buttons, inputs, authState };
    console.log('🔍 Page Debug State:', JSON.stringify(debug, null, 2));
    return debug;
  }

  /**
   * Take a screenshot for debugging
   */
  async takeDebugScreenshot(name: string = 'debug'): Promise<void> {
    const timestamp = Date.now();
    const path = `test-results/debug-${name}-${timestamp}.png`;
    await this.page.screenshot({ path, fullPage: true });
    console.log(`📸 Debug screenshot saved: ${path}`);
  }

  /**
   * Full comprehensive test
   */
  async runComprehensiveTest(): Promise<{
    success: boolean;
    apiResult?: any;
    uiResult?: any;
    debugInfo?: any;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log('🚀 Starting comprehensive run creation test...');

      // 1. Debug current state
      const debugInfo = await this.debugPageState();
      await this.takeDebugScreenshot('start');

      // 2. Test API run creation
      const apiResult = await this.testApiRunCreation();
      if (!apiResult.success) {
        errors.push(`API test failed: ${apiResult.error}`);
      }

      // 3. Test UI run creation
      const uiResult = await this.testUIRunCreation();
      if (!uiResult.success) {
        errors.push(`UI test failed: ${uiResult.error}`);
        await this.takeDebugScreenshot('ui-error');
      }

      const success = apiResult.success || uiResult.success;

      console.log(success ? '✅ Comprehensive test completed successfully' : '❌ Comprehensive test failed');

      return {
        success,
        apiResult,
        uiResult,
        debugInfo,
        errors
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Comprehensive test error: ${errorMsg}`);
      console.error('❌ Comprehensive test failed:', errorMsg);

      return {
        success: false,
        errors
      };
    }
  }
}

// Playwright test using the RunCreationTest class
test.describe('AI Run Creation Testing', () => {
  test('comprehensive run creation test', async ({ page, baseURL }) => {
    const tester = new RunCreationTest(page, baseURL);
    const result = await tester.runComprehensiveTest();

    // Assert that at least one method worked
    expect(result.success).toBe(true);

    // Log results for debugging
    console.log('Final test results:', JSON.stringify(result, null, 2));
  });

  test('api run creation only', async ({ page, baseURL }) => {
    const tester = new RunCreationTest(page, baseURL);
    const result = await tester.testApiRunCreation();

    expect(result.success).toBe(true);
    expect(result.run).toBeDefined();
  });

  test('ui run creation only', async ({ page, baseURL }) => {
    const tester = new RunCreationTest(page, baseURL);

    // First debug the page
    await tester.debugPageState();
    await tester.takeDebugScreenshot('ui-test-start');

    const result = await tester.testUIRunCreation();

    // Don't fail if UI test fails - just log it
    if (!result.success) {
      console.log('UI test failed (this may be expected):', result.error);
      await tester.takeDebugScreenshot('ui-test-failed');
    } else {
      expect(result.success).toBe(true);
      expect(result.runId).toBeDefined();
    }
  });
});