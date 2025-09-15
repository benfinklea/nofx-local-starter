import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe('MemoryQueueAdapter retries + DLQ', () => {
  const cwd = process.cwd();
  let tmp:string;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nofx-test-'));
    process.chdir(tmp);
    process.env.DATA_DRIVER = 'fs';
    process.env.QUEUE_DRIVER = 'memory';
    jest.resetModules();
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
    process.chdir(cwd);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  });

  test('job retries and lands in DLQ after max attempts', async () => {
    const { MemoryQueueAdapter } = await import('../../src/lib/queue/MemoryAdapter');
    const q = new MemoryQueueAdapter();
    // subscribe with handler that always throws
    q.subscribe('step.ready', async () => { throw new Error('boom'); });
    await q.enqueue('step.ready', { runId: 'r1', stepId: 's1', __attempt: 1 });
    // backoff schedule [0, 2000, 5000, 10000]; run timers enough to pass all
    jest.advanceTimersByTime(0); // first attempt
    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(5000);
    jest.advanceTimersByTime(10000);
    // allow microtasks
    await Promise.resolve();
    const items = await q.listDlq('step.dlq');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

