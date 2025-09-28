import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { publishTemplate } from '../../src/lib/registry';
import { store } from '../../src/lib/store';
import type { PublishTemplateRequest } from '../../packages/shared/src/templates';
import { withCors } from '../_lib/cors';

const PublishSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.record(z.any()).default({}),
  version: z.string().min(1),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = PublishSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data as PublishTemplateRequest;
  const inboxKey = `registry:template:${payload.templateId}:${payload.version}`;
  let marked = false;

  try {
    marked = await store.inboxMarkIfNew(inboxKey);
  } catch (err) {
    console.warn('Failed to mark template publish inbox key', err);
  }

  if (marked === false) {
    return res.status(202).json({ status: 'skipped', reason: 'duplicate' });
  }

  try {
    const template = await publishTemplate(payload);
    return res.status(201).json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to publish template';
    return res.status(500).json({ error: message });
  } finally {
    if (marked) {
      store.inboxDelete(inboxKey).catch(() => {});
    }
  }
});
