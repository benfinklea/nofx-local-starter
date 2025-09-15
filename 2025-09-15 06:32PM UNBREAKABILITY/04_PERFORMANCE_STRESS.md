# ⚡ WORKSTREAM 4: PERFORMANCE & STRESS

## Mission
Validate system performance under extreme load, identify bottlenecks, prevent memory leaks, and ensure graceful degradation under stress.

## 🎯 Objectives
- Add 30+ performance and stress tests
- Test queue overflow scenarios
- Validate memory leak prevention
- Load test API endpoints
- Test CPU-bound operation handling

## 📁 Files to Create

### 1. `tests/unit/performance/memory-management.test.ts`

```typescript
/**
 * Memory Management & Leak Prevention Tests
 */

describe('Memory Management', () => {
  describe('Memory leak prevention', () => {
    test('prevents unbounded cache growth', () => {
      class BoundedCache {
        private cache = new Map();
        private maxSize = 1000;
        private accessOrder: string[] = [];

        set(key: string, value: any) {
          if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            // Evict LRU
            const lru = this.accessOrder.shift();
            if (lru) this.cache.delete(lru);
          }

          this.cache.set(key, value);
          this.updateAccessOrder(key);
        }

        get(key: string) {
          const value = this.cache.get(key);
          if (value) this.updateAccessOrder(key);
          return value;
        }

        private updateAccessOrder(key: string) {
          const index = this.accessOrder.indexOf(key);
          if (index > -1) {
            this.accessOrder.splice(index, 1);
          }
          this.accessOrder.push(key);
        }

        get size() { return this.cache.size; }
      }

      const cache = new BoundedCache();

      // Try to overflow
      for (let i = 0; i < 2000; i++) {
        cache.set(`key${i}`, { data: `value${i}`.repeat(100) });
      }

      expect(cache.size).toBeLessThanOrEqual(1000);
    });

    test('cleans up event listeners', () => {
      class EventManager {
        private listeners = new Map<string, Set<Function>>();
        private listenerLimit = 100;

        on(event: string, handler: Function) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
          }

          const handlers = this.listeners.get(event)!;
          if (handlers.size >= this.listenerLimit) {
            console.warn(`Warning: Event ${event} has ${handlers.size} listeners`);
            // Could throw or auto-cleanup oldest
          }

          handlers.add(handler);

          // Return cleanup function
          return () => {
            handlers.delete(handler);
            if (handlers.size === 0) {
              this.listeners.delete(event);
            }
          };
        }

        getListenerCount(event: string) {
          return this.listeners.get(event)?.size || 0;
        }

        removeAllListeners() {
          this.listeners.clear();
        }
      }

      const manager = new EventManager();
      const cleanups: Function[] = [];

      // Add listeners
      for (let i = 0; i < 50; i++) {
        cleanups.push(manager.on('test', () => {}));
      }

      expect(manager.getListenerCount('test')).toBe(50);

      // Clean up
      cleanups.forEach(cleanup => cleanup());
      expect(manager.getListenerCount('test')).toBe(0);
    });

    test('manages buffer allocation', () => {
      class BufferPool {
        private pool: Buffer[] = [];
        private maxPoolSize = 10;
        private bufferSize = 1024 * 1024; // 1MB

        acquire(): Buffer {
          if (this.pool.length > 0) {
            return this.pool.pop()!;
          }
          return Buffer.allocUnsafe(this.bufferSize);
        }

        release(buffer: Buffer) {
          if (this.pool.length < this.maxPoolSize) {
            buffer.fill(0); // Clear sensitive data
            this.pool.push(buffer);
          }
          // Otherwise let GC handle it
        }

        get poolSize() { return this.pool.length; }
      }

      const pool = new BufferPool();
      const buffers: Buffer[] = [];

      // Acquire buffers
      for (let i = 0; i < 20; i++) {
        buffers.push(pool.acquire());
      }

      // Release them back
      buffers.forEach(b => pool.release(b));

      // Pool should be capped
      expect(pool.poolSize).toBeLessThanOrEqual(10);
    });
  });

  describe('Garbage collection optimization', () => {
    test('uses weak references for cache', () => {
      const cache = new WeakMap();
      let obj: any = { id: 1, data: 'test' };

      cache.set(obj, { cached: true });
      expect(cache.has(obj)).toBe(true);

      // Simulate object going out of scope
      const ref = new WeakRef(obj);
      obj = null;

      // Force GC (in test environment)
      if (global.gc) global.gc();

      // Object should be eligible for GC
      expect(ref.deref()).toBeUndefined();
    });
  });
});
```

