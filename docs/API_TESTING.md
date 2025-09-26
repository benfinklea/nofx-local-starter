# API Testing Documentation

## Overview
Complete test suite for all 28 Vercel API endpoints using Jest and custom test utilities.

## Test Structure

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

## Running Tests

### Quick Start
```bash
# Run all API tests
npm run test:api

# Watch mode for development
npm run test:api:watch

# With coverage report
npm run test:api:coverage

# Run before deployment
npm run test:vercel
```

### Test Commands
| Command | Description |
|---------|-------------|
| `npm run test:api` | Run all API tests once |
| `npm run test:api:watch` | Run tests in watch mode |
| `npm run test:api:coverage` | Generate coverage report |
| `npm run test:vercel` | Pre-deployment test suite |
| `npm run precommit:test` | Run before commits |

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

#### 3. Smoke Tests
- All endpoints respond
- Method validation
- Authentication requirements

## Writing Tests

### Basic Test Template
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