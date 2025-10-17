import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { isAdmin } from '../../src/lib/auth';
import { store } from '../../src/lib/store';
import { recordEvent } from '../../src/lib/events';
import { buildPlanFromPrompt } from '../../src/api/planBuilder';
import { setContext } from '../../src/lib/observability';
import { enqueue, STEP_READY_TOPIC, hasSubscribers } from '../../src/lib/queue';
import { withCors } from '../_lib/cors';
import { listProjects, createProject } from '../../src/lib/projects';
import crypto from 'node:crypto';
import { log } from '../../src/lib/logger';
import { trace } from '../../src/lib/traceLogger';

const CreateRunSchema = z.object({
  plan: z.any().refine(val => val !== undefined && val !== null, {
    message: "plan is required"
  }),
  projectId: z.string().optional()
});

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_ADMIN === 'true';
  if (!isDev && !isAdmin(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method === 'GET') {
    // List runs
    const lim = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const projectId = String(req.query.projectId || '');

    try {
      trace('run.list.api-request', { limit: lim, projectId: projectId || null });
      const rows = await store.listRuns(lim, projectId || undefined);
      trace('run.list.api-response', { total: rows.length });
      return res.json({ runs: rows });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed to list runs';
      trace('run.list.api-error', { error: msg });
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
          { quality, openPr, filePath, summarizeQuery, summarizeTarget, projectId: body.projectId }
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
      // Ensure default project exists (create if needed)
      if (projectId === 'default') {
        try {
          const projects = await listProjects();
          const defaultExists = projects.some(p => p.id === 'default');

          if (!defaultExists) {
            await createProject({
              id: 'default',
              name: 'Default Project',
              workspace_mode: 'local_path',
              local_path: null,
              default_branch: 'main'
            });
            log.info('Created default project');
          }
        } catch (projectErr) {
          log.warn({ error: projectErr }, 'Failed to ensure default project exists');
        }
      }

      trace('run.create.api-request', { projectId, plan });
      const run = await store.createRun(plan, projectId);
      const runId = String(run.id);

      try {
        setContext({ runId, projectId });
      } catch {}

      await recordEvent(runId, "run.created", { plan });
      trace('run.create.api-success', { runId, projectId, status: run.status });

      // Process steps asynchronously (similar to local API)
      processRunSteps(plan, runId).catch(err => {
        trace('run.create.api-step-error', { runId, error: err instanceof Error ? err.message : String(err) });
        console.error('Failed to process run steps:', err);
      });

      return res.status(201).json({ ...run, id: runId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed to create run';
      trace('run.create.api-error', { projectId, error: msg });
      return res.status(500).json({ error: msg });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
});

// Helper function to process run steps (similar to local API)
async function processRunSteps(plan: { steps: { name: string; tool?: string; inputs?: Record<string, unknown> }[] }, runId: string) {
  for (const s of plan.steps) {
    try {
      const baseInputs = s.inputs ?? {};
      const hash = crypto.createHash('sha256').update(JSON.stringify(baseInputs)).digest('hex').slice(0, 12);
      const idemKey = `${runId}:${s.name}:${hash}`;

      trace('step.create.api-begin', { runId, stepName: s.name, tool: s.tool, idemKey, inputs: baseInputs });
      const created = await store.createStep(runId, s.name, s.tool || 'unknown', baseInputs as any, idemKey);
      let stepId = created?.id;

      if (!stepId) {
        const existing = await store.getStepByIdempotencyKey(runId, idemKey);
        stepId = existing?.id;
      }

      if (!stepId) continue;

      trace('step.create.api-persisted', { runId, stepId, stepName: s.name, tool: s.tool, idemKey });
      try {
        setContext({ stepId });
      } catch { }

      await recordEvent(runId, "step.enqueued", { name: s.name, tool: s.tool, idempotency_key: idemKey }, stepId);
      trace('step.enqueue.api-event-recorded', { runId, stepId, stepName: s.name, tool: s.tool, idemKey });

      // Enqueue step for worker to pick up
      await enqueue(STEP_READY_TOPIC, {
        runId,
        stepId,
        idempotencyKey: idemKey,
        __attempt: 1
      });
      trace('step.enqueue.api-request', { runId, stepId, idemKey });

      // Inline execution fallback for memory queue
      const usingMemoryQueue = (process.env.QUEUE_DRIVER || 'memory').toLowerCase() === 'memory';
      if (usingMemoryQueue && !hasSubscribers(STEP_READY_TOPIC)) {
        try {
          const { runStep } = await import('../../src/worker/runner');
          await runStep(runId, stepId);
        } catch (error) {
          trace('step.inline-execution.api-error', { runId, stepId, error: error instanceof Error ? error.message : String(error) });
          log.error({ error, runId, stepId }, 'Inline step execution failed');
        }
      }

    } catch (error) {
      trace('step.create.api-error', { runId, stepName: s.name, error: error instanceof Error ? error.message : String(error) });
      log.error({ error, runId, stepName: s.name }, 'Failed to process step');
    }
  }
}
