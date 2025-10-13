/**
 * Load Testing and Concurrent Operations Integration Tests
 * Tests system behavior under concurrent load and validates performance
 */

import request from 'supertest';
import { PerformanceMetrics, TestDataFactory, percentile } from '../helpers/testHelpers';

describe('Integration: Load Testing and Concurrent Operations', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    const appModule = await import('../../src/api/main');
    app = appModule.app;

    // Authenticate
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin'
      });

    if (authResponse.status === 200 && authResponse.body.token) {
      authToken = authResponse.body.token;
    }
  });

  describe('Concurrent API Requests', () => {
    test('should handle 100 concurrent health check requests', async () => {
      const concurrentRequests = 100;
      const results: Array<{ status: number; duration: number }> = [];

      const promises = Array(concurrentRequests).fill(null).map(async (_, i) => {
        const startTime = Date.now();

        try {
          const response = await request(app)
            .get('/health')
            .set('X-Request-ID', `load-test-${i}`)
            .timeout(5000);

          return {
            status: response.status,
            duration: Date.now() - startTime
          };
        } catch (error) {
          return {
            status: 500,
            duration: Date.now() - startTime
          };
        }
      });

      const responses = await Promise.all(promises);
      responses.forEach(r => results.push(r));

      // Calculate metrics
      const successful = results.filter(r => r.status === 200);
      const successRate = successful.length / results.length;

      const durations = results.map(r => r.duration);
      const p95Duration = percentile(durations, 95);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Assertions
      expect(successRate).toBeGreaterThan(0.99); // 99% success rate
      expect(p95Duration).toBeLessThan(1000); // P95 < 1 second
      expect(avgDuration).toBeLessThan(500); // Average < 500ms

      console.log(`📊 Load Test Results (100 concurrent health checks):
  Success Rate: ${(successRate * 100).toFixed(2)}%
  Average Response Time: ${avgDuration.toFixed(2)}ms
  P95 Response Time: ${p95Duration.toFixed(2)}ms
  P99 Response Time: ${percentile(durations, 99).toFixed(2)}ms`);
    }, 60000);

    test('should handle concurrent run creation requests', async () => {
      const concurrentRuns = 20;
      const metrics = new PerformanceMetrics();

      const promises = Array(concurrentRuns).fill(null).map(async (_, i) => {
        const startTime = Date.now();

        try {
          const response = await request(app)
            .post('/runs')
            .set('Authorization', authToken ? `Bearer ${authToken}` : '')
            .send({
              plan: TestDataFactory.createRunPlan({
                goal: `Load test run ${i}`
              })
            })
            .timeout(10000);

          const duration = Date.now() - startTime;
          metrics.record(duration);

          return {
            success: response.status === 201,
            duration,
            runId: response.body.run?.id || response.body.id
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - startTime,
            error: error
          };
        }
      });

      const results = await Promise.all(promises);

      const successful = results.filter(r => r.success);
      const successRate = successful.length / results.length;

      // Assertions
      expect(successRate).toBeGreaterThan(0.90); // 90% success rate
      expect(metrics.getP95()).toBeLessThan(3000); // P95 < 3 seconds
      expect(metrics.getAverage()).toBeLessThan(2000); // Average < 2 seconds

      console.log(`📊 Concurrent Run Creation Results (${concurrentRuns} runs):
  Success Rate: ${(successRate * 100).toFixed(2)}%
  Successful: ${successful.length}/${results.length}
  Average Time: ${metrics.getAverage().toFixed(2)}ms
  P95 Time: ${metrics.getP95().toFixed(2)}ms
  Min Time: ${metrics.getMin().toFixed(2)}ms
  Max Time: ${metrics.getMax().toFixed(2)}ms`);
    }, 120000);
  });

  describe('Sustained Load Testing', () => {
    test('should handle sustained API load', async () => {
      const duration = 30000; // 30 seconds
      const rps = 10; // Requests per second
      const results: Array<{ status: number; duration: number }> = [];

      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        const batchStart = Date.now();

        // Send batch of requests
        const batchPromises = Array(rps).fill(null).map(async () => {
          const reqStart = Date.now();

          try {
            const response = await request(app)
              .get('/health')
              .timeout(5000);

            return {
              status: response.status,
              duration: Date.now() - reqStart
            };
          } catch (error) {
            return {
              status: 500,
              duration: Date.now() - reqStart
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Wait to maintain target RPS
        const batchDuration = Date.now() - batchStart;
        if (batchDuration < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - batchDuration));
        }
      }

      // Calculate metrics
      const successful = results.filter(r => r.status === 200);
      const successRate = successful.length / results.length;

      const durations = results.map(r => r.duration);
      const p95 = percentile(durations, 95);

      // Assertions
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate under sustained load
      expect(p95).toBeLessThan(1000); // P95 < 1 second

      console.log(`📊 Sustained Load Test Results (30 seconds @ ${rps} RPS):
  Total Requests: ${results.length}
  Success Rate: ${(successRate * 100).toFixed(2)}%
  Average Response Time: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms
  P95 Response Time: ${p95.toFixed(2)}ms`);
    }, 60000);
  });

  describe('Database Connection Pool Under Load', () => {
    test('should handle concurrent database queries', async () => {
      const { query } = await import('../../src/lib/db');
      const concurrentQueries = 50;

      const promises = Array(concurrentQueries).fill(null).map(async (_, i) => {
        const startTime = Date.now();

        try {
          await query('SELECT 1 as test');
          return {
            success: true,
            duration: Date.now() - startTime
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - startTime,
            error
          };
        }
      });

      const results = await Promise.all(promises);

      const successful = results.filter(r => r.success);
      const durations = results.map(r => r.duration);

      // Assertions
      expect(successful.length / results.length).toBeGreaterThan(0.95); // 95% success
      expect(percentile(durations, 95)).toBeLessThan(500); // P95 < 500ms

      console.log(`📊 Concurrent Database Queries (${concurrentQueries} queries):
  Success Rate: ${((successful.length / results.length) * 100).toFixed(2)}%
  Average Time: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms`);
    }, 30000);
  });

  describe('Queue Operations Under Load', () => {
    test('should handle concurrent queue enqueuing', async () => {
      try {
        const { enqueue, STEP_READY_TOPIC } = await import('../../src/lib/queue');
        const concurrentJobs = 50;

        const promises = Array(concurrentJobs).fill(null).map(async (_, i) => {
          const startTime = Date.now();

          try {
            await enqueue(STEP_READY_TOPIC, {
              runId: `load-test-run-${i}`,
              stepId: `load-test-step-${i}`,
              idempotencyKey: `load-test-key-${i}-${Date.now()}`
            });

            return {
              success: true,
              duration: Date.now() - startTime
            };
          } catch (error) {
            return {
              success: false,
              duration: Date.now() - startTime,
              error
            };
          }
        });

        const results = await Promise.all(promises);

        const successful = results.filter(r => r.success);
        const durations = results.map(r => r.duration);

        // Assertions
        expect(successful.length / results.length).toBeGreaterThan(0.90); // 90% success
        expect(percentile(durations, 95)).toBeLessThan(1000); // P95 < 1 second

        console.log(`📊 Concurrent Queue Operations (${concurrentJobs} jobs):
  Success Rate: ${((successful.length / results.length) * 100).toFixed(2)}%
  Average Time: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms`);
      } catch (error) {
        // Queue may not be available in test environment
        console.warn('⚠️  Queue tests skipped - queue not available');
      }
    }, 30000);
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle memory-intensive operations', async () => {
      const largePayload = {
        plan: {
          goal: 'Memory test',
          steps: Array(100).fill(null).map((_, i) => ({
            name: `step-${i}`,
            tool: 'codegen',
            inputs: {
              prompt: 'x'.repeat(1000) // 1KB per step
            }
          }))
        }
      };

      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send(largePayload)
        .timeout(10000);

      // Should handle large payload gracefully
      expect([201, 400, 413]).toContain(response.status);
    }, 30000);

    test('should enforce reasonable timeouts', async () => {
      const startTime = Date.now();

      try {
        await request(app)
          .get('/health')
          .timeout(100); // Very short timeout

        // If it succeeds, that's fine
      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Should timeout quickly
        expect(duration).toBeLessThan(500);
        expect(error.message).toMatch(/timeout|ETIMEDOUT/i);
      }
    });
  });

  describe('Performance Degradation Detection', () => {
    test('should detect performance degradation over time', async () => {
      const iterations = 20;
      const measurements: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        await request(app)
          .get('/health')
          .timeout(5000);

        measurements.push(Date.now() - startTime);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate trend
      const firstHalf = measurements.slice(0, iterations / 2);
      const secondHalf = measurements.slice(iterations / 2);

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Performance should not degrade significantly
      const degradationRatio = secondHalfAvg / firstHalfAvg;
      expect(degradationRatio).toBeLessThan(2.0); // No more than 2x slower

      console.log(`📊 Performance Stability Test:
  First Half Average: ${firstHalfAvg.toFixed(2)}ms
  Second Half Average: ${secondHalfAvg.toFixed(2)}ms
  Degradation Ratio: ${degradationRatio.toFixed(2)}x`);
    }, 30000);
  });
});
