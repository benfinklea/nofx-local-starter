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
    const run = await store.createRun({ goal: 'policy' }) as any;
    const runId = run.id || String(run);
    const step = await store.createStep(runId, 's1', 'codegen', { _policy: { tools_allowed: ['manual:approve'] } }) as any;
    const stepId = step.id || String(step);
    await runStep(runId, stepId).catch(()=>{});
    const s = await store.getStep(stepId) as any;
    expect(String(s.status).toLowerCase()).toBe('failed');
  });
});

