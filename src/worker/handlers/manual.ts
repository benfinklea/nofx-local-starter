import { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { enqueue, STEP_READY_TOPIC } from "../../lib/queue";

const CHECK_DELAY_MS = 5000;

const handler: StepHandler = {
  match: (tool) => tool.startsWith("manual:"),
  async run({ runId, step }) {
    const stepId = step.id;
    // ensure step is marked running
    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });

    // does a gate exist for this step?
    const g = await store.getLatestGate(runId, stepId);
    if (!g) {
      await store.createOrGetGate(runId, stepId, step.tool);
      await recordEvent(runId, 'gate.created', { stepId, tool: step.tool }, stepId);
      // re-enqueue to check later
      await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: CHECK_DELAY_MS });
      await recordEvent(runId, 'gate.waiting', { stepId, delayMs: CHECK_DELAY_MS }, stepId);
      return;
    }

    const gate = g as any;
    if (gate.status === 'pending') {
      await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: CHECK_DELAY_MS });
      await recordEvent(runId, 'gate.waiting', { stepId, delayMs: CHECK_DELAY_MS }, stepId);
      return;
    }

    if (gate.status === 'passed' || gate.status === 'waived') {
      await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs: { manual: true, gateId: (gate as any).id, status: gate.status } });
      await recordEvent(runId, 'step.finished', { stepId, tool: step.tool, manual: true, gateId: gate.id }, stepId);
      return;
    }

    if (gate.status === 'failed') {
      await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString(), outputs: { manual: true, gateId: (gate as any).id, status: gate.status } });
      await recordEvent(runId, 'step.failed', { stepId, tool: step.tool, manual: true, gateId: gate.id }, stepId);
      throw new Error('manual gate failed');
    }
  }
};

export default handler;
