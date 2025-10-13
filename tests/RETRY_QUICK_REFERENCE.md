# Test Retry - Quick Reference

## 🚀 Quick Start

```typescript
import { retryTest, waitFor, eventually } from '../helpers/retry';
```

## 📋 Common Patterns

### Wrap Entire Test
```typescript
it('flaky test', retryTest(async () => {
  // test code
}, { maxAttempts: 3 }));
```

### Wait for Condition
```typescript
await waitFor(() => isReady, { timeout: 5000 });
```

### Eventually Assertion
```typescript
await eventually(() => {
  expect(status).toBe('done');
});
```

### Retry Async Operation
```typescript
const result = await retryAsync(async () => {
  return await fetchData();
});
```

### Global Utilities
```typescript
await global.testUtils.waitFor(() => ready, 5000);
await global.testUtils.flushPromises();
```

## 🎛️ Configuration

### Retry Options
```typescript
{
  maxAttempts: 3,           // Max retry attempts
  delayMs: 100,             // Delay between retries
  exponentialBackoff: true, // Double delay each time
  shouldRetry: (err) => true, // Custom retry logic
  onRetry: (attempt, err) => {} // Retry callback
}
```

## 🔍 Debug

```bash
DEBUG_RETRY=1 npm test  # Show retry attempts
```

## ✅ Automatically Retried Errors

- Timeouts
- Network errors (ECONNREFUSED, ECONNRESET, EPIPE)
- Database issues (pool, lock)
- Race conditions
- Socket hang ups

## 🚫 NOT Retried

- Assertion errors (Expected vs Received)
- Validation errors (unless custom `shouldRetry`)

## 📚 Full Documentation

- Comprehensive guide: `tests/RETRY_GUIDE.md`
- Implementation summary: `RETRY_IMPLEMENTATION_SUMMARY.md`
- Test examples: `tests/unit/retry.test.ts`

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests still failing | Enable `DEBUG_RETRY=1` |
| Open handles | All timeouts now properly cleaned up |
| Cleanup fails | Use `cleanupWithRetry()` |
| Need custom retry | Pass `shouldRetry` function |

## 🎯 CI Configuration

Tests automatically retry 2x in CI (when `CI=true`):
```javascript
jest.retryTimes(process.env.CI ? 2 : 0);
```

---
**Status**: ✅ All systems operational - No open handles!
