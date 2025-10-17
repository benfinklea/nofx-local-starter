/**
 * Integration Tests for Complete SLA System
 * Phase 3A Part 4: SLA Monitoring and Alerting
 *
 * Tests the complete SLA workflow:
 * 1. Metric collection
 * 2. SLA violation detection
 * 3. Alert generation and sending
 * 4. Health monitoring
 */

import {
  createSLAMonitoringService,
  createAlertingService,
  createMetricsCollector,
  createHealthCheckService,
  InMemorySLAStorage,
  SLADefinition,
  SLAViolation,
  MetricType,
  AlertChannel,
} from '../../src/sla';

describe('SLA System Integration', () => {
  let storage: InMemorySLAStorage;
  let slaService: ReturnType<typeof createSLAMonitoringService>;
  let alertService: ReturnType<typeof createAlertingService>;
  let metricsCollector: ReturnType<typeof createMetricsCollector>;
  let healthService: ReturnType<typeof createHealthCheckService>;
  let sentAlerts: SLAViolation[];

  beforeEach(async () => {
    storage = new InMemorySLAStorage();
    sentAlerts = [];

    // Create SLA monitoring service
    slaService = createSLAMonitoringService({
      storage,
      onViolation: async (violation: SLAViolation) => {
        await alertService.sendAlert(violation);
      },
    });

    // Create alerting service
    alertService = createAlertingService({
      storage,
      defaultEmail: 'ops@test.com',
      handlers: {
        email: {
          name: 'email',
          async send(violation: SLAViolation) {
            sentAlerts.push(violation);
            return { success: true };
          },
        },
      },
    });

    // Create metrics collector
    metricsCollector = createMetricsCollector({
      slaService,
      collectSystemMetrics: false, // Disable for tests
    });

    // Create health check service
    healthService = createHealthCheckService({
      slaService,
    });

    // Configure email alerts
    await alertService.configureChannel('email', {
      enabled: true,
      recipients: ['ops@test.com'],
    });
  });

  describe('End-to-End SLA Workflow', () => {
    it('should detect violation and send alert', async () => {
      // 1. Create SLA definition
      const sla: SLADefinition = {
        id: 'api-response-time',
        name: 'API Response Time',
        description: 'API should respond within 200ms for 95% of requests',
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

      // 2. Collect metrics that violate SLA
      // Record 80 fast requests (within target)
      for (let i = 0; i < 80; i++) {
        await metricsCollector.recordResponseTime('api-response-time', 150);
      }

      // Record 20 slow requests (exceeds target)
      for (let i = 0; i < 20; i++) {
        await metricsCollector.recordResponseTime('api-response-time', 300);
      }

      // 3. Check for violations
      await slaService.checkViolations('api-response-time');

      // 4. Verify alert was sent
      expect(sentAlerts).toHaveLength(1);
      expect(sentAlerts[0].slaId).toBe('api-response-time');
      expect(sentAlerts[0].severity).toBe('high');
      expect(sentAlerts[0].actualValue).toBeLessThan(95); // 80% < 95%

      // 5. Check health status
      const health = await healthService.checkHealth();
      expect(health.sla.violations).toBeGreaterThan(0);
    });

    it('should handle multiple SLA violations', async () => {
      // Create multiple SLAs
      const responseTimeSLA: SLADefinition = {
        id: 'response-time',
        name: 'Response Time',
        description: 'Response time under 200ms',
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
        id: 'error-rate',
        name: 'Error Rate',
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

      // Violate both SLAs
      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordResponseTime('response-time', 300);
        await metricsCollector.recordError('error-rate');
      }

      // Check all violations
      await slaService.checkViolations('response-time');
      await slaService.checkViolations('error-rate');

      // Should have sent 2 alerts
      expect(sentAlerts.length).toBeGreaterThanOrEqual(2);
    });

    it('should not send duplicate alerts for same violation', async () => {
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
        severity: 'high',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await slaService.createSLA(sla);

      // Configure rate limiting
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@test.com'],
        rateLimitMinutes: 5,
      });

      // Record violating metrics
      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordResponseTime('test-sla', 200);
      }

      // Check violations twice
      await slaService.checkViolations('test-sla');
      await slaService.checkViolations('test-sla');

      // Should only send one alert due to rate limiting
      expect(sentAlerts).toHaveLength(1);
    });
  });

  describe('Real-time Monitoring', () => {
    it('should continuously monitor and alert', async () => {
      const sla: SLADefinition = {
        id: 'continuous-monitor',
        name: 'Continuous Monitor',
        description: 'Continuously monitored SLA',
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

      // Start monitoring
      const monitorInterval = setInterval(async () => {
        await slaService.checkViolations('continuous-monitor');
      }, 100);

      // Record metrics over time
      for (let i = 0; i < 50; i++) {
        await metricsCollector.recordResponseTime('continuous-monitor', 50);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Record violations
      for (let i = 0; i < 50; i++) {
        await metricsCollector.recordResponseTime('continuous-monitor', 200);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for monitoring to detect
      await new Promise(resolve => setTimeout(resolve, 300));

      // Stop monitoring
      clearInterval(monitorInterval);

      // Should have detected violation
      expect(sentAlerts.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout for this test

    it('should auto-recover when metrics improve', async () => {
      const sla: SLADefinition = {
        id: 'recovery-test',
        name: 'Recovery Test',
        description: 'Test auto-recovery',
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

      await slaService.createSLA(sla);

      // Record violations
      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordResponseTime('recovery-test', 200);
      }

      await slaService.checkViolations('recovery-test');
      expect(sentAlerts).toHaveLength(1);

      // Clear violations
      sentAlerts = [];

      // Record good metrics
      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordResponseTime('recovery-test', 50);
      }

      await slaService.checkViolations('recovery-test');

      // Should not send new alerts
      expect(sentAlerts).toHaveLength(0);

      // Check compliance
      const compliance = await slaService.getCompliance('recovery-test');
      expect(compliance.compliant).toBe(true);
    });
  });

  describe('Multi-channel Alerting', () => {
    it('should send alerts through multiple channels', async () => {
      const slackAlerts: SLAViolation[] = [];

      // Add Slack channel
      alertService = createAlertingService({
        storage,
        handlers: {
          email: {
            name: 'email',
            async send(violation) {
              sentAlerts.push(violation);
              return { success: true };
            },
          },
          slack: {
            name: 'slack',
            async send(violation) {
              slackAlerts.push(violation);
              return { success: true };
            },
          },
        },
      });

      slaService = createSLAMonitoringService({
        storage,
        onViolation: async (violation: SLAViolation) => {
          await alertService.sendAlert(violation);
        },
      });

      metricsCollector = createMetricsCollector({ slaService });

      // Configure both channels
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@test.com'],
      });

      await alertService.configureChannel('slack', {
        enabled: true,
        webhookUrl: 'https://hooks.slack.com/test',
      });

      // Create and violate SLA
      const sla: SLADefinition = {
        id: 'multi-channel-test',
        name: 'Multi-channel Test',
        description: 'Test multiple channels',
        metric: {
          type: MetricType.RESPONSE_TIME,
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        severity: 'critical',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await slaService.createSLA(sla);

      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordResponseTime('multi-channel-test', 200);
      }

      await slaService.checkViolations('multi-channel-test');

      // Should send through both channels
      expect(sentAlerts.length).toBeGreaterThan(0);
      expect(slackAlerts.length).toBeGreaterThan(0);
    });

    it('should route alerts by severity', async () => {
      const criticalAlerts: SLAViolation[] = [];
      const normalAlerts: SLAViolation[] = [];

      alertService = createAlertingService({
        storage,
        handlers: {
          'pager-duty': {
            name: 'pager-duty',
            async send(violation) {
              if (violation.severity === 'critical') {
                criticalAlerts.push(violation);
              }
              return { success: true };
            },
          },
          email: {
            name: 'email',
            async send(violation) {
              normalAlerts.push(violation);
              return { success: true };
            },
          },
        },
      });

      slaService = createSLAMonitoringService({
        storage,
        onViolation: async (violation: SLAViolation) => {
          await alertService.sendAlert(violation);
        },
      });

      metricsCollector = createMetricsCollector({ slaService });

      // Configure channels with severity filters
      await alertService.configureChannel('pager-duty', {
        enabled: true,
        minSeverity: 'critical',
      });

      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@test.com'],
      });

      // Create critical SLA
      const criticalSLA: SLADefinition = {
        id: 'critical-sla',
        name: 'Critical SLA',
        description: 'Critical severity',
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

      await slaService.createSLA(criticalSLA);

      // Violate critical SLA
      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordError('critical-sla');
      }

      await slaService.checkViolations('critical-sla');

      // Critical alerts should go to PagerDuty
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should reflect SLA violations in health checks', async () => {
      const sla: SLADefinition = {
        id: 'health-test',
        name: 'Health Test',
        description: 'Test health integration',
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

      await slaService.createSLA(sla);

      // Initial health should be good
      let health = await healthService.checkHealth();
      expect(health.overall).toBe('healthy');

      // Violate SLA
      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordResponseTime('health-test', 200);
      }

      await slaService.checkViolations('health-test');

      // Health should now be degraded
      health = await healthService.checkHealth();
      expect(health.sla.violations).toBeGreaterThan(0);
      expect(health.overall).not.toBe('healthy');
    });

    it('should provide detailed component health', async () => {
      // Register component health checkers
      healthService.registerChecker({
        name: 'database',
        async check() {
          return {
            status: 'healthy',
            message: 'Database OK',
            details: { connections: 5, maxConnections: 10 },
          };
        },
      });

      healthService.registerChecker({
        name: 'cache',
        async check() {
          return {
            status: 'healthy',
            message: 'Cache OK',
            details: { hitRate: 0.95 },
          };
        },
      });

      const health = await healthService.checkHealth();

      expect(health.components['database']).toBeDefined();
      expect(health.components['cache']).toBeDefined();
      expect(health.components['database'].status).toBe('healthy');
      expect(health.components['cache'].status).toBe('healthy');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high metric volume', async () => {
      const sla: SLADefinition = {
        id: 'high-volume-test',
        name: 'High Volume Test',
        description: 'Test high volume',
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

      const start = Date.now();

      // Record 1000 metrics
      for (let i = 0; i < 1000; i++) {
        await metricsCollector.recordResponseTime(
          'high-volume-test',
          Math.random() * 200
        );
      }

      const duration = Date.now() - start;

      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Check violation detection still works
      await slaService.checkViolations('high-volume-test');
    }, 10000);

    it('should handle many concurrent SLA checks', async () => {
      // Create multiple SLAs
      const slaCount = 10;
      const slas = Array.from({ length: slaCount }, (_, i) => ({
        id: `sla-${i}`,
        name: `SLA ${i}`,
        description: `Test SLA ${i}`,
        metric: {
          type: MetricType.RESPONSE_TIME,
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        severity: 'medium' as const,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      for (const sla of slas) {
        await slaService.createSLA(sla);
      }

      // Record metrics for all SLAs
      for (const sla of slas) {
        for (let i = 0; i < 100; i++) {
          await metricsCollector.recordResponseTime(sla.id, Math.random() * 200);
        }
      }

      // Check all violations concurrently
      const start = Date.now();
      await Promise.all(
        slas.map(sla => slaService.checkViolations(sla.id))
      );
      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(3000);
    }, 10000);
  });
});
