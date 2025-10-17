import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  AlertingService,
  createAlertingService,
  EmailAlertHandler,
  SlackAlertHandler,
  WebhookAlertHandler,
} from '../AlertingService';
import { InMemorySLAStorage } from '../storage/InMemorySLAStorage';
import {
  MetricType,
  SLASeverity,
  AlertChannel,
  type SLAViolation,
  type AlertConfig,
} from '../types';

describe('AlertingService', () => {
  let storage: InMemorySLAStorage;
  let service: AlertingService;

  const createTestViolation = (overrides?: Partial<SLAViolation>): SLAViolation => ({
    id: 'vio_test_123',
    threshold_id: 'threshold_123',
    metric: MetricType.RESPONSE_TIME,
    current_value: 1500,
    target_value: 200,
    threshold_value: 1000,
    severity: SLASeverity.CRITICAL,
    detected_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    storage = new InMemorySLAStorage();
    service = createAlertingService({
      storage,
      defaultEmail: 'test@example.com',
    });
  });

  describe('Alert Configuration', () => {
    it('should create alert configuration', async () => {
      const config = await service.createAlert({
        name: 'Test Alert',
        description: 'Test alert description',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['ops@example.com'] },
        },
        enabled: true,
      });

      expect(config.id).toBeDefined();
      expect(config.name).toBe('Test Alert');
      expect(config.enabled).toBe(true);
    });

    it('should retrieve alert configurations', async () => {
      await service.createAlert({
        name: 'Alert 1',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        enabled: true,
      });

      await service.createAlert({
        name: 'Alert 2',
        metric: MetricType.ERROR_RATE,
        severities: [SLASeverity.WARNING],
        channels: [AlertChannel.SLACK],
        enabled: true,
      });

      const alerts = await service.getAlerts();
      expect(alerts.length).toBe(2);
    });

    it('should update alert configuration', async () => {
      const config = await service.createAlert({
        name: 'Original Name',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        enabled: true,
      });

      await service.updateAlert(config.id!, {
        name: 'Updated Name',
        enabled: false,
      });

      const alerts = await service.getAlerts();
      const updated = alerts.find(a => a.id === config.id);

      expect(updated!.name).toBe('Updated Name');
      expect(updated!.enabled).toBe(false);
    });

    it('should delete alert configuration', async () => {
      const config = await service.createAlert({
        name: 'To Delete',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        enabled: true,
      });

      await service.deleteAlert(config.id!);

      const alerts = await service.getAlerts();
      expect(alerts.find(a => a.id === config.id)).toBeUndefined();
    });
  });

  describe('Alert Matching', () => {
    beforeEach(async () => {
      await service.createAlert({
        name: 'Critical Response Time',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['critical@example.com'] },
        },
        enabled: true,
      });

      await service.createAlert({
        name: 'Warning Response Time',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.WARNING],
        channels: [AlertChannel.SLACK],
        channel_config: {
          slack: { webhook_url: 'https://hooks.slack.com/test' },
        },
        enabled: true,
      });
    });

    it('should send alert for matching configuration', async () => {
      const violation = createTestViolation({
        severity: SLASeverity.CRITICAL,
      });

      await service.sendAlert(violation);

      const notifications = await storage.getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0]!.severity).toBe(SLASeverity.CRITICAL);
    });

    it('should not send alert for non-matching metric', async () => {
      const violation = createTestViolation({
        metric: MetricType.ERROR_RATE, // No alerts configured for this
        severity: SLASeverity.CRITICAL,
      });

      await service.sendAlert(violation);

      const notifications = await storage.getNotifications();
      expect(notifications.length).toBe(0);
    });

    it('should not send alert for non-matching severity', async () => {
      const violation = createTestViolation({
        severity: SLASeverity.INFO, // No alerts configured for INFO
      });

      await service.sendAlert(violation);

      const notifications = await storage.getNotifications();
      expect(notifications.length).toBe(0);
    });

    it('should not send alert when disabled', async () => {
      const config = await service.createAlert({
        name: 'Disabled Alert',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['test@example.com'] },
        },
        enabled: false, // Disabled
      });

      const violation = createTestViolation();
      await service.sendAlert(violation);

      const notifications = await storage.getNotifications();
      const disabled = notifications.find(n => n.alert_id === config.id);
      expect(disabled).toBeUndefined();
    });
  });

  describe('Cooldown Period', () => {
    it('should respect cooldown period', async () => {
      const config = await service.createAlert({
        name: 'Cooldown Test',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['test@example.com'] },
        },
        enabled: true,
        cooldown_seconds: 60, // 1 minute
      });

      const violation = createTestViolation();

      // First alert should send
      await service.sendAlert(violation);

      const firstNotifications = await storage.getNotifications();
      expect(firstNotifications.length).toBe(1);

      // Second alert within cooldown should not send
      await service.sendAlert(violation);

      const secondNotifications = await storage.getNotifications();
      expect(secondNotifications.length).toBe(1); // Still just one
    });

    it('should send after cooldown expires', async () => {
      const config = await service.createAlert({
        name: 'Cooldown Test',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['test@example.com'] },
        },
        enabled: true,
        cooldown_seconds: 1, // 1 second
        last_sent_at: new Date(Date.now() - 2000), // 2 seconds ago
      });

      await storage.saveAlertConfig(config);

      const violation = createTestViolation();
      await service.sendAlert(violation);

      const notifications = await storage.getNotifications();
      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Channel Alerts', () => {
    it('should send to multiple channels', async () => {
      await service.createAlert({
        name: 'Multi-Channel Alert',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL, AlertChannel.SLACK, AlertChannel.LOG],
        channel_config: {
          email: { to: ['test@example.com'] },
          slack: { webhook_url: 'https://hooks.slack.com/test' },
        },
        enabled: true,
      });

      const violation = createTestViolation();
      await service.sendAlert(violation);

      const notifications = await storage.getNotifications();
      expect(notifications.length).toBe(3); // One per channel
      expect(notifications.map(n => n.channel).sort()).toEqual([
        AlertChannel.EMAIL,
        AlertChannel.LOG,
        AlertChannel.SLACK,
      ]);
    });
  });

  describe('Notification History', () => {
    beforeEach(async () => {
      await service.createAlert({
        name: 'Test Alert',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['test@example.com'] },
        },
        enabled: true,
      });
    });

    it('should record notification history', async () => {
      const violation = createTestViolation();
      await service.sendAlert(violation);

      const history = await service.getNotificationHistory();
      expect(history.length).toBe(1);
      expect(history[0]!.violation_id).toBe(violation.id);
    });

    it('should filter by time range', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);

      const violation = createTestViolation();
      await service.sendAlert(violation);

      const recent = await service.getNotificationHistory(hourAgo, now);
      expect(recent.length).toBe(1);

      const future = await service.getNotificationHistory(
        new Date(now.getTime() + 3600000),
        new Date(now.getTime() + 7200000)
      );
      expect(future.length).toBe(0);
    });

    it('should include notification status', async () => {
      const violation = createTestViolation();
      await service.sendAlert(violation);

      const history = await service.getNotificationHistory();
      expect(history[0]!.status).toBe('sent');
    });
  });

  describe('Organization-specific Alerts', () => {
    it('should create org-specific alerts', async () => {
      const config = await service.createAlert({
        name: 'Org Alert',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['org@example.com'] },
        },
        enabled: true,
        organization_id: 'org_123',
      });

      expect(config.organization_id).toBe('org_123');
    });

    it('should only trigger for matching organization', async () => {
      await service.createAlert({
        name: 'Org 123 Alert',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.CRITICAL],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['org123@example.com'] },
        },
        enabled: true,
        organization_id: 'org_123',
      });

      const violation = createTestViolation({
        organization_id: 'org_456', // Different org
      });

      await service.sendAlert(violation);

      const notifications = await storage.getNotifications();
      expect(notifications.length).toBe(0);
    });
  });

  describe('Test Alert', () => {
    it('should send test alert', async () => {
      const config = await service.createAlert({
        name: 'Test Alert',
        metric: MetricType.RESPONSE_TIME,
        severities: [SLASeverity.WARNING],
        channels: [AlertChannel.EMAIL],
        channel_config: {
          email: { to: ['test@example.com'] },
        },
        enabled: true,
      });

      await service.testAlert(config.id!);

      const notifications = await storage.getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0]!.alert_id).toBe(config.id);
    });

    it('should throw error for non-existent alert', async () => {
      await expect(service.testAlert('non_existent')).rejects.toThrow();
    });
  });

  describe('Alert Channel Handlers', () => {
    describe('EmailAlertHandler', () => {
      it('should format email alert', async () => {
        const handler = new EmailAlertHandler();
        const config: AlertConfig = {
          id: 'alert_1',
          name: 'Email Test',
          metric: MetricType.RESPONSE_TIME,
          severities: [SLASeverity.CRITICAL],
          channels: [AlertChannel.EMAIL],
          channel_config: {
            email: {
              to: ['test@example.com'],
              cc: ['cc@example.com'],
            },
          },
          enabled: true,
        };

        const violation = createTestViolation();

        // Should not throw
        await expect(handler.send(violation, config)).resolves.toBeUndefined();
      });

      it('should throw error if email config missing', async () => {
        const handler = new EmailAlertHandler();
        const config: AlertConfig = {
          id: 'alert_1',
          name: 'Email Test',
          metric: MetricType.RESPONSE_TIME,
          severities: [SLASeverity.CRITICAL],
          channels: [AlertChannel.EMAIL],
          enabled: true,
        };

        const violation = createTestViolation();

        await expect(handler.send(violation, config)).rejects.toThrow();
      });
    });

    describe('SlackAlertHandler', () => {
      it('should format Slack alert', async () => {
        const handler = new SlackAlertHandler();
        const config: AlertConfig = {
          id: 'alert_1',
          name: 'Slack Test',
          metric: MetricType.RESPONSE_TIME,
          severities: [SLASeverity.CRITICAL],
          channels: [AlertChannel.SLACK],
          channel_config: {
            slack: {
              webhook_url: 'https://hooks.slack.com/test',
              channel: '#alerts',
            },
          },
          enabled: true,
        };

        const violation = createTestViolation();

        await expect(handler.send(violation, config)).resolves.toBeUndefined();
      });
    });

    describe('WebhookAlertHandler', () => {
      it('should format webhook alert', async () => {
        const handler = new WebhookAlertHandler();
        const config: AlertConfig = {
          id: 'alert_1',
          name: 'Webhook Test',
          metric: MetricType.RESPONSE_TIME,
          severities: [SLASeverity.CRITICAL],
          channels: [AlertChannel.WEBHOOK],
          channel_config: {
            webhook: {
              url: 'https://api.example.com/alerts',
              method: 'POST',
            },
          },
          enabled: true,
        };

        const violation = createTestViolation();

        await expect(handler.send(violation, config)).resolves.toBeUndefined();
      });
    });
  });
});
