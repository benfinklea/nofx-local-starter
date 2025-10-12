import { store, type StepRow, type RunRow } from "../lib/store";
import { recordEvent } from "../lib/events";
import { log } from "../lib/logger";
import { loadHandlers as loadHandlersDynamic } from "./handlers/loader";
import { loadHandlers as loadHandlersStatic } from "./handlers/static-loader";
import { enqueue, STEP_READY_TOPIC } from "../lib/queue";
import type { Step } from "./handlers/types";
import { metrics } from "../lib/metrics";
import { runAtomically } from "../lib/tx";
import { trace, traceDebug } from "../lib/traceLogger";

// Use static loader in production/Vercel, dynamic loader in development
const loadHandlers = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? loadHandlersStatic
  : loadHandlersDynamic;

function attemptLoadHandlers(forceAll: boolean): ReturnType<typeof loadHandlers> {
  const prev = process.env.LOAD_ALL_HANDLERS;
  if (forceAll) {
    process.env.LOAD_ALL_HANDLERS = '1';
  }
  try {
    return loadHandlers();
  } finally {
    if (forceAll) {
      if (prev == null) {
        delete process.env.LOAD_ALL_HANDLERS;
      } else {
        process.env.LOAD_ALL_HANDLERS = prev;
      }
    }
  }
}

function loadHandlersSafe(): ReturnType<typeof loadHandlers> {
  const alreadyAll = process.env.LOAD_ALL_HANDLERS === '1';
  try {
    const primary = attemptLoadHandlers(alreadyAll);
    if (primary.length > 0) {
      return primary;
    }
    if (process.env.NODE_ENV === 'test' && !alreadyAll) {
      return attemptLoadHandlers(true);
    }
    return primary;
  } catch (err) {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_HANDLER_LOADING === '1') {
      if (process.env.NODE_ENV === 'test') {
        try {
          return attemptLoadHandlers(true);
        } catch (testError) {
          log.debug({
            error: testError,
            context: { operation: 'attemptLoadHandlers', testMode: true }
          }, 'Failed to load all handlers in test mode');
        }
      }
      if (process.env.NODE_ENV !== 'test') {
        log.warn({ err }, 'handlers.load.skipped');
      }
      return [];
    }
    throw err;
  }
}

let handlers = loadHandlersSafe();

function ensureHandlersLoaded() {
  if (handlers.length === 0) {
    handlers = loadHandlersSafe();
  }
}

