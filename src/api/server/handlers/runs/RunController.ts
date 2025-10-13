/**
 * RunController - HTTP request/response handlers for run management
 *
 * Handles all HTTP concerns:
 * - Request validation and parameter extraction
 * - Response formatting and status codes
 * - Error handling and error responses
 * - SSE stream setup
 *
 * Delegates all business logic to RunCoordinator.
 * All handlers return Promise<void> as required by Express.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { PlanSchema } from '../../../../shared/types';
import { store } from '../../../../lib/store';
import { log } from '../../../../lib/logger';
import { trace } from '../../../../lib/traceLogger';
import { retryStep, StepNotFoundError, StepNotRetryableError } from '../../../../lib/runRecovery';
import { RunCoordinator } from './RunCoordinator';
import type { StandardModeRequest } from './types';

// Validation schema for run creation
const CreateRunSchema = z.object({
  plan: PlanSchema,
  projectId: z.string().optional()
});

/**
 * Preview a plan without creating a run (standard mode)
 *
 * Accepts a natural language prompt and returns the generated plan.
 * No run is created - this is for preview purposes only.
 *
 * @param req - Express request with standard mode parameters
 * @param res - Express response
 */
export async function handleRunPreview(req: Request, res: Response): Promise<void> {
  try {
    if (req.body && req.body.standard) {
      const { prompt, quality, openPr, filePath, summarizeQuery, summarizeTarget, projectId } = req.body.standard;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Missing or invalid prompt in standard mode' });
        return;
      }

      const standardRequest: StandardModeRequest = {
        prompt,
        quality,
        openPr,
        filePath,
        summarizeQuery,
        summarizeTarget,
        projectId
      };

      const coordinator = new RunCoordinator(store);
      const plan = await coordinator.buildPlanFromStandardMode(standardRequest);

      res.status(200).json(plan);
      return;
    }
    res.status(400).json({ error: 'missing standard' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'failed to preview';
    res.status(400).json({ error: message });
  }
}

/**
 * Create a new run from a plan or prompt
 *
 * Supports two modes:
 * 1. Standard mode: Build plan from prompt, then create run
 * 2. Direct mode: Create run from provided plan
 *
 * Returns immediately with run ID while processing steps asynchronously.
 *
 * @param req - Express request with plan or standard mode params
 * @param res - Express response
 */
export async function handleCreateRun(req: Request, res: Response): Promise<void> {
  let projectIdForLog = 'default';
  let planForLog: unknown;

  try {
    const coordinator = new RunCoordinator(store);

    // Standard mode: build a plan from plain-language prompt and settings
    if (req.body && req.body.standard) {
      const { prompt, quality, openPr, filePath, summarizeQuery, summarizeTarget } = req.body.standard;
      const projectId = req.body.projectId || (req.headers['x-project-id'] as string | undefined) || 'default';

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Missing or invalid prompt in standard mode' });
        return;
      }

      const standardRequest: StandardModeRequest = {
        prompt,
        quality,
        openPr,
        filePath,
        summarizeQuery,
        summarizeTarget,
        projectId
      };

      const plan = await coordinator.buildPlanFromStandardMode(standardRequest);

      // Continue with the generated plan
      const parsed = CreateRunSchema.safeParse({ plan, projectId });
      if (!parsed.success) {
        const errorMessage = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Invalid plan data';
        res.status(400).json({ error: errorMessage });
        return;
      }

      const { plan: validatedPlan, projectId: validatedProjectId = 'default' } = parsed.data;
      projectIdForLog = validatedProjectId;
      planForLog = validatedPlan;

      const run = await coordinator.createRun({
        plan: validatedPlan,
        projectId: validatedProjectId,
        userId: req.userId || '',
        userTier: req.userTier || 'free'
      });

      const runId = String(run.id);

      // Respond immediately to avoid request timeouts on large plans
      res.status(201).json({ id: runId, status: "queued", projectId: validatedProjectId });

      // Process steps asynchronously - catch errors to prevent response already sent issues
      coordinator.processStepsAsync(validatedPlan, runId, validatedProjectId).catch(error => {
        trace('step.processing.error', { runId, projectId: validatedProjectId, error: error instanceof Error ? error.message : String(error) });
        log.error({ error, runId, projectId: validatedProjectId }, 'Failed to process run steps after response sent');
      });
      return;
    }

    // Direct mode: create run from provided plan
    const parsed = CreateRunSchema.safeParse({
      ...req.body,
      projectId: req.body?.projectId || (req.headers['x-project-id'] as string | undefined)
    });

    if (!parsed.success) {
      const errorMessage = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Invalid request data';
      res.status(400).json({ error: errorMessage });
      return;
    }

    const { plan, projectId = 'default' } = parsed.data;
    projectIdForLog = projectId;
    planForLog = plan;

    const run = await coordinator.createRun({
      plan,
      projectId,
      userId: req.userId || '',
      userTier: req.userTier || 'free'
    });

    const runId = String(run.id);

    // Respond immediately to avoid request timeouts on large plans
    res.status(201).json({ id: runId, status: "queued", projectId });

    // Process steps asynchronously - catch errors to prevent response already sent issues
    coordinator.processStepsAsync(plan, runId, projectId).catch(error => {
      trace('step.processing.error', { runId, projectId, error: error instanceof Error ? error.message : String(error) });
      log.error({ error, runId, projectId }, 'Failed to process run steps after response sent');
    });

  } catch (error: unknown) {
    trace('run.create.error', { projectId: projectIdForLog, plan: planForLog, error: error instanceof Error ? error.message : String(error) });
    log.error({ error }, 'Failed to create run');
    res.status(500).json({ error: 'Failed to create run' });
  }
}

