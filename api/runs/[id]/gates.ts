import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from '../../../src/lib/store';
import { withCors } from '../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runId = req.query.id as string;

  try {
    const rows = await store.listGatesByRun(runId);
    return res.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to list gates';
    return res.status(500).json({ error: message });
  }
});
