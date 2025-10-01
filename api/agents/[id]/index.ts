import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../../src/lib/auth';
import { getAgent, deleteAgent } from '../../../src/lib/registry';
import { withCors } from '../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  const agentId = req.query.id;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'agent id required' });
  }

  try {
    if (req.method === 'GET') {
      const agent = await getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'agent not found' });
      }
      return res.json({ agent });
    }

    if (req.method === 'DELETE') {
      await deleteAgent(agentId);
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return res.status(500).json({ error: message });
  }
});
