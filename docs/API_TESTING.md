# API Testing Documentation

## Overview
Complete test suite for all 28 Vercel API endpoints using Jest, Newman (Postman), and custom test utilities for comprehensive API validation, contract testing, and smoke testing.

## Test Structure

### Jest Tests (Unit & Integration)
```
tests/api/
├── setup.ts              # Test configuration and environment setup
├── utils/
│   └── testHelpers.ts    # Mock utilities and factories
├── health.test.ts        # Health endpoint tests
├── runs.test.ts          # Run management endpoints (9 endpoints)
├── projects.test.ts      # Project management endpoints (5 endpoints)
├── all-endpoints.test.ts # Comprehensive smoke tests for all 28 endpoints
```

### Newman Collections (API & Contract Testing)
```
collections/
├── nofx-smoke-tests.json     # Critical endpoint health checks
├── nofx-api-tests.json       # Comprehensive API testing
├── nofx-auth-tests.json      # Authentication flows
├── nofx-admin-tests.json     # Admin-only endpoints
└── nofx-contract-tests.json  # API contract validation

environments/
├── local.json                # Local development (http://localhost:3000)
├── staging.json              # Staging environment
└── production.json           # Production (health checks only)
```

## Running Tests

### Quick Start
```bash
# Jest API tests
npm run test:api                # Run all Jest API tests
npm run test:api:watch          # Watch mode for development
npm run test:api:coverage       # Generate coverage report

# Newman API tests
npm run test:smoke              # Fast smoke tests (< 30 seconds)
npm run test:api:newman         # Full Newman API suite
npm run test:contracts          # API contract validation

# Combined testing
npm run test:vercel             # Pre-deployment test suite
npm run precommit:test          # Run before commits
```

### Test Commands

#### Jest Commands
| Command | Description |
|---------|-------------|
| `npm run test:api` | Run all Jest API tests once |
| `npm run test:api:watch` | Run Jest tests in watch mode |
| `npm run test:api:coverage` | Generate Jest coverage report |

#### Newman Commands
| Command | Description |
|---------|-------------|
| `npm run test:smoke` | Fast smoke tests (critical endpoints) |
| `npm run test:api:newman` | Full Newman API test suite |
| `npm run test:contracts` | API contract validation |
| `newman run collections/nofx-smoke-tests.json` | Direct Newman execution |

#### Combined Commands
| Command | Description |
|---------|-------------|
| `npm run test:vercel` | Pre-deployment test suite (Jest + Newman) |
| `npm run precommit:test` | Run before commits (fast tests only) |

## Test Coverage

### Current Coverage (28 endpoints)
- ✅ **Health Check** - 100% coverage
- ✅ **Core Runs** (9 endpoints) - Full test suite
- ✅ **Projects** (5 endpoints) - Full CRUD tests
- ✅ **Settings** (2 endpoints) - Mock implementation
- ✅ **Models** (3 endpoints) - Mock implementation
- ✅ **Backups** (3 endpoints) - Mock implementation
- ✅ **Responses** (7 endpoints) - Mock implementation
- ✅ **Gates** (3 endpoints) - Mock implementation

### Test Categories

#### 1. Unit Tests
- Individual endpoint functionality
- Input validation
- Error handling
- Authentication checks

#### 2. Integration Tests
- Database operations (mocked)
- Queue operations (mocked)
- Event recording (mocked)

#### 3. Smoke Tests (Newman)
- All endpoints respond (< 30 seconds)
- Method validation
- Authentication requirements
- Cross-environment validation

#### 4. Contract Tests (Newman)
- API schema validation
- Request/response format verification
- Breaking change detection
- Backward compatibility checks

## Writing Tests

### Newman Collection Structure

#### Basic Postman Collection Template
```json
{
  "info": {
    "name": "NOFX API Tests",
    "description": "API testing for NOFX Control Plane",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/health",
          "host": ["{{baseUrl}}"],
          "path": ["api", "health"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('API is healthy', function () {",
              "    pm.response.to.have.status(200);",
              "    pm.expect(pm.response.json().status).to.eql('ok');",
              "});"
            ]
          }
        }
      ]
    }
  ]
}
```

#### Environment Configuration
```json
{
  "name": "Local Development",
  "values": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "enabled": true
    },
    {
      "key": "adminPassword",
      "value": "{{$randomPassword}}",
      "enabled": true
    },
    {
      "key": "authToken",
      "value": "",
      "enabled": true
    }
  ]
}
```

