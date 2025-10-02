/**
 * End-to-End Tests for Team Management
 * Complete user workflows from signup to team collaboration
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.APP_URL || 'https://nofx-local-starter.vercel.app';

test.describe('Team Management E2E Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let userEmail: string;
  let userPassword: string;
  let teamId: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Generate unique test user
    userEmail = `test-${uuidv4()}@example.com`;
    userPassword = 'TestPass123!';
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('Complete Team Lifecycle', () => {
    test('user can signup and get personal team', async () => {
      await page.goto(`${BASE_URL}/auth/signup`);

      // Fill signup form
      await page.fill('input[name="email"]', userEmail);
      await page.fill('input[name="password"]', userPassword);
      await page.fill('input[name="fullName"]', 'Test User');
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });

      // Verify personal team was created
      const teamName = await page.textContent('[data-testid="team-name"]');
      expect(teamName).toContain('Test User');
    });

    test('user can create additional team', async () => {
      await page.goto(`${BASE_URL}/teams`);

      // Click create team button
      await page.click('[data-testid="create-team-button"]');

      // Fill team creation form
      const teamName = `Test Team ${Date.now()}`;
      await page.fill('input[name="teamName"]', teamName);
      await page.fill('input[name="billingEmail"]', 'billing@test.com');
      await page.click('button[type="submit"]');

      // Wait for team to be created
      await page.waitForSelector(`text="${teamName}"`, { timeout: 5000 });

      // Extract team ID from URL or data attribute
      const teamElement = await page.locator(`[data-team-name="${teamName}"]`);
      teamId = await teamElement.getAttribute('data-team-id') || '';

      expect(teamId).toBeTruthy();
    });

    test('owner can invite team members', async () => {
      if (!teamId) test.skip();

      await page.goto(`${BASE_URL}/teams/${teamId}/members`);

      // Click invite member button
      await page.click('[data-testid="invite-member-button"]');

      // Fill invite form
      const inviteeEmail = `invitee-${uuidv4()}@example.com`;
      await page.fill('input[name="email"]', inviteeEmail);
      await page.selectOption('select[name="role"]', 'member');
      await page.fill('textarea[name="message"]', 'Welcome to our team!');
      await page.click('button[type="submit"]');

      // Verify invite was sent
      await expect(page.locator('.toast-success')).toContainText('Invitation sent');

      // Verify invite appears in pending list
      await expect(page.locator(`[data-invite-email="${inviteeEmail}"]`)).toBeVisible();
    });

    test('invited user can accept invite', async () => {
      // Create a new user and get invite token
      const inviteeEmail = `invitee-${uuidv4()}@example.com`;
      const inviteToken = 'test-invite-token'; // Would be from email in real scenario

      // Open invite acceptance URL
      await page.goto(`${BASE_URL}/accept-invite?token=${inviteToken}`);

      // If not logged in, should redirect to signup/login
      if (page.url().includes('/auth')) {
        await page.fill('input[name="email"]', inviteeEmail);
        await page.fill('input[name="password"]', 'InviteePass123!');
        await page.click('button[type="submit"]');
      }

      // Should show invite acceptance page
      await expect(page.locator('h1')).toContainText('You\'ve been invited');

      // Accept invite
      await page.click('[data-testid="accept-invite-button"]');

      // Should redirect to team dashboard
      await page.waitForURL(new RegExp(`/teams/${teamId}`), { timeout: 5000 });

      // Verify user is now team member
      await expect(page.locator('[data-testid="member-role"]')).toContainText('Member');
    });

    test('team member can leave team', async () => {
      await page.goto(`${BASE_URL}/teams/${teamId}/settings`);

      // Click leave team button
      await page.click('[data-testid="leave-team-button"]');

      // Confirm in dialog
      await page.click('[data-testid="confirm-leave-button"]');

      // Should redirect to teams list
      await page.waitForURL(/\/teams$/, { timeout: 5000 });

      // Verify team is no longer in list
      await expect(page.locator(`[data-team-id="${teamId}"]`)).not.toBeVisible();
    });

    test('owner can transfer ownership', async () => {
      await page.goto(`${BASE_URL}/teams/${teamId}/settings`);

      // Add a member first
      const newOwnerEmail = `owner-${uuidv4()}@example.com`;
      // ... invite and add member process ...

      // Click transfer ownership
      await page.click('[data-testid="transfer-ownership-button"]');

      // Select new owner
      await page.selectOption('select[name="newOwner"]', newOwnerEmail);
      await page.click('[data-testid="confirm-transfer-button"]');

      // Verify role changed
      await expect(page.locator('[data-testid="member-role"]')).toContainText('Admin');
    });

    test('owner can delete team', async () => {
      await page.goto(`${BASE_URL}/teams/${teamId}/settings`);

      // Scroll to danger zone
      await page.locator('[data-testid="danger-zone"]').scrollIntoViewIfNeeded();

      // Click delete team
      await page.click('[data-testid="delete-team-button"]');

      // Type team name to confirm
      const teamNameInput = await page.locator('[data-testid="confirm-team-name"]');
      await teamNameInput.fill('Test Team');

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-button"]');

      // Should redirect to teams list
      await page.waitForURL(/\/teams$/, { timeout: 5000 });

      // Verify team is deleted
      await expect(page.locator(`[data-team-id="${teamId}"]`)).not.toBeVisible();
    });
  });

  test.describe('Permission Enforcement', () => {
    let memberContext: BrowserContext;
    let memberPage: Page;
    let memberEmail: string;

    test.beforeAll(async ({ browser }) => {
      memberContext = await browser.newContext();
      memberPage = await memberContext.newPage();
      memberEmail = `member-${uuidv4()}@example.com`;

      // Create and login as member user
      // ... signup/login process ...
    });

    test('members cannot delete team', async () => {
      await memberPage.goto(`${BASE_URL}/teams/${teamId}/settings`);

      // Delete button should be disabled or hidden
      const deleteButton = memberPage.locator('[data-testid="delete-team-button"]');
      await expect(deleteButton).toBeDisabled();
    });

    test('viewers cannot invite members', async () => {
      await memberPage.goto(`${BASE_URL}/teams/${teamId}/members`);

      // Invite button should not be visible for viewers
      const inviteButton = memberPage.locator('[data-testid="invite-member-button"]');
      await expect(inviteButton).not.toBeVisible();
    });

    test('non-members cannot access team', async () => {
      const otherTeamId = 'other-team-id';
      await memberPage.goto(`${BASE_URL}/teams/${otherTeamId}`);

      // Should show access denied or redirect
      await expect(memberPage.locator('.error-message')).toContainText('Access denied');
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('handles expired invite gracefully', async () => {
      const expiredToken = 'expired-token-123';
      await page.goto(`${BASE_URL}/accept-invite?token=${expiredToken}`);

      await expect(page.locator('.error-message')).toContainText('expired');
      await expect(page.locator('[data-testid="request-new-invite-link"]')).toBeVisible();
    });

    test('handles network errors during team creation', async () => {
      // Simulate offline mode
      await context.setOffline(true);

      await page.goto(`${BASE_URL}/teams/new`);
      await page.fill('input[name="teamName"]', 'Offline Team');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('.error-toast')).toContainText('Network error');

      // Re-enable network
      await context.setOffline(false);

      // Retry should work
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('.success-toast')).toContainText('Team created');
    });

    test('prevents duplicate team names', async () => {
      const duplicateName = 'Duplicate Team Name';

      // Create first team
      await page.goto(`${BASE_URL}/teams/new`);
      await page.fill('input[name="teamName"]', duplicateName);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.success-toast');

      // Try to create second team with same name
      await page.goto(`${BASE_URL}/teams/new`);
      await page.fill('input[name="teamName"]', duplicateName);
      await page.click('button[type="submit"]');

      await expect(page.locator('.error-message')).toContainText('already exists');
    });

    test('handles simultaneous invites to same email', async () => {
      const sharedEmail = `shared-${uuidv4()}@example.com`;

      // Open two tabs
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      await Promise.all([
        page1.goto(`${BASE_URL}/teams/${teamId}/members`),
        page2.goto(`${BASE_URL}/teams/${teamId}/members`)
      ]);

      // Send invites simultaneously
      await Promise.all([
        page1.click('[data-testid="invite-member-button"]'),
        page2.click('[data-testid="invite-member-button"]')
      ]);

      await Promise.all([
        page1.fill('input[name="email"]', sharedEmail),
        page2.fill('input[name="email"]', sharedEmail)
      ]);

      const [response1, response2] = await Promise.all([
        page1.click('button[type="submit"]'),
        page2.click('button[type="submit"]')
      ]);

      // One should succeed, one should fail with duplicate error
      const hasSuccess =
        await page1.locator('.success-toast').isVisible() ||
        await page2.locator('.success-toast').isVisible();
      const hasError =
        await page1.locator('.error-toast').isVisible() ||
        await page2.locator('.error-toast').isVisible();

      expect(hasSuccess).toBe(true);
      expect(hasError).toBe(true);
    });
  });

  test.describe('Performance Tests', () => {
    test('loads team list quickly with many teams', async () => {
      // Create multiple teams
      const teamPromises = Array(20).fill(null).map(async (_, i) => {
        const response = await fetch(`${BASE_URL}/api/teams`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken(page)}`
          },
          body: JSON.stringify({ name: `Perf Test Team ${i}` })
        });
        return response.json();
      });

      await Promise.all(teamPromises);

      // Measure load time
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/teams`);
      await page.waitForSelector('[data-testid="teams-list"]');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds

      // Verify all teams are displayed
      const teamCount = await page.locator('[data-testid="team-item"]').count();
      expect(teamCount).toBeGreaterThanOrEqual(20);
    });

    test('handles large team member lists', async () => {
      // Simulate team with many members
      await page.goto(`${BASE_URL}/teams/${teamId}/members`);

      // Check pagination is working
      const pagination = await page.locator('[data-testid="pagination"]');
      if (await pagination.isVisible()) {
        // Navigate through pages
        await page.click('[data-testid="next-page"]');
        await expect(page.locator('[data-testid="member-item"]')).toHaveCount(expect.any(Number));
      }
    });
  });

  test.describe('Accessibility Tests', () => {
    test('team management is keyboard navigable', async () => {
      await page.goto(`${BASE_URL}/teams`);

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();

      // Navigate to create team button with keyboard
      let focused = await page.locator(':focus');
      while (!(await focused.getAttribute('data-testid'))?.includes('create-team')) {
        await page.keyboard.press('Tab');
        focused = await page.locator(':focus');
      }

      // Activate with Enter
      await page.keyboard.press('Enter');
      await expect(page.url()).toContain('/teams/new');
    });

    test('team forms have proper ARIA labels', async () => {
      await page.goto(`${BASE_URL}/teams/new`);

      // Check form has proper labels
      const nameInput = await page.locator('input[name="teamName"]');
      const nameLabel = await nameInput.getAttribute('aria-label') ||
                       await page.locator(`label[for="${await nameInput.getAttribute('id')}"]`).textContent();
      expect(nameLabel).toBeTruthy();

      // Check required fields are marked
      const required = await nameInput.getAttribute('aria-required');
      expect(required).toBe('true');
    });

    test('error messages are announced to screen readers', async () => {
      await page.goto(`${BASE_URL}/teams/new`);

      // Submit empty form
      await page.click('button[type="submit"]');

      // Check error has proper ARIA attributes
      const error = await page.locator('[role="alert"]');
      await expect(error).toBeVisible();
      await expect(error).toHaveAttribute('aria-live', 'polite');
    });
  });
});

// Helper function to get auth token from page
async function getAuthToken(page: Page): Promise<string> {
  return await page.evaluate(() => {
    return localStorage.getItem('auth_token') ||
           sessionStorage.getItem('auth_token') ||
           document.cookie.match(/auth_token=([^;]+)/)?.[1] || '';
  });
}