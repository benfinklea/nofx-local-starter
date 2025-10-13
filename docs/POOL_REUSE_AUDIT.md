# Database Pool Reuse Audit

**Date:** 2025-10-12
**Status:** ⚠️ Partial Implementation - Action Required

---

## Executive Summary

We've successfully implemented database pool reuse in **1 out of 3** test files. Two test files still create/destroy pools inefficiently, adding 200-400ms overhead per operation.

### ✅ Already Fixed
- **`tests/performance/benchmarks.test.ts`** - Pool reuse implemented (4.7x speedup achieved)

### ⚠️ Needs Updating
- **`tests/integration/reliability.db.integration.test.ts`** - Creates 3 pools per test run
- **`tests/performance/stress.test.ts`** - Creates multiple pools per test

### ✅ Source Code
- **`src/lib/db.ts`** - Already uses a singleton shared pool ✅
- **`src/worker/health.ts`** - Creates pool for health checks (acceptable for health checks)

---

## Detailed Analysis

### 1. ✅ tests/performance/benchmarks.test.ts (FIXED)

**Status:** Pool reuse fully implemented

**What was done:**
```typescript
describe('Database Benchmarks', () => {
  let dbPool: Pool = null; // Shared pool

  beforeAll(async () => {
    dbPool = new Pool({ /* config */ });
    await dbPool.query('SELECT 1'); // Warm up
  });

  afterAll(async () => {
    await dbPool.end(); // Clean up once
  });

  // All tests reuse dbPool
});
```

**Performance Impact:**
- Cold start: 246.67ms ❌
- Warm pool: 52.72ms ✅
- **Speedup: 4.7x faster** 🚀

---

### 2. ⚠️ tests/integration/reliability.db.integration.test.ts (NEEDS FIX)

**Status:** Creates 3 separate pools per test run

**Problem Areas:**

#### Issue 1: Health Check Pool (Lines 21-28)
```typescript
beforeAll(async () => {
  const pool = new Pool({ connectionString: DB_URL }); // ❌ Created
  try {
    await pool.query('select 1');
  } catch {
    envReady = false;
  } finally {
    await pool.end().catch(() => {}); // ❌ Destroyed
  }
});
```
**Impact:** ~200-400ms overhead at test suite startup

#### Issue 2: Cleanup Pool (Lines 52-62)
```typescript
afterAll(async () => {
  if (envReady) {
    const pool = new Pool({ connectionString: DB_URL }); // ❌ Created
    try {
      await pool.query('truncate nofx.outbox;');
      await pool.query('truncate nofx.inbox;');
      await pool.query('truncate nofx.step cascade;');
      await pool.query('truncate nofx.run cascade;');
    } finally {
      await pool.end().catch(() => {}); // ❌ Destroyed
    }
  }
});
```
**Impact:** ~200-400ms overhead at test suite teardown

#### Issue 3: Inline Test Pool (Lines 104-112)
```typescript
test('DB + Redis drivers persist events...', async () => {
  // ... test code ...
  const pool = new Pool({ connectionString: DB_URL }); // ❌ Created
  try {
    const inbox = await pool.query(...);
    const outbox = await pool.query(...);
  } finally {
    await pool.end().catch(() => {}); // ❌ Destroyed
  }
});
```
**Impact:** ~200-400ms overhead per test run

**Total Impact:** 600-1200ms of unnecessary pool overhead per test run

**Recommended Fix:**
```typescript
describe('Reliability DB Integration', () => {
  let sharedPool: Pool | null = null;
  let envReady = true;
  // ... other variables ...

  beforeAll(async () => {
    // Setup env vars...
    process.env.DATABASE_URL = DB_URL;
    // ... etc ...

    // Create ONE shared pool
    sharedPool = new Pool({ connectionString: DB_URL });

    try {
      await sharedPool.query('select 1');
    } catch {
      envReady = false;
      await sharedPool.end();
      sharedPool = null;
    }

    if (!envReady) {
      console.warn('⚠️  Skipping DB/Redis integration tests; services unavailable');
      return;
    }

    // Load modules...
    ({ store } = await import('../../src/lib/store'));
    // ... etc ...
  });

  afterAll(async () => {
    if (sharedPool && envReady) {
      try {
        await sharedPool.query('truncate nofx.outbox;');
        await sharedPool.query('truncate nofx.inbox;');
        await sharedPool.query('truncate nofx.step cascade;');
        await sharedPool.query('truncate nofx.run cascade;');
      } catch {
        // ignore cleanup failures
      } finally {
        await sharedPool.end();
      }
    }

    // Redis cleanup...
    const { Queue } = await import('bullmq');
    // ... etc ...
  });

  test('DB + Redis drivers persist events...', async () => {
    if (!envReady || !sharedPool) {
      console.warn('Skipping - services unavailable');
      return;
    }

    // ... test setup ...

    // Reuse shared pool
    const inbox = await sharedPool.query(...);
    const outbox = await sharedPool.query(...);
    // ... assertions ...
  });
});
```

