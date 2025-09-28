import type { VercelRequest, VercelResponse } from '@vercel/node';
import { retryStep, StepNotFoundError } from '../../../../../src/lib/runRecovery';
import { isAdmin } from '../../../../../src/lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  const runId = req.query.id as string;
  const stepId = req.query.stepId as string;

  try {
    await retryStep(runId, stepId);
    return res.status(202).json({ ok: true });
  } catch (err) {
    if (err instanceof StepNotFoundError) {
      return res.status(404).json({ error: 'step not found' });
    }
    const message = err instanceof Error ? err.message : 'failed to retry step';
    return res.status(500).json({ error: message });
  }
}