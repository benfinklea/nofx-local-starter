# Testing Prompt 10: Integration & End-to-End Testing Suite

## Priority: CRITICAL 🔴
**Estimated Time:** 5 hours
**Coverage Target:** 90% for critical user flows and integration points

## Objective
Implement comprehensive integration and end-to-end tests that validate complete user journeys, API integrations, system workflows, and cross-service interactions. These tests ensure the entire system works cohesively.

## Files to Test

### Integration Test Files
- `tests/integration/*.test.ts` (Enhance existing → 95%)
- `tests/e2e/*.test.ts` (Enhance existing → 90%)
- `tests/api/*.test.ts` (Enhance existing → 90%)

### Critical Workflows to Test
- Complete user onboarding flow
- Project creation to deployment pipeline
- Team collaboration workflows
- Payment and subscription flows
- Git integration workflows
- Response generation pipeline
- Error recovery and rollback scenarios

## Testing Framework & Tools

### Primary Testing Framework: Jest
All integration and E2E tests MUST use Jest as the primary framework with appropriate helpers for API and browser testing.

### Using the test-generator Subagent
Maximize the test-generator for complex integration scenarios:
```bash
# Generate comprehensive E2E tests
/test-generator "Create end-to-end tests for complete user onboarding flow from signup to first deployment"

# Generate API integration tests
/test-generator "Generate integration tests for API endpoints with authentication, rate limiting, and error scenarios"

# Create workflow tests
/test-generator "Create tests for multi-step workflows including project creation, team collaboration, and deployment"

# Generate performance tests
/test-generator "Generate load tests for concurrent users performing typical workflows"
```

The test-generator subagent will:
- Analyze user flows and generate test scenarios
- Create test data factories for complex scenarios
- Generate API client helpers
- Build page object models for E2E tests
- Create performance benchmarks

### Required Testing Tools
- **Jest**: Primary framework
- **Playwright**: E2E browser testing
- **Supertest**: API integration testing
- **Artillery**: Load testing
- **Docker Compose**: Test environment orchestration
- **Testcontainers**: Database/service containers

## Test Requirements

### 1. E2E Tests - Complete User Journey
```typescript
// Complete user journey with Jest and Playwright
describe('E2E: User Onboarding to First Deployment', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(process.env.BASE_URL || 'http://localhost:3000');
  });

  test('complete new user journey', async () => {
    // 1. Sign up
    await page.click('[data-testid="signup-button"]');
    await page.fill('[name="email"]', 'newuser@example.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.fill('[name="confirmPassword"]', 'SecurePass123!');
    await page.click('[type="submit"]');

    // 2. Verify email (mock in test environment)
    await page.waitForSelector('[data-testid="verification-notice"]');
    const verificationToken = await getVerificationToken('newuser@example.com');
    await page.goto(`/verify-email?token=${verificationToken}`);

    // 3. Complete profile
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="company"]', 'Test Corp');
    await page.click('[data-testid="complete-profile"]');

    // 4. Create first project
    await page.click('[data-testid="create-project"]');
    await page.fill('[name="projectName"]', 'My First Project');
    await page.selectOption('[name="template"]', 'nodejs-express');
    await page.click('[data-testid="create-button"]');

    // 5. Configure project
    await page.waitForSelector('[data-testid="project-dashboard"]');
    await page.click('[data-testid="settings-tab"]');
    await page.fill('[name="NODE_ENV"]', 'production');
    await page.click('[data-testid="save-settings"]');

    // 6. Deploy project
    await page.click('[data-testid="deploy-button"]');
    await page.waitForSelector('[data-testid="deployment-progress"]');

    // Wait for deployment to complete
    await page.waitForSelector('[data-testid="deployment-success"]', {
      timeout: 300000 // 5 minutes
    });

    // 7. Verify deployment
    const deploymentUrl = await page.getAttribute('[data-testid="deployment-url"]', 'href');
    const response = await fetch(deploymentUrl);
    expect(response.status).toBe(200);

    // 8. Check metrics
    await page.click('[data-testid="metrics-tab"]');
    await page.waitForSelector('[data-testid="request-count"]');
    const requestCount = await page.textContent('[data-testid="request-count"]');
    expect(parseInt(requestCount)).toBeGreaterThan(0);
  }, 600000); // 10 minute timeout for complete flow

  // Additional E2E scenarios:
  // - Team collaboration flow
  // - Payment and subscription upgrade
  // - Project migration
  // - Error recovery flows
  // - Multi-device sync
});
```

