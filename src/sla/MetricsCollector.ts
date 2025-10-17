/**
 * Metrics Collector
 *
 * Middleware and utilities for collecting metrics from various sources.
 *
 * @module sla/MetricsCollector
 */

import type { Request, Response, NextFunction } from 'express';
import type { SLAMonitoringService } from './SLAMonitoringService';
import { MetricType, type MetricDataPoint } from './types';

/**
 * Metrics Collector Configuration
 */
export interface MetricsCollectorConfig {
  /** SLA Monitoring Service instance */
  slaService: SLAMonitoringService;
  /** Collect system metrics automatically */
  collectSystemMetrics?: boolean;
  /** System metrics collection interval in seconds */
  systemMetricsInterval?: number;
  /** Track slow query threshold in ms */
  slowQueryThreshold?: number;
}

/**
 * Metrics Collector
 *
 * Provides middleware and utilities for automatic metrics collection.
 *
 * @example
 * ```typescript
 * const collector = new MetricsCollector({
 *   slaService,
 *   collectSystemMetrics: true,
 *   systemMetricsInterval: 60,
 * });
 *
 * // Express middleware
 * app.use(collector.createRequestMetricsMiddleware());
 *
 * // Manual metric recording
 * await collector.recordHandlerTime('codegen', 1234);
 * ```
 */
export class MetricsCollector {
  private slaService: SLAMonitoringService;
  private config: Required<MetricsCollectorConfig>;
  private systemMetricsTimer?: NodeJS.Timeout;
  private requestCounts: Map<string, number> = new Map();

  constructor(config: MetricsCollectorConfig) {
    this.slaService = config.slaService;
    this.config = {
      collectSystemMetrics: config.collectSystemMetrics ?? true,
      systemMetricsInterval: config.systemMetricsInterval ?? 60,
      slowQueryThreshold: config.slowQueryThreshold ?? 100,
      ...config,
    };

    if (this.config.collectSystemMetrics) {
      this.startSystemMetricsCollection();
    }
  }

  /**
   * Express middleware for collecting HTTP request metrics
   */
  createRequestMetricsMiddleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();

      // Get organization from request
      const organizationId = (req as any).organizationId;

      // Track concurrent request
      const path = req.path;
      this.requestCounts.set(path, (this.requestCounts.get(path) || 0) + 1);

      // Intercept response
      const originalSend = res.send.bind(res);
      res.send = (body: any): Response => {
        const duration = Date.now() - startTime;

        // Record metrics asynchronously
        void (async () => {
          try {
            // Response time
            await this.slaService.recordMetric({
              metric: MetricType.RESPONSE_TIME,
              value: duration,
              timestamp: new Date(),
              organization_id: organizationId,
              labels: {
                method: req.method,
                path: req.path,
                status: res.statusCode.toString(),
              },
              duration_ms: duration,
            });

            // Success/Error rate
            const isSuccess = res.statusCode < 400;
            await this.slaService.recordMetric({
              metric: isSuccess ? MetricType.SUCCESS_RATE : MetricType.ERROR_RATE,
              value: isSuccess ? 1 : 0,
              timestamp: new Date(),
              organization_id: organizationId,
              labels: {
                method: req.method,
                path: req.path,
                status: res.statusCode.toString(),
              },
            });

            // Decrement concurrent count
            const count = this.requestCounts.get(path) || 1;
            this.requestCounts.set(path, count - 1);
          } catch (error) {
            // Silent failure - don't break request handling
            console.error('Failed to record request metrics:', error);
          }
        })();

        return originalSend(body);
      };

