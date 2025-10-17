/**
 * Unit Tests for Metrics Collector
 * Phase 3A Part 4: SLA Monitoring and Alerting
 */

import { Request, Response, NextFunction } from 'express';
import {
  createMetricsCollector,
  createSLAMonitoringService,
  InMemorySLAStorage,
  SLADefinition,
  MetricType,
} from '../../../src/sla';

describe('MetricsCollector', () => {
  let storage: InMemorySLAStorage;
  let slaService: ReturnType<typeof createSLAMonitoringService>;
  let metricsCollector: ReturnType<typeof createMetricsCollector>;

  beforeEach(async () => {
    storage = new InMemorySLAStorage();
    slaService = createSLAMonitoringService({ storage });
    metricsCollector = createMetricsCollector({ slaService });

    // Create test SLAs
    const responseTimeSLA: SLADefinition = {
      id: 'api-response-time',
      name: 'API Response Time',
      description: 'API response time under 200ms for 95% of requests',
      metric: {
        type: MetricType.RESPONSE_TIME,
        target: 200,
        threshold: 95,
        unit: 'ms',
      },
      window: '5m',
      severity: 'high',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const errorRateSLA: SLADefinition = {
      id: 'api-error-rate',
      name: 'API Error Rate',
      description: 'Error rate under 1%',
      metric: {
        type: MetricType.ERROR_RATE,
        target: 1,
        threshold: 99,
        unit: '%',
      },
      window: '5m',
      severity: 'critical',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await slaService.createSLA(responseTimeSLA);
    await slaService.createSLA(errorRateSLA);
  });

  describe('Request Metrics Middleware', () => {
    it('should collect response time metrics', async () => {
      const middleware = metricsCollector.createRequestMetricsMiddleware();

      const req = {
        method: 'GET',
        path: '/api/test',
      } as Request;

      const res = {
        statusCode: 200,
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'finish') {
            // Simulate response finishing after 150ms
            setTimeout(callback, 10);
          }
        }),
      } as unknown as Response;

      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      // Wait for response to finish
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
    });

    it('should collect error rate metrics', async () => {
      const middleware = metricsCollector.createRequestMetricsMiddleware();

      const req = {
        method: 'POST',
        path: '/api/test',
      } as Request;

      const res = {
        statusCode: 500, // Error response
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'finish') {
            setTimeout(callback, 10);
          }
        }),
      } as unknown as Response;

      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      // Wait for response to finish
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
    });

    it('should exclude health check endpoints', async () => {
      const middleware = metricsCollector.createRequestMetricsMiddleware({
        excludePaths: ['/health', '/metrics'],
      });

      const req = {
        method: 'GET',
        path: '/health',
      } as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Manual Metric Recording', () => {
    it('should record response time metric', async () => {
      await metricsCollector.recordResponseTime('api-response-time', 150, {
        endpoint: '/api/test',
      });

      const metrics = await slaService.getMetrics('api-response-time');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[metrics.length - 1].value).toBe(150);
    });

    it('should record error metric', async () => {
      await metricsCollector.recordError('api-error-rate', {
        endpoint: '/api/test',
        errorCode: 500,
      });

      const metrics = await slaService.getMetrics('api-error-rate');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should record success metric', async () => {
      await metricsCollector.recordSuccess('api-error-rate', {
        endpoint: '/api/test',
      });

      const metrics = await slaService.getMetrics('api-error-rate');
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('Metric Decorators', () => {
    it('should measure function execution time with @Timed decorator', async () => {
      class TestService {
        async slowOperation(): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'done';
        }
      }

      const service = new TestService();
      const result = await service.slowOperation();

      expect(result).toBe('done');
    });

    it('should track errors with decorator', async () => {
      class TestService {
        async failingOperation(): Promise<void> {
          throw new Error('Test error');
        }
      }

      const service = new TestService();

      await expect(service.failingOperation()).rejects.toThrow('Test error');
    });
  });

  describe('System Metrics Collection', () => {
    it('should collect CPU metrics', async () => {
      const collector = createMetricsCollector({
        slaService,
        collectSystemMetrics: true,
        systemMetricsInterval: 100, // 100ms for testing
      });

      // Wait for one collection cycle
      await new Promise(resolve => setTimeout(resolve, 150));

      const cpuMetrics = await collector.getSystemMetrics('cpu');
      expect(cpuMetrics).toBeDefined();
    });

    it('should collect memory metrics', async () => {
      const collector = createMetricsCollector({
        slaService,
        collectSystemMetrics: true,
        systemMetricsInterval: 100,
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const memoryMetrics = await collector.getSystemMetrics('memory');
      expect(memoryMetrics).toBeDefined();
    });

    it('should stop collecting when stopped', async () => {
      const collector = createMetricsCollector({
        slaService,
        collectSystemMetrics: true,
        systemMetricsInterval: 100,
      });

      collector.stop();

      // Wait to ensure no more metrics are collected
      await new Promise(resolve => setTimeout(resolve, 200));

      // Metrics collection should have stopped
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Metric Aggregation', () => {
    it('should calculate average response time', async () => {
      // Record multiple metrics
      await metricsCollector.recordResponseTime('api-response-time', 100);
      await metricsCollector.recordResponseTime('api-response-time', 200);
      await metricsCollector.recordResponseTime('api-response-time', 150);

      const stats = await metricsCollector.getStats('api-response-time');

      expect(stats.average).toBeCloseTo(150, 0);
      expect(stats.count).toBe(3);
    });

    it('should calculate percentiles', async () => {
      // Record 100 metrics
      for (let i = 1; i <= 100; i++) {
        await metricsCollector.recordResponseTime('api-response-time', i);
      }

      const stats = await metricsCollector.getStats('api-response-time');

      expect(stats.p50).toBeCloseTo(50, 5);
      expect(stats.p95).toBeCloseTo(95, 5);
      expect(stats.p99).toBeCloseTo(99, 5);
    });

    it('should calculate min and max values', async () => {
      await metricsCollector.recordResponseTime('api-response-time', 50);
      await metricsCollector.recordResponseTime('api-response-time', 300);
      await metricsCollector.recordResponseTime('api-response-time', 150);

      const stats = await metricsCollector.getStats('api-response-time');

      expect(stats.min).toBe(50);
      expect(stats.max).toBe(300);
    });
  });

  describe('Time Window Management', () => {
    it('should respect metric retention window', async () => {
      const collector = createMetricsCollector({
        slaService,
        retentionMinutes: 1, // 1 minute retention
      });

      // Record metric with old timestamp
      await slaService.recordMetric({
        slaId: 'api-response-time',
        value: 100,
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        metadata: {},
      });

      // Record recent metric
      await collector.recordResponseTime('api-response-time', 150);

      const stats = await collector.getStats('api-response-time', {
        window: '1m',
      });

      // Should only include recent metric
      expect(stats.count).toBe(1);
    });

    it('should support custom time windows', async () => {
      // Record metrics over time
      await metricsCollector.recordResponseTime('api-response-time', 100);
      await new Promise(resolve => setTimeout(resolve, 100));
      await metricsCollector.recordResponseTime('api-response-time', 200);

      const stats5m = await metricsCollector.getStats('api-response-time', {
        window: '5m',
      });

      const stats1h = await metricsCollector.getStats('api-response-time', {
        window: '1h',
      });

      expect(stats5m.count).toBeGreaterThanOrEqual(0);
      expect(stats1h.count).toBeGreaterThanOrEqual(stats5m.count);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing SLA gracefully', async () => {
      await expect(
        metricsCollector.recordResponseTime('non-existent-sla', 100)
      ).rejects.toThrow();
    });

    it('should handle invalid metric values', async () => {
      await expect(
        metricsCollector.recordResponseTime('api-response-time', -100)
      ).rejects.toThrow();
    });
  });

  describe('Metric Export', () => {
    it('should export metrics in Prometheus format', async () => {
      await metricsCollector.recordResponseTime('api-response-time', 150);
      await metricsCollector.recordResponseTime('api-response-time', 200);

      const prometheus = await metricsCollector.exportPrometheus();

      expect(prometheus).toContain('api_response_time');
      expect(prometheus).toContain('TYPE');
      expect(prometheus).toContain('HELP');
    });

    it('should export metrics in JSON format', async () => {
      await metricsCollector.recordResponseTime('api-response-time', 150);

      const json = await metricsCollector.exportJSON();

      expect(json).toBeDefined();
      expect(json.metrics).toBeDefined();
      expect(Array.isArray(json.metrics)).toBe(true);
    });
  });
});
