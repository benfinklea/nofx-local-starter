/**
 * In-Memory SLA Storage
 *
 * Simple in-memory storage adapter for development and testing.
 *
 * @module sla/storage/InMemorySLAStorage
 */

import type { SLAStorage } from '../SLAMonitoringService';
import type { AlertStorage } from '../AlertingService';
import type {
  SLAThreshold,
  MetricDataPoint,
  SLAViolation,
  MetricAggregation,
  AlertConfig,
  AlertNotification,
  MetricType,
} from '../types';

/**
 * In-Memory SLA Storage
 *
 * Simple storage implementation for development.
 * NOT suitable for production use.
 */
export class InMemorySLAStorage implements SLAStorage, AlertStorage {
  private thresholds: Map<string, SLAThreshold> = new Map();
  private metrics: MetricDataPoint[] = [];
  private violations: SLAViolation[] = [];
  private aggregations: Map<string, MetricAggregation> = new Map();
  private alerts: Map<string, AlertConfig> = new Map();
  private notifications: AlertNotification[] = [];

  // Threshold methods
  async saveThreshold(threshold: SLAThreshold): Promise<void> {
    const key = this.getThresholdKey(threshold.metric, threshold.organization_id);
    this.thresholds.set(key, threshold);
  }

  async getThresholds(organizationId?: string): Promise<SLAThreshold[]> {
    const results: SLAThreshold[] = [];

    for (const [key, threshold] of this.thresholds.entries()) {
      if (organizationId) {
        if (threshold.organization_id === organizationId) {
          results.push(threshold);
        }
      } else {
        if (!threshold.organization_id) {
          results.push(threshold);
        }
      }
    }

    return results;
  }

  async updateThreshold(
    metric: MetricType,
    updates: Partial<SLAThreshold>
  ): Promise<void> {
    const key = this.getThresholdKey(metric, updates.organization_id);
    const existing = this.thresholds.get(key);

    if (existing) {
      this.thresholds.set(key, { ...existing, ...updates });
    }
  }

  async deleteThreshold(metric: MetricType, organizationId?: string): Promise<void> {
    const key = this.getThresholdKey(metric, organizationId);
    this.thresholds.delete(key);
  }

  // Metric methods
  async saveMetric(metric: MetricDataPoint): Promise<void> {
    this.metrics.push({
      ...metric,
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    // Cleanup old metrics (keep last 10000)
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }
  }

  async saveMetricsBatch(metrics: MetricDataPoint[]): Promise<void> {
    for (const metric of metrics) {
      await this.saveMetric(metric);
    }
  }

  async getMetrics(
    metric: MetricType,
    startTime: Date,
    endTime: Date,
    organizationId?: string
  ): Promise<MetricDataPoint[]> {
    return this.metrics.filter(m =>
      m.metric === metric &&
      m.timestamp >= startTime &&
      m.timestamp <= endTime &&
      (organizationId ? m.organization_id === organizationId : !m.organization_id)
    );
  }

  // Violation methods
  async saveViolation(violation: SLAViolation): Promise<void> {
    this.violations.push(violation);
  }

  async getViolations(
    startTime?: Date,
    endTime?: Date,
    organizationId?: string
  ): Promise<SLAViolation[]> {
    return this.violations.filter(v => {
      if (startTime && v.detected_at < startTime) return false;
      if (endTime && v.detected_at > endTime) return false;
      if (organizationId && v.organization_id !== organizationId) return false;
      return true;
    });
  }

  async getActiveViolations(organizationId?: string): Promise<SLAViolation[]> {
    return this.violations.filter(v =>
      !v.resolved_at &&
      (organizationId ? v.organization_id === organizationId : !v.organization_id)
    );
  }

  async resolveViolation(violationId: string): Promise<void> {
    const violation = this.violations.find(v => v.id === violationId);
    if (violation) {
      violation.resolved_at = new Date();
    }
  }

  // Aggregation methods
  async getAggregation(
    metric: MetricType,
    windowStart: Date,
    windowEnd: Date,
    organizationId?: string
  ): Promise<MetricAggregation | null> {
    const key = `${metric}_${windowStart.getTime()}_${windowEnd.getTime()}_${organizationId || 'sys'}`;
    return this.aggregations.get(key) || null;
  }

  // Alert methods
  async saveAlertConfig(config: AlertConfig): Promise<void> {
    this.alerts.set(config.id!, config);
  }

  async getAlertConfigs(organizationId?: string): Promise<AlertConfig[]> {
    const results: AlertConfig[] = [];

    for (const config of this.alerts.values()) {
      if (organizationId) {
        if (config.organization_id === organizationId) {
          results.push(config);
        }
      } else {
        if (!config.organization_id) {
          results.push(config);
        }
      }
    }

    return results;
  }

  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<void> {
    const existing = this.alerts.get(id);
    if (existing) {
      this.alerts.set(id, { ...existing, ...updates });
    }
  }

  async deleteAlertConfig(id: string): Promise<void> {
    this.alerts.delete(id);
  }

  async saveNotification(notification: AlertNotification): Promise<void> {
    this.notifications.push(notification);

    // Cleanup old notifications (keep last 1000)
    if (this.notifications.length > 1000) {
      this.notifications = this.notifications.slice(-1000);
    }
  }

  async getNotifications(
    startTime?: Date,
    endTime?: Date,
    organizationId?: string
  ): Promise<AlertNotification[]> {
    return this.notifications.filter(n => {
      if (startTime && n.sent_at < startTime) return false;
      if (endTime && n.sent_at > endTime) return false;
      if (organizationId && n.organization_id !== organizationId) return false;
      return true;
    });
  }

  async updateLastSentTime(alertId: string, timestamp: Date): Promise<void> {
    const config = this.alerts.get(alertId);
    if (config) {
      config.last_sent_at = timestamp;
    }
  }

  // Helper methods
  private getThresholdKey(metric: MetricType, organizationId?: string): string {
    return `${metric}_${organizationId || 'system'}`;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.thresholds.clear();
    this.metrics = [];
    this.violations = [];
    this.aggregations.clear();
    this.alerts.clear();
    this.notifications = [];
  }
}
