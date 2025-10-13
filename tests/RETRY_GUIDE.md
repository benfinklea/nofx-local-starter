# Test Retry Guide

This guide explains how to use the retry utilities to make tests more resilient to transient failures.

## Automatic Retry in CI

Jest is configured to automatically retry failed tests **2 times** in CI environments (when `CI` env var is set). This helps reduce false negatives from flaky tests.

```javascript
// jest.config.js
retry: process.env.CI ? 2 : 0, // Retry twice in CI, no retry locally
```

## Manual Retry Utilities

For more control, use the retry helpers in `tests/helpers/retry.ts`:

### Basic Async Retry

```typescript
import { retryAsync } from '../helpers/retry';

it('should eventually succeed', async () => {
  const result = await retryAsync(
    async () => {
      const data = await fetchData();
      expect(data).toBeDefined();
      return data;
    },
    {
      maxAttempts: 3,
      delayMs: 100,
      exponentialBackoff: true
    }
  );
});
```

### Wrap Entire Test with Retry

```typescript
import { retryTest } from '../helpers/retry';

it('flaky network test', retryTest(async () => {
  const response = await fetch('https://api.example.com');
  expect(response.ok).toBe(true);
}, { maxAttempts: 3 }));
```

### Wait for Condition

```typescript
import { waitFor } from '../helpers/retry';

it('should wait for element', async () => {
  await waitFor(
    () => document.querySelector('.loaded') !== null,
    { timeout: 5000, interval: 100 }
  );
});
```

### Eventually Assertions

```typescript
import { eventually } from '../helpers/retry';

it('should eventually be true', async () => {
  await eventually(() => {
    expect(getStatus()).toBe('ready');
  }, { timeout: 5000 });
});
```

### Retry with Timeout

```typescript
import { withTimeout } from '../helpers/retry';

it('should complete within timeout', async () => {
  const result = await withTimeout(
    longRunningOperation(),
    5000,
    'Operation took too long'
  );
});
```

### Retry HTTP Requests

```typescript
import { retryFetch } from '../helpers/retry';

it('should retry failed requests', async () => {
  const response = await retryFetch('https://api.example.com', {
    maxRetries: 3
  });
  expect(response.ok).toBe(true);
});
```

## Custom Retry Logic

```typescript
import { retryAsync } from '../helpers/retry';

await retryAsync(
  async () => {
    // Your code here
  },
  {
    maxAttempts: 5,
    delayMs: 200,
    exponentialBackoff: true,
    shouldRetry: (error) => {
      // Custom retry logic
      return error.message.includes('ECONNRESET');
    },
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}:`, error.message);
    }
  }
);
```

## Global Test Utilities

Available via `global.testUtils`:

### Wait For Condition

```typescript
await global.testUtils.waitFor(
  () => someCondition === true,
  5000, // timeout ms
  100   // interval ms
);
```

### Flush Promises

```typescript
// Wait for all pending promises to resolve
await global.testUtils.flushPromises();
```

### Database Cleanup (with retry)

```typescript
// Automatically retries 3 times
await global.testUtils.cleanDatabase();
```

## Common Transient Errors

The retry helpers automatically retry on these common transient failures:

- **Network errors**: `ECONNREFUSED`, `ECONNRESET`, `EPIPE`, `socket hang up`
- **Timeouts**: Any error containing "timeout"
- **Database errors**: Connection pool issues, locks
- **Race conditions**: `Cannot read properties of undefined`

## Best Practices

### 1. Use Retries for External Dependencies

```typescript
// ✅ Good - retry external API calls
it('fetches data from API', retryTest(async () => {
  const data = await externalAPI.fetch();
  expect(data).toBeDefined();
}));

// ❌ Bad - don't retry pure logic tests
it('adds two numbers', retryTest(() => {
  expect(1 + 1).toBe(2); // No need to retry pure logic
}));
```

### 2. Use Appropriate Timeouts

```typescript
// ✅ Good - reasonable timeout
await waitFor(() => condition, { timeout: 5000 });

