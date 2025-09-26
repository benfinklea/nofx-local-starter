import type { JobsOptions } from "bullmq";
import { MemoryQueueAdapter } from "./MemoryAdapter";
import { RedisQueueAdapter } from "./RedisAdapter";
import { PostgresQueueAdapter } from "./PostgresAdapter";
import { OUTBOX_TOPIC, STEP_DLQ_TOPIC, STEP_READY_TOPIC } from "./constants";
import type { JobPayload, JobResult, KnownJobName } from "./jobMap";

const DRIVER = (process.env.QUEUE_DRIVER || "memory").toLowerCase();

interface QueueImplementation {
  enqueue(topic: string, payload: unknown, options?: JobsOptions): Promise<void>;
  subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>): void;
  getCounts(topic: string): Promise<unknown>;
  hasSubscribers?(topic: string): boolean;
  listDlq?(topic: string): Promise<unknown[]>;
  rehydrateDlq?(topic: string, max?: number): Promise<number>;
  getOldestAgeMs?(topic: string): number | null;
}

let impl: QueueImplementation;
if (DRIVER === "redis") {
  impl = new RedisQueueAdapter();
} else if (DRIVER === "postgres" || DRIVER === "supabase") {
  impl = new PostgresQueueAdapter();
} else {
  impl = new MemoryQueueAdapter();
}

export { OUTBOX_TOPIC, STEP_DLQ_TOPIC, STEP_READY_TOPIC };
export type { JobPayload, JobResult, KnownJobName };
export * from "./jobMap";

export async function enqueue<Name extends KnownJobName>(
  topic: Name,
  payload: JobPayload<Name>,
  options?: JobsOptions,
): Promise<void>;
export async function enqueue(topic: string, payload: unknown, options?: JobsOptions): Promise<void>;
export async function enqueue(topic: string, payload: unknown, options?: JobsOptions): Promise<void> {
  await impl.enqueue(topic, payload, options);
}

export function subscribe<Name extends KnownJobName>(
  topic: Name,
  handler: (payload: JobPayload<Name>) => Promise<JobResult<Name>>,
): void;
export function subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>): void;
export function subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>): void {
  impl.subscribe(topic, handler);
}

export const getCounts = (topic: string) => impl.getCounts(topic);
export const hasSubscribers = (topic: string) =>
  typeof impl.hasSubscribers === "function" ? impl.hasSubscribers(topic) : true;
export const listDlq = (topic: string) =>
  (typeof impl.listDlq === "function" ? impl.listDlq(topic) : Promise.resolve([]));
export const rehydrateDlq = (topic: string, max = 50) =>
  (typeof impl.rehydrateDlq === "function" ? impl.rehydrateDlq(topic, max) : Promise.resolve(0));
export const getOldestAgeMs = (topic: string): number | null =>
  (typeof impl.getOldestAgeMs === "function" ? impl.getOldestAgeMs(topic) : null);
