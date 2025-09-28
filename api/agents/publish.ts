import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { publishAgent } from '../../src/lib/registry';
import { store } from '../../src/lib/store';
import type { PublishAgentRequest } from '../../packages/shared/src/agents';

const CapabilitySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional()
});

const PublishSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  manifest: z.record(z.any()).default({}),
  version: z.string().min(1),
  capabilities: z.array(CapabilitySchema).optional(),
  tags: z.array(z.string()).optional(),
  sourceCommit: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = PublishSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data as PublishAgentRequest;
  const inboxKey = `registry:agent:${payload.agentId}:${payload.version}`;
  let marked = false;

  try {
    marked = await store.inboxMarkIfNew(inboxKey);
  } catch (err) {
    // If inbox fails, log a warning but continue to attempt publish for resilience
    console.warn('Failed to mark agent publish inbox key', err);
  }

  if (marked === false) {
    return res.status(202).json({ status: 'skipped', reason: 'duplicate' });
  }

  try {
    const agent = await publishAgent(payload);
    return res.status(201).json({ agent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to publish agent';
    return res.status(500).json({ error: message });
  } finally {
    if (marked) {
      store.inboxDelete(inboxKey).catch(() => {
        // best-effort cleanup
      });
    }
  }
}
