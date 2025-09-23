import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe('runner uses store.updateStep for no-handler case', () => {
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

  test('marks step failed via store.updateStep', async () => {
    const modStore = await import('../../src/lib/store');
    const store = modStore.store;
    const factories = await import('../../src/testing/factories');
    const spy = jest.spyOn(store, 'updateStep');
    const { runStep } = await import('../../src/worker/runner');
    const run = await factories.makeRun(store, { goal: 'no-handler' });
    const step = await factories.makeStep(store, {
      runId: run.id,
      name: 'unknown',
      tool: 'tool:not-implemented',
    });
    await expect(runStep(run.id, step.id)).rejects.toBeTruthy();
    expect(spy).toHaveBeenCalled();
    const updated = await store.getStep(step.id);
    expect(String(updated?.status ?? '').toLowerCase()).toBe('failed');
  });
});
