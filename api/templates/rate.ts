import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { submitTemplateRating } from '../../src/lib/registry';
import type { SubmitTemplateRatingRequest } from '../../packages/shared/src/templates';
import { withCors } from '../_lib/cors';
import { recordRegistryUsage } from '../_lib/billingUsage';

const RateSchema = z.object({
  templateId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  submittedBy: z.string().optional()
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = RateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const payload = parsed.data as SubmitTemplateRatingRequest;
    const result = await submitTemplateRating(payload);
    await recordRegistryUsage(req, 'registry:template:rating', {
      templateId: payload.templateId,
      rating: payload.rating
    });
    return res.status(201).json({ rating: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit rating';
    return res.status(500).json({ error: message });
  }
});
