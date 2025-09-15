import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe('store idempotency + inbox', () => {
  const cwd = process.cwd();
  let tmp:string;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nofx-test-'));
    process.chdir(tmp);
    process.env.DATA_DRIVER = 'fs';
    process.env.QUEUE_DRIVER = 'memory';
    jest.resetModules();
  });
  afterAll(() => {
    process.chdir(cwd);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  });

  test('createStep is idempotent for same key', async () => {
    const { store } = await import('../../src/lib/store');
    const run = await store.createRun({ goal: 'test' }) as any;
    const runId: string = run.id || String(run);
    const key = 'k1';
    const a = await store.createStep(runId, 's1', 'codegen', { a: 1 }, key) as any;
    const b = await store.createStep(runId, 's1', 'codegen', { a: 1 }, key) as any;
    const sidA = a.id || String(a); const sidB = b?.id || String(b || '');
    const byKey = await store.getStepByIdempotencyKey(runId, key) as any;
    expect(sidA).toBeDefined();
    expect(sidB === undefined || sidB === sidA).toBeTruthy();
    expect(byKey?.id).toBe(sidA);
  });

  test('inboxMarkIfNew enforces exactly-once', async () => {
    const { store } = await import('../../src/lib/store');
    const ok1 = await store.inboxMarkIfNew('x:1');
    const ok2 = await store.inboxMarkIfNew('x:1');
    expect(ok1).toBe(true);
    expect(ok2).toBe(false);
  });
});

