import { store } from "./store";

export async function recordEvent(runId: string, type: string, payload: any = {}, stepId?: string) {
  await store.recordEvent(runId, type, payload, stepId);
}
