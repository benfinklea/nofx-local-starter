import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type DatabaseStatus =
  | { status: 'ok'; error?: string }
  | { status: 'error'; error: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let databaseStatus: DatabaseStatus = { status: 'error', error: 'Not configured' };

  // Check database connection
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    try {
      // Simple query to check database connectivity
      // Try the public view first, then fall back to nofx schema
      const { error } = await supabase
        .from('runs')
        .select('id')
        .limit(1);

      if (error) {
        databaseStatus = { status: 'error', error: error.message };
      } else {
        databaseStatus = { status: 'ok' };
      }
    } catch (err) {
      databaseStatus = { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.VERCEL_ENV || 'development',
    node_version: process.version,
    database: databaseStatus
  };

  return res.status(200).json(health);
}
