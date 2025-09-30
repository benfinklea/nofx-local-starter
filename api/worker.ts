/**
 * Vercel Serverless Worker Function
 * Processes queued steps from the database/queue
 * Triggered by Vercel Cron or manual invocation
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runStep } from '../src/worker/runner';
import { log } from '../src/lib/logger';
import { store } from '../src/lib/store';

// Security: Only allow cron jobs or authenticated requests
function isAuthorized(req: VercelRequest): boolean {
  // Allow Vercel cron jobs
  if (req.headers['x-vercel-cron'] === '1') {
    return true;
  }

  // Allow manual trigger with secret key
  const secret = process.env.WORKER_SECRET || process.env.ADMIN_PASSWORD;
  const providedSecret = req.headers['x-worker-secret'] || req.query.secret;

  return Boolean(secret && providedSecret === secret);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Security check
    if (!isAuthorized(req)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Worker can only be triggered by Vercel Cron or with valid secret'
      });
    }

    const startTime = Date.now();
    const maxProcessingTime = 50000; // 50 seconds (Vercel has 60s limit)
    const batchSize = Number(process.env.WORKER_BATCH_SIZE || 10);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    log.info({ batchSize, trigger: req.headers['x-vercel-cron'] ? 'cron' : 'manual' }, 'Worker triggered');

    // Get pending steps from database
    const { query } = await import('../src/lib/db');
    const pendingSteps = await query(
      `SELECT s.id, s.run_id
       FROM nofx.step s
       JOIN nofx.run r ON r.id = s.run_id
       WHERE s.status = 'pending'
       AND r.status IN ('pending', 'running')
       ORDER BY s.created_at ASC
       LIMIT $1`,
      [batchSize]
    );

    if (!pendingSteps || !pendingSteps.rows || pendingSteps.rows.length === 0) {
      log.info('No pending steps to process');
      return res.status(200).json({
        success: true,
        processed: 0,
        message: 'No pending steps'
      });
    }

    // Process steps one at a time (can parallelize later)
    for (const step of pendingSteps.rows) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > maxProcessingTime) {
        log.warn({ processed }, 'Approaching timeout, stopping processing');
        break;
      }

      try {
        // Mark step as running
        await store.updateStep(step.id, { status: 'running' });

        // Execute step
        await runStep(step.run_id, step.id);

        succeeded++;
        processed++;
        log.info({
          runId: step.run_id,
          stepId: step.id
        }, 'Step processed successfully');
      } catch (error: unknown) {
        failed++;
        processed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${step.id}: ${errorMsg}`);
        log.error({ error, runId: step.run_id, stepId: step.id }, 'Step processing failed');
      }
    }

    const duration = Date.now() - startTime;

    log.info({
      processed,
      succeeded,
      failed,
      duration,
      remaining: pendingSteps.rows.length - processed
    }, 'Worker batch completed');

    return res.status(200).json({
      success: true,
      processed,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration,
      hasMore: pendingSteps.rows.length >= batchSize
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error({ error }, 'Worker function failed');

    return res.status(500).json({
      success: false,
      error: errorMsg
    });
  }
}
