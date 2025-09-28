import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../../src/lib/auth';
import { getTemplate } from '../../../src/lib/registry';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const templateId = req.query.id;
  if (!templateId || typeof templateId !== 'string') {
    return res.status(400).json({ error: 'template id required' });
  }

  try {
    const template = await getTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: 'template not found' });
    }
    return res.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load template';
    return res.status(500).json({ error: message });
  }
}
