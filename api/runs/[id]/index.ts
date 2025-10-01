import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../../src/lib/auth';
import { store } from '../../../src/lib/store';
import { withCors } from '../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_ADMIN === 'true';
  if (!isDev && !isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runId = req.query.id as string;

  try {
    const run = await store.getRun(runId);
    if (!run) {
      return res.status(404).json({ error: 'not found' });
    }

    const steps = await store.listStepsByRun(runId);
    const artifacts = await store.listArtifactsByRun(runId);

    return res.json({ run, steps, artifacts });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get run details';
    return res.status(500).json({ error: message });
  }
});
