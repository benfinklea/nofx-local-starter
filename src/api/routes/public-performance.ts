/**
 * Public Performance Monitoring API Routes (No Authentication Required)
 * These endpoints are specifically designed for monitoring dashboards and health checks
 */

import { Router, Request, Response } from 'express';
import { performanceMonitor } from '../../lib/performance-monitor';
import {
  benchmarkRunner,
  getBenchmarkStats
} from '../../lib/benchmarks';

const router = Router();

// Simple error handler for public endpoints
function handleError(res: Response, error: Error, message: string) {
  console.error(`Public performance API error: ${message}`, error);
  return res.status(500).json({
    status: 'error',
    message,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Public health check with performance status
 */
router.get('/health', (_req: Request, res: Response) => {
  try {
    const isHealthy = performanceMonitor.isHealthy();
    const summary = performanceMonitor.getSummary();

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      data: {
        healthy: isHealthy,
        summary: {
          uptime: summary.uptime,
          totalRequests: summary.totalRequests,
          errorRate: summary.errorRate,
          avgResponseTime: summary.avgResponseTime,
          avgMemoryMB: summary.avgMemoryMB
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(res, error as Error, 'Failed to check performance health');
  }
});

/**
 * Get current performance snapshot
 */
router.get('/current', (_req: Request, res: Response) => {
  try {
    const snapshot = performanceMonitor.getCurrentSnapshot();
    return res.json({
      status: 'success',
      data: snapshot,
      healthy: performanceMonitor.isHealthy(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(res, error as Error, 'Failed to get performance snapshot');
  }
});

/**
 * Get performance summary
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : undefined;
    const summary = performanceMonitor.getSummary(timeRange);

    return res.json({
      status: 'success',
      data: summary,
      healthy: performanceMonitor.isHealthy(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(res, error as Error, 'Failed to get performance summary');
  }
});

/**
 * Get recent performance snapshots
 */
router.get('/snapshots', (req: Request, res: Response) => {
  try {
    const count = req.query.count ? parseInt(req.query.count as string) : 100;
    const snapshots = performanceMonitor.getSnapshots(count);

    return res.json({
      status: 'success',
      data: snapshots,
      count: snapshots.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(res, error as Error, 'Failed to get performance snapshots');
  }
});

/**
 * Get benchmark suites list
 */
router.get('/benchmarks/suites', (_req: Request, res: Response) => {
  try {
    const suites = benchmarkRunner.listSuites();

    return res.json({
      status: 'success',
      data: suites,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(res, error as Error, 'Failed to get benchmark suites');
  }
});

/**
 * Get benchmark statistics for a suite
 */
router.get('/benchmarks/stats/:suiteName', (req: Request, res: Response) => {
  try {
    const suiteName = req.params.suiteName || '';
    const stats = getBenchmarkStats(suiteName);

    if (!stats) {
      return res.status(404).json({
        status: 'error',
        message: `Benchmark suite '${suiteName}' not found`,
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(res, error as Error, 'Failed to get benchmark statistics');
  }
});

/**
 * Simple system info endpoint
 */
router.get('/info', (_req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return res.json({
      status: 'success',
      data: {
        uptime: uptime * 1000, // Convert to milliseconds
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return handleError(res, error as Error, 'Failed to get system info');
  }
});

/**
 * Ping endpoint for connectivity testing
 */
router.get('/ping', (_req: Request, res: Response) => {
  return res.json({
    status: 'success',
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

export default router;