### 2. `tests/unit/performance/load-testing.test.ts`

```typescript
/**
 * Load Testing & Throughput Tests
 */

describe('Load Testing', () => {
  describe('API endpoint load', () => {
    test('handles 1000 concurrent requests', async () => {
      const mockApi = {
        activeRequests: 0,
        maxConcurrent: 0,
        totalProcessed: 0,

        async handleRequest(id: number) {
          this.activeRequests++;
          this.maxConcurrent = Math.max(this.maxConcurrent, this.activeRequests);

          // Simulate processing
          await new Promise(r => setTimeout(r, Math.random() * 10));

          this.activeRequests--;
          this.totalProcessed++;
          return { id, processed: true };
        }
      };

      // Launch concurrent requests
      const requests = Array(1000).fill(null).map((_, i) =>
        mockApi.handleRequest(i)
      );

      const start = Date.now();
      await Promise.all(requests);
      const duration = Date.now() - start;

      expect(mockApi.totalProcessed).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete in 5s
      console.log(`Max concurrent: ${mockApi.maxConcurrent}`);
    });

    test('implements rate limiting', async () => {
      class RateLimiter {
        private requests: number[] = [];
        private windowMs = 1000;
        private maxRequests = 100;

        async acquire(): Promise<boolean> {
          const now = Date.now();

          // Remove old requests outside window
          this.requests = this.requests.filter(t => now - t < this.windowMs);

          if (this.requests.length >= this.maxRequests) {
            return false; // Rate limit exceeded
          }

          this.requests.push(now);
          return true;
        }

        reset() {
          this.requests = [];
        }
      }

      const limiter = new RateLimiter();
      let allowed = 0;
      let blocked = 0;

      // Try 150 requests
      for (let i = 0; i < 150; i++) {
        if (await limiter.acquire()) {
          allowed++;
        } else {
          blocked++;
        }
      }

      expect(allowed).toBe(100);
      expect(blocked).toBe(50);
    });
  });

  describe('Queue overflow', () => {
    test('handles queue saturation gracefully', async () => {
      class BoundedQueue {
        private queue: any[] = [];
        private maxSize = 1000;
        private droppedCount = 0;

        enqueue(item: any): boolean {
          if (this.queue.length >= this.maxSize) {
            this.droppedCount++;
            return false; // Queue full
          }

          this.queue.push(item);
          return true;
        }

        dequeue() {
          return this.queue.shift();
        }

        get stats() {
          return {
            size: this.queue.length,
            dropped: this.droppedCount,
            utilization: (this.queue.length / this.maxSize) * 100
          };
        }
      }

      const queue = new BoundedQueue();

      // Overflow attempt
      for (let i = 0; i < 1500; i++) {
        queue.enqueue({ id: i });
      }

      const stats = queue.stats();
      expect(stats.size).toBe(1000);
      expect(stats.dropped).toBe(500);
      expect(stats.utilization).toBe(100);
    });

    test('implements backpressure', async () => {
      class BackpressureQueue {
        private queue: any[] = [];
        private processing = false;
        private highWaterMark = 100;
        private lowWaterMark = 20;
        private paused = false;

        async push(item: any) {
          this.queue.push(item);

          if (this.queue.length > this.highWaterMark) {
            this.paused = true;
            // Wait until queue drains
            while (this.queue.length > this.lowWaterMark) {
              await new Promise(r => setTimeout(r, 10));
            }
            this.paused = false;
          }

          if (!this.processing) {
            this.process();
          }
        }

        private async process() {
          this.processing = true;

          while (this.queue.length > 0) {
            const batch = this.queue.splice(0, 10);
            // Process batch
            await new Promise(r => setTimeout(r, 5));
          }

          this.processing = false;
        }

        isPaused() { return this.paused; }
      }

      const queue = new BackpressureQueue();

      // Add items rapidly
      const promises = [];
      for (let i = 0; i < 150; i++) {
        promises.push(queue.push({ id: i }));

        if (i === 100) {
          // Should be paused at high water mark
          expect(queue.isPaused()).toBe(true);
        }
      }

      await Promise.all(promises);
      expect(queue.isPaused()).toBe(false);
    });
  });
});
```

