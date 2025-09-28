import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { isAdmin } from '../../../src/lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  const id = req.query.id as string;
  const approvedBy = req.body?.approved_by || 'local-user';
  const reason = typeof req.body?.reason === 'string'
    ? String(req.body.reason).slice(0, 500)
    : undefined;

  try {
    // Find gate by scanning run gates (fs driver)
    const runs = await store.listRuns(50);
    type GateLite = { id: string; run_id: string };
    let found: GateLite | null = null;

    for (const run of runs) {
      const runId = String(run.id);
      const gateRows = await store.listGatesByRun(runId);
      const gateMatch = gateRows.find((g) => g.id === id);
      if (gateMatch) {
        found = { id: gateMatch.id, run_id: gateMatch.run_id };
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'gate not found' });
    }

    const updated = await store.updateGate(id, {
      run_id: found.run_id,
      status: 'waived',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    });

    await recordEvent(found.run_id, 'gate.waived', {
      gateId: id,
      approvedBy,
      reason,
    });

    return res.json(updated);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to waive gate';
    return res.status(500).json({ error: message });
  }
}