/**
 * Development Admin Route - For local testing only
 * Bypasses authentication for super admin dashboard testing
 */

import { Router, Request, Response } from 'express';
import { performanceMonitor } from '../../lib/performance-monitor';
import { benchmarkRunner } from '../../lib/benchmarks';

const router = Router();

// Only available in development
if (process.env.NODE_ENV !== 'production') {
  /**
   * Development settings page (no auth required for testing)
   */
  router.get('/settings', async (_req: Request, res: Response): Promise<void> => {
    try {
      const { getSettings } = require('../../lib/settings');
      const { listModels } = require('../../lib/models');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let settings: any = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let models: any[] = [];

      try { settings = await getSettings(); } catch {}
      try { models = await listModels(); } catch {}

      res.render('settings', { preloaded: { settings, models } });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load settings page',
        message: (error as Error).message
      });
    }
  });

  /**
   * Development super admin dashboard (no auth required for testing)
   */
  router.get('/super-admin', (_req: Request, res: Response): void => {
    try {
      const summary = performanceMonitor.getSummary();
      const isHealthy = performanceMonitor.isHealthy();
      const suites = benchmarkRunner.listSuites();

      res.render('super-admin-dashboard', {
        title: 'NOFX Super Admin Dashboard (DEV)',
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
   * Development info route
   */
  router.get('/info', (_req: Request, res: Response): void => {
    res.json({
      message: 'Development admin routes active',
      environment: 'development',
      routes: [
        'GET /dev/super-admin - Super admin dashboard (no auth)',
        'Note: These routes are only available in development mode'
      ],
      warning: 'These routes will not be available in production'
    });
  });
}

export default router;
