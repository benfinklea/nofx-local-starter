import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../../src/lib/auth';
import { getResponsesOperationsSummary } from '../../../src/services/responses/runtime';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'admin required' });
  }

  try {
    const summary = getResponsesOperationsSummary();
    return res.json(summary);
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'failed to build summary'
    });
  }
}