### 3. `tests/unit/performance/cpu-optimization.test.ts`

```typescript
/**
 * CPU Optimization & Threading Tests
 */

describe('CPU Optimization', () => {
  describe('CPU-bound operations', () => {
    test('offloads heavy computation', async () => {
      class ComputePool {
        private workers: any[] = [];
        private queue: any[] = [];
        private maxWorkers = 4;

        async compute(task: Function) {
          // Simulate worker pool
          if (this.workers.length < this.maxWorkers) {
            return this.executeInWorker(task);
          }

          // Queue if all workers busy
          return new Promise((resolve) => {
            this.queue.push({ task, resolve });
          });
        }

        private async executeInWorker(task: Function) {
          const worker = { id: Date.now() };
          this.workers.push(worker);

          try {
            // Simulate heavy computation
            const result = await new Promise(r =>
              setTimeout(() => r(task()), 10)
            );
            return result;
          } finally {
            // Release worker
            this.workers = this.workers.filter(w => w !== worker);

            // Process queued tasks
            if (this.queue.length > 0) {
              const next = this.queue.shift();
              next.resolve(this.executeInWorker(next.task));
            }
          }
        }
      }

      const pool = new ComputePool();

      // Launch parallel computations
      const tasks = Array(10).fill(null).map((_, i) =>
        pool.compute(() => i * i)
      );

      const results = await Promise.all(tasks);
      expect(results).toEqual([0, 1, 4, 9, 16, 25, 36, 49, 64, 81]);
    });

    test('implements computation timeout', async () => {
      const computeWithTimeout = async (fn: Function, timeoutMs: number) => {
        return Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Computation timeout')), timeoutMs)
          )
        ]);
      };

      // Fast computation
      await expect(
        computeWithTimeout(() => Promise.resolve(42), 100)
      ).resolves.toBe(42);

      // Slow computation
      await expect(
        computeWithTimeout(
          () => new Promise(r => setTimeout(r, 200)),
          100
        )
      ).rejects.toThrow('Computation timeout');
    });
  });

  describe('Algorithm optimization', () => {
    test('uses efficient algorithms for large datasets', () => {
      // Inefficient O(n²) approach
      const findDuplicatesSlow = (arr: number[]): number[] => {
        const duplicates: number[] = [];
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
              duplicates.push(arr[i]);
            }
          }
        }
        return duplicates;
      };

      // Efficient O(n) approach
      const findDuplicatesFast = (arr: number[]): number[] => {
        const seen = new Set<number>();
        const duplicates = new Set<number>();

        for (const num of arr) {
          if (seen.has(num)) {
            duplicates.add(num);
          }
          seen.add(num);
        }

        return Array.from(duplicates);
      };

      const testData = Array(10000).fill(null).map((_, i) => i % 100);

      const start1 = Date.now();
      const result1 = findDuplicatesFast(testData);
      const time1 = Date.now() - start1;

      expect(result1.length).toBe(100);
      expect(time1).toBeLessThan(50); // Should be very fast
    });

    test('implements memoization for expensive operations', () => {
      class Memoizer {
        private cache = new Map();

        memoize(fn: Function) {
          return (...args: any[]) => {
            const key = JSON.stringify(args);

            if (this.cache.has(key)) {
              return this.cache.get(key);
            }

            const result = fn(...args);
            this.cache.set(key, result);
            return result;
          };
        }

        clear() {
          this.cache.clear();
        }
      }

      let computeCount = 0;
      const expensiveCompute = (n: number) => {
        computeCount++;
        // Simulate expensive operation
        let result = 0;
        for (let i = 0; i < n * 1000000; i++) {
          result += i;
        }
        return result;
      };

      const memoizer = new Memoizer();
      const memoized = memoizer.memoize(expensiveCompute);

      // First call - computed
      memoized(5);
      expect(computeCount).toBe(1);

      // Second call - cached
      memoized(5);
      expect(computeCount).toBe(1);

      // Different argument - computed
      memoized(3);
      expect(computeCount).toBe(2);
    });
  });
});
```

### 4. `tests/unit/performance/stress-scenarios.test.ts`

