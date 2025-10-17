import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import express, { type Request, type Response } from 'express';
import {
  MetricsCollector,
  createMetricsCollector,
} from '../MetricsCollector';
import { createSLAMonitoringService } from '../SLAMonitoringService';
import { InMemorySLAStorage } from '../storage/InMemorySLAStorage';
import { MetricType } from '../types';

describe('MetricsCollector', () => {
  let storage: InMemorySLAStorage;
  let slaService: ReturnType<typeof createSLAMonitoringService>;
  let collector: MetricsCollector;

  beforeEach(async () => {
    storage = new InMemorySLAStorage();
    slaService = createSLAMonitoringService({ storage });
    collector = createMetricsCollector({
      slaService,
      collectSystemMetrics: false, // Disable for tests
    });
  });

  afterEach(async () => {
    collector.shutdown();
    await slaService.shutdown();
  });

  describe('Request Metrics Middleware', () => {
    it('should collect response time metrics', async () => {
      const middleware = collector.createRequestMetricsMiddleware();

      const req = {
        method: 'GET',
        path: '/api/test',
      } as Request;

      const res = {
        statusCode: 200,
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      const next = jest.fn();

      // Execute middleware
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      // Simulate response
      res.send({});

      // Give async collection time to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.labels?.method).toBe('GET');
      expect(metrics[0]!.labels?.path).toBe('/api/test');
    });

    it('should collect success rate metrics', async () => {
      const middleware = collector.createRequestMetricsMiddleware();

      const req = {
        method: 'POST',
        path: '/api/create',
      } as Request;

      const res = {
        statusCode: 201,
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      const next = jest.fn();

      await middleware(req, res, next);
      res.send({});

      await new Promise(resolve => setTimeout(resolve, 100));
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.SUCCESS_RATE,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(1);
    });

    it('should collect error rate for failed requests', async () => {
      const middleware = collector.createRequestMetricsMiddleware();

      const req = {
        method: 'GET',
        path: '/api/error',
      } as Request;

      const res = {
        statusCode: 500,
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      const next = jest.fn();

      await middleware(req, res, next);
      res.send({});

      await new Promise(resolve => setTimeout(resolve, 100));
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.ERROR_RATE,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(0);
    });

    it('should include organization ID from request', async () => {
      const middleware = collector.createRequestMetricsMiddleware();

      const req = {
        method: 'GET',
        path: '/api/test',
        organizationId: 'org_123',
      } as any;

      const res = {
        statusCode: 200,
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      const next = jest.fn();

      await middleware(req, res, next);
      res.send({});

      await new Promise(resolve => setTimeout(resolve, 100));
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date(),
        'org_123'
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.organization_id).toBe('org_123');
    });
  });

  describe('Manual Metric Recording', () => {
    it('should record query time', async () => {
      await collector.recordQueryTime(42, 'SELECT', 'org_123');
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.DB_QUERY_TIME,
        new Date(Date.now() - 60000),
        new Date(),
        'org_123'
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(42);
      expect(metrics[0]!.labels?.query_type).toBe('SELECT');
    });

    it('should mark slow queries', async () => {
      // Default threshold is 100ms
      await collector.recordQueryTime(150, 'SELECT');
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.DB_QUERY_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics[0]!.labels?.slow).toBe('true');
    });

    it('should record queue time', async () => {
      await collector.recordQueueTime('codegen', 1234, 'org_123');
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.QUEUE_TIME,
        new Date(Date.now() - 60000),
        new Date(),
        'org_123'
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(1234);
      expect(metrics[0]!.labels?.job_type).toBe('codegen');
    });

    it('should record handler time', async () => {
      await collector.recordHandlerTime('workspace:write', 567, 'org_123');
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.HANDLER_TIME,
        new Date(Date.now() - 60000),
        new Date(),
        'org_123'
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(567);
      expect(metrics[0]!.labels?.handler).toBe('workspace:write');
    });

    it('should record storage time', async () => {
      await collector.recordStorageTime('upload', 234);
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.STORAGE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(234);
      expect(metrics[0]!.labels?.operation).toBe('upload');
    });

    it('should record git time', async () => {
      await collector.recordGitTime('clone', 3456);
      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.GIT_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(3456);
      expect(metrics[0]!.labels?.operation).toBe('clone');
    });
  });

  describe('Timing Wrapper', () => {
    it('should measure function execution time', async () => {
      const slowFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };

      const result = await collector.withTiming(
        MetricType.HANDLER_TIME,
        slowFunction,
        { operation: 'slow_op' }
      );

      expect(result).toBe('result');

      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.HANDLER_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBeGreaterThanOrEqual(50);
      expect(metrics[0]!.labels?.operation).toBe('slow_op');
    });

    it('should record time even on error', async () => {
      const failingFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Operation failed');
      };

      await expect(
        collector.withTiming(
          MetricType.HANDLER_TIME,
          failingFunction,
          { operation: 'failing_op' }
        )
      ).rejects.toThrow('Operation failed');

      await slaService.flush();

      const metrics = await storage.getMetrics(
        MetricType.HANDLER_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.labels?.error).toBe('true');
    });
  });

  describe('System Metrics Collection', () => {
    it('should collect system metrics when enabled', async () => {
      const collectorWithSystemMetrics = createMetricsCollector({
        slaService,
        collectSystemMetrics: true,
        systemMetricsInterval: 1, // 1 second
      });

      // Wait for first collection
      await new Promise(resolve => setTimeout(resolve, 1500));
      await slaService.flush();

      const memoryMetrics = await storage.getMetrics(
        MetricType.MEMORY_USAGE,
        new Date(Date.now() - 60000),
        new Date()
      );

      const uptimeMetrics = await storage.getMetrics(
        MetricType.UPTIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(memoryMetrics.length).toBeGreaterThan(0);
      expect(uptimeMetrics.length).toBeGreaterThan(0);

      collectorWithSystemMetrics.shutdown();
    });

    it('should not collect system metrics when disabled', async () => {
      // collector already has collectSystemMetrics: false
      await new Promise(resolve => setTimeout(resolve, 1500));
      await slaService.flush();

      const memoryMetrics = await storage.getMetrics(
        MetricType.MEMORY_USAGE,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(memoryMetrics.length).toBe(0);
    });
  });

  describe('Shutdown', () => {
    it('should stop system metrics collection', async () => {
      const collectorWithMetrics = createMetricsCollector({
        slaService,
        collectSystemMetrics: true,
        systemMetricsInterval: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 1500));
      const beforeShutdown = await storage.getMetrics(
        MetricType.MEMORY_USAGE,
        new Date(Date.now() - 60000),
        new Date()
      );

      collectorWithMetrics.shutdown();

      await new Promise(resolve => setTimeout(resolve, 1500));
      const afterShutdown = await storage.getMetrics(
        MetricType.MEMORY_USAGE,
        new Date(Date.now() - 60000),
        new Date()
      );

      // Should not have collected more metrics after shutdown
      expect(afterShutdown.length).toBe(beforeShutdown.length);
    });
  });
});
