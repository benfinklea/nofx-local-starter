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
    jest.useRealTimers();
  });
  afterAll(() => {
    process.chdir(cwd);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  });

  test('job retries and lands in DLQ after max attempts', async () => {
    const { MemoryQueueAdapter } = await import('../../src/lib/queue/MemoryAdapter');
    const q = new MemoryQueueAdapter();
    // subscribe with handler that always throws
    q.subscribe('step.ready', async () => { throw new Error('boom'); });
    // Start at attempt 4 so next backoff is undefined -> should go to DLQ immediately
    await q.enqueue('step.ready', { runId: 'r1', stepId: 's1', __attempt: 4 });
    // Wait up to 1s for drain to push to DLQ
    const waitUntil = async (fn: () => Promise<boolean>, ms=1000) => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        if (await fn()) return true;
        await new Promise(r => setTimeout(r, 10));
      }
      return false;
    };
    const ok = await waitUntil(async () => (await q.listDlq('step.dlq')).length > 0, 1000);
    const items = await q.listDlq('step.dlq');
    expect(ok).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