### Jest Test Template
```typescript
import handler from '../../api/your-endpoint';
import { callHandler, factories, resetMocks } from './utils/testHelpers';

describe('Your Endpoint', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should handle GET request', async () => {
    const response = await callHandler(handler, {
      method: 'GET',
      query: { id: 'test-123' },
      authenticated: true,
    });

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      // Expected response
    });
  });
});
```

### Using Test Factories
```typescript
const mockRun = factories.run({ id: 'custom-id' });
const mockProject = factories.project({ name: 'Test Project' });
const mockGate = factories.gate({ status: 'approved' });
```

### Mocking Dependencies
```typescript
jest.mock('../../src/lib/store', () => ({
  store: mockStore,
}));

mockStore.getRun.mockResolvedValue(mockRun);
```

## Newman Setup and Installation

### Installation
```bash
# Install Newman globally for CLI usage
npm install -g newman

# Or install locally for project
npm install --save-dev newman
```

### Creating Collections

#### 1. Export from Postman
1. Create collections in Postman application
2. Export as Collection v2.1 format
3. Save to `collections/` directory

#### 2. Generate Programmatically
```bash
# Install Newman collection SDK
npm install --save-dev postman-collection

# Generate collection from OpenAPI spec
npx openapi-to-postman -s docs/openapi.yaml -o collections/nofx-api-tests.json
```

### Running Newman Tests

#### Basic Execution
```bash
# Run smoke tests
newman run collections/nofx-smoke-tests.json \
  --environment environments/local.json

# Run with reporters
newman run collections/nofx-api-tests.json \
  --environment environments/local.json \
  --reporters cli,json \
  --reporter-json-export results.json

# Run with custom options
newman run collections/nofx-api-tests.json \
  --environment environments/local.json \
  --timeout-request 30000 \
  --insecure \
  --disable-unicode
```

#### CI/CD Integration
```bash
# Newman in CI (exit on failure)
newman run collections/nofx-smoke-tests.json \
  --environment environments/staging.json \
  --reporters cli,junit \
  --reporter-junit-export newman-results.xml \
  --bail
```

## Environment Setup

### Test Environment Variables
Create `.env.test`:
```env
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/nofx_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key
SILENT_TESTS=true
```

### Local Testing with Services
```bash
# Start PostgreSQL
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=nofx_test \
  postgres:15

# Start Redis
docker run -d -p 6379:6379 redis:7

# Run tests
npm run test:api
```

## CI/CD Integration

### GitHub Actions
The workflow automatically:
1. Sets up PostgreSQL and Redis services
2. Runs tests on Node 18.x and 20.x
3. Generates coverage reports
4. Deploys to Vercel on success

### Required Secrets
Set in GitHub repository settings:
- `VERCEL_TOKEN` - Vercel authentication token
- `VERCEL_ORG_ID` - Organization ID from Vercel
- `VERCEL_PROJECT_ID` - Project ID from Vercel

## Debugging Tests

### Verbose Output
```bash
# Run with detailed logging
SILENT_TESTS=false npm run test:api

# Debug specific test file
npx jest tests/api/runs.test.ts --verbose
```

### Common Issues

#### Database Connection Errors
- Mocked in tests, no real database needed
- Check mock implementations in test files

#### Authentication Failures
- Default tests use mocked auth (`isAdmin: true`)
- Override with `authenticated: false` in test

#### Timeout Issues
- Default timeout: 30 seconds
- Increase in `jest.config.api.js` if needed

## Test Reports

### Coverage Report
```bash
# Generate HTML coverage report
npm run test:api:coverage

# View report
open coverage/api/index.html
```

### Coverage Goals
- Line Coverage: > 80%
- Branch Coverage: > 75%
- Function Coverage: > 80%
- Statement Coverage: > 80%

## Best Practices

1. **Reset Mocks** - Always reset between tests
2. **Test Isolation** - Each test should be independent
3. **Mock External Services** - Never call real APIs
4. **Test Edge Cases** - Invalid inputs, errors, auth failures
5. **Use Factories** - Consistent test data generation
6. **Descriptive Names** - Clear test descriptions
7. **Arrange-Act-Assert** - Structure tests clearly

## Extending Tests

### Adding New Endpoint Tests
1. Create test file in `tests/api/`
2. Import handler and test utilities
3. Mock dependencies
4. Write test cases
5. Update `all-endpoints.test.ts`

### Adding Test Utilities
1. Add to `tests/api/utils/testHelpers.ts`
2. Export for use in tests
3. Document usage

## Maintenance

### Updating Mocks
When API changes:
1. Update mock implementations
2. Update test factories
3. Run tests to verify
4. Update coverage goals

### Test Performance
- Keep tests fast (< 30s total)
- Use minimal test data
- Mock heavy operations
- Parallelize when possible