import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { enqueue, STEP_READY_TOPIC } from "../../lib/queue";

const CHECK_DELAY_MS = 5000;

const handler: StepHandler = {
  match: (tool) => tool.startsWith("manual:"),
  async run({ runId, step }) {
    const stepId = step.id;
    // ensure step is marked running
    await query(`update nofx.step set status='running', started_at=coalesce(started_at, now()) where id=$1`, [stepId]);

    // does a gate exist for this step?
    const g = await query<any>(`select * from nofx.gate where run_id=$1 and step_id=$2 order by created_at desc limit 1`, [runId, stepId]);
    if (!g.rows[0]) {
      await query(`insert into nofx.gate (run_id, step_id, gate_type, status) values ($1,$2,$3,'pending')`, [runId, stepId, step.tool]);
      await recordEvent(runId, 'gate.created', { stepId, tool: step.tool }, stepId);
      // re-enqueue to check later
      await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: CHECK_DELAY_MS });
      await recordEvent(runId, 'gate.waiting', { stepId, delayMs: CHECK_DELAY_MS }, stepId);
      return;
    }

    const gate = g.rows[0];
    if (gate.status === 'pending') {
      await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: CHECK_DELAY_MS });
      await recordEvent(runId, 'gate.waiting', { stepId, delayMs: CHECK_DELAY_MS }, stepId);
      return;
    }

    if (gate.status === 'passed' || gate.status === 'waived') {
      await query(`update nofx.step set status='succeeded', ended_at=now(), outputs=$2 where id=$1`, [
        stepId,
        JSON.stringify({ manual: true, gateId: gate.id, status: gate.status })
      ]).catch(async ()=>{
        await query(`update nofx.step set status='succeeded', completed_at=now(), outputs=$2 where id=$1`, [
          stepId,
          JSON.stringify({ manual: true, gateId: gate.id, status: gate.status })
        ]);
      });
      await recordEvent(runId, 'step.finished', { stepId, tool: step.tool, manual: true, gateId: gate.id }, stepId);
      return;
    }

    if (gate.status === 'failed') {
      await query(`update nofx.step set status='failed', ended_at=now(), outputs=$2 where id=$1`, [
        stepId,
        JSON.stringify({ manual: true, gateId: gate.id, status: gate.status })
      ]).catch(async ()=>{
        await query(`update nofx.step set status='failed', completed_at=now(), outputs=$2 where id=$1`, [
          stepId,
          JSON.stringify({ manual: true, gateId: gate.id, status: gate.status })
        ]);
      });
      await recordEvent(runId, 'step.failed', { stepId, tool: step.tool, manual: true, gateId: gate.id }, stepId);
      throw new Error('manual gate failed');
    }
  }
};

export default handler;

