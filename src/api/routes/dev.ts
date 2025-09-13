import type { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  app.post('/dev/restart', async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' });
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required' });
    try {
      const flag = path.join(process.cwd(), '.dev-restart');
      fs.writeFileSync(flag, String(Date.now()));
      res.json({ ok: true });
    } catch (e:any) {
      res.status(500).json({ error: e.message });
    }
  });
}