```typescript
/**
 * Stress Testing Scenarios
 */

describe('Stress Scenarios', () => {
  describe('Cascade failures', () => {
    test('prevents cascade failures with circuit breaker', async () => {
      class CircuitBreaker {
        private failureCount = 0;
        private lastFailureTime = 0;
        private state: 'closed' | 'open' | 'half-open' = 'closed';
        private threshold = 5;
        private timeout = 1000;

        async execute(fn: Function) {
          if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
              this.state = 'half-open';
            } else {
              throw new Error('Circuit breaker is open');
            }
          }

          try {
            const result = await fn();

            if (this.state === 'half-open') {
              this.state = 'closed';
              this.failureCount = 0;
            }

            return result;
          } catch (error) {
            this.failureCount++;
            this.lastFailureTime = Date.now();

            if (this.failureCount >= this.threshold) {
              this.state = 'open';
            }

            throw error;
          }
        }

        getState() { return this.state; }
        reset() {
          this.state = 'closed';
          this.failureCount = 0;
        }
      }

      const breaker = new CircuitBreaker();
      const failingService = () => Promise.reject(new Error('Service down'));

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingService);
        } catch {}
      }

      expect(breaker.getState()).toBe('open');

      // Circuit should be open
      await expect(breaker.execute(failingService))
        .rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Resource exhaustion', () => {
    test('handles connection pool exhaustion', async () => {
      class ConnectionPool {
        private connections: any[] = [];
        private waiting: Array<(conn: any) => void> = [];
        private maxSize = 10;
        private timeout = 1000;

        async acquire() {
          if (this.connections.length < this.maxSize) {
            const conn = { id: Date.now(), acquired: true };
            this.connections.push(conn);
            return conn;
          }

          // Wait for available connection
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              const index = this.waiting.indexOf(resolve);
              if (index > -1) {
                this.waiting.splice(index, 1);
              }
              reject(new Error('Connection pool timeout'));
            }, this.timeout);

            this.waiting.push((conn) => {
              clearTimeout(timer);
              resolve(conn);
            });
          });
        }

        release(conn: any) {
          conn.acquired = false;

          if (this.waiting.length > 0) {
            const resolve = this.waiting.shift()!;
            conn.acquired = true;
            resolve(conn);
          }
        }

        getStats() {
          return {
            total: this.connections.length,
            active: this.connections.filter(c => c.acquired).length,
            waiting: this.waiting.length
          };
        }
      }

      const pool = new ConnectionPool();

      // Exhaust pool
      const connections = [];
      for (let i = 0; i < 10; i++) {
        connections.push(await pool.acquire());
      }

      expect(pool.getStats().active).toBe(10);

      // Next should timeout
      const timeoutPromise = pool.acquire();

      setTimeout(() => {
        pool.release(connections[0]);
      }, 500);

      const conn = await timeoutPromise;
      expect(conn).toBeDefined();
    });
  });

  describe('Graceful degradation', () => {
    test('degrades features under load', async () => {
      class AdaptiveSystem {
        private load = 0;
        private features = {
          analytics: true,
          recommendations: true,
          search: true,
          core: true
        };

        async handleRequest(type: string) {
          this.load++;

          try {
            // Disable features based on load
            if (this.load > 80) {
              this.features.analytics = false;
              this.features.recommendations = false;
            }
            if (this.load > 90) {
              this.features.search = false;
            }

            if (!this.features[type as keyof typeof this.features]) {
              return { degraded: true, message: 'Feature temporarily disabled' };
            }

            // Process request
            await new Promise(r => setTimeout(r, 10));
            return { success: true };
          } finally {
            this.load--;
          }
        }

        getActiveFeatures() {
          return Object.entries(this.features)
            .filter(([_, enabled]) => enabled)
            .map(([name]) => name);
        }
      }

      const system = new AdaptiveSystem();

      // Simulate high load
      const requests = Array(85).fill(null).map(() =>
        system.handleRequest('analytics')
      );

      // Features should degrade
      setTimeout(() => {
        const active = system.getActiveFeatures();
        expect(active).not.toContain('analytics');
        expect(active).toContain('core');
      }, 50);

      await Promise.all(requests);
    });
  });
});
```

### 5. `tests/unit/performance/latency-optimization.test.ts`

