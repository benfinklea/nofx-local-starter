import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe('Policy enforcement', () => {
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

  test('denies tool not in allowlist', async () => {
    const { store } = await import('../../src/lib/store');
    const { runStep } = await import('../../src/worker/runner');
    const factories = await import('../../src/testing/factories');
    const run = await factories.makeRun(store, { goal: 'policy' });
    const step = await factories.makeStep(store, {
      runId: run.id,
      name: 's1',
      tool: 'codegen',
      inputs: { _policy: { tools_allowed: ['manual:approve'] } },
    });
    await runStep(run.id, step.id).catch(() => {});
    const refreshed = await store.getStep(step.id);
    expect(String(refreshed?.status ?? '').toLowerCase()).toBe('failed');
  });
});
