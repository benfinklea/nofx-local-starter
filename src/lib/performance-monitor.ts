/**
 * Real-time Performance Monitor
 * Continuous monitoring and alerting for performance metrics
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { metrics } from './metrics';

export interface PerformanceAlert {
  level: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

export interface PerformanceThresholds {
  responseTime: {
    warning: number;
    critical: number;
  };
  memoryUsage: {
    warning: number; // MB
    critical: number; // MB
  };
  cpuUsage: {
    warning: number; // percentage
    critical: number; // percentage
  };
  errorRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  queueDepth: {
    warning: number;
    critical: number;
  };
}

export interface PerformanceSnapshot {
  timestamp: number;
  memory: NodeJS.MemoryUsage;
  cpu: {
    user: number;
    system: number;
  };
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
  };
  requests: {
    total: number;
    errors: number;
    rps: number;
  };
  queue: {
    depth: number;
    oldestAge: number;
  };
}

class PerformanceMonitor extends EventEmitter {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;
  private snapshots: PerformanceSnapshot[] = [];
  private maxSnapshots = 1000; // Keep last 1000 snapshots
  private responseTimes: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private startTime = Date.now();

  constructor(
    private thresholds: PerformanceThresholds = {
      responseTime: { warning: 100, critical: 500 },
      memoryUsage: { warning: 512, critical: 1024 },
      cpuUsage: { warning: 70, critical: 90 },
      errorRate: { warning: 5, critical: 10 },
      queueDepth: { warning: 100, critical: 500 }
    },
    private intervalMs = 5000 // 5 seconds
  ) {
    super();
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    this.lastCpuUsage = process.cpuUsage();

    this.interval = setInterval(() => {
      this.captureSnapshot();
    }, this.intervalMs);

    this.emit('monitor:start');
    console.log('📊 Performance monitor started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.emit('monitor:stop');
    console.log('📊 Performance monitor stopped');
  }

  /**
   * Record a response time
   */
  recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    this.requestCount++;

    // Keep only recent response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500);
    }

    // Check response time thresholds
    if (duration > this.thresholds.responseTime.critical) {
      this.emitAlert('critical', 'responseTime', duration, this.thresholds.responseTime.critical,
        `Critical response time: ${duration.toFixed(2)}ms`);
    } else if (duration > this.thresholds.responseTime.warning) {
      this.emitAlert('warning', 'responseTime', duration, this.thresholds.responseTime.warning,
        `Slow response time: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.errorCount++;
  }

  /**
   * Get current performance snapshot
   */
  getCurrentSnapshot(): PerformanceSnapshot {
    const memory = process.memoryUsage();
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = process.cpuUsage();

    const uptime = Date.now() - this.startTime;
    const rps = this.requestCount / (uptime / 1000);
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    // Calculate response time percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      timestamp: Date.now(),
      memory,
      cpu: {
        user: currentCpuUsage.user / 1000, // Convert to ms
        system: currentCpuUsage.system / 1000
      },
      responseTime: {
        avg: sortedTimes.length > 0 ? sortedTimes.reduce((sum, t) => sum + t, 0) / sortedTimes.length : 0,
        p95: sortedTimes[p95Index] || 0,
        p99: sortedTimes[p99Index] || 0
      },
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        rps
      },
      queue: {
        depth: 0, // TODO: Integrate with queue system
        oldestAge: 0
      }
    };
  }

  /**
   * Capture and analyze performance snapshot
   */
  private captureSnapshot(): void {
    const snapshot = this.getCurrentSnapshot();
    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    // Check thresholds
    this.checkThresholds(snapshot);

    this.emit('snapshot', snapshot);
  }

  /**
   * Check all thresholds against current snapshot
   */
  private checkThresholds(snapshot: PerformanceSnapshot): void {
    // Memory usage
    const memoryMB = snapshot.memory.heapUsed / (1024 * 1024);
    if (memoryMB > this.thresholds.memoryUsage.critical) {
      this.emitAlert('critical', 'memoryUsage', memoryMB, this.thresholds.memoryUsage.critical,
        `Critical memory usage: ${memoryMB.toFixed(2)}MB`);
    } else if (memoryMB > this.thresholds.memoryUsage.warning) {
      this.emitAlert('warning', 'memoryUsage', memoryMB, this.thresholds.memoryUsage.warning,
        `High memory usage: ${memoryMB.toFixed(2)}MB`);
    }

    // CPU usage (approximate)
    const cpuPercent = ((snapshot.cpu.user + snapshot.cpu.system) / this.intervalMs) * 100;
    if (cpuPercent > this.thresholds.cpuUsage.critical) {
      this.emitAlert('critical', 'cpuUsage', cpuPercent, this.thresholds.cpuUsage.critical,
        `Critical CPU usage: ${cpuPercent.toFixed(2)}%`);
    } else if (cpuPercent > this.thresholds.cpuUsage.warning) {
      this.emitAlert('warning', 'cpuUsage', cpuPercent, this.thresholds.cpuUsage.warning,
        `High CPU usage: ${cpuPercent.toFixed(2)}%`);
    }

    // Error rate
    const errorRate = snapshot.requests.total > 0 ? (snapshot.requests.errors / snapshot.requests.total) * 100 : 0;
    if (errorRate > this.thresholds.errorRate.critical) {
      this.emitAlert('critical', 'errorRate', errorRate, this.thresholds.errorRate.critical,
        `Critical error rate: ${errorRate.toFixed(2)}%`);
    } else if (errorRate > this.thresholds.errorRate.warning) {
      this.emitAlert('warning', 'errorRate', errorRate, this.thresholds.errorRate.warning,
        `High error rate: ${errorRate.toFixed(2)}%`);
    }

    // Response time P95
    if (snapshot.responseTime.p95 > this.thresholds.responseTime.critical) {
      this.emitAlert('critical', 'responseTimeP95', snapshot.responseTime.p95, this.thresholds.responseTime.critical,
        `Critical P95 response time: ${snapshot.responseTime.p95.toFixed(2)}ms`);
    } else if (snapshot.responseTime.p95 > this.thresholds.responseTime.warning) {
      this.emitAlert('warning', 'responseTimeP95', snapshot.responseTime.p95, this.thresholds.responseTime.warning,
        `High P95 response time: ${snapshot.responseTime.p95.toFixed(2)}ms`);
    }
  }

  /**
   * Emit performance alert
   */
  private emitAlert(level: 'warning' | 'critical', metric: string, value: number, threshold: number, message: string): void {
    const alert: PerformanceAlert = {
      level,
      metric,
      value,
      threshold,
      timestamp: Date.now(),
      message
    };

    this.emit('alert', alert);

    // Log to console
    const emoji = level === 'critical' ? '🚨' : '⚠️';
    console.log(`${emoji} [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Get performance summary
   */
  getSummary(timeRange?: number): {
    uptime: number;
    totalRequests: number;
    totalErrors: number;
    avgResponseTime: number;
    avgMemoryMB: number;
    avgRPS: number;
    errorRate: number;
  } {
    const now = Date.now();
    const cutoff = timeRange ? now - timeRange : 0;
    const relevantSnapshots = this.snapshots.filter(s => s.timestamp >= cutoff);

    if (relevantSnapshots.length === 0) {
      return {
        uptime: now - this.startTime,
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        avgResponseTime: 0,
        avgMemoryMB: 0,
        avgRPS: 0,
        errorRate: 0
      };
    }

    const totalResponseTime = relevantSnapshots.reduce((sum, s) => sum + s.responseTime.avg, 0);
    const totalMemory = relevantSnapshots.reduce((sum, s) => sum + s.memory.heapUsed, 0);
    const totalRPS = relevantSnapshots.reduce((sum, s) => sum + s.requests.rps, 0);

    return {
      uptime: now - this.startTime,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      avgResponseTime: totalResponseTime / relevantSnapshots.length,
      avgMemoryMB: (totalMemory / relevantSnapshots.length) / (1024 * 1024),
      avgRPS: totalRPS / relevantSnapshots.length,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0
    };
  }

  /**
   * Get recent snapshots
   */
  getSnapshots(count = 100): PerformanceSnapshot[] {
    return this.snapshots.slice(-count);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.snapshots = [];
    this.responseTimes = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
    this.lastCpuUsage = process.cpuUsage();
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.emit('thresholds:updated', this.thresholds);
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    const snapshot = this.getCurrentSnapshot();
    const memoryMB = snapshot.memory.heapUsed / (1024 * 1024);
    const errorRate = snapshot.requests.total > 0 ? (snapshot.requests.errors / snapshot.requests.total) * 100 : 0;

    return memoryMB < this.thresholds.memoryUsage.warning &&
           snapshot.responseTime.p95 < this.thresholds.responseTime.warning &&
           errorRate < this.thresholds.errorRate.warning;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Middleware for Express to automatically track performance
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = performance.now();

    res.on('finish', () => {
      const duration = performance.now() - start;
      performanceMonitor.recordResponseTime(duration);

      if (res.statusCode >= 400) {
        performanceMonitor.recordError();
      }

      // Record to metrics
      metrics.httpRequestDuration.observe(
        {
          method: req.method,
          route: req.route?.path || req.path,
          status: res.statusCode.toString()
        },
        duration
      );
    });

    next();
  };
}