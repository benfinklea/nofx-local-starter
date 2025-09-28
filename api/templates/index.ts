import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { listTemplates } from '../../src/lib/registry';
import type { ListTemplatesQuery } from '../../packages/shared/src/templates';
import { withCors } from '../_lib/cors';

const QuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sort: z.enum(['recent', 'popular', 'rating']).optional()
});

type QueryInput = z.infer<typeof QuerySchema>;

function normalize(input: QueryInput): ListTemplatesQuery {
  return {
    status: input.status,
    tag: input.tag,
    category: input.category,
    search: input.search,
    limit: input.limit ?? undefined,
    cursor: input.cursor,
    sort: input.sort,
  };
}

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = QuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await listTemplates(normalize(parsed.data));
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list templates';
    return res.status(500).json({ error: message });
  }
});
