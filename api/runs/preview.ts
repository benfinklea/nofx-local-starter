import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../src/lib/auth';
import { buildPlanFromPrompt } from '../../src/api/planBuilder';
import { withCors } from '../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_ADMIN === 'true';
  if (!isDev && !isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.body && req.body.standard) {
      const {
        prompt,
        quality = true,
        openPr = false,
        filePath,
        summarizeQuery,
        summarizeTarget
      } = req.body.standard || {};

      const built = await buildPlanFromPrompt(
        String(prompt || '').trim(),
        { quality, openPr, filePath, summarizeQuery, summarizeTarget }
      );

      return res.json({ steps: built.steps, plan: built });
    }

    return res.status(400).json({ error: 'missing standard' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'failed to preview';
    return res.status(400).json({ error: message });
  }
});
