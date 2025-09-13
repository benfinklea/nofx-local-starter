import { query } from "../lib/db";
import { recordEvent } from "../lib/events";
import { log } from "../lib/logger";
import { loadHandlers } from "./handlers/loader";
import type { Step } from "./handlers/types";

const handlers = loadHandlers();

export async function runStep(runId: string, stepId: string) {
  const stepQ = await query<Step>(`select * from nofx.step where id = $1`, [stepId]);
  const step = stepQ.rows[0] as any as Step;
  if (!step) throw new Error("step not found");

  const h = handlers.find(h => h.match(step.tool));
  if (!h) {
    await recordEvent(runId, "step.failed", { error: "no handler for tool", tool: step.tool }, stepId);
    await query(`update nofx.step set status='failed', ended_at=now() where id=$1`, [stepId]);
    throw new Error("no handler for " + step.tool);
  }

  try {
    await h.run({ runId, step });
    // close run if done
    const remaining = await query<{ count: string }>(
      `select count(*)::int as count from nofx.step where run_id=$1 and status not in ('succeeded','cancelled')`, [runId]
    );
    if (Number(remaining.rows[0].count) === 0) {
      await query(`update nofx.run set status='succeeded', ended_at=now() where id=$1`, [runId]);
      await recordEvent(runId, "run.succeeded", {});
    }
  } catch (err:any) {
    log.error({ err }, "step failed");
    await query(`update nofx.step set status='failed', ended_at=now() where id=$1`, [stepId]);
    await recordEvent(runId, "step.failed", { error: err.message }, stepId);
    await query(`update nofx.run set status='failed', ended_at=now() where id=$1`, [runId]);
    await recordEvent(runId, "run.failed", { reason: "step failed", stepId });
  }
}