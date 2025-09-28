import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../../src/lib/auth';
import { rollbackResponsesRun } from '../../../../src/services/responses/runtime';

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
      sequence: z.number().optional(),
      toolCallId: z.string().optional(),
      operator: z.string().optional(),
      reason: z.string().optional(),
    });

    const parsed = schema.parse(req.body ?? {});

    const result = await rollbackResponsesRun(runId, {
      sequence: parsed.sequence,
      toolCallId: parsed.toolCallId,
      operator: parsed.operator,
      reason: parsed.reason,
    });

    return res.json(result);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'rollback failed'
    });
  }
}