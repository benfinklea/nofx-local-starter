import type { Express } from 'express';
import { query } from '../../lib/db';
import { recordEvent } from '../../lib/events';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  // List gates for a run
  app.get('/runs/:id/gates', async (req, res) => {
    const runId = req.params.id;
    const rows = await query<any>(`select * from nofx.gate where run_id=$1 order by created_at asc`, [runId]);
    res.json(rows.rows);
  });

  // Create a gate explicitly (optional; manual handler also auto-creates)
  app.post('/gates', async (req, res) => {
    const { run_id, step_id, gate_type } = req.body || {};
    if (!run_id || !gate_type) return res.status(400).json({ error: 'run_id and gate_type required' });
    const r = await query<any>(
      `insert into nofx.gate (run_id, step_id, gate_type, status) values ($1,$2,$3,'pending') returning *`,
      [run_id, step_id || null, gate_type]
    );
    await recordEvent(run_id, 'gate.created', { gate: r.rows[0] }, step_id || undefined);
    res.status(201).json(r.rows[0]);
  });

  // Approve a gate
  app.post('/gates/:id/approve', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const id = req.params.id;
    const approvedBy = req.body?.approved_by || 'local-user';
    const r = await query<any>(
      `update nofx.gate set status='passed', approved_by=$2, approved_at=now() where id=$1 returning *`,
      [id, approvedBy]
    );
    const gate = r.rows[0];
    if (!gate) return res.status(404).json({ error: 'not found' });
    await recordEvent(gate.run_id, 'gate.approved', { gateId: gate.id, approvedBy });
    res.json(gate);
  });

  // Waive a gate
  app.post('/gates/:id/waive', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const id = req.params.id;
    const approvedBy = req.body?.approved_by || 'local-user';
    const r = await query<any>(
      `update nofx.gate set status='waived', approved_by=$2, approved_at=now() where id=$1 returning *`,
      [id, approvedBy]
    );
    const gate = r.rows[0];
    if (!gate) return res.status(404).json({ error: 'not found' });
    await recordEvent(gate.run_id, 'gate.waived', { gateId: gate.id, approvedBy });
    res.json(gate);
  });
}
