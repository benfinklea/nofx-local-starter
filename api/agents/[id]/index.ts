import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../../src/lib/auth';
import { getAgent } from '../../../src/lib/registry';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentId = req.query.id;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'agent id required' });
  }

  try {
    const agent = await getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'agent not found' });
    }
    return res.json({ agent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load agent';
    return res.status(500).json({ error: message });
  }
}
