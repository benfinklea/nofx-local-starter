import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../../src/lib/auth';
import { listResponseIncidents } from '../../../src/services/responses/runtime';
import { withCors } from '../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'admin required' });
  }

  try {
    const status = typeof req.query.status === 'string'
      ? (req.query.status as 'open' | 'resolved')
      : 'open';
    const incidents = listResponseIncidents(status);
    return res.json({ incidents });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'failed to list incidents'
    });
  }
});
