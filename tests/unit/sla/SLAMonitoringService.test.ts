/**
 * Unit Tests for SLA Monitoring Service
 * Phase 3A Part 4: SLA Monitoring and Alerting
 */

import {
  createSLAMonitoringService,
  InMemorySLAStorage,
  SLADefinition,
  SLAViolation,
  MetricType,
} from '../../../src/sla';

describe('SLAMonitoringService', () => {
  let storage: InMemorySLAStorage;
  let slaService: ReturnType<typeof createSLAMonitoringService>;
  let violations: SLAViolation[];

  beforeEach(() => {
    storage = new InMemorySLAStorage();
    violations = [];
    slaService = createSLAMonitoringService({
      storage,
      onViolation: async (violation: SLAViolation) => {
        violations.push(violation);
      },
    });
  });

  describe('SLA Definition Management', () => {
    it('should create an SLA definition', async () => {
      const sla: SLADefinition = {
        id: 'api-response-time',
        name: 'API Response Time',
        description: 'API should respond within 200ms for 99% of requests',
        metric: {
          type: MetricType.RESPONSE_TIME,
          target: 200,
          threshold: 99,
          unit: 'ms',
        },
        window: '5m',
        severity: 'high',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await slaService.createSLA(sla);
      const retrieved = await slaService.getSLA(sla.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(sla.name);
      expect(retrieved?.metric.target).toBe(200);
    });

    it('should list all SLA definitions', async () => {
      const sla1: SLADefinition = {
        id: 'sla-1',
        name: 'SLA 1',
        description: 'Test SLA 1',
        metric: {
          type: MetricType.RESPONSE_TIME,
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        severity: 'high',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sla2: SLADefinition = {
        id: 'sla-2',
        name: 'SLA 2',
        description: 'Test SLA 2',
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

      await slaService.createSLA(sla1);
      await slaService.createSLA(sla2);

      const all = await slaService.listSLAs();
      expect(all).toHaveLength(2);
      expect(all.map((s: SLADefinition) => s.id)).toContain('sla-1');
      expect(all.map((s: SLADefinition) => s.id)).toContain('sla-2');
    });

    it('should update an SLA definition', async () => {
      const sla: SLADefinition = {
        id: 'update-test',
        name: 'Original Name',
        description: 'Original description',
        metric: {
          type: MetricType.RESPONSE_TIME,
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        severity: 'medium',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await slaService.createSLA(sla);

      const updated = {
        ...sla,
        name: 'Updated Name',
        metric: {
          ...sla.metric,
          target: 150,
        },
      };

      await slaService.updateSLA(updated);
      const retrieved = await slaService.getSLA('update-test');

      expect(retrieved?.name).toBe('Updated Name');
      expect(retrieved?.metric.target).toBe(150);
    });

    it('should delete an SLA definition', async () => {
      const sla: SLADefinition = {
        id: 'delete-test',
        name: 'Delete Test',
        description: 'Will be deleted',
        metric: {
          type: MetricType.RESPONSE_TIME,
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        severity: 'low',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await slaService.createSLA(sla);
      await slaService.deleteSLA('delete-test');

      const retrieved = await slaService.getSLA('delete-test');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('SLA Violation Detection', () => {
    beforeEach(async () => {
      // Create a response time SLA
      const sla: SLADefinition = {
        id: 'response-time-sla',
        name: 'Response Time SLA',
        description: '95% of requests under 200ms',
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

      await slaService.createSLA(sla);
    });

    it('should detect SLA violation when metric exceeds target', async () => {
      // Record metrics that violate SLA (10 slow requests out of 100 = 90% compliance)
      for (let i = 0; i < 90; i++) {
        await slaService.recordMetric({
          slaId: 'response-time-sla',
          value: 150, // Within target
          timestamp: new Date(),
          metadata: { endpoint: '/api/test' },
        });
      }

      for (let i = 0; i < 10; i++) {
        await slaService.recordMetric({
          slaId: 'response-time-sla',
          value: 300, // Exceeds target
          timestamp: new Date(),
          metadata: { endpoint: '/api/test' },
        });
      }

      // Check for violations
      await slaService.checkViolations('response-time-sla');

      // Should have detected violation (90% < 95% threshold)
      expect(violations).toHaveLength(1);
      expect(violations[0].slaId).toBe('response-time-sla');
      expect(violations[0].severity).toBe('high');
    });

    it('should not detect violation when metric is within target', async () => {
      // Record metrics that comply with SLA (96 fast requests out of 100 = 96% compliance)
      for (let i = 0; i < 96; i++) {
        await slaService.recordMetric({
          slaId: 'response-time-sla',
          value: 150, // Within target
          timestamp: new Date(),
          metadata: { endpoint: '/api/test' },
        });
      }

      for (let i = 0; i < 4; i++) {
        await slaService.recordMetric({
          slaId: 'response-time-sla',
          value: 300, // Exceeds target
          timestamp: new Date(),
          metadata: { endpoint: '/api/test' },
        });
      }

      // Check for violations
      await slaService.checkViolations('response-time-sla');

      // Should NOT detect violation (96% >= 95% threshold)
      expect(violations).toHaveLength(0);
    });

    it('should track violation history', async () => {
      // Trigger a violation
      for (let i = 0; i < 100; i++) {
        await slaService.recordMetric({
          slaId: 'response-time-sla',
          value: 300, // All requests slow
          timestamp: new Date(),
          metadata: { endpoint: '/api/test' },
        });
      }

      await slaService.checkViolations('response-time-sla');

      // Get violation history
      const history = await slaService.getViolationHistory('response-time-sla');

      expect(history).toHaveLength(1);
      expect(history[0].slaId).toBe('response-time-sla');
      expect(history[0].actualValue).toBeLessThan(95); // 0% compliance
    });
  });

  describe('SLA Compliance Reporting', () => {
    beforeEach(async () => {
      const sla: SLADefinition = {
        id: 'error-rate-sla',
        name: 'Error Rate SLA',
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

      await slaService.createSLA(sla);
    });

    it('should calculate compliance percentage', async () => {
      // Record 990 successful requests and 10 errors
      for (let i = 0; i < 990; i++) {
        await slaService.recordMetric({
          slaId: 'error-rate-sla',
          value: 0, // Success
          timestamp: new Date(),
          metadata: { endpoint: '/api/test' },
        });
      }

      for (let i = 0; i < 10; i++) {
        await slaService.recordMetric({
          slaId: 'error-rate-sla',
          value: 1, // Error
          timestamp: new Date(),
          metadata: { endpoint: '/api/test' },
        });
      }

      const compliance = await slaService.getCompliance('error-rate-sla');

      // Error rate = 10/1000 = 1%, which meets the <= 1% target
      expect(compliance.compliant).toBe(true);
      expect(compliance.percentage).toBeGreaterThanOrEqual(99);
    });

    it('should generate SLA report', async () => {
      const report = await slaService.generateReport({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        endDate: new Date(),
      });

      expect(report).toBeDefined();
      expect(report.slas).toBeDefined();
      expect(Array.isArray(report.slas)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing SLA gracefully', async () => {
      const result = await slaService.getSLA('non-existent');
      expect(result).toBeUndefined();
    });

    it('should handle invalid metric values', async () => {
      const sla: SLADefinition = {
        id: 'test-sla',
        name: 'Test SLA',
        description: 'Test',
        metric: {
          type: MetricType.RESPONSE_TIME,
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        severity: 'medium',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await slaService.createSLA(sla);

      // Try to record negative value
      await expect(
        slaService.recordMetric({
          slaId: 'test-sla',
          value: -100,
          timestamp: new Date(),
          metadata: {},
        })
      ).rejects.toThrow();
    });
  });
});
