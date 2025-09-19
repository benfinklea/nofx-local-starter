# 🚀 PREREQUISITES & SETUP

## ⚠️ IMPORTANT: Complete These Steps Before Starting Any Workstream

### 1. Environment Verification

```bash
# Check Node.js version (requires 18+)
node --version

# Check npm version
npm --version

# Verify TypeScript
npx tsc --version

# Check existing test coverage baseline
npm run test:coverage
```

### 2. Install Required Dependencies

```bash
# Core testing dependencies (if not already installed)
npm install --save-dev @types/jest @types/node supertest @types/supertest

# Security testing tools
npm install --save-dev snyk npm-audit-html

# Performance testing tools
npm install --save-dev autocannon clinic

# Coverage tools
npm install --save-dev nyc c8

# Mutation testing (optional but recommended)
npm install --save-dev stryker-cli @stryker-mutator/core
```

### 3. Create Test Structure

```bash
# Create test directories if they don't exist
mkdir -p tests/unit/security
mkdir -p tests/unit/infrastructure
mkdir -p tests/unit/data
mkdir -p tests/unit/performance
mkdir -p tests/unit/observability
mkdir -p tests/unit/compliance
mkdir -p tests/integration/security
mkdir -p tests/e2e
mkdir -p tests/chaos
```

### 4. Update package.json Scripts

Add these test scripts to your package.json:

```json
{
  "scripts": {
    "test:security": "jest tests/unit/security tests/integration/security",
    "test:infrastructure": "jest tests/unit/infrastructure",
    "test:data": "jest tests/unit/data",
    "test:performance": "jest tests/unit/performance",
    "test:observability": "jest tests/unit/observability",
    "test:compliance": "jest tests/unit/compliance",
    "test:mutation": "stryker run",
    "audit:security": "npm audit && snyk test",
    "coverage:report": "nyc report --reporter=html --reporter=text"
  }
}
```

### 5. Environment Variables

Create a `.env.test` file with test configurations:

```bash
# Test Environment Variables
NODE_ENV=test
LOG_LEVEL=error
QUEUE_DRIVER=memory
STORE_DRIVER=fs
TEST_TIMEOUT=30000
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test-key-123
SUPABASE_SERVICE_ROLE_KEY=test-service-key-456
```

### 6. Git Configuration

```bash
# Create a test branch for all workstreams
git checkout -b feat/unbreakability-initiative

# Create .gitignore entries
echo "coverage/" >> .gitignore
echo "*.log" >> .gitignore
echo ".nyc_output/" >> .gitignore
echo "test-results/" >> .gitignore
```

### 7. Mock Setup Utilities

Create `tests/helpers/mocks.ts`:

```typescript
// Shared mock utilities for all workstreams
export const mockDatabase = {
  query: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

export const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  connect: jest.fn()
};

export const mockSupabase = {
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      remove: jest.fn()
    }))
  },
  from: jest.fn(() => ({
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }))
};

export const resetAllMocks = () => {
  jest.clearAllMocks();
};
```

### 8. Test Database Setup

```bash
# Create test database (if using PostgreSQL)
createdb nofx_test

# Run migrations on test database
npm run migrate:test
```

### 9. Performance Baseline

Record current performance metrics:

```bash
# Capture baseline metrics
npm run test:bulletproof 2>&1 | tee baseline-metrics.txt

# Record current coverage
npm run test:coverage 2>&1 | tee baseline-coverage.txt
```

### 10. Validation Checklist

Before starting any workstream, verify:

- [ ] All dependencies installed successfully
- [ ] Test directories created
- [ ] package.json scripts added
- [ ] .env.test file configured
- [ ] Git branch created
- [ ] Mock utilities available
- [ ] Baseline metrics recorded
- [ ] No existing test failures (`npm test` passes)

## 🎯 Success Criteria

You're ready to proceed when:
1. `npm run test:bulletproof` shows 194+ tests passing
2. No npm vulnerabilities (`npm audit`)
3. All test directories exist
4. Mock utilities compile without errors

## 🚨 Common Issues & Solutions

### Issue: Port conflicts
**Solution**: Kill existing processes
```bash
lsof -ti:5432 | xargs kill -9  # PostgreSQL
lsof -ti:6379 | xargs kill -9  # Redis
lsof -ti:3000 | xargs kill -9  # API
```

### Issue: Permission denied
**Solution**: Fix npm permissions
```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Issue: Out of memory during tests
**Solution**: Increase Node memory
```bash
export NODE_OPTIONS="--max_old_space_size=4096"
```

## ✅ Ready to Start!

Once all prerequisites are complete, you can:
1. Pick any workstream document (01-06)
2. Work independently without conflicts
3. Run workstream-specific tests without affecting others

**Each workstream is completely independent - choose any one and begin!**