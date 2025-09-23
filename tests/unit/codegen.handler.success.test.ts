import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

jest.mock('../../src/tools/codegen', () => ({
  codegenReadme: jest.fn(async () => ({
    content: '# Generated\n',
    provider: 'stub-provider',
    model: 'stub-model',
    usage: { inputTokens: 10, outputTokens: 20 }
  }))
}));

jest.mock('../../src/lib/settings', () => ({
  getSettings: jest.fn(async () => ({
    approvals: { dbWrites: 'dangerous', allowWaive: true },
    gates: { typecheck: false, lint: false, unit: false, coverageThreshold: 0.9 },
    llm: {
      order: { codegen: ['openai','anthropic','gemini'], reasoning: ['anthropic','openai','gemini'], docs: ['gemini','anthropic','openai'] },
      modelOrder: { codegen: [], reasoning: [], docs: [] },
      providers: {},
      pricing: { openai: { inputPer1M: 1000, outputPer1M: 2000 } }
    },
    ops: { backupIntervalMin: 0 }
  }))
}));

jest.mock('../../src/lib/models', () => ({
  getModelByName: jest.fn(async () => ({
    name: 'stub-model',
    provider: 'openai',
    kind: 'openai',
    input_per_1m: 1500,
    output_per_1m: 2500,
    active: true
  }))
}));

describe('Codegen handler', () => {
  const cwd = process.cwd();
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nofx-codegen-test-'));
    process.chdir(tmp);
    process.env.DATA_DRIVER = 'fs';
    process.env.QUEUE_DRIVER = 'memory';
    process.env.LOAD_ALL_HANDLERS = '1';
    jest.resetModules();
  });

  afterAll(() => {
    process.chdir(cwd);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  });

  test('completes run and records artifact output', async () => {
    const { store } = await import('../../src/lib/store');
    const { loadHandlers } = await import('../../src/worker/handlers/loader');
    expect(loadHandlers().some((handler) => handler.match('codegen'))).toBe(true);
    const { runStep } = await import('../../src/worker/runner');
    const factories = await import('../../src/testing/factories');
    const run = await factories.makeRun(store, { goal: 'test' });
    const step = await factories.makeStep(store, { runId: run.id, name: 'generate', tool: 'codegen' });

    await runStep(run.id, step.id);

    const finished = await store.getStep(step.id);
    expect(String(finished?.status ?? '').toLowerCase()).toBe('succeeded');
    const outputs = (finished?.outputs ?? {}) as Record<string, unknown>;
    expect(outputs.artifact).toBeTruthy();

    const artifacts = await store.listArtifactsByRun(run.id);
    expect(artifacts.length).toBeGreaterThan(0);
  });
});
