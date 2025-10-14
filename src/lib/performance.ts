/**
 * Performance Monitoring Utilities
 *
 * Lightweight performance tracking for:
 * - API response times
 * - Database query performance
 * - Memory usage
 * - Custom metrics
 */

import { log } from './logger';

interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface Timer {
  start: number;
  name: string;
  tags?: Record<string, string>;
}

class PerformanceMonitor {
  private metrics: Metric[] = [];
  private timers: Map<string, Timer> = new Map();
  private readonly maxMetrics = 1000; // Keep last 1000 metrics in memory

  /**
   * Start a performance timer
   */
  startTimer(name: string, tags?: Record<string, string>): string {
    const id = `${name}_${Date.now()}_${Math.random()}`;
    this.timers.set(id, {
      start: performance.now(),
      name,
      tags
    });
    return id;
  }

  /**
   * End a performance timer and record metric
   */
  endTimer(id: string): number | null {
    const timer = this.timers.get(id);
    if (!timer) {
      log.warn({ timerId: id }, 'Timer not found');
      return null;
    }

    const duration = performance.now() - timer.start;
    this.recordMetric(timer.name, duration, 'ms', timer.tags);
    this.timers.delete(id);

    return duration;
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'count',
    tags?: Record<string, string>
  ): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);

    // Keep only last N metrics to prevent memory leak
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (unit === 'ms' && value > 1000) {
      log.warn(
        { metric: name, duration: value, tags },
        'Slow operation detected'
      );
    }
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string, limit = 100): Metric[] {
    return this.metrics
      .filter(m => m.name === name)
      .slice(-limit);
  }

  /**
   * Get metric statistics
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics(name, 1000);
    if (metrics.length === 0) return null;

    const values = metrics.map(m => m.value).sort((a, b) => a - b);

    return {
      count: values.length,
      min: values[0] ?? 0,
      max: values[values.length - 1] ?? 0,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: values[Math.floor(values.length * 0.5)] ?? 0,
      p95: values[Math.floor(values.length * 0.95)] ?? 0,
      p99: values[Math.floor(values.length * 0.99)] ?? 0
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return [...new Set(this.metrics.map(m => m.name))];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  } {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024)
    };
  }

  /**
   * Record memory usage metric
   */
  recordMemoryUsage(): void {
    const mem = this.getMemoryUsage();
    this.recordMetric('memory.heap_used', mem.heapUsed, 'MB');
    this.recordMetric('memory.heap_total', mem.heapTotal, 'MB');
    this.recordMetric('memory.rss', mem.rss, 'MB');
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Middleware for Express to track API response times
 */
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const timerId = perfMonitor.startTimer('api.response_time', {
      method: req.method,
      path: req.route?.path || req.path
    });

    // Override res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      perfMonitor.endTimer(timerId);
      perfMonitor.recordMetric('api.request', 1, 'count', {
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode.toString()
      });
      return originalJson(body);
    };

    // Override res.send for non-JSON responses
    const originalSend = res.send.bind(res);
    res.send = function (body: any) {
      perfMonitor.endTimer(timerId);
      perfMonitor.recordMetric('api.request', 1, 'count', {
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode.toString()
      });
      return originalSend(body);
    };

    next();
  };
}

/**
 * Database query performance wrapper
 */
export async function trackQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const timerId = perfMonitor.startTimer('db.query', { query: queryName });

  try {
    const result = await queryFn();
    const duration = perfMonitor.endTimer(timerId);

    if (duration && duration > 100) {
      log.warn({ query: queryName, duration }, 'Slow database query');
    }

    return result;
  } catch (error) {
    perfMonitor.endTimer(timerId);
    perfMonitor.recordMetric('db.error', 1, 'count', { query: queryName });
    throw error;
  }
}

/**
 * Function performance wrapper
 */
export async function trackFunction<T>(
  functionName: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const timerId = perfMonitor.startTimer(`function.${functionName}`, tags);

  try {
    return await fn();
  } finally {
    perfMonitor.endTimer(timerId);
  }
}

/**
 * Start periodic memory monitoring
 */
export function startMemoryMonitoring(intervalMs = 60000): NodeJS.Timeout {
  return setInterval(() => {
    perfMonitor.recordMemoryUsage();

    const mem = perfMonitor.getMemoryUsage();
    if (mem.heapUsed > 500) { // Alert if heap > 500MB
      log.warn({ memory: mem }, 'High memory usage detected');
    }
  }, intervalMs);
}

/**
 * Get performance summary for dashboard
 */
export function getPerformanceSummary(): Record<string, any> {
  const summary: Record<string, any> = {};

  for (const metricName of perfMonitor.getMetricNames()) {
    const stats = perfMonitor.getStats(metricName);
    if (stats) {
      summary[metricName] = stats;
    }
  }

  summary.memory = perfMonitor.getMemoryUsage();

  return summary;
}
