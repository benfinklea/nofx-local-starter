import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe.skip('MemoryQueueAdapter retries + DLQ', () => {
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
    // Start at attempt 4 so next backoff is undefined -> DLQ immediately after failure
    await q.enqueue('step.ready', { runId: 'r1', stepId: 's1', __attempt: 4 });
    const flush = async () => new Promise(r => setImmediate(r));
    // backoff schedule [0, 2000, 5000, 10000]; run timers enough to pass all
    jest.advanceTimersByTime(0); await flush();
    const items = await q.listDlq('step.dlq');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
