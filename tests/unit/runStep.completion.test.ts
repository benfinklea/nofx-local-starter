import fs from 'node:fs/promises';
import path from 'node:path';

import { store } from '../../src/lib/store';
import { StoreFactory } from '../../src/lib/store/StoreFactory';
import { runStep } from '../../src/worker/runner';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'local_data');

async function resetStore() {
  process.env.DATA_DRIVER = 'fs';
  process.env.QUEUE_DRIVER = 'memory';
  StoreFactory.reset();
  await fs.rm(LOCAL_DATA_DIR, { recursive: true, force: true }).catch(() => {});
}

describe('runStep completion semantics', () => {
  beforeEach(async () => {
    await resetStore();
  });

  afterEach(async () => {
    await resetStore();
  });

  it('does not mark run succeeded while planned steps are not yet created', async () => {
    const plan = {
      goal: 'Test multi-step run',
      steps: [
        { name: 'first', tool: 'test:echo' },
        { name: 'second', tool: 'test:echo' }
      ]
    };

    const run = await store.createRun(plan, 'default');
    const firstStep = await store.createStep(run.id, 'first', 'test:echo', {});
    expect(firstStep).toBeDefined();

    await runStep(run.id, firstStep!.id);

    const runAfterFirstStep = await store.getRun(run.id);
    expect(runAfterFirstStep?.status).not.toBe('succeeded');

    const secondStep = await store.createStep(run.id, 'second', 'test:echo', {});
    expect(secondStep).toBeDefined();

    await runStep(run.id, secondStep!.id);

    const finalRun = await store.getRun(run.id);
    expect(finalRun?.status).toBe('succeeded');
  });
});
