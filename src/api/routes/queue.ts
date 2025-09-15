import type { Express } from 'express';
import { getCounts, STEP_READY_TOPIC, STEP_DLQ_TOPIC, listDlq, rehydrateDlq, getOldestAgeMs } from '../../lib/queue';
import IORedis from 'ioredis';

export function mount(app: Express) {
  app.get('/dev/queue', async (_req, res) => {
    try {
      const counts = await getCounts(STEP_READY_TOPIC);
      const oldestAgeMs = getOldestAgeMs(STEP_READY_TOPIC);
      res.json({ topic: STEP_READY_TOPIC, counts, oldestAgeMs });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'failed to get counts' });
    }
  });
  app.get('/dev/redis', async (_req, res) => {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const r = new IORedis(url, { maxRetriesPerRequest: null });
    try {
      const pong = await r.ping();
      res.json({ url, ok: pong === 'PONG' });
    } catch (e) {
      res.status(500).json({ url, ok: false, error: e instanceof Error ? e.message : 'redis error' });
    } finally {
      r.disconnect();
    }
  });
  app.get('/dev/worker/health', async (_req, res) => {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const r = new IORedis(url, { maxRetriesPerRequest: null });
    try {
      const ts = await r.get('nofx:worker:heartbeat');
      const last = ts ? Number(ts) : 0;
      const ageMs = last ? Date.now() - last : null;
      res.json({ last, ageMs, healthy: !!last && ageMs! < 12000 });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'redis error' });
    } finally {
      r.disconnect();
    }
  });

  // DLQ listing and rehydrate
  app.get('/dev/dlq', async (_req, res) => {
    try {
      const items = await listDlq(STEP_DLQ_TOPIC);
      res.json({ topic: STEP_DLQ_TOPIC, count: items.length, items });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'failed to list dlq' });
    }
  });
  app.post('/dev/dlq/rehydrate', async (req, res) => {
    const max = Number((req.body?.max ?? 50));
    try {
      const n = await rehydrateDlq(STEP_DLQ_TOPIC, Math.max(0, Math.min(max, 500)));
      res.json({ topic: STEP_DLQ_TOPIC, rehydrated: n });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'failed to rehydrate dlq' });
    }
  });
}

export default mount;
