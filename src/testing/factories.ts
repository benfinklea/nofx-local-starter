import type { JsonValue, RunRow, StepRow } from "../lib/store";
import type { StepReadyPayload } from "../lib/queue";

export type StoreApi = typeof import("../lib/store").store;

export interface RunFactoryOptions {
  goal?: string;
  plan?: JsonValue | null;
  projectId?: string;
  steps?: JsonValue;
}

export async function makeRun(store: StoreApi, options: RunFactoryOptions = {}): Promise<RunRow> {
  const {
    goal = "test-run",
    plan = null,
    projectId = "default",
    steps = [],
  } = options;
  const finalPlan = plan ?? { goal, steps };
  return store.createRun(finalPlan, projectId);
}

export interface StepFactoryOptions {
  runId: string;
  name?: string;
  tool?: string;
  inputs?: JsonValue;
  idempotencyKey?: string;
}

export async function makeStep(store: StoreApi, options: StepFactoryOptions): Promise<StepRow> {
  const {
    runId,
    name = "step",
    tool = "test:echo",
    inputs = {},
    idempotencyKey,
  } = options;
  const created = await store.createStep(runId, name, tool, inputs, idempotencyKey);
  if (created) {
    return created;
  }
  const steps = await store.listStepsByRun(runId);
  const fallback = steps.find((step) => step.name === name && step.tool === tool);
  if (!fallback) {
    throw new Error(`step not found for run ${runId}`);
  }
  return fallback;
}

export interface StepReadyFactoryOptions {
  runId: string;
  stepId: string;
  attempt?: number;
  idempotencyKey?: string;
}

export function makeStepReadyPayload(options: StepReadyFactoryOptions): StepReadyPayload {
  const { runId, stepId, attempt, idempotencyKey } = options;
  const payload: StepReadyPayload = { runId, stepId };
  if (typeof attempt === "number") {
    payload.__attempt = attempt;
  }
  if (idempotencyKey) {
    payload.idempotencyKey = idempotencyKey;
  }
  return payload;
}
