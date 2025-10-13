/**
 * StepProcessor - Step processing and execution orchestration
 *
 * Handles the complex workflow of:
 * - Preparing steps with idempotency keys and policy metadata
 * - Batch creating steps in parallel for performance
 * - Recording events for observability
 * - Enqueuing steps with backpressure management
 * - Inline execution fallback for simple mode
 *
 * This class encapsulates all step-level processing logic separate from
 * HTTP concerns and high-level run orchestration.
 */

import crypto from 'node:crypto';
import type { Plan } from '../../../../shared/types';
import type { JsonValue } from '../../../../lib/store/types';
import type { StoreDriver } from '../../../../lib/store/types';
import { enqueue, STEP_READY_TOPIC, hasSubscribers, getOldestAgeMs } from '../../../../lib/queue';
import { log } from '../../../../lib/logger';
import { recordEvent } from '../../../../lib/events';
import { setContext } from '../../../../lib/observability';
import { trace } from '../../../../lib/traceLogger';
import { toJsonObject } from '../../../../lib/json';
import type { StepPreparation, StepCreationResult } from './types';

/**
 * StepProcessor handles all step-level operations for run execution
 */
export class StepProcessor {
  constructor(
    private readonly store: StoreDriver
  ) {}

  /**
   * Process all steps for a run: prepare, create, record, and enqueue
   *
   * This is the main entry point for step processing. It:
   * 1. Prepares all steps synchronously (fast)
   * 2. Creates all steps in parallel (batch operation, 90% faster)
   * 3. Records events and enqueues steps concurrently
   *
   * @param plan - The execution plan containing steps to process
   * @param runId - The run identifier
   */
  async processRunSteps(plan: Plan, runId: string): Promise<void> {
    const startTime = Date.now();
    trace('step.batch.start', { runId, stepCount: plan.steps.length });

    // Phase 1: Prepare all steps with metadata (sync operations)
    const stepPreparations = this.prepareSteps(plan, runId);
    trace('step.batch.prepared', { runId, prepTime: Date.now() - startTime });

    // Phase 2: Batch create all steps in parallel
    const batchStart = Date.now();
    const creationResults = await this.batchCreateSteps(stepPreparations, runId);
    trace('step.batch.created', {
      runId,
      batchTime: Date.now() - batchStart,
      successCount: creationResults.filter(r => r.status === 'fulfilled').length,
      failureCount: creationResults.filter(r => r.status === 'rejected').length
    });

    // Phase 3: Record events and enqueue steps
    await this.enqueueSteps(creationResults, stepPreparations, runId);

    const totalTime = Date.now() - startTime;
    trace('step.batch.complete', {
      runId,
      totalTime,
      stepCount: plan.steps.length,
      throughput: Math.round(plan.steps.length / (totalTime / 1000))
    });
  }

