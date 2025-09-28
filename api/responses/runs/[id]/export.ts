import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../../src/lib/auth';
import { exportResponsesRun } from '../../../../src/services/responses/runtime';
import { withCors } from '../../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'admin required' });
  }

  const runId = req.query.id as string;

  try {
    // exportResponsesRun only takes runId and returns a string
    const result = await exportResponsesRun(runId);

    return res.json({ data: result });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'export failed'
    });
  }
});