      next();
    };
  }

  /**
   * Record database query time
   */
  async recordQueryTime(
    duration: number,
    queryType?: string,
    organizationId?: string
  ): Promise<void> {
    await this.slaService.recordMetric({
      metric: MetricType.DB_QUERY_TIME,
      value: duration,
      timestamp: new Date(),
      organization_id: organizationId,
      labels: {
        query_type: queryType || 'unknown',
        slow: duration > this.config.slowQueryThreshold ? 'true' : 'false',
      },
      duration_ms: duration,
    });
  }

  /**
   * Record queue processing time
   */
  async recordQueueTime(
    jobType: string,
    duration: number,
    organizationId?: string
  ): Promise<void> {
    await this.slaService.recordMetric({
      metric: MetricType.QUEUE_TIME,
      value: duration,
      timestamp: new Date(),
      organization_id: organizationId,
      labels: {
        job_type: jobType,
      },
      duration_ms: duration,
    });
  }

  /**
   * Record handler execution time
   */
  async recordHandlerTime(
    handlerName: string,
    duration: number,
    organizationId?: string
  ): Promise<void> {
    await this.slaService.recordMetric({
      metric: MetricType.HANDLER_TIME,
      value: duration,
      timestamp: new Date(),
      organization_id: organizationId,
      labels: {
        handler: handlerName,
      },
      duration_ms: duration,
    });
  }

  /**
   * Record storage operation time
   */
  async recordStorageTime(
    operation: string,
    duration: number,
    organizationId?: string
  ): Promise<void> {
    await this.slaService.recordMetric({
      metric: MetricType.STORAGE_TIME,
      value: duration,
      timestamp: new Date(),
      organization_id: organizationId,
      labels: {
        operation,
      },
      duration_ms: duration,
    });
  }

  /**
   * Record Git operation time
   */
  async recordGitTime(
    operation: string,
    duration: number,
    organizationId?: string
  ): Promise<void> {
    await this.slaService.recordMetric({
      metric: MetricType.GIT_TIME,
      value: duration,
      timestamp: new Date(),
      organization_id: organizationId,
      labels: {
        operation,
      },
      duration_ms: duration,
    });
  }

  /**
   * Create a timing wrapper for functions
   */
  withTiming<T>(
    metricType: MetricType,
    fn: () => Promise<T>,
    labels?: Record<string, string>,
    organizationId?: string
  ): Promise<T> {
    return this.wrapWithTiming(metricType, fn, labels, organizationId);
  }

  /**
   * Wrap function with automatic timing
   */
  private async wrapWithTiming<T>(
    metricType: MetricType,
    fn: () => Promise<T>,
    labels?: Record<string, string>,
    organizationId?: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      await this.slaService.recordMetric({
        metric: metricType,
        value: duration,
        timestamp: new Date(),
        organization_id: organizationId,
        labels,
        duration_ms: duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.slaService.recordMetric({
        metric: metricType,
        value: duration,
        timestamp: new Date(),
        organization_id: organizationId,
        labels: {
          ...labels,
          error: 'true',
        },
        duration_ms: duration,
      });

      throw error;
    }
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    const collectMetrics = async () => {
      try {
        const metrics: MetricDataPoint[] = [];

        // Memory usage
        const memUsage = process.memoryUsage();
        metrics.push({
          metric: MetricType.MEMORY_USAGE,
          value: memUsage.heapUsed / 1024 / 1024, // MB
          timestamp: new Date(),
          labels: {
            type: 'heap',
          },
        });

        // CPU usage (approximation based on process.cpuUsage())
        const cpuUsage = process.cpuUsage();
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / this.config.systemMetricsInterval;
        metrics.push({
          metric: MetricType.CPU_USAGE,
          value: Math.min(cpuPercent, 1), // Cap at 100%
          timestamp: new Date(),
        });

        // Uptime
        metrics.push({
          metric: MetricType.UPTIME,
          value: 1, // 100% uptime (if we're running)
          timestamp: new Date(),
        });

        // Concurrent users (from request counts)
        const totalConcurrent = Array.from(this.requestCounts.values()).reduce(
          (sum, count) => sum + count,
          0
        );
        metrics.push({
          metric: MetricType.CONCURRENT_USERS,
          value: totalConcurrent,
          timestamp: new Date(),
        });

        // Record all metrics
        await this.slaService.recordMetricsBatch(metrics);
      } catch (error) {
        console.error('Failed to collect system metrics:', error);
      }
    };

    // Collect immediately
    void collectMetrics();

    // Then collect on interval
    this.systemMetricsTimer = setInterval(() => {
      void collectMetrics();
    }, this.config.systemMetricsInterval * 1000);

    if (this.systemMetricsTimer.unref) {
      this.systemMetricsTimer.unref();
    }
  }

  /**
   * Stop metrics collection
   */
  shutdown(): void {
    if (this.systemMetricsTimer) {
      clearInterval(this.systemMetricsTimer);
    }
  }
}

/**
 * Create timing decorator for class methods
 */
export function Timed(metricType: MetricType) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        // Access metrics collector if available
        if (this.metricsCollector) {
          await this.metricsCollector.slaService.recordMetric({
            metric: metricType,
            value: duration,
            timestamp: new Date(),
            labels: {
              method: propertyKey,
            },
            duration_ms: duration,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (this.metricsCollector) {
          await this.metricsCollector.slaService.recordMetric({
            metric: metricType,
            value: duration,
            timestamp: new Date(),
            labels: {
              method: propertyKey,
              error: 'true',
            },
            duration_ms: duration,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Create Metrics Collector instance
 */
export function createMetricsCollector(config: MetricsCollectorConfig): MetricsCollector {
  return new MetricsCollector(config);
}
