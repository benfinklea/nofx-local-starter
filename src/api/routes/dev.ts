import type { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  app.post('/dev/restart', async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' });
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    try {
      const apiFlag = path.join(process.cwd(), '.dev-restart-api');
      const workerFlag = path.join(process.cwd(), '.dev-restart-worker');
      const now = String(Date.now());
      fs.writeFileSync(apiFlag, now);
      fs.writeFileSync(workerFlag, now);
      res.json({ ok: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'restart failed';
      res.status(500).json({ error: message });
    }
  });
}
