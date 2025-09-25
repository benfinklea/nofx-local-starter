import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildPlanFromPrompt } from '../../src/api/planBuilder';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
}