import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { validateAgent } from '../../src/lib/registry';
import { withCors } from '../_lib/cors';

const CapabilitySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional()
});

const ValidateSchema = z.object({
  agentId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  manifest: z.record(z.any()).optional(),
  version: z.string().optional(),
  capabilities: z.array(CapabilitySchema).optional(),
  tags: z.array(z.string()).optional(),
  sourceCommit: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = ValidateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await validateAgent({
    agentId: parsed.data.agentId ?? '',
    name: parsed.data.name ?? '',
    description: parsed.data.description,
    manifest: parsed.data.manifest ?? {},
    version: parsed.data.version ?? '',
    capabilities: parsed.data.capabilities,
    tags: parsed.data.tags,
    sourceCommit: parsed.data.sourceCommit,
    metadata: parsed.data.metadata
  });

  return res.json(result);
});
