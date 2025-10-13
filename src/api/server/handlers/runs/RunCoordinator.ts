/**
 * RunCoordinator - Business logic orchestration for run management
 *
 * Coordinates high-level run operations:
 * - Creating runs with user context
 * - Building plans from prompts (standard mode)
 * - Orchestrating step processing
 * - Managing run lifecycle events
 *
 * This class contains pure business logic with no HTTP concerns.
 * It delegates step processing to StepProcessor and uses injected
 * dependencies for testability.
 */

import type { Plan } from '../../../../shared/types';
import type { StoreDriver, RunRow, EventRow, JsonValue } from '../../../../lib/store/types';
import { log } from '../../../../lib/logger';
import { recordEvent } from '../../../../lib/events';
import { setContext } from '../../../../lib/observability';
import { trace } from '../../../../lib/traceLogger';
import { buildPlanFromPrompt } from '../../../planBuilder';
import { StepProcessor } from './StepProcessor';
import type { RunCreationConfig, StandardModeRequest } from './types';

/**
 * RunCoordinator orchestrates run management business logic
 */
export class RunCoordinator {
  private readonly stepProcessor: StepProcessor;

  constructor(
    private readonly store: StoreDriver
  ) {
    this.stepProcessor = new StepProcessor(store);
  }

  /**
   * Build a plan from a natural language prompt
   *
   * @param request - Standard mode request parameters
   * @returns Generated execution plan
   */
  async buildPlanFromStandardMode(request: StandardModeRequest): Promise<Plan> {
    const { prompt, quality, openPr, filePath, summarizeQuery, summarizeTarget, projectId } = request;

    const plan = await buildPlanFromPrompt(prompt, {
      quality: Boolean(quality),
      openPr: Boolean(openPr),
      filePath,
      summarizeQuery,
      summarizeTarget,
      projectId
    });

    return plan as Plan;
  }

  /**
   * Create a new run and initiate step processing
   *
   * This is the main entry point for run creation. It:
   * 1. Creates the run record with user context
   * 2. Sets observability context
   * 3. Records run.created event
   * 4. Returns the run immediately
   * 5. Initiates async step processing
   *
   * @param config - Run creation configuration
   * @returns Created run record
   */
  async createRun(config: RunCreationConfig): Promise<RunRow> {
    const { plan, projectId, userId, userTier } = config;

    // Add user context to the run
    const runData = {
      ...plan,
      user_id: userId || '',
      metadata: {
        created_by: userId || '',
        tier: userTier || 'free'
      }
    } as JsonValue;

    trace('run.create.request', { projectId, plan, userId: userId || 'anonymous' });

    const run = await this.store.createRun(runData, projectId);
    const runId = String(run.id);

    try {
      setContext({ runId, projectId });
    } catch { }

    await recordEvent(runId, "run.created", { plan });
    trace('run.create.success', { runId, projectId, status: run.status, createdAt: run.created_at });

    return run;
  }

  /**
   * Process all steps for a run asynchronously
   *
   * This should be called after responding to the client to avoid
   * blocking the HTTP response on large plans.
   *
   * @param plan - Execution plan
   * @param runId - Run identifier
   * @param projectId - Project identifier (for logging)
   * @throws Does not throw - logs errors internally
   */
  async processStepsAsync(plan: Plan, runId: string, projectId: string): Promise<void> {
    try {
      await this.stepProcessor.processRunSteps(plan, runId);
    } catch (error) {
      trace('step.processing.error', {
        runId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      log.error({ error, runId, projectId }, 'Failed to process run steps after response sent');
      throw error; // Re-throw for caller to handle if needed
    }
  }

  /**
   * Get a run by ID
   *
   * @param id - Run identifier
   * @returns Run record or undefined if not found
   */
  async getRun(id: string): Promise<RunRow | undefined> {
    return this.store.getRun(id);
  }

  /**
   * Get run timeline (events)
   *
   * @param id - Run identifier
   * @returns Array of events for the run
   */
  async getRunTimeline(id: string): Promise<EventRow[]> {
    // Get timeline if the method exists, otherwise return empty timeline
    if ('getRunTimeline' in this.store && typeof this.store.getRunTimeline === 'function') {
      return this.store.getRunTimeline(id);
    }
    return [];
  }

  /**
   * List runs with optional pagination
   *
   * @param limit - Maximum number of runs to return
   * @returns Array of run summaries
   */
  async listRuns(limit: number): Promise<RunRow[]> {
    trace('run.list.request', { limit });
    const result = await this.store.listRuns(limit);

    // Handle different return types from store.listRuns
    const runs = Array.isArray(result) ? result : [];
    trace('run.list.response', { count: runs.length, total: runs.length });

    return runs;
  }
}
