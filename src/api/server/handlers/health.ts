/**
 * Health check handler
 */

import { Request, Response } from 'express';
import { hasSubscribers, getOldestAgeMs, STEP_READY_TOPIC } from '../../../lib/queue';
import { store } from '../../../lib/store';

export async function handleHealthCheck(_req: Request, res: Response) {
  try {
    const timestamp = new Date().toISOString();
    const queueStatus = hasSubscribers(STEP_READY_TOPIC) ? 'active' : 'inactive';
    const queueAge = getOldestAgeMs(STEP_READY_TOPIC);

    // Basic store health check
    let storeStatus = 'unknown';
    try {
      // Try a simple operation to verify store health
      await store.listRuns(1);
      storeStatus = 'healthy';
    } catch (_error) {
      storeStatus = 'unhealthy';
    }

    res.json({
      status: 'ok',
      timestamp,
      queue: {
        status: queueStatus,
        oldestAgeMs: queueAge
      },
      store: {
        status: storeStatus
      }
    });
  } catch (_error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
}