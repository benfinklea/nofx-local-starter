import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../../src/lib/auth';
import { retryResponsesRun } from '../../../../src/services/responses/runtime';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'admin required' });
  }

  const runId = req.query.id as string;

  try {
    const schema = z.object({
      tenantId: z.string().optional(),
      metadata: z.record(z.string()).optional(),
      background: z.boolean().optional(),
    });

    const parsed = schema.parse(req.body ?? {});

    const result = await retryResponsesRun(runId, {
      tenantId: parsed.tenantId,
      metadata: parsed.metadata,
      background: parsed.background,
    });

    return res.json(result);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'retry failed'
    });
  }
}