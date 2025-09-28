import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../src/lib/auth';
import { rollbackAgent } from '../../../src/lib/registry';
import { withCors } from '../../_lib/cors';
import { recordRegistryUsage } from '../../_lib/billingUsage';

const BodySchema = z.object({
  targetVersion: z.string().min(1)
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentId = req.query.id;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'agent id required' });
  }

  const parsed = BodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const agent = await rollbackAgent(agentId, parsed.data.targetVersion);
    await recordRegistryUsage(req, 'registry:agent:rollback', {
      agentId,
      targetVersion: parsed.data.targetVersion
    });
    return res.json({ agent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to rollback agent';
    const status = message.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});
