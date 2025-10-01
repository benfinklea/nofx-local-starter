import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getTenantContext } from '../../src/lib/tenant-auth';
import { listAgents } from '../../src/lib/registry';
import type { ListAgentsQuery } from '../../packages/shared/src/agents';
import { withCors } from '../_lib/cors';

const QuerySchema = z.object({
  status: z.enum(['draft', 'active', 'deprecated', 'disabled']).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional()
});

type QueryInput = z.infer<typeof QuerySchema>;

function normalizeQuery(input: QueryInput): ListAgentsQuery {
  return {
    status: input.status,
    tag: input.tag,
    search: input.search,
    limit: input.limit ?? undefined,
    cursor: input.cursor
  };
}

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Get tenant context from auth token
  const tenantContext = await getTenantContext(req);

  if (!tenantContext) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = QuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    // Pass tenant ID to listAgents for filtering
    const result = await listAgents(normalizeQuery(parsed.data), tenantContext.tenantId);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list agents';
    return res.status(500).json({ error: message });
  }
});
