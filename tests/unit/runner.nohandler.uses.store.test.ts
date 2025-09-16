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
    const spy = jest.spyOn(store, 'updateStep');
    const { runStep } = await import('../../src/worker/runner');
    const run = await store.createRun({ goal: 'no-handler' }) as any;
    const runId = run.id || String(run);
    // tool that has no handler
    const step = await store.createStep(runId, 'unknown', 'tool:not-implemented', {}) as any;
    const stepId = step.id || String(step);
    await expect(runStep(runId, stepId)).rejects.toBeTruthy();
    expect(spy).toHaveBeenCalled();
    const updated = await store.getStep(stepId) as any;
    expect(String(updated.status).toLowerCase()).toBe('failed');
  });
});

