import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../../src/lib/auth';
import {
  createOrchestrationSession,
  listOrchestrationSessions
} from '../../../src/lib/orchestration';
import type {
  CreateSessionRequest,
  ListSessionsQuery
} from '../../../packages/shared/src/orchestration';
import { withCors } from '../../_lib/cors';

const CreateSessionSchema = z.object({
  orchestrationType: z.enum(['solo', 'pair', 'hierarchical', 'swarm']),
  agentSelectionCriteria: z.object({
    requiredCapabilities: z.array(z.object({
      skillId: z.string(),
      minProficiency: z.number().min(1).max(10).optional(),
      maxLatencyMs: z.number().optional(),
      minSuccessRate: z.number().min(0).max(1).optional(),
      maxCost: z.number().optional()
    })),
    orchestrationType: z.enum(['solo', 'pair', 'hierarchical', 'swarm']),
    resourceConstraints: z.object({
      cpu: z.number().optional(),
      memory: z.number().optional(),
      gpu: z.boolean().optional(),
      apiCalls: z.number().optional(),
      estimatedTimeMs: z.number().optional()
    }).optional(),
    costBudget: z.number().optional(),
    preferredAgents: z.array(z.string()).optional(),
    excludedAgents: z.array(z.string()).optional()
  }).optional(),
  sessionMetadata: z.record(z.unknown()).optional(),
  autoStart: z.boolean().optional()
});

const ListSessionsSchema = z.object({
  orchestrationType: z.enum(['solo', 'pair', 'hierarchical', 'swarm']).optional(),
  status: z.enum(['active', 'completed', 'failed', 'cancelled']).optional(),
  startedAfter: z.string().optional(),
  startedBefore: z.string().optional(),
  primaryAgentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional()
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    if (req.method === 'POST') {
      // Create new orchestration session
      const parsed = CreateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const response = await createOrchestrationSession(parsed.data as CreateSessionRequest);
      return res.status(201).json(response);

    } else if (req.method === 'GET') {
      // List orchestration sessions
      const parsed = ListSessionsSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const response = await listOrchestrationSessions(parsed.data as ListSessionsQuery);
      return res.json(response);

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: unknown) {
    console.error('Orchestration session error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process orchestration request';
    return res.status(500).json({ error: message });
  }
});