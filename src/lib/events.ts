import { store } from "./store";
import { OUTBOX_TOPIC } from './queue';
import { withTransaction } from './db';
import { toJsonObject, toJsonValue } from './json';

export async function recordEvent(runId: string, type: string, payload: unknown = {}, stepId?: string) {
  const sanitizedPayload = toJsonValue(payload);
  const outboxPayload = toJsonObject({
    runId,
    stepId: stepId ?? null,
    type,
    payload: sanitizedPayload,
  });

  const exec = async () => {
    await store.recordEvent(runId, type, sanitizedPayload, stepId);
    if (store.driver === 'db') {
      await store.outboxAdd(OUTBOX_TOPIC, outboxPayload);
    } else {
      try {
        await store.outboxAdd(OUTBOX_TOPIC, outboxPayload);
      } catch {}
    }
  };

  if (store.driver === 'db') {
    await withTransaction(exec);
  } else {
    await exec();
  }
}
