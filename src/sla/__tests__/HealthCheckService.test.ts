import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  HealthCheckService,
  createHealthCheckService,
  DatabaseHealthChecker,
  RedisHealthChecker,
  StorageHealthChecker,
  type ComponentHealthChecker,
} from '../HealthCheckService';
import { createSLAMonitoringService } from '../SLAMonitoringService';
import { InMemorySLAStorage } from '../storage/InMemorySLAStorage';
import { MetricType, SLASeverity } from '../types';

describe('HealthCheckService', () => {
  let storage: InMemorySLAStorage;
  let slaService: ReturnType<typeof createSLAMonitoringService>;
  let healthService: HealthCheckService;

  beforeEach(async () => {
    storage = new InMemorySLAStorage();
    slaService = createSLAMonitoringService({ storage });
    await slaService.initializeDefaultThresholds();
    healthService = createHealthCheckService({ slaService });
  });

  afterEach(async () => {
    await slaService.shutdown();
  });

  describe('Basic Health Checks', () => {
    it('should return healthy status with no violations', async () => {
      // Wait a tick for uptime to be > 0
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = await healthService.check();

      expect(status.status).toBe('healthy');
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(status.active_violations).toBe(0);
      expect(status.uptime_seconds).toBeGreaterThanOrEqual(0);
    });

    it('should include version information', async () => {
      const status = await healthService.check();

      expect(status.version).toBeDefined();
    });

    it('should cache health status', async () => {
      await healthService.check();
      const cached = healthService.getCachedStatus();

      expect(cached).toBeDefined();
      expect(cached!.status).toBe('healthy');
    });
  });

  describe('Component Health Checks', () => {
    it('should check database health', async () => {
      const mockQuery = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const checker = new DatabaseHealthChecker(mockQuery);

      healthService.registerChecker(checker);
      const status = await healthService.check();

      expect(status.components.database).toBeDefined();
      expect(status.components.database!.status).toBe('healthy');
      expect(status.components.database!.response_time_ms).toBeGreaterThan(0);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should detect unhealthy database', async () => {
      const mockQuery = jest.fn<() => Promise<void>>().mockRejectedValue(
        new Error('Connection failed')
      );
      const checker = new DatabaseHealthChecker(mockQuery);

      healthService.registerChecker(checker);
      const status = await healthService.check();

      expect(status.components.database!.status).toBe('unhealthy');
      expect(status.components.database!.error).toContain('Connection failed');
      expect(status.status).toBe('unhealthy');
    });

    it('should check Redis health', async () => {
      const mockPing = jest.fn<() => Promise<string>>().mockResolvedValue('PONG');
      const checker = new RedisHealthChecker(mockPing);

      healthService.registerChecker(checker);
      const status = await healthService.check();

      expect(status.components.redis).toBeDefined();
      expect(status.components.redis!.status).toBe('healthy');
      expect(mockPing).toHaveBeenCalled();
    });

    it('should detect unhealthy Redis', async () => {
      const mockPing = jest.fn<() => Promise<string>>().mockResolvedValue('WRONG');
      const checker = new RedisHealthChecker(mockPing);

      healthService.registerChecker(checker);
      const status = await healthService.check();

      expect(status.components.redis!.status).toBe('unhealthy');
      expect(status.status).toBe('unhealthy');
    });

    it('should check storage health', async () => {
      const mockCheck = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
      const checker = new StorageHealthChecker(mockCheck);

      healthService.registerChecker(checker);
      const status = await healthService.check();

      expect(status.components.storage).toBeDefined();
      expect(status.components.storage!.status).toBe('healthy');
      expect(mockCheck).toHaveBeenCalled();
    });

    it('should detect unhealthy storage', async () => {
      const mockCheck = jest.fn<() => Promise<boolean>>().mockResolvedValue(false);
      const checker = new StorageHealthChecker(mockCheck);

      healthService.registerChecker(checker);
      const status = await healthService.check();

      expect(status.components.storage!.status).toBe('unhealthy');
      expect(status.status).toBe('unhealthy');
    });
  });

  describe('Custom Component Checkers', () => {
    it('should register custom health checker', async () => {
      const customChecker: ComponentHealthChecker = {
        name: 'custom_service',
        async check() {
          return {
            status: 'healthy',
            response_time_ms: 10,
            last_check: new Date(),
            details: { custom_field: 'value' },
          };
        },
      };

      healthService.registerChecker(customChecker);
      const status = await healthService.check();

      expect(status.components).toHaveProperty('custom_service');
      expect((status.components as any).custom_service.status).toBe('healthy');
    });

    it('should unregister health checker', async () => {
      const customChecker: ComponentHealthChecker = {
        name: 'custom_service',
        async check() {
          return { status: 'healthy', last_check: new Date() };
        },
      };

      healthService.registerChecker(customChecker);
      healthService.unregisterChecker('custom_service');
      const status = await healthService.check();

      expect(status.components).not.toHaveProperty('custom_service');
    });
  });

  describe('SLA Integration', () => {
    beforeEach(async () => {
      await slaService.initializeDefaultThresholds();
    });

    it('should include SLA status in health check', async () => {
      const status = await healthService.check();

      expect(status.sla_status).toBeDefined();
      expect(status.sla_status).toBe('ok');
    });

    it('should return degraded status with SLA violations', async () => {
      // Create SLA violation
      await slaService.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 1500, // Exceeds critical threshold
        timestamp: new Date(),
      });

      await slaService.flush();

      const status = await healthService.check();

      expect(status.sla_status).toBe('violated');
      expect(status.status).toBe('degraded'); // SLA violation makes it degraded, not unhealthy
      expect(status.active_violations).toBeGreaterThan(0);
    });
  });

  describe('Overall Status Determination', () => {
    it('should return unhealthy with any unhealthy component', async () => {
      const healthyChecker: ComponentHealthChecker = {
        name: 'healthy_service',
        async check() {
          return { status: 'healthy', last_check: new Date() };
        },
      };

      const unhealthyChecker: ComponentHealthChecker = {
        name: 'unhealthy_service',
        async check() {
          return { status: 'unhealthy', error: 'Failed', last_check: new Date() };
        },
      };

      healthService.registerChecker(healthyChecker);
      healthService.registerChecker(unhealthyChecker);

      const status = await healthService.check();

      expect(status.status).toBe('unhealthy');
    });

    it('should return degraded with degraded component', async () => {
      const degradedChecker: ComponentHealthChecker = {
        name: 'degraded_service',
        async check() {
          return { status: 'degraded', last_check: new Date() };
        },
      };

      healthService.registerChecker(degradedChecker);

      const status = await healthService.check();

      expect(status.status).toBe('degraded');
    });
  });

  describe('Health Check Timeout', () => {
    it('should handle slow health checks with timeout', async () => {
      const slowChecker: ComponentHealthChecker = {
        name: 'slow_service',
        async check() {
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
          return { status: 'healthy', last_check: new Date() };
        },
      };

      const fastService = createHealthCheckService({
        slaService,
        checkTimeout: 100, // 100ms timeout
      });

      fastService.registerChecker(slowChecker);

      const status = await fastService.check();

      expect((status.components as any).slow_service).toBeDefined();
      expect((status.components as any).slow_service.status).toBe('unhealthy');
      expect((status.components as any).slow_service.error).toContain('timeout');
    });
  });

  describe('Express Endpoints', () => {
    describe('Health Endpoint', () => {
      it('should create health endpoint handler', async () => {
        const handler = healthService.createHealthEndpoint();

        const req = { query: {} } as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
        const response = res.json.mock.calls[0]![0];
        expect(response.status).toBe('healthy');
      });

      it('should return 503 for unhealthy status', async () => {
        const unhealthyChecker: ComponentHealthChecker = {
          name: 'unhealthy_service',
          async check() {
            return { status: 'unhealthy', error: 'Failed', last_check: new Date() };
          },
        };

        healthService.registerChecker(unhealthyChecker);

        const handler = healthService.createHealthEndpoint();
        const req = { query: {} } as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
      });

      it('should support details query parameter', async () => {
        const handler = healthService.createHealthEndpoint();

        const req = { query: { details: 'false' } } as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        await handler(req, res);

        const response = res.json.mock.calls[0]![0];
        expect(Object.keys(response.components).length).toBe(0);
      });
    });

    describe('Readiness Endpoint', () => {
      it('should create readiness endpoint handler', async () => {
        const handler = healthService.createReadinessEndpoint();

        const req = {} as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
        const response = res.json.mock.calls[0]![0];
        expect(response.ready).toBe(true);
      });

      it('should return not ready for degraded status', async () => {
        const degradedChecker: ComponentHealthChecker = {
          name: 'degraded_service',
          async check() {
            return { status: 'degraded', last_check: new Date() };
          },
        };

        healthService.registerChecker(degradedChecker);

        const handler = healthService.createReadinessEndpoint();
        const req = {} as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        const response = res.json.mock.calls[0]![0];
        expect(response.ready).toBe(false);
      });
    });

    describe('Liveness Endpoint', () => {
      it('should create liveness endpoint handler', () => {
        const handler = healthService.createLivenessEndpoint();

        const req = {} as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
        const response = res.json.mock.calls[0]![0];
        expect(response.alive).toBe(true);
      });

      it('should always return alive', () => {
        const unhealthyChecker: ComponentHealthChecker = {
          name: 'unhealthy_service',
          async check() {
            return { status: 'unhealthy', error: 'Failed', last_check: new Date() };
          },
        };

        healthService.registerChecker(unhealthyChecker);

        const handler = healthService.createLivenessEndpoint();
        const req = {} as any;
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });
  });

  describe('Component-Specific Checks', () => {
    it('should check specific component by name', async () => {
      const checker: ComponentHealthChecker = {
        name: 'specific_service',
        async check() {
          return { status: 'healthy', last_check: new Date() };
        },
      };

      healthService.registerChecker(checker);

      const health = await healthService.checkComponent('specific_service');

      expect(health.status).toBe('healthy');
    });

    it('should return unhealthy for unknown component', async () => {
      const health = await healthService.checkComponent('unknown_service');

      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('not found');
    });
  });
});
