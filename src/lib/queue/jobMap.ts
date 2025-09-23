import type { JsonValue } from "../store";
import { OUTBOX_TOPIC, STEP_DLQ_TOPIC, STEP_READY_TOPIC } from "./constants";

export interface JobDefinition<Payload, Result = void> {
  payload: Payload;
  result: Result;
}

export type StepReadyPayload = {
  runId: string;
  stepId: string;
  idempotencyKey?: string;
  __attempt?: number;
};

export type StepReadyResult = void;

export type StepDlqPayload = StepReadyPayload;
export type StepDlqResult = void;

export type OutboxJobPayload = {
  runId: string;
  type: string;
  payload: JsonValue;
  stepId?: string | null;
  __attempt?: number;
};

export type OutboxJobResult = void;

export interface KnownJobMap {
  [STEP_READY_TOPIC]: JobDefinition<StepReadyPayload, StepReadyResult>;
  [STEP_DLQ_TOPIC]: JobDefinition<StepDlqPayload, StepDlqResult>;
  [OUTBOX_TOPIC]: JobDefinition<OutboxJobPayload, OutboxJobResult>;
}

export type KnownJobName = keyof KnownJobMap;

export type JobPayload<Name extends string> =
  Name extends KnownJobName ? KnownJobMap[Name]["payload"] : Record<string, unknown>;

export type JobResult<Name extends string> =
  Name extends KnownJobName ? KnownJobMap[Name]["result"] : unknown;
