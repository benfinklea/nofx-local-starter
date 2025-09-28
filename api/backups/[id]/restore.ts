import type { VercelRequest, VercelResponse } from '@vercel/node';
import { restoreBackup } from '../../../src/lib/backup';
import { isAdmin } from '../../../src/lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  const backupId = req.query.id as string;

  try {
    const meta = await restoreBackup(backupId);
    return res.json({ ok: true, meta });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}