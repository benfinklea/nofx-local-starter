import { store } from "../lib/store";
import { enqueue } from "../lib/queue";
import { log } from "../lib/logger";

const INTERVAL_MS = Number(process.env.OUTBOX_RELAY_INTERVAL_MS || 1000);
const BATCH = Number(process.env.OUTBOX_RELAY_BATCH || 25);

export function startOutboxRelay() {
  async function tick() {
    try {
      const rows = await store.outboxListUnsent(BATCH);
      type OutboxRow = { id: string; topic: string; payload: unknown };
      for (const r of rows as OutboxRow[]) {
        try {
          const payload = typeof r.payload === 'object' && r.payload !== null ? r.payload as Record<string, unknown> : {};
          await enqueue(r.topic, { ...payload, __attempt: 1 });
          await store.outboxMarkSent(r.id);
        } catch {
          // leave unsent for next tick
          // optional: add backoff if needed
        }
      }
    } catch (e) {
      log.error({ e }, 'outbox.tick.error');
    } finally {
      setTimeout(tick, INTERVAL_MS);
    }
  }
  setTimeout(tick, INTERVAL_MS);
}

export default startOutboxRelay;
