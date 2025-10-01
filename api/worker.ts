/**
 * Vercel Serverless Worker Function
 * Processes queued steps from the database/queue
 * Triggered by Vercel Cron or manual invocation
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Security: Only allow cron jobs or authenticated requests
function isAuthorized(req: VercelRequest): boolean {
  // Allow Vercel cron jobs (check multiple possible headers)
  if (req.headers['x-vercel-cron'] === '1') {
    return true;
  }

  // Vercel also uses this authorization header for cron jobs
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
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

    console.log('Worker triggered', { batchSize, trigger: req.headers['x-vercel-cron'] ? 'cron' : 'manual' });

    // Lazy load dependencies to avoid module issues
    const { query } = await import('../src/lib/db');
    const { store } = await import('../src/lib/store');
    const { runStep } = await import('../src/worker/runner');

    // Get pending steps from database
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
      console.log('No pending steps to process');
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
        console.warn('Approaching timeout, stopping processing', { processed });
        break;
      }

      try {
        // Mark step as running
        await store.updateStep(step.id, { status: 'running' });

        // Execute step
        await runStep(step.run_id, step.id);

        succeeded++;
        processed++;
        console.log('Step processed successfully', {
          runId: step.run_id,
          stepId: step.id
        });
      } catch (error: unknown) {
        failed++;
        processed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${step.id}: ${errorMsg}`);
        console.error('Step processing failed', { error, runId: step.run_id, stepId: step.id });
      }
    }

    const duration = Date.now() - startTime;

    console.log('Worker batch completed', {
      processed,
      succeeded,
      failed,
      duration,
      remaining: pendingSteps.rows.length - processed
    });

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
    console.error('Worker function failed', { error });

    return res.status(500).json({
      success: false,
      error: errorMsg
    });
  }
}