**Expected Improvement:** 600-1200ms faster per test run (60-80% faster)

---

### 3. ⚠️ tests/performance/stress.test.ts (NEEDS FIX)

**Status:** Creates multiple pools throughout test suite

**Problem Areas:**

#### Issue 1: Health Check Pool (Lines 67-77)
```typescript
beforeAll(async () => {
  // ... other checks ...

  if (!process.env.DATABASE_URL) {
    markSkip('DATABASE_URL is not configured...');
  } else {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 }); // ❌
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } finally {
      await pool.end().catch(() => {}); // ❌
    }
  }
});
```

#### Issue 2: Multiple Pools in Tests (Lines 137-150, 158-178, 186-205)
```typescript
test('handles connection pool exhaustion', async () => {
  const pools: Pool[] = [];
  try {
    for (let i = 0; i < 200; i++) {
      const pool = new Pool({ /* ... */ }); // ❌ Intentional for THIS test
      pools.push(pool);
      await pool.query('SELECT 1');
    }
  } finally {
    await Promise.all(pools.map(p => p.end().catch(() => {})));
  }
});

test('handles large result sets', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // ❌
  try {
    await pool.query(/* large query */);
  } finally {
    await pool.end();
  }
});

test('handles rapid transaction commits', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // ❌
  // ... 100 transactions ...
  await pool.end();
});
```

**Analysis:**
- **Health check pool (line 67):** Should be shared ⚠️
- **Pool exhaustion test (line 137):** Creating many pools is intentional for this specific test ✅
- **Large result sets test (line 158):** Should reuse shared pool ⚠️
- **Transaction test (line 186):** Should reuse shared pool ⚠️

**Recommended Fix:**
```typescript
describeStress('Stress Tests', () => {
  let sharedPool: Pool | null = null;
  let dbAvailable = false;
  // ... other variables ...

  beforeAll(async () => {
    // ... API and Redis checks ...

    // Create ONE shared pool for health check AND tests
    if (!process.env.DATABASE_URL) {
      markSkip('DATABASE_URL is not configured...');
    } else {
      sharedPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5, // Allow concurrent connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });

      try {
        await sharedPool.query('SELECT 1');
        dbAvailable = true;
      } catch (error) {
        dbAvailable = false;
        markSkip(`Database unavailable...`);
        await sharedPool.end();
        sharedPool = null;
      }
    }
  });

  afterAll(async () => {
    if (sharedPool) {
      await sharedPool.end();
    }
  });

  describe('Database Stress', () => {
    test('handles connection pool exhaustion', async () => {
      // This test SHOULD create many pools - that's what it's testing!
      const pools: Pool[] = [];
      try {
        for (let i = 0; i < 200; i++) {
          const pool = new Pool({ /* ... */ });
          pools.push(pool);
          await pool.query('SELECT 1');
        }
      } finally {
        await Promise.all(pools.map(p => p.end().catch(() => {})));
      }
    });

    test('handles large result sets', async () => {
      if (!sharedPool || !dbAvailable) return;

      // Reuse shared pool
      try {
        await sharedPool.query(/* large query */);
      } catch (error) {
        // ... error handling ...
      }
    });

    test('handles rapid transaction commits', async () => {
      if (!sharedPool || !dbAvailable) return;

      // Reuse shared pool
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          sharedPool.query('BEGIN')
            .then(() => sharedPool!.query('INSERT ...'))
            .then(() => sharedPool!.query('COMMIT'))
            .catch(() => sharedPool!.query('ROLLBACK'))
        );
      }

      const results = await Promise.allSettled(promises);
      // ... assertions ...
    });
  });
});
```

