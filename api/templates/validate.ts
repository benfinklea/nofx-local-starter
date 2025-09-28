import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { validateTemplate } from '../../src/lib/registry';

const ValidateSchema = z.object({
  templateId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  content: z.record(z.any()).optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = ValidateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await validateTemplate({
    templateId: parsed.data.templateId ?? '',
    name: parsed.data.name ?? '',
    description: parsed.data.description,
    content: parsed.data.content ?? {},
    version: parsed.data.version ?? '',
    tags: parsed.data.tags,
    category: parsed.data.category,
    metadata: parsed.data.metadata
  });

  return res.json(result);
}
