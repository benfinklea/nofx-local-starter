import { store } from "./store";
import { OUTBOX_TOPIC } from './queue';

export async function recordEvent(runId: string, type: string, payload: any = {}, stepId?: string) {
  await store.recordEvent(runId, type, payload, stepId);
  // Fan-out to outbox for relaying (best effort)
  try { await store.outboxAdd(OUTBOX_TOPIC, { runId, stepId, type, payload }); } catch { /* ignore */ }
}
