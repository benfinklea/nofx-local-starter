import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { isAdmin } from '../../../src/lib/auth';
import { withCors } from '../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  const originalRunId = req.query.id as string;

  try {
    // Get the original run details
    const originalRun = await store.getRun(originalRunId);
    if (!originalRun) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Create a new run with the same plan
    const plan = originalRun.plan || {};
    const projectId = originalRun.project_id || 'default';

    const newRun = await store.createRun(plan, projectId);
    const newRunId = String(newRun.id);

    // Record event for the new run
    await recordEvent(newRunId, "run.created", {
      plan,
      originalRunId
    });

    // Return the new run ID
    return res.json({
      id: newRunId,
      originalRunId,
      message: 'Rerun created successfully'
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create rerun';
    return res.status(500).json({ error: message });
  }
});
