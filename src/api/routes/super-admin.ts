/**
 * Super Admin Routes - Only accessible to ben@volacci.com
 * Protected admin-only functionality and monitoring tools
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../auth/middleware';
import { performanceMonitor } from '../../lib/performance-monitor';
import {
  benchmarkRunner,
  exportBenchmarkResults
} from '../../lib/benchmarks';

const router = Router();

// Super admin email check middleware
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireSuperAdmin(req: any, res: Response, next: any): void {
  const userEmail = req.user?.email || req.session?.user?.email;

  if (userEmail !== 'ben@volacci.com') {
    res.status(403).json({
      error: 'Access denied',
      message: 'Super admin access required'
    });
    return;
  }

  next();
}

// Apply auth middleware to all routes
router.use(requireAuth);
router.use(requireSuperAdmin);

/**
 * Super Admin Dashboard - Main admin interface
 */
router.get('/dashboard', (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = performanceMonitor.getSummary();
    const isHealthy = performanceMonitor.isHealthy();
    const suites = benchmarkRunner.listSuites();

    res.render('super-admin-dashboard', {
      title: 'NOFX Super Admin Dashboard',
      summary,
      isHealthy,
      suites,
      userEmail: 'ben@volacci.com',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load admin dashboard',
      message: (error as Error).message
    });
  }
});

/**
 * Get all performance data (admin view)
 */
router.get('/performance/full', (_req: Request, res: Response): Promise<void> => {
  try {
    const current = performanceMonitor.getCurrentSnapshot();
    const summary = performanceMonitor.getSummary();
    const snapshots = performanceMonitor.getSnapshots(200);
    const suites = benchmarkRunner.listSuites();

    res.json({
      status: 'success',
      data: {
        current,
        summary,
        snapshots,
        benchmarkSuites: suites,
        healthy: performanceMonitor.isHealthy()
      },
      admin: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get full performance data',
      message: (error as Error).message
    });
  }
});

/**
 * Run performance benchmarks (admin only)
 */
router.post('/benchmarks/run', async (req: Request, res: Response): Promise<void> => {
  try {
    const { suiteName, description } = req.body;

    // This would trigger a benchmark run
    // For now, return success message
    res.json({
      status: 'success',
      message: `Benchmark suite '${suiteName}' scheduled to run`,
      data: {
        suiteName,
        description,
        scheduledBy: 'ben@volacci.com',
        scheduledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to run benchmarks',
      message: (error as Error).message
    });
  }
});

/**
 * Export all performance data
 */
router.post('/export/performance', (_req: Request, res: Response): Promise<void> => {
  try {
    // Export benchmark results
    exportBenchmarkResults();

    const summary = performanceMonitor.getSummary();
    const snapshots = performanceMonitor.getSnapshots(1000);

    const exportData = {
      exportedBy: 'ben@volacci.com',
      exportedAt: new Date().toISOString(),
      summary,
      snapshots,
      benchmarks: 'Exported to benchmarks/results/ directory'
    };

    res.json({
      status: 'success',
      message: 'Performance data exported successfully',
      data: exportData
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export performance data',
      message: (error as Error).message
    });
  }
});

/**
 * System control - Reset performance monitoring
 */
router.post('/system/reset-performance', (_req: Request, res: Response): Promise<void> => {
  try {
    performanceMonitor.reset();
    benchmarkRunner.clear();

    res.json({
      status: 'success',
      message: 'Performance monitoring data reset',
      resetBy: 'ben@volacci.com',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset performance data',
      message: (error as Error).message
    });
  }
});

/**
 * Get system information (admin view)
 */
router.get('/system/info', (_req: Request, res: Response): Promise<void> => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    res.json({
      status: 'success',
      data: {
        process: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          uptime: uptime * 1000,
          memoryUsage,
          cpuUsage
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT,
          databaseUrl: process.env.DATABASE_URL ? 'Connected' : 'Not configured',
          redisUrl: process.env.REDIS_URL ? 'Connected' : 'Not configured'
        },
        performance: {
          monitoring: performanceMonitor.isHealthy(),
          summary: performanceMonitor.getSummary()
        }
      },
      admin: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system info',
      message: (error as Error).message
    });
  }
});

/**
 * Update performance thresholds (admin only)
 */
router.post('/performance/thresholds', (req: Request, res: Response): Promise<void> => {
  try {
    const thresholds = req.body;
    performanceMonitor.updateThresholds(thresholds);

    res.json({
      status: 'success',
      message: 'Performance thresholds updated',
      data: thresholds,
      updatedBy: 'ben@volacci.com',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update thresholds',
      message: (error as Error).message
    });
  }
});

export default router;