export async function runStep(runId: string, stepId: string) {
  ensureHandlersLoaded();
  const s = await store.getStep(stepId) as StepRow | undefined;
  if (!s) throw new Error(`Step with ID '${stepId}' not found. Ensure the step was created with store.createStep() before retrying.`);
  const step: Step = { id: s.id, run_id: s.run_id, name: s.name, tool: s.tool, inputs: s.inputs } as Step;

  trace('step.execute.begin', { runId, stepId, tool: step.tool, name: step.name, inputs: step.inputs });

  // Exactly-once guard: inbox key based on step id
  const executionKey = `step-exec:${stepId}`;
  let executionMarked = false;
  const releaseExecutionKey = async () => {
    if (!executionMarked) return;
    executionMarked = false;
    await store.inboxDelete(executionKey).catch((error) => {
      log.warn({
        error,
        context: { executionKey, runId, stepId, operation: 'inboxDelete' }
      }, 'Failed to delete execution key from inbox');
    });
  };
  try {
    const ok = await store.inboxMarkIfNew(executionKey);
    if (!ok) {
      log.warn({ runId, stepId }, 'inbox.duplicate');
      trace('step.execute.duplicate', { runId, stepId, tool: step.tool });
      return;
    }
    executionMarked = true;
  } catch (error) {
    log.error({
      error,
      context: { executionKey, runId, stepId, operation: 'inboxMarkIfNew' }
    }, 'Failed to mark execution key in inbox');
  }

  // DAG dependency check (optional _dependsOn names)
  try {
    const deps: string[] | undefined = (step.inputs && step.inputs._dependsOn) || undefined;
    if (Array.isArray(deps) && deps.length) {
      const steps = await store.listStepsByRun(runId);
      const ok = deps.every(name => {
        const t = steps.find(st => (st as any).name === name);
        const st = String((t as any)?.status || '').toLowerCase();
        return ['succeeded','cancelled'].includes(st);
      });
      if (!ok) {
        await releaseExecutionKey();
        await enqueue(STEP_READY_TOPIC, { runId, stepId, __attempt: 1 }, { delay: 2000 });
        await recordEvent(runId, 'step.waiting', { stepId, reason: 'deps_not_ready', deps }, stepId);
        return;
      }
    }
  } catch {}

  // Enforce tool policy if provided on step inputs
  try {
    const policy = (step.inputs && step.inputs._policy) || {};
    const toolsAllowed: string[] | undefined = policy.tools_allowed;
    if (Array.isArray(toolsAllowed) && toolsAllowed.length > 0) {
      if (!toolsAllowed.includes(step.tool)) {
        await runAtomically(async () => {
          await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString(), outputs: { error: 'policy: tool not allowed', tool: step.tool, toolsAllowed } });
          await recordEvent(runId, 'policy.denied', { stepId, reason: 'tool_not_allowed', tool: step.tool, toolsAllowed }, stepId);
          await recordEvent(runId, 'step.failed', { reason: 'policy_denied', tool: step.tool, toolsAllowed }, stepId);
          // Mark run failed for safety
          await store.updateRun(runId, { status: 'failed', ended_at: new Date().toISOString() });
          await recordEvent(runId, 'run.failed', { reason: 'policy_denied', stepId });
        });
        await releaseExecutionKey();
        return;
      }
    }
  } catch {
    // Best-effort policy enforcement; do not throw here
  }

  let h = handlers.find(h => h.match(step.tool));
  if (!h) {
    ensureHandlersLoaded();
    h = handlers.find(handler => handler.match(step.tool));
  }
  if (!h) {
    await recordEvent(runId, "step.failed", { error: "no handler for tool", tool: step.tool }, stepId);
    await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString() });
    await releaseExecutionKey();
    throw new Error(`No handler found for tool '${step.tool}'. Available handlers: ${handlers.map(h => h.constructor.name).join(', ') || 'none loaded'}. Check worker/handlers directory.`);
  }

  const started = Date.now();
  try {
    await h.run({ runId, step });
    trace('step.execute.handler-finished', { runId, stepId, tool: step.tool, durationMs: Date.now() - started });
    // close run if done
    await runAtomically(async () => {
      const latest = await store.getStep(stepId);
      const currentStatus = String((latest as any)?.status || '').toLowerCase();
      if (['timed_out', 'failed', 'cancelled'].includes(currentStatus)) {
        trace('step.execute.status-skip-close', { runId, stepId, status: currentStatus });
        return;
      }
      await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString() });
      await recordEvent(runId, 'step.succeeded', { tool: step.tool, name: step.name }, stepId);
      let remaining = 0;
      let outstandingPlanned = 0;
      try {
        const stepsForRun = await store.listStepsByRun(runId);
        remaining = stepsForRun.filter((s) => {
          const st = String((s as any)?.status || '').toLowerCase();
          return !['succeeded', 'cancelled'].includes(st);
        }).length;
        traceDebug('run.step.remaining.statuses', {
          runId,
          stepId,
          stepStatuses: stepsForRun.map((stepRow) => ({
            id: (stepRow as any)?.id,
            name: (stepRow as any)?.name,
            status: (stepRow as any)?.status
          }))
        });

        const runRow = await store.getRun(runId) as RunRow | undefined;
        const plannedSteps = (runRow?.plan && typeof runRow.plan === 'object'
          && !Array.isArray(runRow.plan)
          && Array.isArray((runRow.plan as any).steps))
          ? (runRow.plan as any).steps as unknown[]
          : undefined;

        if (Array.isArray(plannedSteps) && plannedSteps.length > stepsForRun.length) {
          outstandingPlanned = plannedSteps.length - stepsForRun.length;
        }
      } catch (error) {
        log.warn({ error, runId, stepId }, 'failed to evaluate remaining steps');
        trace('run.step.remaining.error', { runId, stepId, error: error instanceof Error ? error.message : String(error) });
      }

      traceDebug('run.step.remaining.summary', { runId, stepId, remaining, outstandingPlanned });
      if (Number(remaining) === 0 && outstandingPlanned === 0) {
        await store.updateRun(runId, { status: 'succeeded', ended_at: new Date().toISOString() });
        await recordEvent(runId, "run.succeeded", {});
        trace('run.execute.completed', { runId, stepId, tool: step.tool });
      }
    });
    const latencyMs = Date.now() - started;
    try {
      metrics.stepDuration.observe({ tool: step.tool, status: 'succeeded' }, latencyMs);
      metrics.stepsTotal.inc({ status: 'succeeded' });
    } catch {}
    log.info({ runId, stepId, status: 'succeeded', latencyMs }, 'step.completed');
    trace('step.execute.success', { runId, stepId, tool: step.tool, latencyMs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    log.error({
      err,
      stepId,
      runId,
      tool: step.tool,
      message: msg,
      stack
    }, "step failed");

    await releaseExecutionKey();
    await runAtomically(async () => {
      const latest = await store.getStep(stepId);
      const currentStatus = String((latest as any)?.status || '').toLowerCase();
      if (currentStatus === 'timed_out') {
        // Timeout handler already persisted state/events; avoid clobbering.
        trace('step.execute.timeout', { runId, stepId, tool: step.tool });
        return;
      }
      await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString() });
      await recordEvent(runId, "step.failed", { error: msg }, stepId);
      await store.updateRun(runId, { status: 'failed', ended_at: new Date().toISOString() });
      await recordEvent(runId, "run.failed", { reason: "step failed", stepId });
    });
    const latencyMs = Date.now() - started;
    try {
      metrics.stepDuration.observe({ tool: step.tool, status: 'failed' }, latencyMs);
      metrics.stepsTotal.inc({ status: 'failed' });
    } catch {}
    log.error({ runId, stepId, status: 'failed', latencyMs }, 'step.completed');
    trace('step.execute.error', { runId, stepId, tool: step.tool, error: msg, latencyMs, stack });
    throw err;
  }
}

export async function markStepTimedOut(runId: string, stepId: string, timeoutMs: number) {
  await runAtomically(async () => {
    const latest = await store.getStep(stepId) as StepRow | undefined;
    const status = String(latest?.status || '').toLowerCase();
    if (['succeeded', 'cancelled'].includes(status)) {
      return;
    }

    const endedAt = new Date().toISOString();
    const baseOutputs = (latest?.outputs && typeof latest.outputs === 'object' && !Array.isArray(latest.outputs))
      ? (latest.outputs as Record<string, unknown>)
      : {};
    const outputs = {
      ...baseOutputs,
      error: 'timeout',
      timeoutMs
    };

    await store.updateStep(stepId, { status: 'timed_out', ended_at: endedAt, outputs });
    await recordEvent(runId, 'step.timeout', { stepId, timeoutMs }, stepId);
    const run = await store.getRun(runId) as RunRow | undefined;
    const runStatus = String(run?.status || '').toLowerCase();
    if (runStatus !== 'failed') {
      await store.updateRun(runId, { status: 'failed', ended_at: endedAt });
      await recordEvent(runId, 'run.failed', { reason: 'timeout', stepId, timeoutMs });
    }
  });
}
