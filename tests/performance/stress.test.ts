/**
 * Stress Testing Suite
 * Tests system behavior under extreme conditions
 */

import { Pool } from 'pg';
import IORedis from 'ioredis';
import { performance } from 'perf_hooks';

const stressEnabled = process.env.ENABLE_STRESS_TESTS === '1';
const describeStress = stressEnabled ? describe : describe.skip;

describeStress('Stress Tests - System Breaking Points', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  let metrics: any = {};
  let apiAvailable = false;
  let dbAvailable = false;
  let redisAvailable = false;
  const skipReasons = new Set<string>();

  const markSkip = (reason: string) => {
    if (!skipReasons.has(reason)) {
      skipReasons.add(reason);
      console.warn(`[stress tests] ${reason}`);
    }
  };

  const skipIf = (condition: boolean, reason: string) => {
    if (condition) {
      markSkip(reason);
      return true;
    }

    return false;
  };

  beforeAll(async () => {
    metrics = {
      startTime: performance.now(),
      requests: 0,
      errors: 0,
      latencies: []
    };

    // Detect API availability with a short timeout to avoid hanging the suite
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);

    try {
      const response = await fetch(`${API_URL}/health`, { signal: controller.signal });
      apiAvailable = response.ok;

      if (!apiAvailable) {
        markSkip(`API at ${API_URL} is not responding with 200; skipping HTTP stress tests.`);
      }
    } catch (error) {
      apiAvailable = false;
      markSkip(`API at ${API_URL} is unavailable (${(error as Error).message ?? 'unknown error'}); skipping HTTP stress tests.`);
    } finally {
      clearTimeout(timeout);
    }

    // Detect database availability if a connection string is configured
    if (!process.env.DATABASE_URL) {
      markSkip('DATABASE_URL is not configured; skipping database stress tests.');
    } else {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

      try {
        await pool.query('SELECT 1');
        dbAvailable = true;
      } catch (error) {
        dbAvailable = false;
        markSkip(`Database is unavailable (${(error as Error).message ?? 'unknown error'}); skipping database stress tests.`);
      } finally {
        await pool.end().catch(() => {});
      }
    }

    // Detect Redis availability
    if (process.env.DISABLE_REDIS_STRESS === '1') {
      redisAvailable = false;
      markSkip('Redis stress tests disabled via configuration.');
    } else {
      try {
        const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
          maxRetriesPerRequest: 1,
          lazyConnect: true
        });

        await redis.connect();
        await redis.ping();
        redisAvailable = true;
        redis.disconnect();
      } catch (error) {
        redisAvailable = false;
        markSkip(`Redis is unavailable (${(error as Error).message ?? 'unknown error'}); skipping Redis stress tests.`);
      }
    }
  });

  afterAll(() => {
    const duration = performance.now() - metrics.startTime;
    const requestCount = metrics.requests || 0;
    const errorRate = requestCount > 0 ? metrics.errors / requestCount : 0;
    const totalLatency = metrics.latencies.reduce((sum: number, value: number) => sum + value, 0);
    const averageLatency = metrics.latencies.length > 0 ? totalLatency / metrics.latencies.length : 0;
    const sortedLatencies = [...metrics.latencies].sort((a: number, b: number) => a - b);
    const p95Index = sortedLatencies.length > 0 ? Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * 0.95)) : 0;
    const p95Latency = sortedLatencies.length > 0 ? sortedLatencies[p95Index] : 0;
    const durationSeconds = duration / 1000;
    const requestsPerSecond = durationSeconds > 0 ? requestCount / durationSeconds : 0;

    console.log(`
      === STRESS TEST RESULTS ===
      Total Duration: ${duration.toFixed(2)}ms
      Total Requests: ${requestCount}
      Failed Requests: ${metrics.errors}
      Error Rate: ${(errorRate * 100).toFixed(2)}%
      Average Latency: ${averageLatency.toFixed(2)}ms
      P95 Latency: ${p95Latency.toFixed(2)}ms
      Requests/Second: ${requestsPerSecond.toFixed(2)}
    `);
  });

  describe('Database Stress', () => {
    test('handles connection pool exhaustion', async () => {
      if (skipIf(!dbAvailable, 'Database stress tests skipped because the database is unavailable.')) {
        return;
      }

      const pools: Pool[] = [];

      try {
        // Create many connections until pool is exhausted
        for (let i = 0; i < 200; i++) {
          const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 1
          });
          pools.push(pool);
          await pool.query('SELECT 1');
        }
      } catch (error: any) {
        // Expected to fail at some point
        expect(error.message).toMatch(/connection|pool|timeout/i);
      } finally {
        // Cleanup
        await Promise.all(pools.map(p => p.end().catch(() => {})));
      }
    });

    test('handles large result sets', async () => {
      if (skipIf(!dbAvailable, 'Database stress tests skipped because the database is unavailable.')) {
        return;
      }

      const pool = new Pool({ connectionString: process.env.DATABASE_URL });

      try {
        // Generate large dataset
        await pool.query(`
          WITH RECURSIVE large_set AS (
            SELECT 1 as n, random()::text || repeat('x', 1000) as data
            UNION ALL
            SELECT n + 1, random()::text || repeat('x', 1000)
            FROM large_set WHERE n < 10000
          )
          SELECT * FROM large_set
        `);
      } catch (error: any) {
        // Might fail due to memory/timeout
        expect(['timeout', 'memory', 'canceled'].some(word =>
          error.message.toLowerCase().includes(word)
        )).toBeTruthy();
      } finally {
        await pool.end();
      }
    });

    test('handles rapid transaction commits', async () => {
      if (skipIf(!dbAvailable, 'Database stress tests skipped because the database is unavailable.')) {
        return;
      }

      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          pool.query('BEGIN')
            .then(() => pool.query('INSERT INTO nofx.event (run_id, type, payload) VALUES ($1, $2, $3)',
              [crypto.randomUUID(), 'stress_test', { index: i }]))
            .then(() => pool.query('COMMIT'))
            .catch(() => pool.query('ROLLBACK'))
        );
      }

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;

      // At least some should succeed
      expect(succeeded).toBeGreaterThan(0);
      await pool.end();
    });
  });

  describe('Redis/Queue Stress', () => {
    test('handles queue overflow', async () => {
      if (skipIf(!redisAvailable, 'Redis stress tests skipped because Redis is unavailable.')) {
        return;
      }

      const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null
      });

      const promises = [];
      for (let i = 0; i < 10000; i++) {
        promises.push(
          redis.lpush('stress_test_queue', JSON.stringify({
            index: i,
            data: 'x'.repeat(1000),
            timestamp: Date.now()
          }))
        );
      }

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;

      expect(succeeded).toBeGreaterThan(9000); // Most should succeed

      // Cleanup
      await redis.del('stress_test_queue');
      redis.disconnect();
    });

    test('handles rapid pub/sub', async () => {
      if (skipIf(!redisAvailable, 'Redis stress tests skipped because Redis is unavailable.')) {
        return;
      }

      const publisher = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null
      });
      const subscriber = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null
      });

      let received = 0;
      subscriber.on('message', () => received++);
      await subscriber.subscribe('stress_channel');

      // Rapid fire messages
      for (let i = 0; i < 1000; i++) {
        await publisher.publish('stress_channel', `message${i}`);
      }

      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(received).toBeGreaterThan(900); // Most should be received

      publisher.disconnect();
      subscriber.disconnect();
    });
  });

  describe('API Stress', () => {
    test('handles thundering herd', async () => {
      if (skipIf(!apiAvailable, 'API stress tests skipped because the API is unavailable.')) {
        return;
      }

      // 1000 simultaneous requests
      const promises = Array(1000).fill(null).map(async () => {
        const start = performance.now();
        try {
          const response = await fetch(`${API_URL}/health`);
          const latency = performance.now() - start;
          metrics.latencies.push(latency);
          metrics.requests++;
          return response.ok;
        } catch (error) {
          metrics.errors++;
          return false;
        }
      });

      const results = await Promise.all(promises);
      const successful = results.filter(r => r).length;

      // At least 90% should succeed
      expect(successful).toBeGreaterThan(900);
    });

    test('handles sustained high load', async () => {
      if (skipIf(!apiAvailable, 'API stress tests skipped because the API is unavailable.')) {
        return;
      }

      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      let requestCount = 0;
      let errorCount = 0;

      while (Date.now() - startTime < duration) {
        try {
          const response = await fetch(`${API_URL}/health`);
          if (!response.ok) errorCount++;
          requestCount++;
        } catch {
          errorCount++;
          requestCount++;
        }

        // No delay - maximum pressure
      }

      const errorRate = errorCount / requestCount;
      expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
      expect(requestCount).toBeGreaterThan(100); // Should handle many requests
    });

    test('handles memory pressure', async () => {
      if (skipIf(!apiAvailable, 'API stress tests skipped because the API is unavailable.')) {
        return;
      }

      // Create runs with increasingly large payloads
      const sizes = [1, 10, 100, 1000, 10000]; // KB

      for (const size of sizes) {
        const largeData = 'x'.repeat(size * 1024);

        try {
          const response = await fetch(`${API_URL}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: {
                goal: `Memory test ${size}KB`,
                steps: [{
                  name: 'memory_test',
                  tool: 'test',
                  inputs: { data: largeData }
                }]
              }
            })
          });

          if (!response.ok) {
            // Expected to fail at some point
            break;
          }
        } catch (error) {
          // Expected for very large payloads
          expect(size).toBeGreaterThanOrEqual(100);
          break;
        }
      }
    });
  });

  describe('Resource Exhaustion', () => {
    test('handles file descriptor exhaustion', async () => {
      if (skipIf(!apiAvailable, 'Resource exhaustion tests skipped because the API is unavailable.')) {
        return;
      }

      const promises = [];

      // Try to open many connections
      for (let i = 0; i < 5000; i++) {
        promises.push(
          fetch(`${API_URL}/health`)
            .then(r => r.text())
            .catch(() => null)
        );
      }

      const results = await Promise.all(promises);
      const successful = results.filter(r => r !== null).length;

      // System should handle gracefully
      expect(successful).toBeGreaterThan(0);
    });

    test('handles CPU intensive operations', async () => {
      if (skipIf(!apiAvailable, 'Resource exhaustion tests skipped because the API is unavailable.')) {
        return;
      }

      // Submit many CPU-intensive tasks
      const promises = Array(50).fill(null).map(() =>
        fetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: {
              goal: 'CPU intensive task',
              steps: Array(10).fill(null).map((_, i) => ({
                name: `cpu_task_${i}`,
                tool: 'codegen',
                inputs: {
                  // Trigger complex processing
                  complexity: 'high',
                  iterations: 1000000
                }
              }))
            }
          })
        }).catch(() => null)
      );

      const results = await Promise.all(promises);
      const successful = results.filter(r => r !== null).length;

      // Should handle at least some requests
      expect(successful).toBeGreaterThan(0);
    });
  });
});
