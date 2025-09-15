import dotenv from "dotenv";
dotenv.config();
import { subscribe, STEP_READY_TOPIC, OUTBOX_TOPIC } from "../lib/queue";
import { runStep } from "./runner";
import { log } from "../lib/logger";
import fs from 'node:fs';
import path from 'node:path';
import IORedis from 'ioredis';
import { runWithContext } from '../lib/observability';
import { store } from "../lib/store";
import crypto from 'node:crypto';
import { startOutboxRelay } from './relay';
import { initTracing } from '../lib/tracing';

const STEP_TIMEOUT_MS = Number(process.env.STEP_TIMEOUT_MS || 30000);
initTracing('nofx-worker').catch(()=>{});
function hashInputs(val: any) {
  return crypto.createHash('sha256').update(JSON.stringify(val || {})).digest('hex').slice(0, 12);
}

subscribe(STEP_READY_TOPIC, async ({ runId, stepId, idempotencyKey, __attempt }: any) => {
  return runWithContext({ runId, stepId, retryCount: Math.max(0, Number(__attempt || 1) - 1) }, async () => {
    log.info({ runId, stepId, attempt: __attempt }, "worker handling step");
    // Compute or use provided idempotency key, and guard via inbox
    let key = String(idempotencyKey || '');
    try {
      if (!key) {
        const step = await store.getStep(stepId);
        if (step) key = `${runId}:${(step as any).name}:${hashInputs((step as any).inputs)}`;
      }
    } catch {}
    if (key) {
      const isNew = await store.inboxMarkIfNew(key).catch(()=> true);
      if (!isNew) { log.info({ key }, 'inbox.duplicate.ignored'); return; }
    }
    const timeout = new Promise((_res, rej) => setTimeout(() => rej(new Error('step timeout')), STEP_TIMEOUT_MS));
    try {
      await Promise.race([ runStep(runId, stepId), timeout ]);
      await store.outboxAdd(OUTBOX_TOPIC, { type: 'step.succeeded', runId, stepId });
    } catch (err: any) {
      await store.outboxAdd(OUTBOX_TOPIC, { type: 'step.failed', runId, stepId, error: err?.message || String(err) });
      throw err;
    }
  });
});

log.info("Worker up");
// Start outbox relay daemon
startOutboxRelay();

// Heartbeat to Redis for diagnostics
try {
  const hb = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
  const key = 'nofx:worker:heartbeat';
  setInterval(async () => {
    try { await hb.set(key, String(Date.now()), 'EX', 10); } catch {}
  }, 3000);
} catch {}

// Dev-only restart watcher to exit when flag changes
if (process.env.DEV_RESTART_WATCH === '1') {
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
