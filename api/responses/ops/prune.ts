import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../src/lib/auth';
import {
  pruneResponsesOlderThanDays,
  getResponsesOperationsSummary
} from '../../../src/services/responses/runtime';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'admin required' });
  }

  try {
    const schema = z.object({ days: z.number().int().positive().max(365) });
    const parsed = schema.parse({
      days: typeof req.body?.days !== 'undefined'
        ? Number(req.body.days)
        : Number(req.query?.days ?? 0),
    });

    pruneResponsesOlderThanDays(parsed.days);

    return res.json({ ok: true, summary: getResponsesOperationsSummary() });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'prune failed'
    });
  }
}