import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from '../src/lib/store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { runId } = req.query;
    
    if (!runId || typeof runId !== 'string') {
      return res.status(400).json({ error: 'runId query parameter required' });
    }

    const run = await store.getRun(runId);
    
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const steps = await store.listStepsByRun(runId);
    
    return res.json({ 
      ...run,
      steps
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Unknown error' });
  }
}