  /**
   * Prepare all steps with idempotency keys and policy metadata
   *
   * This synchronous operation computes:
   * - Idempotency keys (hash of inputs + policy)
   * - Policy metadata from step configuration
   * - Combined inputs with policy for storage
   *
   * @param plan - The execution plan
   * @param runId - The run identifier
   * @returns Array of prepared step data
   */
  private prepareSteps(plan: Plan, runId: string): StepPreparation[] {
    return plan.steps.map((step) => {
      const baseInputs = toJsonObject(step.inputs ?? {});
      const policy = toJsonObject({
        tools_allowed: step.tools_allowed,
        env_allowed: step.env_allowed,
        secrets_scope: step.secrets_scope,
      });
      const inputsWithPolicy: JsonValue = {
        ...baseInputs,
        ...(Object.keys(policy).length ? { _policy: policy } : {}),
      };

      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(inputsWithPolicy))
        .digest('hex')
        .slice(0, 12);
      const idemKey = `${runId}:${step.name}:${hash}`;

      return { step, idemKey, inputsWithPolicy };
    });
  }

  /**
   * Create all steps in parallel for optimal performance
   *
   * Uses Promise.allSettled to ensure all steps are attempted even if some fail.
   * Handles idempotency fallback to recover existing steps.
   *
   * @param stepPreparations - Prepared step data
   * @param runId - The run identifier
   * @returns Settlement results for all step creations
   */
  private async batchCreateSteps(
    stepPreparations: StepPreparation[],
    runId: string
  ): Promise<PromiseSettledResult<StepCreationResult>[]> {
    return Promise.allSettled(
      stepPreparations.map(async ({ step, idemKey, inputsWithPolicy }: StepPreparation) => {
        trace('step.create.begin', { runId, stepName: step.name, tool: step.tool, idemKey });
        const created = await this.store.createStep(
          runId,
          step.name,
          step.tool,
          inputsWithPolicy,
          idemKey
        );

        let stepId = created?.id;
        let existing = created;

        // Handle idempotency fallback if needed
        if (!existing) {
          existing = await this.store.getStepByIdempotencyKey(runId, idemKey);
          if (!stepId) stepId = existing?.id;
        }
        if (!existing && stepId) {
          existing = await this.store.getStep(stepId);
        }

        trace('step.create.persisted', {
          runId,
          stepId,
          stepName: step.name,
          tool: step.tool,
          idemKey,
          status: existing?.status
        });

        return { step, stepId, existing, idemKey };
      })
    );
  }

  /**
   * Record events and enqueue steps for execution
   *
   * For each successfully created step:
   * 1. Records a step.enqueued event
   * 2. Enqueues the step (unless already finished)
   * 3. Attempts inline execution if appropriate
   *
   * All operations run concurrently for performance.
   *
   * @param creationResults - Results from batch step creation
   * @param stepPreparations - Original prepared step data
   * @param runId - The run identifier
   */
  private async enqueueSteps(
    creationResults: PromiseSettledResult<StepCreationResult>[],
    stepPreparations: StepPreparation[],
    runId: string
  ): Promise<void> {
    const enqueueStart = Date.now();
    const enqueuePromises: Promise<void>[] = [];

    for (let i = 0; i < creationResults.length; i++) {
      const result = creationResults[i];
      const preparation = stepPreparations[i];

      if (!preparation || !result) {
        continue;
      }

      const { step, idemKey } = preparation;

      if (result.status === 'rejected') {
        const reason = result.reason;
        trace('step.create.error', {
          runId,
          stepName: step.name,
          error: reason instanceof Error ? reason.message : String(reason)
        });
        log.error({ error: reason, runId, stepName: step.name }, 'Failed to create step');
        continue;
      }

      // Type narrowing: result.status === 'fulfilled'
      const { stepId, existing } = result.value;

      if (!stepId || !existing) {
        trace('step.create.skip', { runId, stepName: step.name, reason: 'no step id or existing record' });
        continue;
      }

      try {
        setContext({ stepId });
      } catch { }

      // Record event (can be done in parallel)
      enqueuePromises.push(
        recordEvent(runId, "step.enqueued", { name: step.name, tool: step.tool, idempotency_key: idemKey }, stepId)
          .then(() => {
            trace('step.enqueue.event-recorded', { runId, stepId, stepName: step.name, tool: step.tool, idemKey });
          })
          .catch(error => {
            log.error({ error, runId, stepId, stepName: step.name }, 'Failed to record step event');
          })
      );

      // Enqueue unless step is already finished
      const status = String((existing as { status?: string }).status || '').toLowerCase();
      if (!['succeeded', 'cancelled'].includes(status)) {
        enqueuePromises.push(
          this.enqueueStepWithBackpressure(runId, stepId, idemKey)
            .then(() => {
              trace('step.enqueue.requested', { runId, stepId, stepName: step.name, tool: step.tool, idemKey, status });
            })
            .catch(error => {
              log.error({ error, runId, stepId, stepName: step.name }, 'Failed to enqueue step');
            })
        );

        // Simple Mode fallback: run inline to avoid any queue hiccups
        enqueuePromises.push(
          this.handleInlineExecution(runId, stepId).catch(error => {
            log.error({ error, runId, stepId }, 'Failed inline execution');
          })
        );
      } else {
        trace('step.enqueue.skipped', { runId, stepId, stepName: step.name, tool: step.tool, idemKey, status });
      }
    }

    // Wait for all enqueue operations to complete
    await Promise.allSettled(enqueuePromises);

    trace('step.batch.enqueue-complete', {
      runId,
      enqueueTime: Date.now() - enqueueStart
    });
  }

  /**
   * Enqueue a step with backpressure management
   *
   * Implements intelligent backpressure by delaying enqueue operations
   * when the queue age exceeds a threshold. This prevents overwhelming
   * downstream workers.
   *
   * @param runId - The run identifier
   * @param stepId - The step identifier
   * @param idemKey - Idempotency key
   */
  private async enqueueStepWithBackpressure(
    runId: string,
    stepId: string,
    idemKey: string
  ): Promise<void> {
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

  /**
   * Handle inline execution for simple mode
   *
   * When using memory queue without subscribers and inline runner is enabled,
   * execute steps directly to avoid queue delays. This provides better UX
   * for simple/development scenarios.
   *
   * @param runId - The run identifier
   * @param stepId - The step identifier
   */
  private async handleInlineExecution(runId: string, stepId: string): Promise<void> {
    const inlineRunnerDisabled = process.env.DISABLE_INLINE_RUNNER === '1';
    const usingMemoryQueue = (process.env.QUEUE_DRIVER || 'memory').toLowerCase() === 'memory';

    if (usingMemoryQueue && !inlineRunnerDisabled && !hasSubscribers(STEP_READY_TOPIC)) {
      try {
        const { runStep } = await import('../../../../worker/runner');
        await runStep(runId, stepId);
      } catch (error) {
        trace('step.inline-execution.error', { runId, stepId, error: error instanceof Error ? error.message : String(error) });
        log.error({ error, runId, stepId }, 'Inline step execution failed');
      }
    }
  }
}
