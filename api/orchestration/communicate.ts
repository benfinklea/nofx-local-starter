import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { sendAgentMessage } from '../../src/lib/orchestration';
import type { SendMessageRequest } from '../../packages/shared/src/orchestration';
import { withCors } from '../_lib/cors';

const SendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  fromAgentId: z.string().uuid(),
  toAgentId: z.string().uuid().optional(),
  messageType: z.enum([
    'task_assignment',
    'status_update',
    'result_share',
    'error_report',
    'coordination',
    'context_handoff',
    'capability_query',
    'resource_request'
  ]),
  payload: z.record(z.unknown()),
  requireAcknowledgment: z.boolean().optional()
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parsed = SendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const response = await sendAgentMessage(parsed.data as SendMessageRequest);
    return res.json(response);

  } catch (error: unknown) {
    console.error('Agent communication error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send agent message';
    return res.status(500).json({ error: message });
  }
});