import type { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";

const handler: StepHandler = {
  match: (tool) => tool === 'test:fail',
  async run({ runId, step }) {
    const stepId = step.id;
    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);
    throw new Error('intentional failure for testing');
  }
};

export default handler;

