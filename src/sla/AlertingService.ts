/**
 * Alerting Service
 *
 * Manages alert configurations and sends notifications through various channels.
 *
 * @module sla/AlertingService
 */

import pino from 'pino';
import {
  AlertChannel,
  SLASeverity,
  type AlertConfig,
  type AlertNotification,
  type SLAViolation,
} from './types';

/**
 * Alert channel handler interface
 */
export interface AlertChannelHandler {
  /** Channel type */
  channel: AlertChannel;
  /** Send alert notification */
  send(violation: SLAViolation, config: AlertConfig): Promise<void>;
}

/**
 * Storage interface for alerts
 */
export interface AlertStorage {
  saveAlertConfig(config: AlertConfig): Promise<void>;
  getAlertConfigs(organizationId?: string): Promise<AlertConfig[]>;
  updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<void>;
  deleteAlertConfig(id: string): Promise<void>;
  saveNotification(notification: AlertNotification): Promise<void>;
  getNotifications(
    startTime?: Date,
    endTime?: Date,
    organizationId?: string
  ): Promise<AlertNotification[]>;
  updateLastSentTime(alertId: string, timestamp: Date): Promise<void>;
}

/**
 * Alerting Service Configuration
 */
export interface AlertingServiceConfig {
  /** Storage adapter */
  storage: AlertStorage;
  /** Logger instance */
  logger?: pino.Logger;
  /** Channel handlers */
  channels?: AlertChannelHandler[];
  /** Default notification email */
  defaultEmail?: string;
  /** Default Slack webhook URL */
  defaultSlackWebhook?: string;
}

/**
 * Email Alert Handler
 */
export class EmailAlertHandler implements AlertChannelHandler {
  channel = AlertChannel.EMAIL;

  async send(violation: SLAViolation, config: AlertConfig): Promise<void> {
    const emailConfig = config.channel_config?.email;
    if (!emailConfig || !emailConfig.to || emailConfig.to.length === 0) {
      throw new Error('Email configuration missing or invalid');
    }

    // In production, integrate with SendGrid, AWS SES, or similar
    // For now, log the email that would be sent
    console.log('SEND EMAIL:', {
      to: emailConfig.to,
      cc: emailConfig.cc,
      subject: `SLA ${violation.severity.toUpperCase()}: ${violation.metric} violation`,
      body: this.formatEmailBody(violation, config),
    });
  }

  private formatEmailBody(violation: SLAViolation, config: AlertConfig): string {
    return `
SLA Violation Detected

Alert: ${config.name}
Severity: ${violation.severity.toUpperCase()}
Metric: ${violation.metric}

Current Value: ${violation.current_value.toFixed(2)}
Target Value: ${violation.target_value.toFixed(2)}
Threshold: ${violation.threshold_value.toFixed(2)}

Detected At: ${violation.detected_at.toISOString()}
Organization: ${violation.organization_id || 'System-wide'}

${config.description || ''}

Please investigate and take appropriate action.
`.trim();
  }
}

/**
 * Slack Alert Handler
 */
export class SlackAlertHandler implements AlertChannelHandler {
  channel = AlertChannel.SLACK;

