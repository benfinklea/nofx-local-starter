import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../src/lib/auth';
import { deleteModel } from '../../src/lib/models';
import { withCors } from '../../_lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  const modelId = req.query.id as string;

  if (req.method === 'DELETE') {
    // Delete a model
    try {
      await deleteModel(modelId);
      return res.json({ ok: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete model';
      return res.status(500).json({ error: message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
});
