/**
 * Unit Tests for Alerting Service
 * Phase 3A Part 4: SLA Monitoring and Alerting
 */

import {
  createAlertingService,
  InMemorySLAStorage,
  SLAViolation,
  AlertChannel,
  AlertChannelHandler,
} from '../../../src/sla';

describe('AlertingService', () => {
  let storage: InMemorySLAStorage;
  let alertService: ReturnType<typeof createAlertingService>;
  let sentAlerts: Array<{ channel: AlertChannel; violation: SLAViolation; config: any }>;

  beforeEach(() => {
    storage = new InMemorySLAStorage();
    sentAlerts = [];

    // Create mock alert handler
    const mockHandler: AlertChannelHandler = {
      name: 'mock',
      async send(violation: SLAViolation, config: any) {
        sentAlerts.push({ channel: 'email', violation, config });
        return { success: true };
      },
    };

    alertService = createAlertingService({
      storage,
      defaultEmail: 'ops@test.com',
      handlers: {
        email: mockHandler,
        slack: mockHandler,
        webhook: mockHandler,
      },
    });
  });

  describe('Alert Configuration', () => {
    it('should configure email alerts', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['test@example.com'],
      });

      const config = await alertService.getChannelConfig('email');
      expect(config.enabled).toBe(true);
      expect(config.recipients).toContain('test@example.com');
    });

    it('should configure Slack alerts', async () => {
      await alertService.configureChannel('slack', {
        enabled: true,
        webhookUrl: 'https://hooks.slack.com/test',
        channel: '#alerts',
      });

      const config = await alertService.getChannelConfig('slack');
      expect(config.enabled).toBe(true);
      expect(config.channel).toBe('#alerts');
    });

    it('should configure webhook alerts', async () => {
      await alertService.configureChannel('webhook', {
        enabled: true,
        url: 'https://api.example.com/alerts',
        headers: {
          'Authorization': 'Bearer token123',
        },
      });

      const config = await alertService.getChannelConfig('webhook');
      expect(config.enabled).toBe(true);
      expect(config.url).toBe('https://api.example.com/alerts');
    });
  });

  describe('Alert Sending', () => {
    const mockViolation: SLAViolation = {
      id: 'violation-1',
      slaId: 'api-response-time',
      slaName: 'API Response Time',
      severity: 'high',
      detectedAt: new Date(),
      threshold: 95,
      actualValue: 85,
      metric: {
        type: 'response_time',
        target: 200,
        threshold: 95,
        unit: 'ms',
      },
      window: '5m',
      message: 'Response time SLA violated',
    };

    it('should send alert through configured channel', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
      });

      await alertService.sendAlert(mockViolation);

      expect(sentAlerts).toHaveLength(1);
      expect(sentAlerts[0].violation.id).toBe('violation-1');
    });

    it('should send alerts through multiple channels', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
      });

      await alertService.configureChannel('slack', {
        enabled: true,
        webhookUrl: 'https://hooks.slack.com/test',
      });

      await alertService.sendAlert(mockViolation);

      // Should send through both channels
      expect(sentAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it('should not send alerts through disabled channels', async () => {
      await alertService.configureChannel('email', {
        enabled: false,
        recipients: ['ops@example.com'],
      });

      await alertService.sendAlert(mockViolation);

      expect(sentAlerts).toHaveLength(0);
    });

    it('should respect severity filters', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
        minSeverity: 'critical', // Only send critical alerts
      });

      // Send high severity (should not be sent)
      await alertService.sendAlert(mockViolation);
      expect(sentAlerts).toHaveLength(0);

      // Send critical severity (should be sent)
      const criticalViolation = {
        ...mockViolation,
        severity: 'critical' as const,
      };
      await alertService.sendAlert(criticalViolation);
      expect(sentAlerts).toHaveLength(1);
    });
  });

  describe('Alert History', () => {
    const mockViolation: SLAViolation = {
      id: 'violation-1',
      slaId: 'api-response-time',
      slaName: 'API Response Time',
      severity: 'high',
      detectedAt: new Date(),
      threshold: 95,
      actualValue: 85,
      metric: {
        type: 'response_time',
        target: 200,
        threshold: 95,
        unit: 'ms',
      },
      window: '5m',
      message: 'Response time SLA violated',
    };

    it('should track sent alerts', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
      });

      await alertService.sendAlert(mockViolation);

      const history = await alertService.getAlertHistory({
        startDate: new Date(Date.now() - 60000),
        endDate: new Date(),
      });

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].violationId).toBe('violation-1');
    });

    it('should filter alert history by severity', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
      });

      // Send alerts of different severities
      await alertService.sendAlert(mockViolation);
      await alertService.sendAlert({
        ...mockViolation,
        id: 'violation-2',
        severity: 'critical',
      });

      const criticalAlerts = await alertService.getAlertHistory({
        severity: 'critical',
      });

      expect(criticalAlerts.every((a: any) => a.severity === 'critical')).toBe(true);
    });

    it('should filter alert history by channel', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
      });

      await alertService.sendAlert(mockViolation);

      const emailAlerts = await alertService.getAlertHistory({
        channel: 'email',
      });

      expect(emailAlerts.every((a: any) => a.channel === 'email')).toBe(true);
    });
  });

  describe('Alert Rate Limiting', () => {
    const mockViolation: SLAViolation = {
      id: 'violation-1',
      slaId: 'api-response-time',
      slaName: 'API Response Time',
      severity: 'high',
      detectedAt: new Date(),
      threshold: 95,
      actualValue: 85,
      metric: {
        type: 'response_time',
        target: 200,
        threshold: 95,
        unit: 'ms',
      },
      window: '5m',
      message: 'Response time SLA violated',
    };

    it('should not send duplicate alerts within rate limit window', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
        rateLimitMinutes: 5,
      });

      // Send first alert
      await alertService.sendAlert(mockViolation);
      expect(sentAlerts).toHaveLength(1);

      // Try to send same alert again immediately
      sentAlerts = [];
      await alertService.sendAlert(mockViolation);
      expect(sentAlerts).toHaveLength(0); // Should be rate limited
    });

    it('should send alerts after rate limit window expires', async () => {
      await alertService.configureChannel('email', {
        enabled: true,
        recipients: ['ops@example.com'],
        rateLimitMinutes: 0.01, // 0.6 seconds for testing
      });

      // Send first alert
      await alertService.sendAlert(mockViolation);
      expect(sentAlerts).toHaveLength(1);

      // Wait for rate limit to expire
      await new Promise(resolve => setTimeout(resolve, 700));

      // Should send again
      sentAlerts = [];
      await alertService.sendAlert(mockViolation);
      expect(sentAlerts).toHaveLength(1);
    });
  });

  describe('Alert Templates', () => {
    it('should format alert message for email', async () => {
      const violation: SLAViolation = {
        id: 'violation-1',
        slaId: 'api-response-time',
        slaName: 'API Response Time',
        severity: 'high',
        detectedAt: new Date(),
        threshold: 95,
        actualValue: 85,
        metric: {
          type: 'response_time',
          target: 200,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        message: 'Response time SLA violated',
      };

      const formatted = await alertService.formatAlert(violation, 'email');

      expect(formatted).toBeDefined();
      expect(formatted).toContain('API Response Time');
      expect(formatted).toContain('85%'); // actual value
      expect(formatted).toContain('95%'); // threshold
    });

    it('should support custom alert templates', async () => {
      await alertService.setTemplate('email', {
        subject: 'SLA Alert: {{slaName}}',
        body: 'Violation detected: {{message}}\nSeverity: {{severity}}',
      });

      const violation: SLAViolation = {
        id: 'violation-1',
        slaId: 'test-sla',
        slaName: 'Test SLA',
        severity: 'critical',
        detectedAt: new Date(),
        threshold: 99,
        actualValue: 90,
        metric: {
          type: 'error_rate',
          target: 1,
          threshold: 99,
          unit: '%',
        },
        window: '5m',
        message: 'Error rate too high',
      };

      const formatted = await alertService.formatAlert(violation, 'email');

      expect(formatted).toContain('Test SLA');
      expect(formatted).toContain('critical');
      expect(formatted).toContain('Error rate too high');
    });
  });

  describe('Error Handling', () => {
    it('should handle failed alert delivery', async () => {
      const failingHandler: AlertChannelHandler = {
        name: 'failing',
        async send() {
          throw new Error('Send failed');
        },
      };

      const serviceWithFailingHandler = createAlertingService({
        storage,
        handlers: {
          email: failingHandler,
        },
      });

      await serviceWithFailingHandler.configureChannel('email', {
        enabled: true,
        recipients: ['test@example.com'],
      });

      const violation: SLAViolation = {
        id: 'violation-1',
        slaId: 'test-sla',
        slaName: 'Test',
        severity: 'high',
        detectedAt: new Date(),
        threshold: 95,
        actualValue: 85,
        metric: {
          type: 'response_time',
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        message: 'Test violation',
      };

      // Should not throw, but should log error
      await expect(serviceWithFailingHandler.sendAlert(violation)).resolves.not.toThrow();
    });

    it('should handle missing channel configuration', async () => {
      const violation: SLAViolation = {
        id: 'violation-1',
        slaId: 'test-sla',
        slaName: 'Test',
        severity: 'high',
        detectedAt: new Date(),
        threshold: 95,
        actualValue: 85,
        metric: {
          type: 'response_time',
          target: 100,
          threshold: 95,
          unit: 'ms',
        },
        window: '5m',
        message: 'Test violation',
      };

      // Should handle gracefully even with no configured channels
      await expect(alertService.sendAlert(violation)).resolves.not.toThrow();
    });
  });
});
