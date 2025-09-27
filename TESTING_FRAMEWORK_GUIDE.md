# 🧪 Testing Framework Guide - NOFX Control Plane

## Overview

The NOFX Control Plane uses a multi-layered testing strategy combining multiple frameworks to ensure reliability, performance, and security across all environments.

## Framework Selection Matrix

| Test Type | Primary Framework | Alternative | When to Use | Coverage Target |
|-----------|------------------|-------------|-------------|-----------------|
| **Unit Tests** | Jest | Vitest (existing only) | Core logic, handlers, utilities | 80%+ |
| **API Tests** | Newman + Jest | Postman | Endpoints, contracts, smoke tests | 90%+ |
| **E2E Tests** | Playwright | Cypress | User workflows, complex interactions | 5-10% |
| **Load Tests** | Artillery | k6 | Performance validation, scalability | Critical paths |
| **Security Tests** | OWASP ZAP | Jest (auth) | Vulnerability scanning, auth bypass | All endpoints |
| **Contract Tests** | Pact + Newman | JSON Schema | API contracts, breaking changes | API boundaries |

## Testing Pyramid for NOFX

```
┌─────────────────────────────────────┐
│           E2E Tests (5-10%)         │  ← Playwright + Cypress
│         Critical User Journeys      │    • Run creation workflows
│                                     │    • Admin dashboard flows
├─────────────────────────────────────┤    • Authentication flows
│       Integration Tests (20%)       │  ← Newman + Contract Tests
│     API Endpoints, Queue Flows      │    • All 28 API endpoints
│                                     │    • Queue processing
├─────────────────────────────────────┤    • Handler integrations
│        Unit Tests (70%)            │  ← Jest + Vitest
│   Handlers, Services, Utilities     │    • Business logic
│                                     │    • Error handling
└─────────────────────────────────────┘    • Input validation

Supporting Layers:
│ Smoke Tests    │ ← Newman (Fast health checks)
│ Load Tests     │ ← Artillery (Performance validation)
│ Security Tests │ ← OWASP ZAP (Vulnerability scanning)
│ Contract Tests │ ← Pact (API contract validation)
```

## Framework Configurations

### Jest (Unit Tests)
**Location**: `jest.config.js`
**Purpose**: Core business logic, utilities, handlers

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 }
  }
};
```

**Commands**:
```bash
npm test              # Run all unit tests with coverage
npm run test:unit     # Unit tests only
npm run test:watch    # Watch mode for development
```

### Newman (API & Smoke Tests)
**Location**: `collections/`, `environments/`
**Purpose**: API testing, smoke tests, contract validation

```bash
# Install Newman
npm install --save-dev newman

# Run smoke tests
newman run collections/nofx-smoke-tests.json --environment environments/local.json

# Run full API suite
newman run collections/nofx-api-tests.json --reporters cli,json
```

**Collections Structure**:
```
collections/
├── nofx-smoke-tests.json        # Critical endpoint health checks
├── nofx-api-tests.json          # Comprehensive API testing
├── nofx-auth-tests.json         # Authentication flows
└── nofx-admin-tests.json        # Admin-only endpoints

environments/
├── local.json                   # Local development
├── staging.json                 # Staging environment
└── production.json              # Production (health checks only)
```

### Playwright (E2E Tests)
**Location**: `playwright.config.ts`, `tests/e2e/`
**Purpose**: End-to-end user workflows, browser testing

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } }
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  }
});
```

**Commands**:
```bash
npm run test:e2e              # Run all E2E tests
npx playwright test --ui      # Interactive mode
npx playwright show-report    # View test results
```

### Artillery (Load Tests)
**Location**: `artillery.yml`, `tests/load/`
**Purpose**: Performance testing, scalability validation

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "API Load Test"
    flow:
      - post:
          url: "/api/runs"
          json: { plan: { goal: "Load test" } }
```

**Commands**:
```bash
npm install --save-dev artillery
npm run test:load             # Run load tests
artillery run artillery.yml   # Direct execution
```

## Test Organization

### Directory Structure
```
tests/
├── unit/                     # Jest unit tests
│   ├── handlers/
│   ├── services/
│   └── utils/
├── api/                      # Jest API integration tests
│   ├── routes/
│   └── utils/
├── e2e/                      # Playwright E2E tests
│   ├── auth/
│   ├── runs/
│   └── admin/
├── load/                     # Artillery load tests
│   ├── api-load.yml
│   └── worker-load.yml
├── security/                 # Security tests
│   ├── auth.test.ts
│   └── injection.test.ts
└── setup/                    # Test configuration
    ├── global-setup.ts
    └── test-helpers.ts

collections/                  # Newman collections
├── nofx-smoke-tests.json
├── nofx-api-tests.json
└── nofx-auth-tests.json

environments/                 # Newman environments
├── local.json
├── staging.json
└── production.json
```

## Test Execution Strategy

### Development Workflow
```bash
# 1. Unit tests during development
npm run test:watch

# 2. API tests before commits
npm run test:api

# 3. Smoke tests before deployment
newman run collections/nofx-smoke-tests.json

# 4. Full E2E before releases
npm run test:e2e
```

### CI/CD Pipeline
```bash
# Stage 1: Fast feedback (< 5 minutes)
npm run test:unit
npm run test:api
newman run collections/nofx-smoke-tests.json

# Stage 2: Integration (< 15 minutes)
npm run test:e2e
npm run test:load

# Stage 3: Security (< 10 minutes)
npm run test:security
zap-baseline.py -t http://localhost:3000
```

### Pre-deployment Checklist
```bash
# Required before any deployment
npm run test                  # Unit tests (80%+ coverage)
npm run test:api             # API tests (all endpoints)
newman run collections/nofx-smoke-tests.json  # Smoke tests

