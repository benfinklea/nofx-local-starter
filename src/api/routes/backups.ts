import type { Express } from 'express';
import { createBackup, listBackups, restoreBackup } from '../../lib/backup';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  app.get('/backups', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const rows = await listBackups();
    res.json(rows);
  });
  app.post('/backups', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const note = (req.body && (req.body.note || req.body.message)) || undefined;
    const scope = (req.body && req.body.scope) || 'data';
    try { const meta = await createBackup(note, scope); res.status(201).json(meta); }
    catch(e: unknown){ const msg = e instanceof Error ? e.message : String(e); res.status(500).json({ error: msg }); }
  });
  app.post('/backups/:id/restore', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    try { const meta = await restoreBackup(req.params.id); res.json({ ok: true, meta }); }
    catch(e: unknown){ const msg = e instanceof Error ? e.message : String(e); res.status(500).json({ error: msg }); }
  });
}
