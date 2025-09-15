import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
import { metrics } from './metrics';
import { log } from './logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
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