```typescript
/**
 * Latency & Response Time Tests
 */

describe('Latency Optimization', () => {
  describe('Response time targets', () => {
    test('maintains p99 latency under load', async () => {
      class LatencyTracker {
        private measurements: number[] = [];

        async measure(fn: Function) {
          const start = performance.now();
          const result = await fn();
          const duration = performance.now() - start;

          this.measurements.push(duration);
          return result;
        }

        getPercentile(p: number): number {
          const sorted = [...this.measurements].sort((a, b) => a - b);
          const index = Math.ceil((p / 100) * sorted.length) - 1;
          return sorted[index] || 0;
        }

        getStats() {
          return {
            p50: this.getPercentile(50),
            p95: this.getPercentile(95),
            p99: this.getPercentile(99),
            max: Math.max(...this.measurements),
            min: Math.min(...this.measurements),
            avg: this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length
          };
        }
      }

      const tracker = new LatencyTracker();

      // Simulate varied latencies
      for (let i = 0; i < 1000; i++) {
        await tracker.measure(async () => {
          // Most requests are fast
          const delay = Math.random() < 0.95 ?
            Math.random() * 10 : // 95% under 10ms
            Math.random() * 100; // 5% slower

          await new Promise(r => setTimeout(r, delay));
        });
      }

      const stats = tracker.getStats();
      expect(stats.p99).toBeLessThan(100);
      expect(stats.p95).toBeLessThan(50);
      expect(stats.p50).toBeLessThan(10);
    });
  });

  describe('Caching strategies', () => {
    test('implements multi-tier caching', async () => {
      class MultiTierCache {
        private l1Cache = new Map(); // Memory
        private l2Cache = new Map(); // Disk simulation
        private l1MaxSize = 100;
        private stats = {
          l1Hits: 0,
          l2Hits: 0,
          misses: 0
        };

        async get(key: string) {
          // Check L1
          if (this.l1Cache.has(key)) {
            this.stats.l1Hits++;
            return this.l1Cache.get(key);
          }

          // Check L2
          if (this.l2Cache.has(key)) {
            this.stats.l2Hits++;
            const value = this.l2Cache.get(key);

            // Promote to L1
            this.setL1(key, value);
            return value;
          }

          this.stats.misses++;
          return null;
        }

        async set(key: string, value: any) {
          this.setL1(key, value);
          this.l2Cache.set(key, value);
        }

        private setL1(key: string, value: any) {
          if (this.l1Cache.size >= this.l1MaxSize) {
            // Evict random item (simple strategy)
            const firstKey = this.l1Cache.keys().next().value;
            this.l1Cache.delete(firstKey);
          }
          this.l1Cache.set(key, value);
        }

        getStats() { return this.stats; }
      }

      const cache = new MultiTierCache();

      // Populate cache
      for (let i = 0; i < 200; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      // Access pattern
      for (let i = 0; i < 1000; i++) {
        const key = `key${Math.floor(Math.random() * 200)}`;
        await cache.get(key);
      }

      const stats = cache.getStats();
      expect(stats.l1Hits + stats.l2Hits + stats.misses).toBe(1000);
      expect(stats.l1Hits).toBeGreaterThan(0);
      expect(stats.l2Hits).toBeGreaterThan(0);
    });
  });
});
```

## 📊 Success Metrics

- [ ] All 30+ performance tests passing
- [ ] Memory leaks prevented
- [ ] Load handling verified
- [ ] CPU optimization implemented
- [ ] Latency targets met
- [ ] Stress scenarios handled

## 🚀 Execution Instructions

1. Create all test files in `tests/unit/performance/`
2. Run tests: `npm run test:performance`
3. Profile and optimize based on results
4. Verify improvements: `npm run test:coverage -- --grep performance`

## 🔍 Files to Review & Fix

Priority performance files:
- `src/api/main.ts` - Needs rate limiting
- `src/worker/process.ts` - CPU-bound operation handling
- `src/lib/queue/RedisAdapter.ts` - Backpressure implementation
- `src/lib/cache.ts` - Memory management
- `src/lib/metrics.ts` - Performance monitoring

## ⚠️ Critical Performance Gaps

1. **No rate limiting** on API endpoints
2. **Memory leaks** in event emitters
3. **No circuit breaker** pattern
4. **Missing backpressure** in queues
5. **No caching strategy** implemented

## ✅ Completion Checklist

- [ ] Created all 5 test files
- [ ] 30+ performance tests written
- [ ] All tests passing
- [ ] Memory leaks fixed
- [ ] Load handling improved
- [ ] Coverage report generated

---

**This workstream is independent and focuses solely on performance and stress testing.**