# Required before production deployment
npm run test:e2e             # E2E tests (critical paths)
npm run test:load            # Load tests (performance gates)
npm run test:security        # Security tests (vulnerability scan)
```

## Framework-Specific Best Practices

### Jest Best Practices
1. **Test Isolation**: Reset mocks between tests
2. **Test Data**: Use factories for consistent test data
3. **Error Testing**: Test error paths explicitly
4. **Async Testing**: Use async/await, not callbacks
5. **Coverage**: Focus on meaningful coverage, not just numbers

### Newman Best Practices
1. **Environment Variables**: Use environments for different configs
2. **Test Data**: Generate dynamic test data in pre-request scripts
3. **Assertions**: Write comprehensive test assertions
4. **Collections**: Organize by feature, not HTTP method
5. **Documentation**: Document API contracts in collection descriptions

### Playwright Best Practices
1. **Page Objects**: Use page object pattern for reusability
2. **Test Isolation**: Each test should be independent
3. **Waiting**: Use auto-waiting, avoid fixed delays
4. **Debugging**: Use `page.pause()` for interactive debugging
5. **Parallelization**: Design tests to run in parallel safely

### Artillery Best Practices
1. **Realistic Load**: Model actual user behavior
2. **Gradual Ramp**: Gradually increase load, don't start at peak
3. **Metrics**: Monitor both response time and error rate
4. **Environment**: Test against production-like environments
5. **Cleanup**: Clean up test data after load tests

## Integration with NOFX Architecture

### Handler Testing Strategy
```typescript
// handlers/*.test.ts
describe('CodegenHandler', () => {
  it('should be idempotent', async () => {
    const ctx = createTestContext();
    const result1 = await handler.run(ctx);
    const result2 = await handler.run(ctx);
    expect(result1).toEqual(result2);
  });

  it('should handle errors gracefully', async () => {
    const ctx = createFailingContext();
    const result = await handler.run(ctx);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Queue Testing Strategy
```typescript
// queue/*.test.ts
describe('Queue Integration', () => {
  it('should process steps in order', async () => {
    await enqueue(STEP_READY_TOPIC, { runId, stepId });
    // Verify processing order and completion
  });

  it('should handle queue failures', async () => {
    // Test queue resilience and retry logic
  });
});
```

### API Testing Strategy
```javascript
// Newman collection example
{
  "name": "Create Run",
  "request": {
    "method": "POST",
    "url": "{{baseUrl}}/api/runs",
    "body": {
      "mode": "raw",
      "raw": "{{createRunPayload}}"
    }
  },
  "event": [{
    "listen": "test",
    "script": {
      "exec": [
        "pm.test('Run created successfully', () => {",
        "    pm.response.to.have.status(200);",
        "    pm.expect(pm.response.json().success).to.be.true;",
        "    pm.globals.set('runId', pm.response.json().data.id);",
        "});"
      ]
    }
  }]
}
```

## Troubleshooting Common Issues

### Jest Issues
- **Memory leaks**: Use `--detectOpenHandles` flag
- **Timeout errors**: Increase `testTimeout` in config
- **Mock issues**: Reset mocks in `beforeEach` hooks

### Newman Issues
- **Environment variables**: Check variable scoping (global vs environment)
- **SSL errors**: Use `--insecure` flag for self-signed certificates
- **Rate limiting**: Add delays between requests in collection

### Playwright Issues
- **Flaky tests**: Use proper waits, avoid race conditions
- **Browser context**: Ensure proper cleanup between tests
- **Element selection**: Use stable selectors, avoid auto-generated IDs

### Artillery Issues
- **Connection errors**: Check target URL and network connectivity
- **Memory usage**: Monitor memory during long-running tests
- **Rate limiting**: Respect API rate limits in load scenarios

## Metrics and Reporting

### Coverage Reports
```bash
# Generate comprehensive coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Test Reports
```bash
# Newman JSON reports
newman run collection.json --reporters json --reporter-json-export results.json

# Playwright HTML reports
npx playwright show-report

# Artillery performance reports
artillery run --output report.json artillery.yml
artillery report report.json
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Test Suite
  run: |
    npm run test:unit
    npm run test:api
    newman run collections/nofx-smoke-tests.json
    npm run test:e2e
```

## Migration from Current Setup

### Phase 1: Newman Integration (Week 1)
1. Install Newman and create basic collections
2. Convert existing API tests to Newman format
3. Set up environment configurations
4. Integrate into CI/CD pipeline

### Phase 2: Enhanced E2E (Week 2)
1. Upgrade Playwright configuration
2. Create comprehensive E2E test suites
3. Add browser compatibility testing
4. Set up parallel execution

### Phase 3: Performance Testing (Week 3)
1. Install and configure Artillery
2. Create load test scenarios
3. Set up performance monitoring
4. Define performance gates

### Phase 4: Security Integration (Week 4)
1. Set up OWASP ZAP integration
2. Create security test suites
3. Add vulnerability scanning to CI/CD
4. Implement security gates

## Next Steps

1. **Review current test coverage** - Identify gaps in existing tests
2. **Install new frameworks** - Newman, Artillery, enhanced Playwright
3. **Create test collections** - Newman collections for API testing
4. **Enhance configurations** - Update configs for production readiness
5. **Integrate CI/CD** - Add new testing stages to deployment pipeline
6. **Train team** - Ensure team understands new testing strategy

---

**Note**: This guide aligns with the AI_CODER_GUIDE.md requirements and maintains compatibility with existing Jest and Playwright setups while adding the missing modern testing capabilities essential for production-grade software delivery.