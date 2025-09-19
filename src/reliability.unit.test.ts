import { describe, it, expect, beforeAll } from 'vitest';
import { enqueue, STEP_READY_TOPIC, listDlq, STEP_DLQ_TOPIC, rehydrateDlq, subscribe } from './lib/queue';
let store: typeof import('./lib/store').store;
import crypto from 'node:crypto';

describe('Workstream 01 — Reliability', () => {
  beforeAll(async () => {
    process.env.QUEUE_DRIVER = 'memory';
    process.env.DATA_DRIVER = 'fs';
    store = (await import('./lib/store')).store;
    // Minimal subscriber to emulate worker inbox semantics for tests
    const STEP_TIMEOUT_MS = 2000;
    function hashInputs(val: any) {
      return crypto.createHash('sha256').update(JSON.stringify(val || {})).digest('hex').slice(0, 12);
    }
    subscribe(STEP_READY_TOPIC, async ({ runId, stepId, idempotencyKey, __attempt }: any) => {
      let key = String(idempotencyKey || '');
      if (!key) {
        const st = await store.getStep(stepId);
        if (st) key = `${runId}:${(st as any).name}:${hashInputs((st as any).inputs)}`;
      }
      if (key) {
        const isNew = await store.inboxMarkIfNew(key).catch(()=> true);
        if (!isNew) return;
      }
      const st = await store.getStep(stepId);
      const tool = (st as any)?.tool;
      if (tool === 'test:fail') {
        throw new Error('fail');
      }
      // echo success
      await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString() });
      await store.recordEvent(runId, 'step.started', {}, stepId);
      await new Promise(r => setTimeout(r, 10));
    });
  });

  it('idempotent enqueue/execute: duplicate deliveries ignored', async () => {
    const run = await store.createRun({ goal: 'idempotency', steps: [] });
    const runId = (run as any).id || String(run);
    const step = await store.createStep(runId, 'echo', 'test:echo', { foo: 'bar' });
    const stepId = (step as any).id || String(step);

    // Enqueue the same delivery twice
    await enqueue(STEP_READY_TOPIC, { runId, stepId, __attempt: 1 });
    await enqueue(STEP_READY_TOPIC, { runId, stepId, __attempt: 1 });

    // Wait for processing
    await new Promise(r => setTimeout(r, 200));

    const ev = await store.listEvents(runId);
    const started = ev.filter((e: any) => e.step_id === stepId && e.type === 'step.started');
    expect(started.length).toBe(1);
  });

  it('moves to DLQ after max retries', async () => {
    const run = await store.createRun({ goal: 'dlq', steps: [] });
    const runId = (run as any).id || String(run);
    const step = await store.createStep(runId, 'boom', 'test:fail', { x: 1 });
    const stepId = (step as any).id || String(step);

    // Force immediate DLQ by simulating next-failure beyond backoff schedule
    await enqueue(STEP_READY_TOPIC, { runId, stepId, __attempt: 4 });
    await new Promise(r => setTimeout(r, 100));

    const items = await listDlq(STEP_DLQ_TOPIC);
    const found = (items as any[]).some((p: any) => p && p.stepId === stepId || p?.step_id === stepId);
    expect(items.length).toBeGreaterThan(0);
    expect(found).toBeTruthy();

    // Rehydrate back to ready queue
    const n = await rehydrateDlq(STEP_DLQ_TOPIC, 10);
    expect(n).toBeGreaterThan(0);
  });

  it('concurrent duplicate deliveries still start only once', async () => {
    process.env.WORKER_CONCURRENCY = '8';
    const run = await store.createRun({ goal: 'concurrency', steps: [] });
    const runId = (run as any).id || String(run);
    const step = await store.createStep(runId, 'echo-many', 'test:echo', { a: 1 });
    const stepId = (step as any).id || String(step);

    // Fire many enqueues for the same step
    const bursts = Array.from({ length: 20 }, () => enqueue(STEP_READY_TOPIC, { runId, stepId, __attempt: 1 }));
    await Promise.all(bursts);
    await new Promise(r => setTimeout(r, 300));

    const ev = await store.listEvents(runId);
    const started = ev.filter((e: any) => e.step_id === stepId && e.type === 'step.started');
    expect(started.length).toBe(1);
  });
});
