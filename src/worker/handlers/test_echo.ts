import type { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";

const handler: StepHandler = {
  match: (tool) => tool === 'test:echo',
  async run({ runId, step }) {
    const stepId = step.id;
    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);
    const outputs = { echo: step.inputs || {} };
    await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs });
    await recordEvent(runId, 'step.finished', { outputs }, stepId);
  }
};

export default handler;

