/**
 * SLA Monitoring Service
 *
 * Core service for tracking SLAs, detecting violations, and managing thresholds.
 *
 * @module sla/SLAMonitoringService
 */

import pino from 'pino';
import {
  MetricType,
  SLASeverity,
  SLAStatus,
  type SLAThreshold,
  type MetricDataPoint,
  type SLAViolation,
  type MetricAggregation,
  type SLAReport,
  type SLAConfig,
} from './types';

/**
 * Storage interface for SLA data
 */
export interface SLAStorage {
  // Thresholds
  saveThreshold(threshold: SLAThreshold): Promise<void>;
  getThresholds(organizationId?: string): Promise<SLAThreshold[]>;
  updateThreshold(metric: MetricType, updates: Partial<SLAThreshold>): Promise<void>;
  deleteThreshold(metric: MetricType, organizationId?: string): Promise<void>;

  // Metrics
  saveMetric(metric: MetricDataPoint): Promise<void>;
  saveMetricsBatch(metrics: MetricDataPoint[]): Promise<void>;
  getMetrics(
    metric: MetricType,
    startTime: Date,
    endTime: Date,
    organizationId?: string
  ): Promise<MetricDataPoint[]>;

  // Violations
  saveViolation(violation: SLAViolation): Promise<void>;
  getViolations(
    startTime?: Date,
    endTime?: Date,
    organizationId?: string
  ): Promise<SLAViolation[]>;
  getActiveViolations(organizationId?: string): Promise<SLAViolation[]>;
  resolveViolation(violationId: string): Promise<void>;

  // Aggregations
  getAggregation(
    metric: MetricType,
    windowStart: Date,
    windowEnd: Date,
    organizationId?: string
  ): Promise<MetricAggregation | null>;
}

/**
 * SLA Monitoring Service Configuration
 */
export interface SLAMonitoringServiceConfig {
  /** Storage adapter */
  storage: SLAStorage;
  /** Logger instance */
  logger?: pino.Logger;
  /** SLA configuration */
  config?: Partial<SLAConfig>;
  /** Violation callback */
  onViolation?: (violation: SLAViolation) => Promise<void>;
}

/**
 * Default SLA thresholds (production-grade targets)
 */
const DEFAULT_THRESHOLDS: SLAThreshold[] = [
  {
    metric: MetricType.RESPONSE_TIME,
    target: 200,
    warning_threshold: 500,
    critical_threshold: 1000,
    window_seconds: 300, // 5 minutes
    enabled: true,
  },
  {
    metric: MetricType.SUCCESS_RATE,
    target: 0.999, // 99.9%
    warning_threshold: 0.99, // 99%
    critical_threshold: 0.95, // 95%
    window_seconds: 300,
    enabled: true,
  },
  {
    metric: MetricType.ERROR_RATE,
    target: 0.001, // 0.1%
    warning_threshold: 0.01, // 1%
    critical_threshold: 0.05, // 5%
    window_seconds: 300,
    enabled: true,
  },
  {
    metric: MetricType.UPTIME,
    target: 0.9999, // 99.99%
    warning_threshold: 0.999, // 99.9%
    critical_threshold: 0.99, // 99%
    window_seconds: 3600, // 1 hour
    enabled: true,
  },
  {
    metric: MetricType.DB_QUERY_TIME,
    target: 50,
    warning_threshold: 100,
    critical_threshold: 500,
    window_seconds: 300,
    enabled: true,
  },
  {
    metric: MetricType.QUEUE_TIME,
    target: 1000,
    warning_threshold: 5000,
    critical_threshold: 30000,
    window_seconds: 300,
    enabled: true,
  },
];

/**
 * SLA Monitoring Service
 *
 * Tracks SLA metrics, detects violations, and manages thresholds.
 *
 * @example
 * ```typescript
 * const slaService = new SLAMonitoringService({
 *   storage: slaStorage,
 *   onViolation: async (violation) => {
 *     await alertService.send(violation);
 *   }
 * });
 *
 * // Record a metric
 * await slaService.recordMetric({
 *   metric: MetricType.RESPONSE_TIME,
 *   value: 145,
 *   timestamp: new Date(),
 * });
 *
 * // Check SLA status
 * const status = await slaService.getSLAStatus();
 * ```
 */
