import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

describe('Artifact hashing', () => {
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

  test('saveArtifact stores sha256 in metadata', async () => {
    const { store } = await import('../../src/lib/store');
    const { saveArtifact } = await import('../../src/lib/artifacts');
    const run = await store.createRun({ goal: 'hash' }) as any;
    const runId = run.id || String(run);
    const step = await store.createStep(runId, 's1', 'codegen', {}) as any;
    const stepId = step.id || String(step);
    const content = '# hello\n';
    const p = await saveArtifact(runId, stepId, 'README.md', content, 'text/markdown');
    const arts = await store.listArtifactsByRun(runId) as any[];
    const row = arts.find(a => a.path === p);
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    expect(row?.metadata?.sha256).toBe(sha);
  });
});

