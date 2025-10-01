/**
 * Google Cloud Run Worker for NOFX Gate Execution
 *
 * This worker runs continuously to process gate steps (typecheck, lint, tests, etc.)
 * that cannot run in Vercel's serverless environment due to:
 * - Read-only file system
 * - 60-second timeout
 * - Missing CLI tools
 *
 * Architecture:
 * - Vercel handles: API, frontend, simple handlers (codegen, bash, etc.)
 * - Cloud Run handles: Gate execution (typecheck, lint, sast, tests)
 * - Both write to same Supabase database
 */

const { query } = require('../lib/db');
const { store } = require('../lib/store');
const { runStep } = require('./runner');

// Configuration
const POLL_INTERVAL_MS = 30000; // Poll every 30 seconds
const BATCH_SIZE = 5; // Process up to 5 gate steps per batch
const MAX_PROCESSING_TIME_MS = 300000; // 5 minutes max per step

// Health check endpoint for Cloud Run
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      worker: 'nofx-cloud-gate-worker',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Cloud Run worker health endpoint listening on port ${PORT}`);
  console.log('Starting continuous gate processing...');
});

/**
 * Process a batch of pending gate steps
 */
async function processBatch() {
  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // Get pending gate steps only
    // Gate steps have tool names like: gate:typecheck, gate:lint, gate:sast, gate:tests
    const pendingSteps = await query(
      `SELECT s.id, s.run_id, s.tool
       FROM nofx.step s
       JOIN nofx.run r ON r.id = s.run_id
       WHERE s.status IN ('pending', 'queued')
       AND s.tool LIKE 'gate:%'
       AND r.status IN ('pending', 'running', 'queued')
       ORDER BY s.created_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (!pendingSteps || !pendingSteps.rows || pendingSteps.rows.length === 0) {
      // No work to do - this is normal
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`Found ${pendingSteps.rows.length} gate steps to process`);

    // Process each gate step
    for (const step of pendingSteps.rows) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > MAX_PROCESSING_TIME_MS) {
        console.warn('Approaching timeout, stopping processing', { processed });
        break;
      }

      try {
        console.log(`Processing gate step: ${step.tool}`, {
          runId: step.run_id,
          stepId: step.id
        });

        // Mark step as running
        await store.updateStep(step.id, { status: 'running' });

        // Execute gate step
        await runStep(step.run_id, step.id);

        succeeded++;
        processed++;
        console.log(`Gate step succeeded: ${step.tool}`, {
          runId: step.run_id,
          stepId: step.id
        });
      } catch (error) {
        failed++;
        processed++;
        console.error(`Gate step failed: ${step.tool}`, {
          error: error.message,
          runId: step.run_id,
          stepId: step.id,
          stack: error.stack
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log('Batch completed', {
      processed,
      succeeded,
      failed,
      duration,
      remaining: pendingSteps.rows.length - processed
    });

    return { processed, succeeded, failed };
  } catch (error) {
    console.error('Batch processing error', {
      error: error.message,
      stack: error.stack
    });
    return { processed: 0, succeeded: 0, failed: 0 };
  }
}

/**
 * Main worker loop - polls continuously for gate steps
 */
async function workerLoop() {
  console.log('Worker loop started');

  const running = true;
  while (running) {
    try {
      await processBatch();
    } catch (error) {
      console.error('Worker loop error', {
        error: error.message,
        stack: error.stack
      });
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the worker loop
workerLoop().catch(error => {
  console.error('Fatal worker error', { error });
  process.exit(1);
});
