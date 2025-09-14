import type { Express } from 'express';
import { query } from '../../lib/db';
import { supabase, ARTIFACT_BUCKET } from '../../lib/supabase';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  app.get('/ui/runs', async (_req, res) => {
    const rows = await query<any>(`select id,status,created_at from nofx.run order by created_at desc limit 100`);
    res.render('runs', { runs: rows.rows });
  });
  // Place the 'new' route BEFORE the ':id' route to avoid param capture
  app.get('/ui/runs/new', async (_req, res) => {
    res.render('new_run');
  });
  app.get('/ui/runs/:id', async (req, res) => {
    const runId = req.params.id;
    const run = await query<any>(`select * from nofx.run where id = $1`, [runId]);
    const artifacts = await query<any>(
      `select a.*, a.path as uri, s.name as step_name from nofx.artifact a join nofx.step s on s.id = a.step_id where s.run_id = $1`, [runId]
    );
    const gates = await query<any>(`select * from nofx.gate where run_id=$1 order by created_at asc`, [runId]);
    res.render('run', { run: run.rows[0], artifacts: artifacts.rows, gates: gates.rows });
  });
  app.get('/ui/settings', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    res.render('settings');
  });
  app.get('/ui/models', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    res.render('models');
  });
  app.get('/ui/artifacts/signed', async (req, res) => {
    const path = String(req.query.path || '');
    const { data, error } = await supabase.storage.from(ARTIFACT_BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return res.status(404).send('not found');
    res.redirect(data.signedUrl);
  });
}