// ❌ Bad - timeout too short
await waitFor(() => condition, { timeout: 10 }); // May fail unnecessarily
```

### 3. Clean Up After Tests

```typescript
afterEach(async () => {
  // Use cleanup with retry to avoid teardown failures
  await cleanupWithRetry(async () => {
    await cleanupResources();
  });
});
```

### 4. Combine with Eventually for Assertions

```typescript
// ✅ Good - wait for condition to be true
await eventually(() => {
  const status = getAsyncStatus();
  expect(status).toBe('completed');
});

// ❌ Bad - immediate assertion may fail
expect(getAsyncStatus()).toBe('completed');
```

## Debugging Flaky Tests

### 1. Enable Retry Logging

```typescript
await retryAsync(
  async () => { /* test code */ },
  {
    onRetry: (attempt, error) => {
      console.log(`Attempt ${attempt} failed:`, error);
    }
  }
);
```

### 2. Run Tests Multiple Times

```bash
# Run test 10 times to detect flakiness
for i in {1..10}; do npm test -- path/to/test.ts; done
```

### 3. Increase Timeouts in CI

```typescript
if (process.env.CI) {
  jest.setTimeout(60000); // 60s in CI
}
```

## Configuration

### Jest Config (jest.config.js)

```javascript
{
  testTimeout: 30000,           // 30s default timeout
  retry: process.env.CI ? 2 : 0, // Auto-retry in CI
  forceExit: true,              // Force exit to prevent hangs
  detectOpenHandles: true        // Detect resource leaks
}
```

### Environment Variables

- `CI=true` - Enables automatic retry (2 attempts)
- `INTEGRATION_TEST=true` - Enables database cleanup with retry

## Examples

### Example 1: Flaky Network Test

```typescript
import { retryTest } from '../helpers/retry';

describe('API Integration', () => {
  it('fetches user data', retryTest(async () => {
    const response = await fetch('/api/users/1');
    const data = await response.json();
    expect(data.id).toBe(1);
  }, { maxAttempts: 3, delayMs: 500 }));
});
```

### Example 2: Database Test with Cleanup

```typescript
import { cleanupWithRetry } from '../helpers/retry';

describe('Database Operations', () => {
  afterEach(async () => {
    await cleanupWithRetry(async () => {
      await db.query('DELETE FROM test_table');
    });
  });

  it('inserts record', async () => {
    await db.insert({ id: 1, name: 'test' });
    const record = await db.findById(1);
    expect(record).toBeDefined();
  });
});
```

### Example 3: Eventually Assertion

```typescript
import { eventually } from '../helpers/retry';

describe('Async State', () => {
  it('updates state asynchronously', async () => {
    // Trigger async update
    triggerAsyncUpdate();

    // Wait for state to update
    await eventually(() => {
      const state = getState();
      expect(state.isUpdated).toBe(true);
    }, { timeout: 5000, interval: 100 });
  });
});
```

## Troubleshooting

### Tests Still Failing After Retry

1. **Check if error is truly transient** - Some errors are permanent and should fail
2. **Increase timeout** - Operation may need more time
3. **Add logging** - Use `onRetry` callback to debug
4. **Check for resource leaks** - Use `detectOpenHandles: true`

### Tests Hanging

1. **Check for unclosed resources** - Database connections, file handles
2. **Use `forceExit: true`** - Already enabled in jest.config.js
3. **Add timeouts** - Use `withTimeout()` wrapper
4. **Check async operations** - Ensure all promises resolve

### Cleanup Failures

1. **Use `cleanupWithRetry()`** - Automatically retries cleanup
2. **Ignore non-critical failures** - Don't throw in cleanup
3. **Add delay before cleanup** - Allow operations to complete

## Additional Resources

- Jest Retry Documentation: https://jestjs.io/docs/jest-object#jestretrytimes-numofretriesonfailure
- Test Flakiness Best Practices: https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html
