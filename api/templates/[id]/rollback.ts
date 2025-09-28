import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../src/lib/auth';
import { rollbackTemplate } from '../../../src/lib/registry';
import { withCors } from '../../_lib/cors';
import { recordRegistryUsage } from '../../_lib/billingUsage';

const BodySchema = z.object({
  targetVersion: z.string().min(1)
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const templateId = req.query.id;
  if (!templateId || typeof templateId !== 'string') {
    return res.status(400).json({ error: 'template id required' });
  }

  const parsed = BodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const template = await rollbackTemplate(templateId, parsed.data.targetVersion);
    await recordRegistryUsage(req, 'registry:template:rollback', {
      templateId,
      targetVersion: parsed.data.targetVersion
    });
    return res.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to rollback template';
    const status = message.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});
