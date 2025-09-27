import { store } from "../lib/store";
import { enqueue, OUTBOX_TOPIC, type OutboxJobPayload } from "../lib/queue";
import { log } from "../lib/logger";

const INTERVAL_MS = Number(process.env.OUTBOX_RELAY_INTERVAL_MS || 1000);
const BATCH = Number(process.env.OUTBOX_RELAY_BATCH || 25);

export function startOutboxRelay() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const scheduleTick = () => {
    const handle = setTimeout(tick, INTERVAL_MS);
    if (typeof handle.unref === 'function') {
      handle.unref();
    }
  };

  async function tick() {
    try {
      const rows = await store.outboxListUnsent(BATCH);
      type OutboxRow = { id: string; topic: string; payload: unknown };
      for (const r of rows as OutboxRow[]) {
        try {
          if (r.topic === OUTBOX_TOPIC) {
            const payload = normalizeOutboxPayload(r.payload);
            await enqueue(OUTBOX_TOPIC, { ...payload, __attempt: 1 });
          } else {
            const payload = typeof r.payload === 'object' && r.payload !== null
              ? { ...(r.payload as Record<string, unknown>), __attempt: 1 }
              : { __attempt: 1 };
            await enqueue(r.topic, payload);
          }
          await store.outboxMarkSent(r.id);
        } catch {
          // leave unsent for next tick
          // optional: add backoff if needed
        }
      }
    } catch (e) {
      log.error({ e }, 'outbox.tick.error');
    } finally {
      scheduleTick();
    }
  }

  scheduleTick();
}

function normalizeOutboxPayload(value: unknown): OutboxJobPayload {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Outbox payload must be an object, received: ${typeof value}. Use an object with runId and type properties.`);
  }

  const record = value as Record<string, unknown>;
  const runId = record.runId;
  const type = record.type;
  if (typeof runId !== 'string' || typeof type !== 'string') {
    throw new Error(`Outbox payload missing required fields. Expected: {runId: string, type: string}, received: {runId: ${typeof runId}, type: ${typeof record.type}}`);
  }

  const payload = record.payload as OutboxJobPayload['payload'];
  const stepIdValue = record.stepId;
  const stepId = typeof stepIdValue === 'string' ? stepIdValue : undefined;
  return {
    runId,
    type,
    payload,
    ...(stepId ? { stepId } : {}),
  };
}

export default startOutboxRelay;
