import { store } from "./store";
import { OUTBOX_TOPIC } from './queue';
import { withTransaction } from './db';

export async function recordEvent(runId: string, type: string, payload: any = {}, stepId?: string) {
  const exec = async () => {
    await store.recordEvent(runId, type, payload, stepId);
    if (store.driver === 'db') {
      await store.outboxAdd(OUTBOX_TOPIC, { runId, stepId, type, payload });
    } else {
      try { await store.outboxAdd(OUTBOX_TOPIC, { runId, stepId, type, payload }); } catch {}
    }
  };

  if (store.driver === 'db') {
    await withTransaction(exec);
  } else {
    await exec();
  }
}
