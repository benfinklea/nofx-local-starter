---
name: tests-write-e2e
description: Write end-to-end tests simulating real user interactions
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL USER JOURNEY TESTING**
Writing E2E tests for all user flows and features across the application...
{{else}}
**Mode: RECENT FEATURE TESTING**
Focusing on recently modified user-facing features. I will:
1. Test UI components and flows recently added or modified
2. Cover user journeys affected by recent changes
3. Focus on features you've recently implemented

To write E2E tests for all user journeys, use: `/tests-write-e2e --all`
{{/if}}

Write comprehensive end-to-end tests that simulate real user behavior and validate complete system functionality:

## E2E Testing Principles

### User-Centric Testing
- Test from the user's perspective, not technical implementation
- Simulate real browser/app interactions
- Test complete user journeys and workflows
- Validate business outcomes, not just technical success

## Test Scenarios

### 1. Critical User Paths
**Authentication Flow**
- User registration with email verification
- Login with valid/invalid credentials
- Password reset flow
- Session management and timeout
- Multi-factor authentication if applicable

**Core Business Flows**
- Complete purchase/checkout process
- Content creation and publishing
- Search and filtering operations
- User profile management
- Sharing and collaboration features

### 2. Cross-Browser/Device Testing
- Test on Chrome, Firefox, Safari, Edge
- Validate responsive design on mobile/tablet/desktop
- Test touch interactions on mobile devices
- Verify accessibility with screen readers
- Test offline/online transitions

### 3. Real-World Conditions
**Network Conditions**
- Slow 3G/4G connections
- Intermittent connectivity
- High latency scenarios
- Bandwidth restrictions

**User Behaviors**
- Multiple tabs/windows
- Browser back/forward navigation
- Form resubmission
- Session restoration after crash
- Concurrent user actions

## Implementation Requirements

### Test Framework Setup
- Use Playwright, Cypress, or Selenium WebDriver
- Configure for headless and headed modes
- Set up parallel test execution
- Implement screenshot/video capture on failure
- Configure multiple browser contexts

### Page Object Pattern
- Create page objects for each UI component
- Implement reusable interaction methods
- Abstract selectors and locators
- Build composable test actions
- Maintain clear separation of concerns

### Test Data Management
- Use dedicated test accounts and data
- Implement data seeding before tests
- Clean up test data after completion
- Handle dynamic data generation
- Manage test environment state

## Validation Points

### Visual Validation
- Verify UI elements are visible and positioned correctly
- Test loading states and transitions
- Validate error messages and notifications
- Check responsive layout adjustments
- Verify animations and interactions

### Functional Validation
- Confirm data persistence across pages
- Validate form submissions and validations
- Test file uploads/downloads
- Verify real-time updates (WebSocket/SSE)
- Check proper URL routing and deep linking

### Performance Validation
- Monitor page load times
- Track time to interactive (TTI)
- Measure critical user action durations
- Detect memory leaks in long sessions
- Validate lazy loading and pagination

## Advanced Scenarios

### Multi-User Interactions
- Test real-time collaboration features
- Validate concurrent editing and locking
- Test notification delivery to multiple users
- Verify chat/messaging functionality
- Test user permission and access control

### Third-Party Integrations
- Test payment gateway flows
- Validate social media authentication
- Test analytics and tracking
- Verify email delivery
- Test CDN and asset loading

### Error Recovery
- Test graceful handling of server errors
- Validate client-side error boundaries
- Test session recovery after timeout
- Verify data recovery after connection loss
- Test fallback UI for failed components

## Test Execution Strategy

### Test Organization
- Group tests by feature or user journey
- Implement smoke tests for critical paths
- Create regression suites for bug fixes
- Tag tests for selective execution
- Maintain test execution priorities

### Continuous Integration
- Run smoke tests on every commit
- Execute full suite on merge requests
- Schedule nightly comprehensive runs
- Implement flaky test detection
- Generate detailed test reports

## Success Criteria
- All critical user paths have E2E coverage
- Tests pass consistently across all browsers
- Test execution time under 30 minutes
- Zero false positives (flaky tests)
- Clear error messages and debugging info
- Visual regression detection implemented

Write and execute these E2E tests using Playwright, fixing any issues discovered.

## Command Completion

✅ `/tests-write-e2e $ARGUMENTS` command complete.

Summary: Written comprehensive end-to-end tests simulating real user interactions with cross-browser validation and complete user journey coverage.