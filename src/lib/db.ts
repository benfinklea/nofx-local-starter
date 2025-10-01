import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
import { metrics } from './metrics';
import { log } from './logger';

// Supabase serverless configuration
// Critical for Vercel + Supabase: https://supabase.com/docs/guides/database/connecting-to-postgres
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // CRITICAL: Serverless functions should use minimal connections
  // Each function invocation gets its own pool, so max=1 is optimal
  max: 1,

  // Allow pool to close when function ends (prevents connection leaking)
  allowExitOnIdle: true,

  // Close idle connections after 30 seconds
  idleTimeoutMillis: 30000,

  // Timeout for acquiring connection from pool
  connectionTimeoutMillis: 5000,

  // Query timeouts (prevent long-running queries)
  statement_timeout: 30000,  // 30 seconds
  query_timeout: 30000,
});

// Connection monitoring and error handling
pool.on('error', (err) => {
  log.error({ err }, 'Unexpected database pool error');
  console.error('Database pool error:', err);
});

pool.on('connect', () => {
  log.info({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  }, 'Database connection established');
});

pool.on('remove', () => {
  log.info({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  }, 'Database connection removed');
});

// Validate DATABASE_URL uses Supabase transaction pooler
if (process.env.DATABASE_URL) {
  const isPooler = process.env.DATABASE_URL.includes('pooler.supabase.com');
  const isPort6543 = process.env.DATABASE_URL.includes(':6543');

  if (!isPooler || !isPort6543) {
    console.warn('⚠️  DATABASE_URL may not be using Supabase transaction pooler');
    console.warn('   Expected: pooler.supabase.com:6543');
    console.warn('   Current:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown');
    console.warn('   This can cause "prepared statement does not exist" errors in production');
  }
}

if (process.env.NODE_ENV === 'test') {
  const registry = (globalThis as any).__NOFX_TEST_POOLS__ || new Set<Pool>();
  registry.add(pool);
  (globalThis as any).__NOFX_TEST_POOLS__ = registry;
}

const txContext = new AsyncLocalStorage<PoolClient>();

function getRunner(): Pool | PoolClient {
  const client = txContext.getStore();
  return client || pool;
}

async function runQuery<T extends QueryResultRow = QueryResultRow>(client: Pool | PoolClient, text: string, params?: any[]): Promise<QueryResult<T>> {
  if ('query' in client) {
    return client.query<T>(text, params);
  }
  // Fallback for unexpected shapes; should not happen but keeps types happy
  return (client as Pool).query<T>(text, params);
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const runner = getRunner();
  const start = Date.now();
  try {
    const res = await runQuery<T>(runner, text, params);
    const latencyMs = Date.now() - start;
    try { metrics.dbQueryDuration.observe({ op: 'query' }, latencyMs); } catch {}
    // Avoid logging SQL text to prevent leaking sensitive data
    log.info({ status: 'ok', latencyMs }, 'db.query');
    return res as { rows: T[] };
  } catch (err) {
    const latencyMs = Date.now() - start;
    try { metrics.dbQueryDuration.observe({ op: 'query' }, latencyMs); } catch {}
    log.error({ status: 'error', latencyMs, err }, 'db.query.error');
    throw err;
  }
}

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const existingClient = txContext.getStore();
  if (existingClient) {
    // Nested transaction: reuse existing client.
    return fn();
  }

  const client = await pool.connect();
  return txContext.run(client, async () => {
    let committed = false;
    try {
      await client.query('BEGIN');
      const result = await fn();
      await client.query('COMMIT');
      committed = true;
      return result;
    } catch (err) {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch (rollbackErr) {
          log.error({ rollbackErr }, 'db.tx.rollback.error');
        }
      }
      throw err;
    } finally {
      client.release();
    }
  });
}
