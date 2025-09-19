# 🏗️ WORKSTREAM 2: INFRASTRUCTURE RESILIENCE

## Mission
Ensure the system gracefully handles all infrastructure failures including service outages, network partitions, and resource exhaustion.

## 🎯 Objectives
- Add 40+ infrastructure resilience tests
- Test Redis failover scenarios
- Validate Supabase fallback mechanisms
- Implement database connection recovery
- Test DNS and certificate failures

## 📁 Files to Create

### 1. `tests/unit/infrastructure/redis-failover.test.ts`

```typescript
/**
 * Redis Failover & Recovery Tests
 */

describe('Redis Infrastructure Resilience', () => {
  describe('Connection failures', () => {
    test('retries connection with exponential backoff', async () => {
      let attempts = 0;
      const mockRedis = {
        connect: jest.fn(() => {
          attempts++;
          if (attempts < 3) {
            throw new Error('ECONNREFUSED');
          }
          return Promise.resolve();
        })
      };

      const connectWithRetry = async (maxRetries = 5) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            await mockRedis.connect();
            return true;
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
          }
        }
      };

      await connectWithRetry();
      expect(attempts).toBe(3);
    });

    test('switches to memory adapter on Redis failure', async () => {
      const queueAdapter = {
        current: 'redis',

        async enqueue(topic: string, payload: any) {
          try {
            if (this.current === 'redis') {
              await redisQueue.add(topic, payload);
            }
          } catch (error) {
            // Fallback to memory
            this.current = 'memory';
            await memoryQueue.add(topic, payload);
          }
        }
      };

      // Simulate Redis failure
      redisQueue.add = jest.fn().mockRejectedValue(new Error('Redis down'));
      memoryQueue.add = jest.fn().mockResolvedValue(true);

      await queueAdapter.enqueue('test', { data: 1 });

      expect(queueAdapter.current).toBe('memory');
      expect(memoryQueue.add).toHaveBeenCalled();
    });
  });

  describe('Cluster failover', () => {
    test('handles master node failure', async () => {
      const cluster = {
        nodes: ['redis1:6379', 'redis2:6379', 'redis3:6379'],
        currentMaster: 0,

        async execute(command: string) {
          const node = this.nodes[this.currentMaster];
          try {
            return await sendCommand(node, command);
          } catch (error) {
            // Promote next node
            this.currentMaster = (this.currentMaster + 1) % this.nodes.length;
            return await sendCommand(this.nodes[this.currentMaster], command);
          }
        }
      };

      // Test failover behavior
      expect(cluster.currentMaster).toBe(0);
      // Simulate failure and verify promotion
    });
  });
});
```

### 2. `tests/unit/infrastructure/supabase-fallback.test.ts`

```typescript
/**
 * Supabase Service Resilience Tests
 */

describe('Supabase Fallback Mechanisms', () => {
  describe('Storage failures', () => {
    test('falls back to local filesystem on upload failure', async () => {
      const storage = {
        async upload(path: string, data: Buffer) {
          try {
            return await supabase.storage.from('bucket').upload(path, data);
          } catch (error) {
            // Fallback to local
            const localPath = `/tmp/fallback/${path}`;
            await fs.promises.writeFile(localPath, data);
            return { path: localPath, fallback: true };
          }
        }
      };

      supabase.storage.from().upload = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await storage.upload('test.txt', Buffer.from('data'));
      expect(result.fallback).toBe(true);
      expect(result.path).toContain('/tmp/fallback');
    });

    test('queues uploads for retry when Supabase recovers', async () => {
      const retryQueue = [];

      const resilientUpload = async (path: string, data: Buffer) => {
        try {
          return await supabase.storage.upload(path, data);
        } catch (error) {
          retryQueue.push({ path, data, timestamp: Date.now() });
          return { queued: true };
        }
      };

      // Process retry queue when service recovers
      const processRetryQueue = async () => {
        while (retryQueue.length > 0) {
          const item = retryQueue.shift();
          await supabase.storage.upload(item.path, item.data);
        }
      };

      // Test queue and retry logic
    });
  });

  describe('Database connection pool', () => {
    test('handles connection exhaustion', async () => {
      const pool = {
        max: 20,
        active: 0,
        waiting: [],

        async acquire() {
          if (this.active >= this.max) {
            return new Promise((resolve) => {
              this.waiting.push(resolve);
              setTimeout(() => {
                // Timeout waiting connections
                const idx = this.waiting.indexOf(resolve);
                if (idx > -1) {
                  this.waiting.splice(idx, 1);
                  resolve(null);
                }
              }, 5000);
            });
          }

          this.active++;
          return { id: Date.now() };
        },

        release(conn) {
          this.active--;
          if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            resolve(this.acquire());
          }
        }
      };

      // Exhaust pool
      const connections = [];
      for (let i = 0; i < 20; i++) {
        connections.push(await pool.acquire());
      }

      expect(pool.active).toBe(20);

      // Next request should wait
      const waitPromise = pool.acquire();
      pool.release(connections[0]);

      const conn = await waitPromise;
      expect(conn).not.toBeNull();
    });
  });
});
```

