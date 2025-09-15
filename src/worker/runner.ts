import { store, type StepRow } from "../lib/store";
import { recordEvent } from "../lib/events";
import { log } from "../lib/logger";
import { loadHandlers } from "./handlers/loader";
import type { Step } from "./handlers/types";
import { metrics } from "../lib/metrics";
import { query } from "../lib/db";

const handlers = loadHandlers();

export async function runStep(runId: string, stepId: string) {
  const s = await store.getStep(stepId) as StepRow | undefined;
  if (!s) throw new Error("step not found");
  const step: Step = { id: s.id, run_id: s.run_id, name: s.name, tool: s.tool, inputs: s.inputs } as Step;

  // Enforce tool policy if provided on step inputs
  try {
    const policy = (step.inputs && step.inputs._policy) || {};
    const toolsAllowed: string[] | undefined = policy.tools_allowed;
    if (Array.isArray(toolsAllowed) && toolsAllowed.length > 0) {
      if (!toolsAllowed.includes(step.tool)) {
        await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString(), outputs: { error: 'policy: tool not allowed', tool: step.tool, toolsAllowed } });
        await recordEvent(runId, 'policy.denied', { stepId, reason: 'tool_not_allowed', tool: step.tool, toolsAllowed }, stepId);
        // Mark run failed for safety
        await store.updateRun(runId, { status: 'failed', ended_at: new Date().toISOString() });
        await recordEvent(runId, 'run.failed', { reason: 'policy_denied', stepId });
        return;
      }
    }
  } catch {
    // Best-effort policy enforcement; do not throw here
  }

  const h = handlers.find(h => h.match(step.tool));
  if (!h) {
    await recordEvent(runId, "step.failed", { error: "no handler for tool", tool: step.tool }, stepId);
    await query(`update nofx.step set status='failed', ended_at=now() where id=$1`, [stepId]);
    throw new Error("no handler for " + step.tool);
  }

  const started = Date.now();
  try {
    await h.run({ runId, step });
    // close run if done
    const remaining = await store.countRemainingSteps(runId);
    if (Number(remaining) === 0) {
      await store.updateRun(runId, { status: 'succeeded', ended_at: new Date().toISOString() });
      await recordEvent(runId, "run.succeeded", {});
    }
    const latencyMs = Date.now() - started;
    try {
      metrics.stepDuration.observe({ tool: step.tool, status: 'succeeded' }, latencyMs);
      metrics.stepsTotal.inc({ status: 'succeeded' });
    } catch {}
    log.info({ runId, stepId, status: 'succeeded', latencyMs }, 'step.completed');
  } catch (err: unknown) {
    log.error({ err }, "step failed");
    await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString() });
    const msg = err instanceof Error ? err.message : String(err);
    await recordEvent(runId, "step.failed", { error: msg }, stepId);
    await store.updateRun(runId, { status: 'failed', ended_at: new Date().toISOString() });
    await recordEvent(runId, "run.failed", { reason: "step failed", stepId });
    const latencyMs = Date.now() - started;
    try {
      metrics.stepDuration.observe({ tool: step.tool, status: 'failed' }, latencyMs);
      metrics.stepsTotal.inc({ status: 'failed' });
    } catch {}
    log.error({ runId, stepId, status: 'failed', latencyMs }, 'step.completed');
    throw err;
  }
}
