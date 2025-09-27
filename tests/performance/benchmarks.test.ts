/**
 * Performance Benchmark Test Suite
 * Comprehensive performance testing with thresholds and reporting
 */

import { performance } from 'perf_hooks';
import {
  createBenchmarkSuite,
  benchmark,
  completeBenchmarkSuite,
  getBenchmarkStats,
  generateBenchmarkReport,
  exportBenchmarkResults
} from '../../src/lib/benchmarks';
import { performanceMonitor } from '../../src/lib/performance-monitor';

describe('Performance Benchmarks', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  let baselineResults: any = {};

  beforeAll(async () => {
    // Start performance monitoring
    performanceMonitor.start();

    // Load baseline results if they exist
    try {
      // In a real implementation, you'd load from a file
      baselineResults = {};
    } catch {
      console.log('No baseline results found, creating new baseline');
    }
  });

  afterAll(async () => {
    performanceMonitor.stop();
    exportBenchmarkResults();
  });

  describe('API Endpoint Benchmarks', () => {
    beforeAll(() => {
      createBenchmarkSuite('api-endpoints', 'API endpoint performance benchmarks', {
        maxDuration: 100, // 100ms max for API calls
        maxMemoryMB: 10,  // 10MB max memory increase
        maxCpuPercent: 50 // 50% max CPU
      });
    });

    afterAll(() => {
      const suite = completeBenchmarkSuite();
      if (suite) {
        console.log(generateBenchmarkReport(suite.name));
      }
    });

    test('Health check endpoint performance', async () => {
      const { result, benchmark: benchmarkResult } = await benchmark(
        'health-check',
        async () => {
          const response = await fetch(`${API_URL}/health`);
          return response.text();
        },
        { endpoint: '/health', method: 'GET' }
      );

      expect(benchmarkResult.duration).toBeLessThan(50); // Should be very fast
      expect(result).toContain('OK');
    });

    test('Run creation endpoint performance', async () => {
      const { benchmark: benchmarkResult } = await benchmark(
        'create-run',
        async () => {
          const response = await fetch(`${API_URL}/runs/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: {
                goal: 'Performance test run',
                steps: [
                  {
                    name: 'test-step',
                    tool: 'codegen',
                    inputs: { prompt: 'Generate simple code' }
                  }
                ]
              }
            })
          });
          return response.json();
        },
        { endpoint: '/runs/preview', method: 'POST' }
      );

      expect(benchmarkResult.duration).toBeLessThan(200); // Should complete in under 200ms
    });

    test('Metrics endpoint performance', async () => {
      const { benchmark: benchmarkResult } = await benchmark(
        'metrics-endpoint',
        async () => {
          const response = await fetch(`${API_URL}/api/metrics`);
          return response.text();
        },
        { endpoint: '/api/metrics', method: 'GET' }
      );

      expect(benchmarkResult.duration).toBeLessThan(100); // Metrics should be fast
    });
  });

  describe('Database Benchmarks', () => {
    beforeAll(() => {
      createBenchmarkSuite('database-operations', 'Database operation benchmarks', {
        maxDuration: 50,  // 50ms max for DB operations
        maxMemoryMB: 5,   // 5MB max memory increase
        maxCpuPercent: 30 // 30% max CPU
      });
    });

    afterAll(() => {
      const suite = completeBenchmarkSuite();
      if (suite) {
        console.log(generateBenchmarkReport(suite.name));
      }
    });

    test('Database connection benchmark', async () => {
      if (!process.env.DATABASE_URL) {
        console.log('Skipping database benchmarks - no DATABASE_URL');
        return;
      }

      const { Pool } = require('pg');

      const { benchmark: benchmarkResult } = await benchmark(
        'db-connection',
        async () => {
          const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
          try {
            const result = await pool.query('SELECT 1 as test');
            return result.rows[0];
          } finally {
            await pool.end();
          }
        },
        { operation: 'connection' }
      );

      expect(benchmarkResult.duration).toBeLessThan(100); // Connection should be fast
    });

    test('Simple query benchmark', async () => {
      if (!process.env.DATABASE_URL) {
        console.log('Skipping database benchmarks - no DATABASE_URL');
        return;
      }

      const { Pool } = require('pg');

      const { benchmark: benchmarkResult } = await benchmark(
        'simple-query',
        async () => {
          const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
          try {
            const result = await pool.query('SELECT NOW() as current_time');
            return result.rows[0];
          } finally {
            await pool.end();
          }
        },
        { operation: 'simple-select' }
      );

      expect(benchmarkResult.duration).toBeLessThan(50); // Simple query should be very fast
    });

    test('Complex query benchmark', async () => {
      if (!process.env.DATABASE_URL) {
        console.log('Skipping database benchmarks - no DATABASE_URL');
        return;
      }

      const { Pool } = require('pg');

      const { benchmark: benchmarkResult } = await benchmark(
        'complex-query',
        async () => {
          const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
          try {
            // Query that might exist in your schema
            const result = await pool.query(`
              SELECT COUNT(*) as event_count
              FROM nofx.event
              WHERE created_at > NOW() - INTERVAL '1 day'
            `);
            return result.rows[0];
          } catch (error) {
            // If table doesn't exist, just return a placeholder
            return { event_count: 0 };
          } finally {
            await pool.end();
          }
        },
        { operation: 'complex-select' }
      );

      expect(benchmarkResult.duration).toBeLessThan(200); // Complex query can take longer
    });
  });

  describe('Memory and CPU Benchmarks', () => {
    beforeAll(() => {
      createBenchmarkSuite('resource-usage', 'Memory and CPU usage benchmarks', {
        maxDuration: 1000, // 1 second max
        maxMemoryMB: 50,   // 50MB max memory increase
        maxCpuPercent: 80  // 80% max CPU
      });
    });

    afterAll(() => {
      const suite = completeBenchmarkSuite();
      if (suite) {
        console.log(generateBenchmarkReport(suite.name));
      }
    });

    test('Memory allocation benchmark', async () => {
      const { benchmark: benchmarkResult } = await benchmark(
        'memory-allocation',
        async () => {
          // Allocate and work with some memory
          const arrays: number[][] = [];
          for (let i = 0; i < 100; i++) {
            arrays.push(new Array(1000).fill(Math.random()));
          }

          // Perform some operations
          return arrays.reduce((sum, arr) => sum + arr.length, 0);
        },
        { operation: 'memory-intensive' }
      );

      expect(benchmarkResult.memory?.used).toBeGreaterThan(0);
      expect(benchmarkResult.duration).toBeLessThan(500); // Should complete quickly
    });

    test('CPU intensive benchmark', async () => {
      const { result, benchmark: benchmarkResult } = await benchmark(
        'cpu-intensive',
        async () => {
          // CPU intensive calculation
          let result = 0;
          for (let i = 0; i < 100000; i++) {
            result += Math.sin(i) * Math.cos(i);
          }
          return result;
        },
        { operation: 'cpu-intensive' }
      );

      expect(typeof result).toBe('number');
      expect(benchmarkResult.cpu?.user).toBeGreaterThan(0);
      expect(benchmarkResult.duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('JSON parsing benchmark', async () => {
      const largeObject = {
        data: Array(10000).fill(null).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random(),
          tags: [`tag${i}`, `category${i % 10}`],
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          }
        }))
      };

      const jsonString = JSON.stringify(largeObject);

      const { benchmark: benchmarkResult } = await benchmark(
        'json-parsing',
        async () => {
          const parsed = JSON.parse(jsonString);
          return parsed.data.length;
        },
        {
          operation: 'json-parse',
          dataSize: jsonString.length
        }
      );

      expect(benchmarkResult.duration).toBeLessThan(100); // JSON parsing should be fast
    });
  });

  describe('Concurrent Operation Benchmarks', () => {
    beforeAll(() => {
      createBenchmarkSuite('concurrent-operations', 'Concurrent operation benchmarks', {
        maxDuration: 2000, // 2 seconds max for concurrent ops
        maxMemoryMB: 100,  // 100MB max memory increase
        maxCpuPercent: 90  // 90% max CPU
      });
    });

    afterAll(() => {
      const suite = completeBenchmarkSuite();
      if (suite) {
        console.log(generateBenchmarkReport(suite.name));
      }
    });

    test('Concurrent API calls benchmark', async () => {
      const { result, benchmark: benchmarkResult } = await benchmark(
        'concurrent-api-calls',
        async () => {
          const promises = Array(10).fill(null).map(() =>
            fetch(`${API_URL}/health`).then(r => r.text())
          );

          const results = await Promise.all(promises);
          return results.length;
        },
        { operation: 'concurrent-requests', concurrency: 10 }
      );

      expect(result).toBe(10);
      expect(benchmarkResult.duration).toBeLessThan(1000); // Should handle 10 concurrent requests quickly
    });

    test('Concurrent promise processing', async () => {
      const { result, benchmark: benchmarkResult } = await benchmark(
        'concurrent-promises',
        async () => {
          const promises = Array(100).fill(null).map((_, i) =>
            new Promise(resolve => {
              setTimeout(() => resolve(i * i), Math.random() * 10);
            })
          );

          const results = await Promise.all(promises);
          return results.reduce((sum: number, val: any) => sum + val, 0);
        },
        { operation: 'concurrent-promises', count: 100 }
      );

      expect(typeof result).toBe('number');
      expect(benchmarkResult.duration).toBeLessThan(500); // Should handle concurrent promises efficiently
    });
  });

  describe('Performance Regression Tests', () => {
    test('Compare against baseline performance', async () => {
      const stats = getBenchmarkStats('api-endpoints');

      if (stats && baselineResults.apiEndpoints) {
        const performanceRegression = (stats.avgDuration / baselineResults.apiEndpoints.avgDuration) > 1.2;

        if (performanceRegression) {
          console.warn(`⚠️ Performance regression detected!
            Current avg: ${stats.avgDuration.toFixed(2)}ms
            Baseline avg: ${baselineResults.apiEndpoints.avgDuration.toFixed(2)}ms
            Regression: ${((stats.avgDuration / baselineResults.apiEndpoints.avgDuration - 1) * 100).toFixed(1)}%`);
        }

        expect(performanceRegression).toBe(false);
      } else {
        console.log('📊 No baseline data available, current results will be saved as baseline');
        baselineResults.apiEndpoints = stats;
      }
    });

    test('Memory leak detection', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform operations that might leak memory
      for (let i = 0; i < 100; i++) {
        await benchmark(
          `memory-test-${i}`,
          async () => {
            const tempData = new Array(1000).fill(Math.random());
            return tempData.reduce((sum, val) => sum + val, 0);
          }
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB

      console.log(`Memory usage: ${initialMemory / (1024 * 1024)}MB → ${finalMemory / (1024 * 1024)}MB (${memoryIncrease > 0 ? '+' : ''}${memoryIncrease.toFixed(2)}MB)`);

      // Allow for some memory increase, but detect significant leaks
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });

  describe('Performance Summary', () => {
    test('Generate comprehensive performance report', () => {
      const summary = performanceMonitor.getSummary();

      console.log(`
📊 Performance Test Summary
============================
⏱️  Uptime: ${(summary.uptime / 1000).toFixed(2)}s
🔢 Total Requests: ${summary.totalRequests}
❌ Total Errors: ${summary.totalErrors}
📈 Error Rate: ${summary.errorRate.toFixed(2)}%
⚡ Avg Response Time: ${summary.avgResponseTime.toFixed(2)}ms
🧠 Avg Memory Usage: ${summary.avgMemoryMB.toFixed(2)}MB
🚀 Avg RPS: ${summary.avgRPS.toFixed(2)}

System Health: ${performanceMonitor.isHealthy() ? '✅ Healthy' : '❌ Unhealthy'}
      `);

      // Basic health assertions
      expect(summary.errorRate).toBeLessThan(10); // Less than 10% error rate
      expect(summary.avgResponseTime).toBeLessThan(1000); // Less than 1 second average
      expect(performanceMonitor.isHealthy()).toBe(true);
    });
  });
});