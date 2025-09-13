import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query<T = any>(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res as { rows: T[] };
}
