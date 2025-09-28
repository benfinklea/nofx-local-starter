import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBackup, listBackups } from '../../src/lib/backup';
import { isAdmin } from '../../src/lib/auth';
import { withCors } from '../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  if (req.method === 'GET') {
    // List all backups
    try {
      const rows = await listBackups();
      return res.json(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to list backups';
      return res.status(500).json({ error: message });
    }
  } else if (req.method === 'POST') {
    // Create a new backup
    try {
      const note = (req.body && (req.body.note || req.body.message)) || undefined;
      const scope = (req.body && req.body.scope) || 'data';
      const meta = await createBackup(note, scope);
      return res.status(201).json(meta);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ error: msg });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
});
