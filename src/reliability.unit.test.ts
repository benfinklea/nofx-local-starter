import crypto from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { enqueue, listDlq, rehydrateDlq, STEP_DLQ_TOPIC, STEP_READY_TOPIC, subscribe } from './lib/queue';
import type { EventRow, RunRow, StepRow } from './lib/store';
import { markStepTimedOut } from './worker/runner';
import { retryStep } from './lib/runRecovery';
import type { StoreApi } from './testing/factories';
import { makeRun, makeStep, makeStepReadyPayload } from './testing/factories';

let store: StoreApi;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Workstream 01 — Reliability', () => {
  beforeAll(async () => {
    process.env.QUEUE_DRIVER = 'memory';
    process.env.DATA_DRIVER = 'fs';
    store = (await import('./lib/store')).store;
    const hashInputs = (value: StepRow['inputs'] | undefined) =>
      crypto.createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex').slice(0, 12);

    subscribe(STEP_READY_TOPIC, async ({ runId, stepId, idempotencyKey }) => {
      const step = await store.getStep(stepId);
      let key = idempotencyKey ?? '';
      if (!key && step) {
        key = `${runId}:${step.name}:${hashInputs(step.inputs)}`;
      }
      if (key) {
        const isNew = await store.inboxMarkIfNew(key).catch(() => true);
        if (!isNew) return;
      }
      if (!step) {
        return;
      }
      if (step.tool === 'test:fail') {
        throw new Error('fail');
      }
      await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString() });
      await store.recordEvent(runId, 'step.started', {}, stepId);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  it('idempotent enqueue/execute: duplicate deliveries ignored', async () => {
    const run = await makeRun(store, { goal: 'idempotency' });
    const step = await makeStep(store, { runId: run.id, name: 'echo', inputs: { foo: 'bar' } });

    const payload = makeStepReadyPayload({ runId: run.id, stepId: step.id, attempt: 1 });
    await enqueue(STEP_READY_TOPIC, payload);
    await enqueue(STEP_READY_TOPIC, payload);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const events = await store.listEvents(run.id) as EventRow[];
    const started = events.filter((event) => event.step_id === step.id && event.type === 'step.started');
    expect(started.length).toBe(1);
  });

  it('moves to DLQ after max retries', async () => {
    const run = await makeRun(store, { goal: 'dlq' });
    const step = await makeStep(store, { runId: run.id, name: 'boom', tool: 'test:fail', inputs: { x: 1 } });

    await enqueue(STEP_READY_TOPIC, makeStepReadyPayload({ runId: run.id, stepId: step.id, attempt: 4 }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    const items = await listDlq(STEP_DLQ_TOPIC);
    const found = items.some((item) => {
      if (typeof item !== 'object' || item === null) return false;
      const record = item as Record<string, unknown>;
      return record['stepId'] === step.id || record['step_id'] === step.id;
    });
    expect(items.length).toBeGreaterThan(0);
    expect(found).toBeTruthy();

    const n = await rehydrateDlq(STEP_DLQ_TOPIC, 10);
    expect(n).toBeGreaterThan(0);
  });

  it('concurrent duplicate deliveries still start only once', async () => {
    process.env.WORKER_CONCURRENCY = '8';
    const run = await makeRun(store, { goal: 'concurrency' });
    const step = await makeStep(store, { runId: run.id, name: 'echo-many', inputs: { a: 1 } });

    const bursts = Array.from({ length: 20 }, () =>
      enqueue(STEP_READY_TOPIC, makeStepReadyPayload({ runId: run.id, stepId: step.id, attempt: 1 })),
    );
    await Promise.all(bursts);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const events = await store.listEvents(run.id) as EventRow[];
    const started = events.filter((event) => event.step_id === step.id && event.type === 'step.started');
    expect(started.length).toBe(1);
  });

  it('marks step timed_out and records events without clobbering success', async () => {
    const run = await makeRun(store, { goal: 'timeout' });
    const step = await makeStep(store, { runId: run.id, name: 'long', inputs: { a: 1 } });

    await markStepTimedOut(run.id, step.id, 1234);

    const updated = await store.getStep(step.id);
    expect(updated).toBeDefined();
    expect(String(updated?.status).toLowerCase()).toBe('timed_out');
    expect(updated?.outputs).toMatchObject({ error: 'timeout', timeoutMs: 1234 });
    const runRow = await store.getRun(run.id) as RunRow;
    expect(String(runRow.status).toLowerCase()).toBe('failed');
    const events = (await store.listEvents(run.id)) as EventRow[];
    const timeoutEvent = events.find((event) => event.type === 'step.timeout');
    expect(timeoutEvent).toBeTruthy();
  });

  it('retryStep resets state and re-enqueues work', async () => {
    const run = await makeRun(store, { goal: 'retry' });
    const step = await makeStep(store, { runId: run.id, name: 'needs-retry', inputs: { a: 1 } });
    const nowIso = new Date().toISOString();
    await store.updateStep(step.id, { status: 'failed', ended_at: nowIso, outputs: { error: 'boom' } });
    await store.updateRun(run.id, { status: 'failed', ended_at: nowIso });

    const queueModule = await import('./lib/queue');
    const spy = vi.spyOn(queueModule, 'enqueue');

    await retryStep(run.id, step.id);

    const refreshed = await store.getStep(step.id);
    expect(String(refreshed?.status).toLowerCase()).toBe('queued');
    expect(refreshed?.ended_at ?? undefined).toBeUndefined();
    expect(refreshed?.outputs).toEqual({});
    const runRow = await store.getRun(run.id) as RunRow;
    expect(String(runRow.status).toLowerCase()).toBe('queued');
    const events = (await store.listEvents(run.id)) as EventRow[];
    expect(events.some((event) => event.type === 'step.retry')).toBe(true);
    expect(events.some((event) => event.type === 'run.resumed')).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      STEP_READY_TOPIC,
      makeStepReadyPayload({ runId: run.id, stepId: step.id, attempt: 1 }),
    );
  });
});
