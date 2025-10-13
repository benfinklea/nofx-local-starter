import { Pool } from 'pg';
import IORedis from 'ioredis';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let envReady = true;
let sharedPool: Pool | null = null; // Shared pool across all tests
let store: typeof import('../../src/lib/store').store;
let queue: typeof import('../../src/lib/queue');
let factories: typeof import('../../src/testing/factories');

beforeAll(async () => {
  // Unmock ioredis for this integration test
  jest.unmock('ioredis');

  // Ensure modules reload with DB/Redis drivers
  jest.resetModules();
  process.env.DATA_DRIVER = 'db';
  process.env.QUEUE_DRIVER = 'redis';
  process.env.DATABASE_URL = DB_URL;
  process.env.REDIS_URL = REDIS_URL;
  process.env.INTEGRATION_TEST = '1';

  // Create a single shared pool for all tests
  sharedPool = new Pool({
    connectionString: DB_URL,
    max: 5, // Allow multiple connections for better performance
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  try {
    await sharedPool.query('select 1');
    console.log('✅ Database pool initialized and warmed up');
  } catch (error) {
    envReady = false;
    console.error('⚠️ Failed to connect to database:', error);
    await sharedPool.end().catch(() => {});
    sharedPool = null;
  }

  const redis = new IORedis(REDIS_URL, { lazyConnect: true });
  try {
    await redis.connect();
  } catch {
    envReady = false;
  } finally {
    try {
      redis.disconnect();
    } catch {}
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
  if (envReady && sharedPool) {
    try {
      await sharedPool.query('truncate nofx.outbox;');
      await sharedPool.query('truncate nofx.inbox;');
      await sharedPool.query('truncate nofx.step cascade;');
      await sharedPool.query('truncate nofx.run cascade;');
      console.log('✅ Database cleanup completed');
    } catch (error) {
      // ignore cleanup failures in teardown
      console.warn('⚠️ Database cleanup failed (non-critical):', error);
    } finally {
      await sharedPool.end().catch(() => {});
      console.log('✅ Database pool closed');
    }

    // Clean up queue if it was loaded
    if (queue) {
      try {
        // Import a fresh IORedis to avoid module issues
        const { default: FreshIORedis } = await import('ioredis');
        const { Queue } = await import('bullmq');
        // Create an IORedis connection instance
        const connection = new FreshIORedis(REDIS_URL);
        const q = new Queue(queue.STEP_READY_TOPIC, { connection });
        await q.drain(true);
        await q.close();
        await connection.quit();
      } catch (error) {
        // Ignore queue cleanup failures in teardown
        console.warn('⚠️ Queue cleanup failed (non-critical):', error);
      }
    }
  }

  jest.unmock('ioredis'); // Unmock before resetting modules
  jest.resetModules();
  delete process.env.DATA_DRIVER;
  delete process.env.QUEUE_DRIVER;
  delete process.env.INTEGRATION_TEST;
});

test('DB + Redis drivers persist events and enqueue reliably', async () => {
  if (!envReady || !sharedPool) {
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
  const counts = await queue.getCounts(queue.STEP_READY_TOPIC) as any;
  // Job might be waiting, delayed, or already active if a worker picked it up
  expect(counts.waiting + counts.delayed + counts.active).toBeGreaterThan(0);

  // Verify DB reflects new status and inbox has been cleared/reset
  const refreshedStep = await store.getStep(step.id);
  expect(refreshedStep).toBeDefined();
  expect(String(refreshedStep?.status ?? '').toLowerCase()).toBe('queued');

  // Reuse the shared pool instead of creating a new one
  const inbox = await sharedPool.query<{ key: string }>('select key from nofx.inbox where key = $1', [`step-exec:${step.id}`]);
  expect(inbox.rowCount).toBe(0);
  const outbox = await sharedPool.query<{ topic: string }>('select topic from nofx.outbox order by created_at desc limit 1');
  expect(outbox.rowCount).toBeGreaterThan(0);
});
