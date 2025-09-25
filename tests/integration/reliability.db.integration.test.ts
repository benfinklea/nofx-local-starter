import { Pool } from 'pg';
import IORedis from 'ioredis';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let envReady = true;
let store: typeof import('../../src/lib/store').store;
let queue: typeof import('../../src/lib/queue');
let factories: typeof import('../../src/testing/factories');

beforeAll(async () => {
  // Ensure modules reload with DB/Redis drivers
  jest.resetModules();
  process.env.DATA_DRIVER = 'db';
  process.env.QUEUE_DRIVER = 'redis';
  process.env.DATABASE_URL = DB_URL;
  process.env.REDIS_URL = REDIS_URL;
  process.env.INTEGRATION_TEST = '1';

  const pool = new Pool({ connectionString: DB_URL });
  try {
    await pool.query('select 1');
  } catch {
    envReady = false;
  } finally {
    await pool.end().catch(() => {});
  }

  const redis = new IORedis(REDIS_URL, { lazyConnect: true });
  try {
    await redis.connect();
  } catch {
    envReady = false;
  } finally {
    redis.disconnect();
  }

  if (!envReady) {
    console.warn('⚠️  Skipping DB/Redis integration tests; services unavailable');
    return;
  }

  ({ store } = await import('../../src/lib/store'));
  queue = await import('../../src/lib/queue');
  factories = await import('../../src/testing/factories');
});

afterAll(async () => {
  // Clean up persistent state when tests actually ran
  if (envReady) {
    const pool = new Pool({ connectionString: DB_URL });
    try {
      await pool.query('truncate nofx.outbox;');
      await pool.query('truncate nofx.inbox;');
      await pool.query('truncate nofx.step cascade;');
      await pool.query('truncate nofx.run cascade;');
    } catch {
      // ignore cleanup failures in teardown
    } finally {
      await pool.end().catch(() => {});
    }

    const { Queue } = await import('bullmq');
    const q = new Queue(queue.STEP_READY_TOPIC, { connection: { url: REDIS_URL } });
    await q.drain(true);
    await q.close();
  }

  jest.resetModules();
  delete process.env.DATA_DRIVER;
  delete process.env.QUEUE_DRIVER;
  delete process.env.INTEGRATION_TEST;
});

test('DB + Redis drivers persist events and enqueue reliably', async () => {
  if (!envReady) {
    console.warn('Skipping DB/Redis integration scenario; services unavailable');
    return;
  }

  const run = await factories.makeRun(store, { goal: 'db-integration' });
  const step = await factories.makeStep(store, {
    runId: run.id,
    name: 'codegen',
    tool: 'test:echo',
    inputs: { ping: 'pong' },
  });

  await store.updateStep(step.id, { status: 'failed', ended_at: new Date().toISOString(), outputs: { error: 'boom' } });
  await store.updateRun(run.id, { status: 'failed', ended_at: new Date().toISOString() });

  const { retryStep } = await import('../../src/lib/runRecovery');
  await retryStep(run.id, step.id);

  // Verify queue received job via Redis adapter
  const counts = await queue.getCounts(queue.STEP_READY_TOPIC) as { waiting: number; delayed: number };
  expect(counts.waiting + counts.delayed).toBeGreaterThan(0);

  // Verify DB reflects new status and inbox has been cleared/reset
  const refreshedStep = await store.getStep(step.id);
  expect(refreshedStep).toBeDefined();
  expect(String(refreshedStep?.status ?? '').toLowerCase()).toBe('queued');
  const pool = new Pool({ connectionString: DB_URL });
  try {
    const inbox = await pool.query<{ key: string }>('select key from nofx.inbox where key = $1', [`step-exec:${step.id}`]);
    expect(inbox.rowCount).toBe(0);
    const outbox = await pool.query<{ topic: string }>('select topic from nofx.outbox order by created_at desc limit 1');
    expect(outbox.rowCount).toBeGreaterThan(0);
  } finally {
    await pool.end().catch(() => {});
  }
});