  async send(violation: SLAViolation, config: AlertConfig): Promise<void> {
    const slackConfig = config.channel_config?.slack;
    if (!slackConfig?.webhook_url) {
      throw new Error('Slack webhook URL not configured');
    }

    const payload = {
      text: `SLA ${violation.severity.toUpperCase()}: ${violation.metric} violation`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 SLA Violation: ${config.name}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${this.getSeverityEmoji(violation.severity)} ${violation.severity.toUpperCase()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Metric:*\n${violation.metric}`,
            },
            {
              type: 'mrkdwn',
              text: `*Current Value:*\n${violation.current_value.toFixed(2)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Target:*\n${violation.target_value.toFixed(2)}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Detected at ${violation.detected_at.toISOString()} | ${violation.organization_id || 'System-wide'}`,
            },
          ],
        },
      ],
    };

    // In production, make HTTP POST to webhook_url
    console.log('SEND SLACK:', {
      webhook: slackConfig.webhook_url,
      channel: slackConfig.channel,
      mentions: slackConfig.mentions,
      payload,
    });
  }

  private getSeverityEmoji(severity: SLASeverity): string {
    const emojiMap: Record<SLASeverity, string> = {
      [SLASeverity.INFO]: 'ℹ️',
      [SLASeverity.WARNING]: '⚠️',
      [SLASeverity.CRITICAL]: '🔥',
      [SLASeverity.EMERGENCY]: '🚨',
    };
    return emojiMap[severity] || '⚠️';
  }
}

/**
 * Webhook Alert Handler
 */
export class WebhookAlertHandler implements AlertChannelHandler {
  channel = AlertChannel.WEBHOOK;

  async send(violation: SLAViolation, config: AlertConfig): Promise<void> {
    const webhookConfig = config.channel_config?.webhook;
    if (!webhookConfig?.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      event: 'sla.violation',
      alert: config.name,
      violation: {
        id: violation.id,
        metric: violation.metric,
        severity: violation.severity,
        current_value: violation.current_value,
        target_value: violation.target_value,
        threshold_value: violation.threshold_value,
        detected_at: violation.detected_at.toISOString(),
        organization_id: violation.organization_id,
        metadata: violation.metadata,
      },
    };

    // In production, make HTTP request to webhook URL
    console.log('SEND WEBHOOK:', {
      url: webhookConfig.url,
      method: webhookConfig.method || 'POST',
      headers: webhookConfig.headers,
      payload,
    });
  }
}

/**
 * Log Alert Handler (always available fallback)
 */
export class LogAlertHandler implements AlertChannelHandler {
  channel = AlertChannel.LOG;

  async send(violation: SLAViolation, config: AlertConfig): Promise<void> {
    console.log('SLA ALERT:', {
      alert: config.name,
      severity: violation.severity,
      metric: violation.metric,
      current: violation.current_value,
      target: violation.target_value,
      organization: violation.organization_id,
      detected_at: violation.detected_at.toISOString(),
    });
  }
}

/**
 * Alerting Service
 *
 * Manages alert configurations and sends notifications when SLA violations occur.
 *
 * @example
 * ```typescript
 * const alertService = new AlertingService({
 *   storage: alertStorage,
 *   defaultEmail: 'ops@company.com',
 *   defaultSlackWebhook: process.env.SLACK_WEBHOOK,
 * });
 *
 * // Create alert configuration
 * await alertService.createAlert({
 *   name: 'API Response Time Alert',
 *   metric: MetricType.RESPONSE_TIME,
 *   severities: [SLASeverity.CRITICAL],
 *   channels: [AlertChannel.EMAIL, AlertChannel.SLACK],
 *   channel_config: {
 *     email: { to: ['oncall@company.com'] },
 *     slack: { webhook_url: process.env.SLACK_WEBHOOK },
 *   },
 *   enabled: true,
 * });
 *
 * // Send alert for violation
 * await alertService.sendAlert(violation);
 * ```
 */
export class AlertingService {
  private storage: AlertStorage;
  private logger: pino.Logger;
  private handlers: Map<AlertChannel, AlertChannelHandler>;

  constructor(config: AlertingServiceConfig) {
    this.storage = config.storage;
    this.logger = config.logger || pino({ name: 'alerting-service' });

    // Initialize channel handlers
    this.handlers = new Map();

    // Register provided handlers
    if (config.channels) {
      for (const handler of config.channels) {
        this.handlers.set(handler.channel, handler);
      }
    }

    // Register default handlers if not provided
    if (!this.handlers.has(AlertChannel.EMAIL)) {
      this.handlers.set(AlertChannel.EMAIL, new EmailAlertHandler());
    }
    if (!this.handlers.has(AlertChannel.SLACK)) {
      this.handlers.set(AlertChannel.SLACK, new SlackAlertHandler());
    }
    if (!this.handlers.has(AlertChannel.WEBHOOK)) {
      this.handlers.set(AlertChannel.WEBHOOK, new WebhookAlertHandler());
    }
    if (!this.handlers.has(AlertChannel.LOG)) {
      this.handlers.set(AlertChannel.LOG, new LogAlertHandler());
    }
  }

  /**
   * Create alert configuration
   */
  async createAlert(config: Omit<AlertConfig, 'id'>): Promise<AlertConfig> {
    const alertConfig: AlertConfig = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...config,
    };

    await this.storage.saveAlertConfig(alertConfig);

    this.logger.info(
      { alertId: alertConfig.id, name: alertConfig.name },
      'Alert configuration created'
    );

    return alertConfig;
  }

  /**
   * Send alert for SLA violation
   */
  async sendAlert(violation: SLAViolation): Promise<void> {
    // Get applicable alert configurations
    const configs = await this.storage.getAlertConfigs(violation.organization_id);

    const applicableConfigs = configs.filter(config =>
      config.enabled &&
      config.metric === violation.metric &&
      config.severities.includes(violation.severity)
    );

    if (applicableConfigs.length === 0) {
      this.logger.debug(
        { metric: violation.metric, severity: violation.severity },
        'No alert configurations match this violation'
      );
      return;
    }

    // Send notifications through each configured channel
    for (const config of applicableConfigs) {
      // Check cooldown
      if (this.isInCooldown(config)) {
        this.logger.debug(
          { alertId: config.id },
          'Alert in cooldown period, skipping'
        );
        continue;
      }

      for (const channel of config.channels) {
        await this.sendNotification(violation, config, channel);
      }

      // Update last sent time
      await this.storage.updateLastSentTime(config.id!, new Date());
    }
  }

  /**
   * Send notification through specific channel
   */
  private async sendNotification(
    violation: SLAViolation,
    config: AlertConfig,
    channel: AlertChannel
  ): Promise<void> {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const notification: AlertNotification = {
      id: notificationId,
      alert_id: config.id!,
      violation_id: violation.id,
      channel,
      severity: violation.severity,
      subject: `SLA ${violation.severity.toUpperCase()}: ${violation.metric}`,
      message: `Metric ${violation.metric} violated threshold`,
      sent_at: new Date(),
      status: 'pending',
      organization_id: violation.organization_id,
    };

    try {
      const handler = this.handlers.get(channel);

      if (!handler) {
        throw new Error(`No handler available for channel: ${channel}`);
      }

      await handler.send(violation, config);

      notification.status = 'sent';
      this.logger.info(
        { channel, alertId: config.id, violationId: violation.id },
        'Alert notification sent'
      );
    } catch (error) {
      notification.status = 'failed';
      notification.error = error instanceof Error ? error.message : String(error);

      this.logger.error(
        {
          error: notification.error,
          channel,
          alertId: config.id,
        },
        'Failed to send alert notification'
      );
    }

    // Save notification record
    await this.storage.saveNotification(notification);
  }

  /**
   * Check if alert is in cooldown period
   */
  private isInCooldown(config: AlertConfig): boolean {
    if (!config.cooldown_seconds || !config.last_sent_at) {
      return false;
    }

    const cooldownMs = config.cooldown_seconds * 1000;
    const timeSinceLastSent = Date.now() - config.last_sent_at.getTime();

    return timeSinceLastSent < cooldownMs;
  }

  /**
   * Get alert configurations
   */
  async getAlerts(organizationId?: string): Promise<AlertConfig[]> {
    return this.storage.getAlertConfigs(organizationId);
  }

  /**
   * Update alert configuration
   */
  async updateAlert(id: string, updates: Partial<AlertConfig>): Promise<void> {
    await this.storage.updateAlertConfig(id, updates);

    this.logger.info({ alertId: id }, 'Alert configuration updated');
  }

  /**
   * Delete alert configuration
   */
  async deleteAlert(id: string): Promise<void> {
    await this.storage.deleteAlertConfig(id);

    this.logger.info({ alertId: id }, 'Alert configuration deleted');
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(
    startTime?: Date,
    endTime?: Date,
    organizationId?: string
  ): Promise<AlertNotification[]> {
    return this.storage.getNotifications(startTime, endTime, organizationId);
  }

  /**
   * Test alert configuration
   */
  async testAlert(alertId: string): Promise<void> {
    const configs = await this.storage.getAlertConfigs();
    const config = configs.find(c => c.id === alertId);

    if (!config) {
      throw new Error(`Alert configuration not found: ${alertId}`);
    }

    // Create test violation
    const testViolation: SLAViolation = {
      id: `test_${Date.now()}`,
      threshold_id: 'test',
      metric: config.metric,
      current_value: 1000,
      target_value: 100,
      threshold_value: 500,
      severity: SLASeverity.WARNING,
      detected_at: new Date(),
      organization_id: config.organization_id,
      metadata: { test: true },
    };

    // Send test notifications
    for (const channel of config.channels) {
      await this.sendNotification(testViolation, config, channel);
    }

    this.logger.info({ alertId }, 'Test alert sent');
  }
}

/**
 * Create Alerting Service instance
 */
export function createAlertingService(config: AlertingServiceConfig): AlertingService {
  return new AlertingService(config);
}
