import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { store } from '../../src/lib/store';
import { recordEvent } from '../../src/lib/events';
import { buildPlanFromPrompt } from '../../src/api/planBuilder';
import { setContext } from '../../src/lib/observability';
import { enqueue } from '../../src/lib/queue';
import { withCors } from '../_lib/cors';

const CreateRunSchema = z.object({
  plan: z.any().refine(val => val !== undefined && val !== null, {
    message: "plan is required"
  }),
  projectId: z.string().optional()
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // List runs
    const lim = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const projectId = String(req.query.projectId || '');

    try {
      const rows = await store.listRuns(lim, projectId || undefined);
      return res.json({ runs: rows });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed to list runs';
      return res.status(500).json({ error: msg });
    }
  } else if (req.method === 'POST') {
    // Create run
    let body = req.body;

    // Standard mode: build a plan from plain-language prompt and settings
    if (body && body.standard) {
      try {
        const {
          prompt,
          quality = true,
          openPr = false,
          filePath,
          summarizeQuery,
          summarizeTarget
        } = body.standard || {};

        const built = await buildPlanFromPrompt(
          String(prompt || '').trim(),
          { quality, openPr, filePath, summarizeQuery, summarizeTarget }
        );
        body = { plan: built };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'bad standard request';
        return res.status(400).json({ error: message });
      }
    }

    const parsed = CreateRunSchema.safeParse({
      ...body,
      projectId: body?.projectId || (req.headers['x-project-id'] as string | undefined)
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { plan, projectId = 'default' } = parsed.data;

    try {
      const run = await store.createRun(plan, projectId);
      const runId = String(run.id);

      try {
        setContext({ runId, projectId });
      } catch {}

      await recordEvent(runId, "run.created", { plan });

      // Enqueue run for processing
      await enqueue('run-plan', {
        runId,
        projectId,
        startedAt: new Date().toISOString()
      });

      return res.status(201).json({ ...run, id: runId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed to create run';
      return res.status(500).json({ error: msg });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
});