**Expected Improvement:**
- Health check: 200-400ms faster
- Large result sets test: 200-400ms faster
- Transaction test: 200-400ms faster
- **Total: 600-1200ms faster** (excluding intentional pool exhaustion test)

---

### 4. ✅ src/lib/db.ts (ALREADY CORRECT)

**Status:** Already uses singleton pattern correctly

**Implementation:**
```typescript
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // Optimized for serverless
  allowExitOnIdle: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  query_timeout: 30000,
});
```

**Why this is correct:**
- ✅ Exported as singleton (`export const pool`)
- ✅ Created once at module load time
- ✅ Reused throughout application lifetime
- ✅ Properly configured for Supabase serverless
- ✅ Includes monitoring and error handling
- ✅ Has transaction support via `withTransaction()`

**No changes needed.** ✅

---

### 5. ✅ src/worker/health.ts (ACCEPTABLE)

**Status:** Creates pool for health checks (acceptable pattern)

**Implementation (Line 84):**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000
});
```

**Why this is acceptable:**
- ✅ Health check endpoint should be isolated
- ✅ Should not depend on shared application state
- ✅ Creates minimal pool (max: 1)
- ✅ Short timeout (5s)
- ✅ Gets cleaned up after check

**This is a valid pattern for health checks.** No changes needed. ✅

---

## Summary & Recommendations

### Current State

| File | Status | Pools Created | Impact | Action Needed |
|------|--------|---------------|--------|---------------|
| `tests/performance/benchmarks.test.ts` | ✅ Fixed | 1 shared | 4.7x faster | None - already done |
| `tests/integration/reliability.db.integration.test.ts` | ⚠️ Needs fix | 3 per run | +600-1200ms | Implement shared pool |
| `tests/performance/stress.test.ts` | ⚠️ Needs fix | 1 health + 3 tests | +800-1600ms | Implement shared pool (except exhaustion test) |
| `src/lib/db.ts` | ✅ Correct | 1 singleton | N/A | None - already optimal |
| `src/worker/health.ts` | ✅ Acceptable | 1 per check | N/A | None - valid pattern |

### Impact Summary

**If we fix all test files:**
- ⚡ Test suite speedup: 1.4-2.8 seconds faster
- 📊 More accurate performance measurements
- 🎯 Realistic production-like behavior
- 💰 Reduced database connection overhead

### Priority Recommendations

#### 1. High Priority: Fix Integration Tests
**File:** `tests/integration/reliability.db.integration.test.ts`

**Why:** This runs frequently in CI/CD and affects developer feedback loop.

**Expected Impact:** 600-1200ms faster (60-80% improvement)

#### 2. Medium Priority: Fix Stress Tests
**File:** `tests/performance/stress.test.ts`

**Why:** Stress tests should measure actual system performance, not pool overhead.

**Expected Impact:** 600-1200ms faster (excluding intentional pool exhaustion test)

**Note:** The "handles connection pool exhaustion" test SHOULD create many pools - that's what it's testing. Don't change that one.

---

## Implementation Guide

For step-by-step instructions on implementing pool reuse, see:
- **`docs/DATABASE_POOL_REUSE_GUIDE.md`** - Comprehensive guide with examples

### Quick Checklist

When updating a test file:

- [ ] Declare shared pool variable: `let sharedPool: Pool | null = null;`
- [ ] Create pool in `beforeAll()` with proper config
- [ ] Warm up pool: `await sharedPool.query('SELECT 1');`
- [ ] Handle errors (set pool to null if unavailable)
- [ ] Update all tests to reuse `sharedPool`
- [ ] Close pool in `afterAll()`: `await sharedPool.end();`
- [ ] Add null checks in tests: `if (!sharedPool) return;`
- [ ] Test the changes: Verify tests still pass
- [ ] Measure improvement: Compare before/after execution times

---

## Next Steps

1. ✅ Review this audit document
2. ⚠️ Decide whether to fix test files now or later
3. ⚠️ If fixing: Start with `tests/integration/reliability.db.integration.test.ts` (highest impact)
4. ⚠️ Then fix `tests/performance/stress.test.ts`
5. ✅ Verify all tests pass after changes
6. ✅ Measure and document performance improvements

---

## Questions?

Refer to:
- **`docs/DATABASE_POOL_REUSE_GUIDE.md`** - Detailed implementation guide
- **`tests/performance/benchmarks.test.ts`** - Working example (lines 111-259)
- **`src/lib/db.ts`** - Production singleton pattern example