### 2. Integration Tests - API Workflows
```typescript
describe('API Integration: Project Management', () => {
  let app: Express;
  let authToken: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    authToken = await authenticateTestUser();
  });

  describe('Project CRUD Operations', () => {
    test('complete project lifecycle', async () => {
      // 1. Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Integration Test Project',
          template: 'nodejs',
          settings: {
            environment: 'development',
            nodeVersion: '18'
          }
        })
        .expect(201);

      projectId = createResponse.body.id;
      expect(createResponse.body.status).toBe('initializing');

      // 2. Wait for initialization
      await waitForCondition(async () => {
        const status = await request(app)
          .get(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${authToken}`);
        return status.body.status === 'ready';
      }, 30000);

      // 3. Update project
      await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settings: {
            environment: 'production',
            scaling: { min: 1, max: 3 }
          }
        })
        .expect(200);

      // 4. Deploy project
      const deployResponse = await request(app)
        .post(`/api/projects/${projectId}/deploy`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branch: 'main',
          environment: 'production'
        })
        .expect(202);

      const deploymentId = deployResponse.body.deploymentId;

      // 5. Monitor deployment
      await waitForCondition(async () => {
        const deployment = await request(app)
          .get(`/api/deployments/${deploymentId}`)
          .set('Authorization', `Bearer ${authToken}`);
        return deployment.body.status === 'completed';
      }, 120000);

      // 6. Verify deployment health
      const healthResponse = await request(app)
        .get(`/api/projects/${projectId}/health`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.uptime).toBeGreaterThan(0);

      // 7. Get metrics
      const metricsResponse = await request(app)
        .get(`/api/projects/${projectId}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: '1h' })
        .expect(200);

      expect(metricsResponse.body.requests).toBeDefined();
      expect(metricsResponse.body.errors).toBeDefined();
      expect(metricsResponse.body.latency).toBeDefined();

      // 8. Clean up
      await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  // Additional integration scenarios:
  // - Concurrent operations
  // - Rate limiting behavior
  // - Error handling and recovery
  // - Webhook delivery
  // - Cross-service communication
});
```

### 3. Integration Tests - Database Transactions
```typescript
describe('Database Integration: Complex Transactions', () => {
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  test('handles complex multi-table transaction', async () => {
    await db.transaction(async (tx) => {
      // 1. Create team
      const team = await tx.query(
        'INSERT INTO teams (name, plan) VALUES ($1, $2) RETURNING *',
        ['Test Team', 'pro']
      );

      // 2. Create users
      const users = await Promise.all([
        tx.query(
          'INSERT INTO users (email, team_id) VALUES ($1, $2) RETURNING *',
          ['user1@test.com', team.rows[0].id]
        ),
        tx.query(
          'INSERT INTO users (email, team_id) VALUES ($1, $2) RETURNING *',
          ['user2@test.com', team.rows[0].id]
        )
      ]);

      // 3. Create project
      const project = await tx.query(
        'INSERT INTO projects (name, team_id, created_by) VALUES ($1, $2, $3) RETURNING *',
        ['Test Project', team.rows[0].id, users[0].rows[0].id]
      );

      // 4. Set permissions
      await Promise.all(
        users.map(user =>
          tx.query(
            'INSERT INTO project_permissions (project_id, user_id, role) VALUES ($1, $2, $3)',
            [project.rows[0].id, user.rows[0].id, 'admin']
          )
        )
      );

      // 5. Create audit log
      await tx.query(
        'INSERT INTO audit_logs (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
        ['project', project.rows[0].id, 'created', users[0].rows[0].id]
      );

      return { team: team.rows[0], project: project.rows[0], users: users.map(u => u.rows[0]) };
    });

    // Verify transaction completed
    const projectCount = await db.query('SELECT COUNT(*) FROM projects WHERE name = $1', ['Test Project']);
    expect(parseInt(projectCount.rows[0].count)).toBe(1);
  });

  test('rollback on constraint violation', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query('INSERT INTO users (email) VALUES ($1)', ['duplicate@test.com']);
        await tx.query('INSERT INTO users (email) VALUES ($1)', ['duplicate@test.com']); // Duplicate
      })
    ).rejects.toThrow(/unique constraint/i);

    // Verify rollback
    const userCount = await db.query('SELECT COUNT(*) FROM users WHERE email = $1', ['duplicate@test.com']);
    expect(parseInt(userCount.rows[0].count)).toBe(0);
  });
});
```

### 4. Load Tests - Concurrent Users
```typescript
describe('Load Testing: Concurrent Operations', () => {
  test('handles 100 concurrent API requests', async () => {
    const results = await Promise.allSettled(
      Array(100).fill(null).map(async (_, i) => {
        const response = await request(app)
          .get('/api/health')
          .set('X-Request-ID', `load-test-${i}`)
          .timeout(5000);
        return {
          status: response.status,
          duration: response.header['x-response-time']
        };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    expect(successful.length / results.length).toBeGreaterThan(0.99); // 99% success rate

    const durations = successful.map(r => parseFloat(r.value.duration));
    const p95 = percentile(durations, 95);
    expect(p95).toBeLessThan(1000); // P95 < 1 second
  });

  test('handles sustained load', async () => {
    const startTime = Date.now();
    const duration = 60000; // 1 minute
    const rps = 50; // Requests per second
    const results = [];

    while (Date.now() - startTime < duration) {
      const batchStart = Date.now();

      const batchResults = await Promise.allSettled(
        Array(rps).fill(null).map(() =>
          request(app)
            .post('/api/responses')
            .set('Authorization', `Bearer ${authToken}`)
            .send(generateTestPayload())
        )
      );

      results.push(...batchResults);

      const batchDuration = Date.now() - batchStart;
      if (batchDuration < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - batchDuration));
      }
    }

    const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
    expect(successRate).toBeGreaterThan(0.95); // 95% success rate under sustained load
  });
});
```

### 5. Cross-Service Integration Tests
```typescript
describe('Cross-Service Integration', () => {
  let services: TestServices;

  beforeAll(async () => {
    services = await startTestServices({
      api: true,
      worker: true,
      redis: true,
      postgres: true,
      webhook: true
    });
  });

  afterAll(async () => {
    await stopTestServices(services);
  });

  test('webhook delivery with retry', async () => {
    const webhookReceiver = new WebhookReceiver();
    const webhookUrl = await webhookReceiver.start();

    // Configure webhook
    await request(services.api)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: webhookUrl,
        events: ['response.completed'],
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2
        }
      })
      .expect(201);

    // Trigger event
    const response = await request(services.api)
      .post('/api/responses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'process' })
      .expect(201);

    // Wait for webhook delivery
    const webhook = await webhookReceiver.waitForWebhook(30000);

    expect(webhook.body.event).toBe('response.completed');
    expect(webhook.body.data.id).toBe(response.body.id);
    expect(webhook.headers['x-signature']).toBeDefined();
  });

  test('queue processing with worker coordination', async () => {
    // Submit batch job
    const batchResponse = await request(services.api)
      .post('/api/batch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobs: Array(50).fill(null).map((_, i) => ({
          type: 'process',
          data: { index: i }
        }))
      })
      .expect(202);

    const batchId = batchResponse.body.batchId;

    // Monitor processing
    await waitForCondition(async () => {
      const status = await request(services.api)
        .get(`/api/batch/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);

      return status.body.completed === 50;
    }, 60000);

    // Verify results
    const results = await request(services.api)
      .get(`/api/batch/${batchId}/results`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(results.body.successful).toBe(50);
    expect(results.body.failed).toBe(0);
  });
});
```

### 6. Error Recovery Tests
```typescript
describe('Error Recovery and Resilience', () => {
  test('recovers from database connection loss', async () => {
    // Simulate database disconnection
    await services.postgres.pause();

    // Attempt operation (should fail gracefully)
    const response = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(503);

    expect(response.body.error).toContain('temporarily unavailable');

    // Resume database
    await services.postgres.unpause();

    // Verify recovery
    await waitForCondition(async () => {
      const health = await request(app).get('/api/health');
      return health.body.database === 'connected';
    }, 10000);

    // Operation should work now
    await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
  });

  test('handles cascading service failures', async () => {
    // Simulate Redis failure
    await services.redis.pause();

    // System should degrade gracefully
    const response = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.headers['x-cache']).toBe('bypass');
    expect(response.headers['x-degraded']).toBe('true');

    // Resume Redis
    await services.redis.unpause();

    // Verify full functionality restored
    const cached = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cached.headers['x-cache']).toBe('hit');
  });
});
```

## Edge Cases to Test

1. **Network Edge Cases**
   - Network partition scenarios
   - Slow network conditions
   - Connection timeouts
   - DNS resolution failures
   - SSL/TLS errors

2. **Data Edge Cases**
   - Large payload handling
   - Unicode and special characters
   - Timezone edge cases
   - Locale-specific formatting
   - Data migration scenarios

3. **Concurrency Edge Cases**
   - Race conditions
   - Deadlock scenarios
   - Resource contention
   - Cache stampede
   - Connection pool exhaustion

4. **Security Edge Cases**
   - Session hijacking attempts
   - CSRF attack prevention
   - XSS prevention
   - SQL injection attempts
   - Rate limit bypass attempts

## Performance Requirements

- Page load: < 3 seconds (P95)
- API response: < 200ms (P95)
- Database query: < 100ms (P95)
- End-to-end flow: < 30 seconds
- Concurrent users: Support 1000+
- Throughput: > 1000 req/sec

## Expected Outcomes

1. **User Experience**: Smooth end-to-end flows
2. **API Reliability**: 99.9% uptime
3. **Data Consistency**: Zero data corruption
4. **Performance**: Meets all SLA targets
5. **Security**: No vulnerabilities in flows

## Validation Checklist

- [ ] All critical user journeys tested
- [ ] API integration tests complete
- [ ] Database transaction tests passing
- [ ] Load tests meet requirements
- [ ] Error recovery validated
- [ ] Security scenarios tested
- [ ] Performance benchmarks met
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness tested
- [ ] Accessibility compliance verified

## Jest Configuration for Integration Tests

```javascript
// jest.integration.config.js
module.exports = {
  displayName: 'integration',
  testMatch: ['**/tests/integration/**/*.test.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // Run sequentially for database
  globalSetup: './tests/setup/integration.js',
  globalTeardown: './tests/teardown/integration.js',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

// jest.e2e.config.js
module.exports = {
  displayName: 'e2e',
  preset: 'jest-playwright-preset',
  testMatch: ['**/tests/e2e/**/*.test.ts'],
  testTimeout: 60000,
  globalSetup: './tests/setup/e2e.js',
  globalTeardown: './tests/teardown/e2e.js',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  }
};
```

## Testing Best Practices

1. **Test Data Management**
   - Use dedicated test databases
   - Create test data factories
   - Clean up after each test
   - Use realistic data volumes

2. **Test Isolation**
   - Each test should be independent
   - Reset state between tests
   - Use transactions for database tests
   - Mock external services

3. **Performance Testing**
   - Include performance assertions
   - Monitor resource usage
   - Test with realistic load
   - Profile slow tests

4. **Debugging Support**
   - Comprehensive logging
   - Screenshot on E2E failures
   - Network request recording
   - Test replay capability