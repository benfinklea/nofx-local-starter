export const STEP_READY_TOPIC = "step.ready" as const;
export const STEP_DLQ_TOPIC = "step.dlq" as const;
export const OUTBOX_TOPIC = "event.out" as const;

export type QueueTopic =
  | typeof STEP_READY_TOPIC
  | typeof STEP_DLQ_TOPIC
  | typeof OUTBOX_TOPIC;