export class SLAMonitoringService {
  private storage: SLAStorage;
  private logger: pino.Logger;
  private config: SLAConfig;
  private onViolation?: (violation: SLAViolation) => Promise<void>;
  private metricsBuffer: MetricDataPoint[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: SLAMonitoringServiceConfig) {
    this.storage = config.storage;
    this.logger = config.logger || pino({ name: 'sla-monitoring' });
    this.onViolation = config.onViolation;

    this.config = {
      default_thresholds: DEFAULT_THRESHOLDS,
      retention_days: 90,
      collection_interval_seconds: 60,
      enable_health_checks: true,
      health_check_interval_seconds: 30,
      ...config.config,
    };

    // Start buffer flush timer
    this.startFlushTimer();
  }

  /**
   * Record a metric data point
   */
  async recordMetric(metric: MetricDataPoint): Promise<void> {
    // Add to buffer
    this.metricsBuffer.push({
      ...metric,
      timestamp: metric.timestamp || new Date(),
    });

    // Flush if buffer is large
    if (this.metricsBuffer.length >= 100) {
      await this.flush();
    }

    // Check for violations in real-time for critical metrics
    if (this.isCriticalMetric(metric.metric)) {
      await this.checkThresholds(metric);
    }
  }

  /**
   * Record multiple metrics at once
   */
  async recordMetricsBatch(metrics: MetricDataPoint[]): Promise<void> {
    this.metricsBuffer.push(...metrics.map(m => ({
      ...m,
      timestamp: m.timestamp || new Date(),
    })));

    if (this.metricsBuffer.length >= 100) {
      await this.flush();
    }
  }

