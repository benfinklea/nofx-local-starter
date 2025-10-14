/**
 * Performance Monitoring API Routes
 * Endpoints for accessing performance metrics and benchmarks
 */

import { Router } from 'express';
import { performanceMonitor } from '../../lib/performance-monitor';
import {
  benchmarkRunner,
  getBenchmarkStats,
  generateBenchmarkReport
} from '../../lib/benchmarks';

const router = Router();

/**
 * Get current performance snapshot (public endpoint for monitoring)
 */
router.get('/performance/current', (_req, res) => {
  try {
    const snapshot = performanceMonitor.getCurrentSnapshot();
    return res.json({
      status: 'success',
      data: snapshot,
      healthy: performanceMonitor.isHealthy()
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get performance snapshot',
      error: (error as Error).message
    });
  }
});

/**
 * Get performance summary
 */
router.get('/performance/summary', (req, res) => {
  try {
    const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : undefined;
    const summary = performanceMonitor.getSummary(timeRange);

    return res.json({
      status: 'success',
      data: summary,
      healthy: performanceMonitor.isHealthy()
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get performance summary',
      error: (error as Error).message
    });
  }
});

/**
 * Get recent performance snapshots
 */
router.get('/performance/snapshots', (req, res) => {
  try {
    const count = req.query.count ? parseInt(req.query.count as string) : 100;
    const snapshots = performanceMonitor.getSnapshots(count);

    return res.json({
      status: 'success',
      data: snapshots,
      count: snapshots.length
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get performance snapshots',
      error: (error as Error).message
    });
  }
});

/**
 * Update performance thresholds
 */
router.post('/performance/thresholds', (req, res) => {
  try {
    const thresholds = req.body;
    performanceMonitor.updateThresholds(thresholds);

    return res.json({
      status: 'success',
      message: 'Performance thresholds updated',
      data: thresholds
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update performance thresholds',
      error: (error as Error).message
    });
  }
});

/**
 * Reset performance metrics
 */
router.post('/performance/reset', (_req, res) => {
  try {
    performanceMonitor.reset();

    return res.json({
      status: 'success',
      message: 'Performance metrics reset'
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to reset performance metrics',
      error: (error as Error).message
    });
  }
});

/**
 * Get benchmark suites list
 */
router.get('/benchmarks/suites', (_req, res) => {
  try {
    const suites = benchmarkRunner.listSuites();

    return res.json({
      status: 'success',
      data: suites
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get benchmark suites',
      error: (error as Error).message
    });
  }
});

/**
 * Get benchmark statistics for a suite
 */
router.get('/benchmarks/stats/:suiteName', (req, res) => {
  try {
    const { suiteName } = req.params;
    const stats = getBenchmarkStats(suiteName);

    if (!stats) {
      return res.status(404).json({
        status: 'error',
        message: `Benchmark suite '${suiteName}' not found`
      });
    }

    return res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get benchmark statistics',
      error: (error as Error).message
    });
  }
});

/**
 * Get benchmark report for a suite
 */
router.get('/benchmarks/report/:suiteName', (req, res) => {
  try {
    const { suiteName } = req.params;
    const report = generateBenchmarkReport(suiteName);

    if (report === 'No data available') {
      return res.status(404).json({
        status: 'error',
        message: `Benchmark suite '${suiteName}' not found`
      });
    }

    return res.json({
      status: 'success',
      data: {
        report,
        suiteName
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate benchmark report',
      error: (error as Error).message
    });
  }
});

/**
 * Export benchmark results
 */
router.post('/benchmarks/export', (req, res) => {
  try {
    const { suiteName } = req.body;
    benchmarkRunner.exportResults(suiteName);

    return res.json({
      status: 'success',
      message: `Benchmark results exported${suiteName ? ` for suite: ${suiteName}` : ''}`
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to export benchmark results',
      error: (error as Error).message
    });
  }
});

/**
 * Clear benchmark data
 */
router.post('/benchmarks/clear', (_req, res) => {
  try {
    benchmarkRunner.clear();

    return res.json({
      status: 'success',
      message: 'Benchmark data cleared'
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to clear benchmark data',
      error: (error as Error).message
    });
  }
});

/**
 * Health check with performance status
 */
router.get('/performance/health', (_req, res) => {
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
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to check performance health',
      error: (error as Error).message
    });
  }
});

export default router;