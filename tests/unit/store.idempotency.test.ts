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
    const factories = await import('../../src/testing/factories');
    const run = await factories.makeRun(store, { goal: 'test' });
    const key = 'k1';
    const primary = await factories.makeStep(store, {
      runId: run.id,
      name: 's1',
      tool: 'codegen',
      inputs: { a: 1 },
      idempotencyKey: key,
    });
    const duplicate = await store.createStep(run.id, 's1', 'codegen', { a: 1 }, key);
    const duplicateId = duplicate?.id ?? primary.id;
    const byKey = await store.getStepByIdempotencyKey(run.id, key);
    expect(primary.id).toBeDefined();
    expect(duplicateId).toBe(primary.id);
    expect(byKey?.id).toBe(primary.id);
  });

  test('inboxMarkIfNew enforces exactly-once', async () => {
    const { store } = await import('../../src/lib/store');
    const ok1 = await store.inboxMarkIfNew('x:1');
    const ok2 = await store.inboxMarkIfNew('x:1');
    expect(ok1).toBe(true);
    expect(ok2).toBe(false);
  });
});
