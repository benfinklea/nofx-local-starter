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
    const factories = await import('../../src/testing/factories');
    const run = await factories.makeRun(store, { goal: 'hash' });
    const step = await factories.makeStep(store, { runId: run.id, name: 's1', tool: 'codegen' });
    const content = '# hello\n';
    const artifactPath = await saveArtifact(run.id, step.id, 'README.md', content, 'text/markdown');
    const artifacts = await store.listArtifactsByRun(run.id);
    const row = artifacts.find((a) => a.path === artifactPath);
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    expect(row?.metadata?.sha256).toBe(sha);
  });
});