/**
 * Get a single run by ID
 *
 * @param req - Express request with run ID parameter
 * @param res - Express response
 */
export async function handleGetRun(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    const coordinator = new RunCoordinator(store);
    const run = await coordinator.getRun(id);

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json(run);
  } catch (error: unknown) {
    log.error({ error, runId: req.params.id }, 'Failed to get run');
    res.status(500).json({ error: 'Failed to retrieve run' });
  }
}

/**
 * Get run timeline (event history)
 *
 * @param req - Express request with run ID parameter
 * @param res - Express response
 */
export async function handleGetRunTimeline(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    const coordinator = new RunCoordinator(store);

    // Verify run exists
    const run = await coordinator.getRun(id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    // Get timeline
    const timeline = await coordinator.getRunTimeline(id);

    res.json({ timeline });
  } catch (error: unknown) {
    log.error({ error, runId: req.params.id }, 'Failed to get run timeline');
    res.status(500).json({ error: 'Failed to retrieve timeline' });
  }
}

/**
 * Setup Server-Sent Events (SSE) stream for run updates
 *
 * Establishes a persistent connection that can stream real-time
 * updates about run progress.
 *
 * @param req - Express request with run ID parameter
 * @param res - Express response
 */
export async function handleRunStream(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    const coordinator = new RunCoordinator(store);

    // Verify run exists
    const run = await coordinator.getRun(id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
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

  } catch (error: unknown) {
    log.error({ error, runId: req.params.id }, 'Failed to setup run stream');
    res.status(500).json({ error: 'Failed to setup stream' });
  }
}

/**
 * List all runs with pagination
 *
 * @param req - Express request with page and limit query params
 * @param res - Express response
 */
export async function handleListRuns(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const coordinator = new RunCoordinator(store);
    const runs = await coordinator.listRuns(limit);

    const total = runs.length;

    res.json({
      runs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: unknown) {
    trace('run.list.error', { error: error instanceof Error ? error.message : String(error) });
    log.error({ error }, 'Failed to list runs');
    res.status(500).json({ error: 'Failed to list runs' });
  }
}

/**
 * Retry a failed step
 *
 * Delegates to the runRecovery module which handles retry logic.
 *
 * @param req - Express request with runId and stepId parameters
 * @param res - Express response
 */
export async function handleRetryStep(req: Request, res: Response): Promise<void> {
  try {
    const { runId, stepId } = req.params;

    if (!runId || !stepId) {
      res.status(400).json({ error: 'Run ID and Step ID are required' });
      return;
    }

    await retryStep(runId, stepId);
    res.json({ success: true, message: 'Step retry initiated' });
  } catch (error: unknown) {
    if (error instanceof StepNotFoundError) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }
    if (error instanceof StepNotRetryableError) {
      res.status(400).json({ error: 'Step cannot be retried' });
      return;
    }

    log.error({ error, runId: req.params.runId, stepId: req.params.stepId }, 'Failed to retry step');
    res.status(500).json({ error: 'Failed to retry step' });
  }
}
