/**
 * Run management handlers
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { PlanSchema } from '../../../shared/types';
import { store } from '../../../lib/store';
import { log } from '../../../lib/logger';
import { enqueue, STEP_READY_TOPIC, hasSubscribers, getOldestAgeMs } from '../../../lib/queue';
import crypto from 'node:crypto';
import { recordEvent } from '../../../lib/events';
import { setContext } from '../../../lib/observability';
import { retryStep, StepNotFoundError, StepNotRetryableError } from '../../../lib/runRecovery';
import { toJsonObject } from '../../../lib/json';
import { trace } from '../../../lib/traceLogger';
import { buildPlanFromPrompt } from '../../planBuilder';

const CreateRunSchema = z.object({
  plan: PlanSchema,
  projectId: z.string().optional()
});

export async function handleRunPreview(req: Request, res: Response) {
  try {
    if (req.body && req.body.standard) {
      const { prompt, quality, openPr, filePath, summarizeQuery, summarizeTarget, projectId } = req.body.standard;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid prompt in standard mode' });
      }

      const plan = await buildPlanFromPrompt(prompt, {
        quality: Boolean(quality),
        openPr: Boolean(openPr),
        filePath,
        summarizeQuery,
        summarizeTarget,
        projectId
      });

      return res.status(200).json(plan);
    }
    return res.status(400).json({ error: 'missing standard' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'failed to preview';
    return res.status(400).json({ error: message });
  }
}

export async function handleCreateRun(req: Request, res: Response) {
  let projectIdForLog = 'default';
  let planForLog: unknown;
  try {
    // Standard mode: build a plan from plain-language prompt and settings
    if (req.body && req.body.standard) {
      const { prompt, quality, openPr, filePath, summarizeQuery, summarizeTarget } = req.body.standard;
      const projectId = req.body.projectId || (req.headers['x-project-id'] as string | undefined) || 'default';

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid prompt in standard mode' });
      }

      const plan = await buildPlanFromPrompt(prompt, {
        quality: Boolean(quality),
        openPr: Boolean(openPr),
        filePath,
        summarizeQuery,
        summarizeTarget,
        projectId
      });

      // Continue with the generated plan
      const parsed = CreateRunSchema.safeParse({ plan, projectId });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { plan: validatedPlan, projectId: validatedProjectId = 'default' } = parsed.data;
      projectIdForLog = validatedProjectId;
      planForLog = validatedPlan;

      // Add user context to the run
      const runData = {
        ...validatedPlan,
        user_id: req.userId || '',
        metadata: {
          created_by: req.userId || '',
          tier: req.userTier || 'free'
        }
      };

      trace('run.create.request', { projectId: validatedProjectId, plan: validatedPlan, userId: req.userId || 'anonymous' });

      const run = await store.createRun(runData as any, validatedProjectId);
      const runId = String(run.id);

      try {
        setContext({ runId, projectId: validatedProjectId });
      } catch { }

      await recordEvent(runId, "run.created", { plan: validatedPlan });
      trace('run.create.success', { runId, projectId: validatedProjectId, status: run.status, createdAt: run.created_at });

      // Respond immediately to avoid request timeouts on large plans
      res.status(201).json({ id: runId, status: "queued", projectId: validatedProjectId });

      // Process steps asynchronously
      await processRunSteps(validatedPlan, runId);
      return;
    }

    const parsed = CreateRunSchema.safeParse({
      ...req.body,
      projectId: req.body?.projectId || (req.headers['x-project-id'] as string | undefined)
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { plan, projectId = 'default' } = parsed.data;
    projectIdForLog = projectId;
    planForLog = plan;

    // Add user context to the run
    const runData = {
      ...plan,
      user_id: req.userId || '',
      metadata: {
        created_by: req.userId || '',
        tier: req.userTier || 'free'
      }
    };

    trace('run.create.request', { projectId, plan, userId: req.userId || 'anonymous' });

    const run = await store.createRun(runData as any, projectId);
    const runId = String(run.id);

    try {
      setContext({ runId, projectId });
    } catch { }

    await recordEvent(runId, "run.created", { plan });
    trace('run.create.success', { runId, projectId, status: run.status, createdAt: run.created_at });

    // Respond immediately to avoid request timeouts on large plans
    res.status(201).json({ id: runId, status: "queued", projectId });

    // Process steps asynchronously
    await processRunSteps(plan, runId);

  } catch (error) {
    trace('run.create.error', { projectId: projectIdForLog, plan: planForLog, error: error instanceof Error ? error.message : String(error) });
    log.error({ error }, 'Failed to create run');
    res.status(500).json({ error: 'Failed to create run' });
  }
}

async function processRunSteps(plan: any, runId: string) {
  for (const s of plan.steps) {
    try {
      // Preserve optional per-step security policy by embedding into inputs
      const baseInputs = toJsonObject(s.inputs ?? {});
      const policy = toJsonObject({
        tools_allowed: s.tools_allowed,
        env_allowed: s.env_allowed,
        secrets_scope: s.secrets_scope,
      });
      const inputsWithPolicy = {
        ...baseInputs,
        ...(Object.keys(policy).length ? { _policy: policy } : {}),
      };

      // Idempotency key: `${runId}:${stepName}:${hash(inputs)}`
      const hash = crypto.createHash('sha256').update(JSON.stringify(inputsWithPolicy)).digest('hex').slice(0, 12);
      const idemKey = `${runId}:${s.name}:${hash}`;
      trace('step.create.begin', { runId, stepName: s.name, tool: s.tool, idemKey, inputs: inputsWithPolicy });
      const created = await store.createStep(runId, s.name, s.tool, inputsWithPolicy, idemKey);

      let stepId = created?.id;
      let existing = created;
      if (!existing) {
        existing = await store.getStepByIdempotencyKey(runId, idemKey);
        if (!stepId) stepId = existing?.id;
      }
      if (!existing && stepId) {
        existing = await store.getStep(stepId);
      }
      if (!stepId || !existing) continue; // safety: skip if we couldn't resolve step id

      trace('step.create.persisted', { runId, stepId, stepName: s.name, tool: s.tool, idemKey, status: existing?.status });

      try {
        setContext({ stepId });
      } catch { }

      await recordEvent(runId, "step.enqueued", { name: s.name, tool: s.tool, idempotency_key: idemKey }, stepId);
      trace('step.enqueue.event-recorded', { runId, stepId, stepName: s.name, tool: s.tool, idemKey });

      // Enqueue unless step is already finished
      const status = String((existing as { status?: string }).status || '').toLowerCase();
      if (!['succeeded', 'cancelled'].includes(status)) {
        await enqueueStepWithBackpressure(runId, stepId, idemKey);
        trace('step.enqueue.requested', { runId, stepId, stepName: s.name, tool: s.tool, idemKey, status });
      } else {
        trace('step.enqueue.skipped', { runId, stepId, stepName: s.name, tool: s.tool, idemKey, status });
      }

      // Simple Mode fallback: run inline to avoid any queue hiccups
      await handleInlineExecution(runId, stepId);

    } catch (error) {
      trace('step.create.error', { runId, stepName: s.name, error: error instanceof Error ? error.message : String(error) });
      log.error({ error, runId, stepName: s.name }, 'Failed to process step');
    }
  }
}

async function enqueueStepWithBackpressure(runId: string, stepId: string, idemKey: string) {
  // Backpressure: delay enqueue when queue age grows beyond threshold
  const thresholdMs = Math.max(0, Number(process.env.BACKPRESSURE_AGE_MS || 5000));
  const ageMs = getOldestAgeMs(STEP_READY_TOPIC);
  let delayMs = 0;

  if (ageMs != null && ageMs > thresholdMs) {
    delayMs = Math.min(Math.floor((ageMs - thresholdMs) / 2), 15000);
    await recordEvent(runId, 'queue.backpressure', { ageMs, delayMs }, stepId);
  }

  await enqueue(
    STEP_READY_TOPIC,
    { runId, stepId, idempotencyKey: idemKey, __attempt: 1 },
    delayMs ? { delay: delayMs } : undefined
  );

  trace('step.enqueue.finalized', { runId, stepId, idemKey, delayMs, ageMs, thresholdMs });
}

async function handleInlineExecution(runId: string, stepId: string) {
  const inlineRunnerDisabled = process.env.DISABLE_INLINE_RUNNER === '1';
  const usingMemoryQueue = (process.env.QUEUE_DRIVER || 'memory').toLowerCase() === 'memory';

  if (usingMemoryQueue && !inlineRunnerDisabled && !hasSubscribers(STEP_READY_TOPIC)) {
    try {
      const { runStep } = await import('../../../worker/runner');
      await runStep(runId, stepId);
    } catch (error) {
      trace('step.inline-execution.error', { runId, stepId, error: error instanceof Error ? error.message : String(error) });
      log.error({ error, runId, stepId }, 'Inline step execution failed');
    }
  }
}

export async function handleGetRun(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const run = await store.getRun(id);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    res.json(run);
  } catch (error) {
    log.error({ error, runId: req.params.id }, 'Failed to get run');
    res.status(500).json({ error: 'Failed to retrieve run' });
  }
}

export async function handleGetRunTimeline(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Verify run exists
    const run = await store.getRun(id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Get timeline if the method exists, otherwise return empty timeline
    let timeline: any[] = [];
    if ('getRunTimeline' in store && typeof store.getRunTimeline === 'function') {
      timeline = await (store as any).getRunTimeline(id);
    }

    res.json({ timeline });
  } catch (error) {
    log.error({ error, runId: req.params.id }, 'Failed to get run timeline');
    res.status(500).json({ error: 'Failed to retrieve timeline' });
  }
}

export async function handleRunStream(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Verify run exists
    const run = await store.getRun(id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial data
    res.write(`data: ${JSON.stringify({ type: 'connected', runId: id })}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    log.error({ error, runId: req.params.id }, 'Failed to setup run stream');
    res.status(500).json({ error: 'Failed to setup stream' });
  }
}

export async function handleListRuns(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    trace('run.list.request', { page, limit });
    const result = await store.listRuns(limit);

    // Handle different return types from store.listRuns
    const runs = Array.isArray(result) ? result : (result as any)?.runs || [];
    const total = Array.isArray(result) ? result.length : (result as any)?.total || 0;

    trace('run.list.response', { count: runs.length, total });

    res.json({
      runs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    trace('run.list.error', { error: error instanceof Error ? error.message : String(error) });
    log.error({ error }, 'Failed to list runs');
    res.status(500).json({ error: 'Failed to list runs' });
  }
}

export async function handleRetryStep(req: Request, res: Response) {
  try {
    const { runId, stepId } = req.params;

    await retryStep(runId, stepId);
    res.json({ success: true, message: 'Step retry initiated' });
  } catch (error) {
    if (error instanceof StepNotFoundError) {
      return res.status(404).json({ error: 'Step not found' });
    }
    if (error instanceof StepNotRetryableError) {
      return res.status(400).json({ error: 'Step cannot be retried' });
    }

    log.error({ error, runId: req.params.runId, stepId: req.params.stepId }, 'Failed to retry step');
    res.status(500).json({ error: 'Failed to retry step' });
  }
}
