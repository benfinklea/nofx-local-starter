import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../../../src/lib/auth';
import { resolveResponseIncident } from '../../../../../src/services/responses/runtime';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req as any)) {
    return res.status(401).json({ error: 'admin required' });
  }

  const incidentId = req.query.id as string;

  try {
    const schema = z.object({
      resolvedBy: z.string().min(1),
      notes: z.string().optional(),
      disposition: z.enum(['retry', 'dismissed', 'escalated', 'manual']).optional(),
      linkedRunId: z.string().optional(),
    });

    const parsed = schema.parse(req.body ?? {});

    const incident = resolveResponseIncident({
      incidentId,
      resolvedBy: parsed.resolvedBy,
      notes: parsed.notes,
      disposition: parsed.disposition,
      linkedRunId: parsed.linkedRunId,
    });

    return res.json({ incident });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'failed to resolve incident'
    });
  }
}