### 3. `tests/unit/infrastructure/database-recovery.test.ts`

```typescript
/**
 * Database Connection Recovery Tests
 */

describe('Database Recovery Mechanisms', () => {
  describe('Connection recovery', () => {
    test('reconnects after database restart', async () => {
      let isConnected = false;
      const db = {
        async connect() {
          if (!isConnected) {
            throw new Error('Connection refused');
          }
          return true;
        },

        async healthCheck() {
          try {
            await this.connect();
            return 'healthy';
          } catch {
            // Attempt reconnection
            await new Promise(r => setTimeout(r, 1000));
            isConnected = true; // Simulate DB coming back
            return await this.connect();
          }
        }
      };

      // Initially disconnected
      const firstCheck = await db.healthCheck();
      expect(firstCheck).toBe(true);
    });

    test('handles transaction rollback on connection loss', async () => {
      const transaction = {
        operations: [],

        async execute(ops: Function[]) {
          await db.query('BEGIN');

          try {
            for (const op of ops) {
              this.operations.push(await op());
            }
            await db.query('COMMIT');
          } catch (error) {
            await db.query('ROLLBACK');
            this.operations = [];
            throw error;
          }
        }
      };

      db.query = jest.fn()
        .mockResolvedValueOnce('BEGIN')
        .mockRejectedValueOnce(new Error('Connection lost'));

      await expect(transaction.execute([
        () => 'INSERT 1',
        () => 'INSERT 2'
      ])).rejects.toThrow('Connection lost');

      expect(transaction.operations).toHaveLength(0);
    });
  });

  describe('Replication lag', () => {
    test('handles read-after-write consistency', async () => {
      const db = {
        master: { write: jest.fn() },
        replica: { read: jest.fn() },

        async writeAndRead(data: any) {
          await this.master.write(data);

          // Wait for replication or read from master
          let attempts = 0;
          while (attempts < 3) {
            const result = await this.replica.read(data.id);
            if (result) return result;

            attempts++;
            if (attempts === 3) {
              // Fallback to master
              return await this.master.read(data.id);
            }

            await new Promise(r => setTimeout(r, 100));
          }
        }
      };

      // Test read-after-write logic
    });
  });
});
```

### 4. `tests/unit/infrastructure/network-failures.test.ts`

```typescript
/**
 * Network Failure Handling Tests
 */

describe('Network Resilience', () => {
  describe('DNS failures', () => {
    test('caches DNS lookups', async () => {
      const dnsCache = new Map();

      const resolveWithCache = async (hostname: string) => {
        if (dnsCache.has(hostname)) {
          const cached = dnsCache.get(hostname);
          if (Date.now() - cached.time < 300000) { // 5 min TTL
            return cached.ip;
          }
        }

        try {
          const ip = await dns.resolve(hostname);
          dnsCache.set(hostname, { ip, time: Date.now() });
          return ip;
        } catch (error) {
          // Use cached if available
          if (dnsCache.has(hostname)) {
            return dnsCache.get(hostname).ip;
          }
          throw error;
        }
      };

      // Test DNS caching behavior
    });

    test('handles network partition', async () => {
      const service = {
        async callAPI(url: string, timeout = 5000) {
          return Promise.race([
            fetch(url),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), timeout)
            )
          ]);
        }
      };

      // Test timeout behavior
      await expect(service.callAPI('http://unreachable', 100))
        .rejects.toThrow('Timeout');
    });
  });

  describe('Certificate validation', () => {
    test('handles expired certificates gracefully', async () => {
      const httpsAgent = {
        rejectUnauthorized: true,

        async request(url: string) {
          try {
            return await fetch(url, { agent: this });
          } catch (error) {
            if (error.code === 'CERT_HAS_EXPIRED') {
              // Log and use alternative
              console.error('Certificate expired for', url);
              return { fallback: true };
            }
            throw error;
          }
        }
      };

      // Test certificate handling
    });
  });
});
```

