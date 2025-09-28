import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from '../../../src/lib/store';
import { withCors } from '../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runId = req.query.id as string;

  try {
    const events = await store.listEvents(runId);
    return res.json(events);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get timeline';
    return res.status(500).json({ error: message });
  }
});
