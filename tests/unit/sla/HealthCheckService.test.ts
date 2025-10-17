/**
 * Unit Tests for Health Check Service
 * Phase 3A Part 4: SLA Monitoring and Alerting
 */

import { Request, Response } from 'express';
import {
  createHealthCheckService,
  createSLAMonitoringService,
  InMemorySLAStorage,
  ComponentHealthChecker,
  HealthStatus,
} from '../../../src/sla';

describe('HealthCheckService', () => {
  let storage: InMemorySLAStorage;
  let slaService: ReturnType<typeof createSLAMonitoringService>;
  let healthService: ReturnType<typeof createHealthCheckService>;

  beforeEach(() => {
    storage = new InMemorySLAStorage();
    slaService = createSLAMonitoringService({ storage });
    healthService = createHealthCheckService({ slaService });
  });

  describe('Component Health Checks', () => {
    it('should register health checker for component', async () => {
      const dbChecker: ComponentHealthChecker = {
        name: 'database',
        async check() {
          return {
            status: 'healthy',
            message: 'Database connection OK',
            details: {
              connections: 5,
              maxConnections: 10,
            },
          };
        },
      };

      healthService.registerChecker(dbChecker);

      const health = await healthService.checkHealth();
      expect(health.components['database']).toBeDefined();
      expect(health.components['database'].status).toBe('healthy');
    });

    it('should detect unhealthy component', async () => {
      const failingChecker: ComponentHealthChecker = {
        name: 'cache',
        async check() {
          return {
            status: 'unhealthy',
            message: 'Cache connection failed',
            details: {
              error: 'Connection timeout',
            },
          };
        },
      };

      healthService.registerChecker(failingChecker);

      const health = await healthService.checkHealth();
      expect(health.components['cache'].status).toBe('unhealthy');
      expect(health.overall).toBe('unhealthy');
    });

    it('should handle degraded component', async () => {
      const degradedChecker: ComponentHealthChecker = {
        name: 'api',
        async check() {
          return {
            status: 'degraded',
            message: 'API running with reduced capacity',
            details: {
              availableWorkers: 2,
              totalWorkers: 10,
            },
          };
        },
      };

      healthService.registerChecker(degradedChecker);

      const health = await healthService.checkHealth();
      expect(health.components['api'].status).toBe('degraded');
      expect(health.overall).toBe('degraded');
    });

    it('should handle checker errors gracefully', async () => {
      const errorChecker: ComponentHealthChecker = {
        name: 'error-service',
        async check() {
          throw new Error('Health check failed');
        },
      };

      healthService.registerChecker(errorChecker);

      const health = await healthService.checkHealth();
      expect(health.components['error-service'].status).toBe('unhealthy');
      expect(health.components['error-service'].message).toContain('failed');
    });
  });

  describe('Overall Health Status', () => {
    it('should report healthy when all components healthy', async () => {
      healthService.registerChecker({
        name: 'db',
        async check() {
          return { status: 'healthy', message: 'OK' };
        },
      });

      healthService.registerChecker({
        name: 'cache',
        async check() {
          return { status: 'healthy', message: 'OK' };
        },
      });

      const health = await healthService.checkHealth();
      expect(health.overall).toBe('healthy');
    });

    it('should report unhealthy when any component unhealthy', async () => {
      healthService.registerChecker({
        name: 'db',
        async check() {
          return { status: 'healthy', message: 'OK' };
        },
      });

      healthService.registerChecker({
        name: 'cache',
        async check() {
          return { status: 'unhealthy', message: 'Failed' };
        },
      });

      const health = await healthService.checkHealth();
      expect(health.overall).toBe('unhealthy');
    });

    it('should report degraded when any component degraded (but none unhealthy)', async () => {
      healthService.registerChecker({
        name: 'db',
        async check() {
          return { status: 'healthy', message: 'OK' };
        },
      });

      healthService.registerChecker({
        name: 'cache',
        async check() {
          return { status: 'degraded', message: 'Slow' };
        },
      });

      const health = await healthService.checkHealth();
      expect(health.overall).toBe('degraded');
    });
  });

  describe('Health Endpoints', () => {
    it('should create health check endpoint', async () => {
      const endpoint = healthService.createHealthEndpoint();

      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await endpoint(req, res);

      expect(res.json).toHaveBeenCalled();
      const call = (res.json as jest.Mock).mock.calls[0][0];
      expect(call.status).toBeDefined();
      expect(call.timestamp).toBeDefined();
    });

    it('should create readiness endpoint', async () => {
      healthService.registerChecker({
        name: 'db',
        async check() {
          return { status: 'healthy', message: 'Ready' };
        },
      });

      const endpoint = healthService.createReadinessEndpoint();

      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 503 when not ready', async () => {
      healthService.registerChecker({
        name: 'db',
        async check() {
          return { status: 'unhealthy', message: 'Not ready' };
        },
      });

      const endpoint = healthService.createReadinessEndpoint();

      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('should create liveness endpoint', async () => {
      const endpoint = healthService.createLivenessEndpoint();

      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ alive: true });
    });
  });

  describe('SLA Compliance Health', () => {
    it('should include SLA compliance in health check', async () => {
      const health = await healthService.checkHealth();

      expect(health.sla).toBeDefined();
      expect(typeof health.sla.compliant).toBe('boolean');
    });

    it('should report unhealthy when SLAs violated', async () => {
      // Create and violate an SLA
      await slaService.createSLA({
        id: 'test-sla',
        name: 'Test SLA',
        description: 'Test',
        metric: {
          type: 'response_time',
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        severity: 'critical',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Record violations
      for (let i = 0; i < 100; i++) {
        await slaService.recordMetric({
          slaId: 'test-sla',
          value: 200, // Over target
          timestamp: new Date(),
          metadata: {},
        });
      }

      await slaService.checkViolations('test-sla');

      const health = await healthService.checkHealth();
      expect(health.sla.violations).toBeGreaterThan(0);
    });
  });

  describe('Built-in Health Checkers', () => {
    it('should check database health', async () => {
      const { DatabaseHealthChecker } = await import('../../../src/sla');

      const dbChecker = new DatabaseHealthChecker({
        async query(sql: string) {
          return { rows: [{ now: new Date() }] };
        },
      });

      const result = await dbChecker.check();
      expect(result.status).toBe('healthy');
    });

    it('should detect database connection failure', async () => {
      const { DatabaseHealthChecker } = await import('../../../src/sla');

      const dbChecker = new DatabaseHealthChecker({
        async query() {
          throw new Error('Connection failed');
        },
      });

      const result = await dbChecker.check();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('failed');
    });

    it('should check Redis health', async () => {
      const { RedisHealthChecker } = await import('../../../src/sla');

      const mockRedis = {
        ping: jest.fn().mockResolvedValue('PONG'),
        info: jest.fn().mockResolvedValue('used_memory:1000000'),
      };

      const redisChecker = new RedisHealthChecker(mockRedis);
      const result = await redisChecker.check();

      expect(result.status).toBe('healthy');
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should check storage health', async () => {
      const { StorageHealthChecker } = await import('../../../src/sla');

      const mockStorage = {
        async healthCheck() {
          return { available: true, spaceUsed: 50 };
        },
      };

      const storageChecker = new StorageHealthChecker(mockStorage);
      const result = await storageChecker.check();

      expect(result.status).toBe('healthy');
    });
  });

  describe('Health Check Caching', () => {
    it('should cache health check results', async () => {
      let checkCount = 0;

      healthService.registerChecker({
        name: 'cached',
        async check() {
          checkCount++;
          return { status: 'healthy', message: 'OK' };
        },
      });

      const service = createHealthCheckService({
        slaService,
        cacheTTL: 1000, // 1 second cache
      });

      service.registerChecker({
        name: 'cached',
        async check() {
          checkCount++;
          return { status: 'healthy', message: 'OK' };
        },
      });

      await service.checkHealth();
      await service.checkHealth();

      // Should only check once due to caching
      expect(checkCount).toBe(1);
    });

    it('should refresh cache after TTL expires', async () => {
      let checkCount = 0;

      const service = createHealthCheckService({
        slaService,
        cacheTTL: 100, // 100ms cache
      });

      service.registerChecker({
        name: 'cached',
        async check() {
          checkCount++;
          return { status: 'healthy', message: 'OK' };
        },
      });

      await service.checkHealth();
      await new Promise(resolve => setTimeout(resolve, 150));
      await service.checkHealth();

      // Should check twice (cache expired)
      expect(checkCount).toBe(2);
    });
  });

  describe('Health Metrics', () => {
    it('should track health check duration', async () => {
      healthService.registerChecker({
        name: 'slow',
        async check() {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { status: 'healthy', message: 'OK' };
        },
      });

      const health = await healthService.checkHealth();
      expect(health.checkDurationMs).toBeGreaterThan(0);
    });

    it('should track last check timestamp', async () => {
      const before = Date.now();
      await healthService.checkHealth();
      const after = Date.now();

      const health = await healthService.getLastHealth();
      expect(health?.timestamp).toBeDefined();

      const timestamp = new Date(health!.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing checkers gracefully', async () => {
      const health = await healthService.checkHealth();
      expect(health.components).toBeDefined();
      expect(Object.keys(health.components).length).toBeGreaterThanOrEqual(0);
    });

    it('should continue checking other components if one fails', async () => {
      healthService.registerChecker({
        name: 'failing',
        async check() {
          throw new Error('Check failed');
        },
      });

      healthService.registerChecker({
        name: 'working',
        async check() {
          return { status: 'healthy', message: 'OK' };
        },
      });

      const health = await healthService.checkHealth();
      expect(health.components['failing'].status).toBe('unhealthy');
      expect(health.components['working'].status).toBe('healthy');
    });
  });
});