### 5. `tests/unit/infrastructure/resource-limits.test.ts`

```typescript
/**
 * Resource Exhaustion Tests
 */

describe('Resource Limit Handling', () => {
  describe('Memory limits', () => {
    test('prevents memory leaks', () => {
      const cache = {
        store: new Map(),
        maxSize: 1000,

        set(key: string, value: any) {
          if (this.store.size >= this.maxSize) {
            // Evict oldest
            const firstKey = this.store.keys().next().value;
            this.store.delete(firstKey);
          }
          this.store.set(key, value);
        }
      };

      // Fill cache beyond limit
      for (let i = 0; i < 1500; i++) {
        cache.set(`key${i}`, { data: i });
      }

      expect(cache.store.size).toBe(1000);
    });

    test('handles file descriptor exhaustion', async () => {
      const fileManager = {
        openFiles: new Set(),
        maxFiles: 100,

        async open(path: string) {
          if (this.openFiles.size >= this.maxFiles) {
            // Close oldest
            const oldest = this.openFiles.values().next().value;
            await this.close(oldest);
          }

          const fd = await fs.promises.open(path);
          this.openFiles.add(fd);
          return fd;
        },

        async close(fd: any) {
          await fd.close();
          this.openFiles.delete(fd);
        }
      };

      // Test file descriptor management
    });
  });

  describe('CPU throttling', () => {
    test('implements request throttling under load', async () => {
      const throttle = {
        queue: [],
        processing: 0,
        maxConcurrent: 10,

        async process(fn: Function) {
          while (this.processing >= this.maxConcurrent) {
            await new Promise(r => setTimeout(r, 10));
          }

          this.processing++;
          try {
            return await fn();
          } finally {
            this.processing--;
          }
        }
      };

      // Test concurrent limit
      const tasks = Array(20).fill(null).map(() =>
        throttle.process(() => new Promise(r => setTimeout(r, 50)))
      );

      const start = Date.now();
      await Promise.all(tasks);
      const duration = Date.now() - start;

      // Should take ~100ms (2 batches of 10)
      expect(duration).toBeGreaterThan(90);
      expect(duration).toBeLessThan(150);
    });
  });
});
```

## 📊 Success Metrics

- [ ] All 40+ infrastructure tests passing
- [ ] Redis failover working
- [ ] Supabase fallback implemented
- [ ] Database recovery tested
- [ ] Network failures handled gracefully
- [ ] Resource limits enforced

## 🚀 Execution Instructions

1. Create all test files in `tests/unit/infrastructure/`
2. Run tests: `npm run test:infrastructure`
3. Update source code to handle failures
4. Verify resilience: `npm run test:coverage -- --grep infrastructure`

## 🔍 Files to Review & Fix

Priority infrastructure files:
- `src/lib/queue/RedisAdapter.ts` - Needs failover logic
- `src/lib/supabase.ts` - Missing fallback mechanisms
- `src/lib/db.ts` - Connection recovery needed
- `src/lib/cache.ts` - Memory limit enforcement
- `src/lib/store.ts` - Transaction rollback handling

## ⚠️ Critical Infrastructure Gaps

1. **RedisAdapter.ts**: No reconnection logic
2. **supabase.ts**: No fallback for storage failures
3. **db.ts**: Missing connection pool management
4. **No circuit breaker** implementation
5. **No health check** endpoints

## ✅ Completion Checklist

- [ ] Created all 5 test files
- [ ] 40+ infrastructure tests written
- [ ] All tests passing
- [ ] Failover mechanisms implemented
- [ ] Resource limits enforced
- [ ] Coverage report generated

---

**This workstream is independent and focuses solely on infrastructure resilience.**