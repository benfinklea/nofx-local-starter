import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
import { metrics } from './metrics';
import { log } from './logger';

// Environment-aware database connection pool configuration
// Optimized for both serverless (Vercel) and local development environments
const isProduction = process.env.NODE_ENV === 'production';
const isServerless = Boolean(process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Connection pool sizing based on environment
// Serverless: max=1 (each invocation gets its own pool)
// Development: max=10 (shared pool for all requests)
// This improves local development performance by 5-10x
const poolConfig = {
  connectionString: process.env.DATABASE_URL,

  // CRITICAL: Serverless functions should use minimal connections
  // Each function invocation gets its own pool, so max=1 is optimal
  // Local development benefits from more connections for concurrent requests
  max: isServerless ? 1 : (parseInt(process.env.DB_POOL_SIZE || '10', 10)),

  // Minimum pool size (only for non-serverless)
  min: isServerless ? 0 : 2,

  // Allow pool to close when function ends (prevents connection leaking)
  // Only for serverless - keep connections alive in development
  allowExitOnIdle: isServerless ? true : false,

  // Close idle connections after timeout
  // Serverless: 30s (quick cleanup)
  // Development: 5 minutes (avoid reconnection overhead)
  idleTimeoutMillis: isServerless ? 30000 : 300000,

  // Timeout for acquiring connection from pool
  connectionTimeoutMillis: 5000,

  // Query timeouts (prevent long-running queries)
  statement_timeout: 30000,  // 30 seconds
  query_timeout: 30000,
};

export const pool = new Pool(poolConfig);

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

    // Record metrics
    try {
      metrics.dbQueryDuration.observe({ op: 'query' }, latencyMs);
    } catch {}

    // Performance monitoring: log slow queries
    // Thresholds: WARN at 100ms, ERROR at 500ms
    const queryPreview = text.substring(0, 100).replace(/\s+/g, ' ').trim();
    const rowCount = res.rows.length;

    if (latencyMs > 500) {
      // Critical slow query - needs immediate attention
      log.error({
        status: 'critical_slow',
        latencyMs,
        rowCount,
        queryPreview,
        threshold: 500
      }, 'db.query.critical-slow');
    } else if (latencyMs > 100) {
      // Warning slow query - should be optimized
      log.warn({
        status: 'slow',
        latencyMs,
        rowCount,
        queryPreview,
        threshold: 100
      }, 'db.query.slow');
    } else if (latencyMs > 50 || process.env.DB_LOG_ALL === '1') {
      // Info level for queries above 50ms or when verbose logging enabled
      log.info({
        status: 'ok',
        latencyMs,
        rowCount
      }, 'db.query');
    }

    return res as { rows: T[] };
  } catch (err) {
    const latencyMs = Date.now() - start;
    try {
      metrics.dbQueryDuration.observe({ op: 'query' }, latencyMs);
    } catch {}

    // Log error with query preview (first 100 chars, sanitized)
    const queryPreview = text.substring(0, 100).replace(/\s+/g, ' ').trim();
    log.error({
      status: 'error',
      latencyMs,
      err,
      queryPreview
    }, 'db.query.error');
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
