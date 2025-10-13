import dotenv from "dotenv";
dotenv.config();
import { subscribe, STEP_READY_TOPIC, OUTBOX_TOPIC } from "../lib/queue";
import { runStep, markStepTimedOut } from "./runner";
import { log } from "../lib/logger";
import fs from 'node:fs';
import path from 'node:path';
import IORedis from 'ioredis';
import { runWithContext } from '../lib/observability';
import { store } from "../lib/store";
import crypto from 'node:crypto';
import { startOutboxRelay } from './relay';
import { initTracing } from '../lib/tracing';
import { shouldEnableDevRestartWatch } from '../lib/devRestart';
import { startHealthServer, incrementProcessed, incrementErrors } from './health';

const STEP_TIMEOUT_MS = Number(process.env.STEP_TIMEOUT_MS || 30000);
initTracing('nofx-worker').catch(()=>{});
const devRestartWatch = shouldEnableDevRestartWatch();
function hashInputs(val: any) {
  return crypto.createHash('sha256').update(JSON.stringify(val || {})).digest('hex').slice(0, 12);
}

subscribe(STEP_READY_TOPIC, async ({ runId, stepId, idempotencyKey, __attempt }) => {
  const attemptNum = Number(__attempt);
  const retryCount = Number.isNaN(attemptNum) || attemptNum < 1 ? 0 : Math.max(0, attemptNum - 1);
  return runWithContext({ runId, stepId, retryCount }, async () => {
    log.info({ runId, stepId, attempt: __attempt }, "worker handling step");
    // Compute or use provided idempotency key, and guard via inbox
    let key = String(idempotencyKey || '');
    let marked = false;
    try {
      if (!key) {
        const step = await store.getStep(stepId);
        if (step) key = `${runId}:${(step as any).name}:${hashInputs((step as any).inputs)}`;
      }
    } catch {}
    if (key) {
      const isNew = await store.inboxMarkIfNew(key).catch(()=> true);
      if (!isNew) { log.info({ key }, 'inbox.duplicate.ignored'); return; }
      marked = true;
    }
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeout = new Promise((_res, rej) => {
      timeoutHandle = setTimeout(() => rej(new Error('step timeout')), STEP_TIMEOUT_MS);
    });
    try {
      await Promise.race([ runStep(runId, stepId), timeout ]);
      await store.outboxAdd(OUTBOX_TOPIC, { type: 'step.succeeded', runId, stepId }).catch(() => {});
      incrementProcessed(); // Track successful job
    } catch (err: any) {
      incrementErrors(); // Track errors
      if (err && typeof err.message === 'string' && err.message.toLowerCase() === 'step timeout') {
        await markStepTimedOut(runId, stepId, STEP_TIMEOUT_MS);
      }
      await store.outboxAdd(OUTBOX_TOPIC, {
        type: 'step.failed',
        runId,
        stepId,
        error: (err && typeof err.message === 'string') ? err.message : String(err)
      }).catch(() => {});
      throw err;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (marked && key) {
        await store.inboxDelete(key).catch(() => {});
      }
    }
  });
});

log.info("Worker up");
// Start outbox relay daemon
startOutboxRelay();

// Start health check server
if (process.env.HEALTH_CHECK_ENABLED !== 'false') {
  startHealthServer().catch(err => {
    log.error({ error: err }, 'Failed to start health check server');
  });
}

const shouldHeartbeat =
  (process.env.QUEUE_DRIVER || '').toLowerCase() !== 'memory' &&
  process.env.REDIS_URL &&
  process.env.REDIS_URL !== 'memory';

if (shouldHeartbeat) {
  try {
    const hb = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
    const key = 'nofx:worker:heartbeat';
    setInterval(async () => {
      try { await hb.set(key, String(Date.now()), 'EX', 10); } catch {}
    }, 3000);
  } catch {}
}

// Dev-only restart watcher to exit when flag changes
if (devRestartWatch) {
  const flagPath = path.join(process.cwd(), '.dev-restart-worker');
  const startedAt = Date.now();
  let last = 0;
  // Clean up stale flag from previous run
  try { const st = fs.statSync(flagPath); if (st.mtimeMs <= startedAt) fs.unlinkSync(flagPath); } catch {}
  setInterval(() => {
    try {
      const stat = fs.statSync(flagPath);
      const m = stat.mtimeMs;
      if (m > startedAt && m > last) { last = m; log.info('Dev restart flag changed; exiting worker'); process.exit(0); }
    } catch {}
  }, 1500);
}