  /**
   * Flush buffered metrics to storage
   */
  async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const toFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await this.storage.saveMetricsBatch(toFlush);
      this.logger.debug({ count: toFlush.length }, 'Flushed metrics to storage');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to flush metrics'
      );
      // Re-add to buffer for retry
      this.metricsBuffer.unshift(...toFlush);
    }
  }

  /**
   * Check if a metric exceeds thresholds
   */
  private async checkThresholds(metric: MetricDataPoint): Promise<void> {
    const thresholds = await this.storage.getThresholds(metric.organization_id);
    const relevantThreshold = thresholds.find(t =>
      t.metric === metric.metric && t.enabled
    );

    if (!relevantThreshold) return;

    // Determine if violation occurred
    const violation = this.evaluateThreshold(metric, relevantThreshold);

    if (violation) {
      await this.handleViolation(violation);
    }
  }

  /**
   * Evaluate if a metric violates threshold
   */
  private evaluateThreshold(
    metric: MetricDataPoint,
    threshold: SLAThreshold
  ): SLAViolation | null {
    let severity: SLASeverity | null = null;
    let thresholdValue: number;

    // Determine severity based on metric type and value
    if (this.isHigherBetterMetric(metric.metric)) {
      // For metrics like uptime, success_rate (higher is better)
      if (metric.value < threshold.critical_threshold) {
        severity = SLASeverity.CRITICAL;
        thresholdValue = threshold.critical_threshold;
      } else if (metric.value < threshold.warning_threshold) {
        severity = SLASeverity.WARNING;
        thresholdValue = threshold.warning_threshold;
      }
    } else {
      // For metrics like response_time, error_rate (lower is better)
      if (metric.value > threshold.critical_threshold) {
        severity = SLASeverity.CRITICAL;
        thresholdValue = threshold.critical_threshold;
      } else if (metric.value > threshold.warning_threshold) {
        severity = SLASeverity.WARNING;
        thresholdValue = threshold.warning_threshold;
      }
    }

    if (!severity) return null;

    return {
      id: `vio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      threshold_id: `${metric.metric}_${metric.organization_id || 'system'}`,
      metric: metric.metric,
      current_value: metric.value,
      target_value: threshold.target,
      threshold_value: thresholdValue!,
      severity,
      detected_at: new Date(),
      organization_id: metric.organization_id,
      metadata: {
        labels: metric.labels,
        duration_ms: metric.duration_ms,
      },
    };
  }

  /**
   * Handle SLA violation
   */
  private async handleViolation(violation: SLAViolation): Promise<void> {
    try {
      // Save violation
      await this.storage.saveViolation(violation);

      this.logger.warn(
        {
          metric: violation.metric,
          current: violation.current_value,
          target: violation.target_value,
          severity: violation.severity,
        },
        'SLA violation detected'
      );

      // Trigger callback if provided
      if (this.onViolation) {
        await this.onViolation(violation);
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to handle SLA violation'
      );
    }
  }

  /**
   * Get current SLA status
   */
  async getSLAStatus(organizationId?: string): Promise<SLAStatus> {
    const activeViolations = await this.storage.getActiveViolations(organizationId);

    if (activeViolations.length === 0) {
      return SLAStatus.OK;
    }

    const hasCritical = activeViolations.some(v => v.severity === SLASeverity.CRITICAL);
    if (hasCritical) {
      return SLAStatus.VIOLATED;
    }

    return SLAStatus.WARNING;
  }

  /**
   * Get metric aggregation for a time window
   */
  async getAggregation(
    metric: MetricType,
    windowStart: Date,
    windowEnd: Date,
    organizationId?: string
  ): Promise<MetricAggregation | null> {
    // Try to get cached aggregation first
    const cached = await this.storage.getAggregation(
      metric,
      windowStart,
      windowEnd,
      organizationId
    );

    if (cached) return cached;

    // Calculate from raw metrics
    const metrics = await this.storage.getMetrics(
      metric,
      windowStart,
      windowEnd,
      organizationId
    );

    if (metrics.length === 0) return null;

    const values = metrics.map(m => m.value).sort((a, b) => a - b);

    const aggregation: MetricAggregation = {
      metric,
      window_start: windowStart,
      window_end: windowEnd,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: values[0]!,
      max: values[values.length - 1]!,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
      count: values.length,
      organization_id: organizationId,
    };

    return aggregation;
  }

  /**
   * Generate SLA report for a time period
   */
  async generateReport(
    periodStart: Date,
    periodEnd: Date,
    organizationId?: string
  ): Promise<SLAReport> {
    const thresholds = await this.storage.getThresholds(organizationId);
    const violations = await this.storage.getViolations(periodStart, periodEnd, organizationId);

    const report: SLAReport = {
      period_start: periodStart,
      period_end: periodEnd,
      organization_id: organizationId,
      compliance_rate: 0,
      metrics: {},
      total_violations: violations.length,
      violations_by_severity: {
        [SLASeverity.INFO]: 0,
        [SLASeverity.WARNING]: 0,
        [SLASeverity.CRITICAL]: 0,
        [SLASeverity.EMERGENCY]: 0,
      },
      generated_at: new Date(),
    };

    // Count violations by severity
    for (const violation of violations) {
      report.violations_by_severity[violation.severity]! += 1;
    }

    // Calculate metrics compliance
    let totalCompliance = 0;
    let metricsCount = 0;

    for (const threshold of thresholds) {
      if (!threshold.enabled) continue;

      const agg = await this.getAggregation(
        threshold.metric,
        periodStart,
        periodEnd,
        organizationId
      );

      if (!agg) continue;

      const metricViolations = violations.filter(v => v.metric === threshold.metric);
      const totalPeriod = periodEnd.getTime() - periodStart.getTime();
      const violationTime = metricViolations.reduce(
        (sum, v) => sum + ((v.resolved_at || periodEnd).getTime() - v.detected_at.getTime()),
        0
      );

      const compliance = 1 - (violationTime / totalPeriod);

      report.metrics[threshold.metric] = {
        target: threshold.target,
        actual: agg.avg,
        compliance,
        violations: metricViolations.length,
        p50: agg.p50,
        p95: agg.p95,
        p99: agg.p99,
      };

      totalCompliance += compliance;
      metricsCount++;
    }

    report.compliance_rate = metricsCount > 0 ? totalCompliance / metricsCount : 1;

    return report;
  }

  /**
   * Initialize default thresholds
   */
  async initializeDefaultThresholds(organizationId?: string): Promise<void> {
    for (const threshold of this.config.default_thresholds) {
      await this.storage.saveThreshold({
        ...threshold,
        organization_id: organizationId,
      });
    }

    this.logger.info(
      { organizationId, count: this.config.default_thresholds.length },
      'Initialized default SLA thresholds'
    );
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    await this.flush();

    this.logger.info('SLA Monitoring Service shutdown complete');
  }

  /**
   * Start buffer flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Periodic flush failed'
        );
      });
    }, 10000); // Flush every 10 seconds

    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Calculate percentile value
   */
  private percentile(values: number[], p: number): number {
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, index)]!;
  }

  /**
   * Check if metric is critical (needs real-time monitoring)
   */
  private isCriticalMetric(metric: MetricType): boolean {
    return [
      MetricType.RESPONSE_TIME,
      MetricType.ERROR_RATE,
      MetricType.SUCCESS_RATE,
      MetricType.UPTIME,
      MetricType.DB_QUERY_TIME,
    ].includes(metric);
  }

  /**
   * Check if higher values are better for this metric
   */
  private isHigherBetterMetric(metric: MetricType): boolean {
    return [
      MetricType.SUCCESS_RATE,
      MetricType.UPTIME,
    ].includes(metric);
  }
}

/**
 * Create SLA Monitoring Service instance
 */
export function createSLAMonitoringService(
  config: SLAMonitoringServiceConfig
): SLAMonitoringService {
  return new SLAMonitoringService(config);
}
