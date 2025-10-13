import type { Express } from 'express';
import { store } from '../../lib/store';
import { recordEvent } from '../../lib/events';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  // List gates for a run
  app.get('/runs/:id/gates', async (req, res): Promise<void> => {
    const runId = req.params.id;
    const rows = await store.listGatesByRun(runId);
    return res.json(rows);
  });

  // Create a gate explicitly (optional; manual handler also auto-creates)
  app.post('/gates', async (req, res): Promise<void> => {
    const { run_id, step_id, gate_type } = req.body || {};
    if (!run_id || !gate_type) return res.status(400).json({ error: 'run_id and gate_type required' });
    const g = await store.createOrGetGate(run_id, step_id || '', gate_type as string);
    await recordEvent(run_id, 'gate.created', { gate: g }, step_id || undefined);
    return res.status(201).json(g);
  });

  // Approve a gate
  app.post('/gates/:id/approve', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const id = req.params.id;
    const approvedBy = req.body?.approved_by || 'local-user';
    const reason = typeof req.body?.reason === 'string' ? String(req.body.reason).slice(0,500) : undefined;
    // Find gate by scanning run gates (fs driver); for db we rely on update by id via store
    // For simplicity, ask client to also provide run_id when approving in fs mode.
    // Fallback: try to locate gate across recent runs.
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
    if (!found) return res.status(404).json({ error: 'not found' });
    await store.updateGate(id, { status: 'passed', run_id: found.run_id, approved_by: approvedBy });
    const gate = { id, run_id: found.run_id, status: 'passed' } as { id: string; run_id: string; status: string };
    if (!gate) return res.status(404).json({ error: 'not found' });
    await recordEvent(gate.run_id, 'gate.approved', { gateId: gate.id, approvedBy, reason });
    return res.json(gate);
  });

  // Waive a gate
  app.post('/gates/:id/waive', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const id = req.params.id;
    const approvedBy = req.body?.approved_by || 'local-user';
    const reason = typeof req.body?.reason === 'string' ? String(req.body.reason).slice(0,500) : undefined;
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
    if (!found) return res.status(404).json({ error: 'not found' });
    await store.updateGate(id, { status: 'waived', run_id: found.run_id, approved_by: approvedBy });
    const gate = { id, run_id: found.run_id, status: 'waived' } as { id: string; run_id: string; status: string };
    if (!gate) return res.status(404).json({ error: 'not found' });
    await recordEvent(gate.run_id, 'gate.waived', { gateId: gate.id, approvedBy, reason });
    return res.json(gate);
  });
}
