import type { Express } from 'express';
import { store } from '../../lib/store';
import { supabase, ARTIFACT_BUCKET } from '../../lib/supabase';
import { getSettings, type Settings } from '../../lib/settings';
import { listModels, type ModelRow } from '../../lib/models';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  app.get('/ui/runs', async (_req, res) => {
    const rows = await store.listRuns(100);
    res.render('runs', { runs: rows });
  });
  // Place the 'new' route BEFORE the ':id' route to avoid param capture
  app.get('/ui/runs/new', async (_req, res) => {
    res.render('new_run');
  });
  app.get('/ui/runs/:id', async (req, res) => {
    const runId = req.params.id;
    const run = await store.getRun(runId);
    if (!run) {
      // Graceful fallback if run not yet persisted (FS lag) or missing
      return res.render('run', { run: { id: runId, status: 'queued' }, artifacts: [], gates: [] });
    }
    const artifacts = await store.listArtifactsByRun(runId);
    const gates = await store.listGatesByRun(runId);
    res.render('run', { run, artifacts, gates });
  });
  app.get('/ui/settings', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    let settings: Settings | null = null; let models: ModelRow[] = [];
    try { settings = await getSettings(); } catch {}
    try { models = await listModels(); } catch {}
    res.render('settings', { preloaded: { settings, models } });
  });
  app.get('/ui/dev', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    res.render('dev_settings');
  });
  app.get('/ui/models', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    res.render('models');
  });
  app.get('/ui/artifacts/signed', async (req, res) => {
    const pth = String(req.query.path || '');
    if (store.driver === 'fs') {
      const full = require('node:path').join(process.cwd(), 'local_data', pth.replace(/^\/+/, ''));
      return res.sendFile(full, (err: unknown) => { if (err) res.status(404).send('not found'); });
    }
    const { data, error } = await supabase.storage.from(ARTIFACT_BUCKET).createSignedUrl(pth, 3600);
    if (error || !data) return res.status(404).send('not found');
    res.redirect(data.signedUrl);
  });
}
