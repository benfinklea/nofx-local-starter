import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../src/lib/auth';
import { store } from '../../src/lib/store';
import { recordEvent } from '../../src/lib/events';
import { withCors } from '../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_ADMIN === 'true';
  if (!isDev && !isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { run_id, step_id, gate_type } = req.body || {};

  if (!run_id || !gate_type) {
    return res.status(400).json({ error: 'run_id and gate_type required' });
  }

  try {
    const g = await store.createOrGetGate(run_id, step_id || '', gate_type as string);
    await recordEvent(run_id, 'gate.created', { gate: g }, step_id || undefined);
    return res.status(201).json(g);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create gate';
    return res.status(500).json({ error: message });
  }
});
