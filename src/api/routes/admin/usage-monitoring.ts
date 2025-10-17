/**
 * Admin API: Usage Monitoring
 * Endpoints for triggering and managing usage monitoring
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../../auth/middleware';
import { monitorAllUsersUsage } from '../../../services/usage/usageMonitoring';
import { log } from '../../../lib/logger';

const router = Router();

/**
 * Trigger usage monitoring for all users
 * POST /admin/usage-monitoring/check-all
 */
router.post('/check-all', requireAuth, async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check
    // For now, any authenticated user can trigger (should be admin only in production)

    log.info({ userId: req.userId }, 'Manual usage monitoring triggered');

    const results = await monitorAllUsersUsage();

    res.json({
      success: true,
      message: 'Usage monitoring completed',
      results: {
        usersChecked: results.checked,
        warningsSent: results.warned,
        errors: results.errors,
      },
    });
  } catch (error) {
    log.error({ error, userId: req.userId }, 'Error triggering usage monitoring');
    res.status(500).json({
      success: false,
      error: 'Failed to trigger usage monitoring',
    });
  }
});

/**
 * Health check endpoint for cron jobs
 * GET /admin/usage-monitoring/health
 */
router.get('/health', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'usage-monitoring',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Cron endpoint (for Vercel Cron or similar)
 * GET /admin/usage-monitoring/cron
 *
 * Add this to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/admin/usage-monitoring/cron",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
router.get('/cron', async (req: Request, res: Response) => {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
      log.warn({ ip: req.ip }, 'Unauthorized cron request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    log.info('Cron usage monitoring triggered');

    const results = await monitorAllUsersUsage();

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        checked: results.checked,
        warned: results.warned,
        errors: results.errors,
      },
    });
  } catch (error) {
    log.error({ error }, 'Error in cron usage monitoring');
    return res.status(500).json({
      success: false,
      error: 'Cron job failed',
    });
  }
});

export default router;
