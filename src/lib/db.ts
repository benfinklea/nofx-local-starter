import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
import { metrics } from './metrics';
import { log } from './logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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
