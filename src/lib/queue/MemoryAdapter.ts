import { log } from "../logger";
import { metrics } from "../metrics";

type Job = { id: number; payload: unknown; runAt: number; enqueuedAt: number };

export class MemoryQueueAdapter {
  private subs = new Map<string, Array<(payload: unknown) => Promise<unknown>>>();
  private queues = new Map<string, Job[]>();
  private active = new Map<string, number>();
  private counts = new Map<string, { waiting:number; active:number; completed:number; failed:number; delayed:number; paused:number }>();
  private idSeq = 1;
  private dlq = new Map<string, Job[]>();
  private readonly backoffScheduleMs = [0, 2000, 5000, 10000];
  private maxConcurrent = Math.max(1, Number(process.env.WORKER_CONCURRENCY || process.env.NOFX_WORKER_CONCURRENCY || 4));

  private ensure(topic: string) {
    if (!this.queues.has(topic)) this.queues.set(topic, []);
    if (!this.counts.has(topic)) this.counts.set(topic, { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });
    if (!this.active.has(topic)) this.active.set(topic, 0);
  }

  private updateGauges(topic: string) {
    try {
      const c = this.counts.get(topic)!;
      metrics.queueDepth.set({ topic, state: 'waiting' }, c.waiting);
      metrics.queueDepth.set({ topic, state: 'active' }, c.active);
      metrics.queueDepth.set({ topic, state: 'completed' }, c.completed);
      metrics.queueDepth.set({ topic, state: 'failed' }, c.failed);
      metrics.queueDepth.set({ topic, state: 'delayed' }, c.delayed);
      metrics.queueDepth.set({ topic, state: 'paused' }, c.paused);
      const dlqSize = (this.dlq.get(topic) || []).length;
      metrics.dlqSize.set({ topic }, dlqSize);
      const oldest = this.getOldestAgeMs(topic) || 0;
      metrics.queueOldestAgeMs.set({ topic }, oldest);
    } catch {}
  }

  async enqueue(topic: string, payload: unknown, options?: { delay?: number }) {
    this.ensure(topic);
    const delay = Math.max(0, Number(options?.delay || 0));
    const now = Date.now();
    const runAt = now + delay;
    const job: Job = { id: this.idSeq++, payload, runAt, enqueuedAt: now };
    const q = this.queues.get(topic)!;
    q.push(job);
    const c = this.counts.get(topic)!;
    if (delay > 0) c.delayed += 1; else c.waiting += 1;
    log.info({ topic, payload, delay }, 'memq.enqueued');
    this.updateGauges(topic);
    setTimeout(() => this.drain(topic), Math.max(0, runAt - Date.now()));
  }

  subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>) {
    const arr = this.subs.get(topic) || [];
    arr.push(handler);
    this.subs.set(topic, arr);
    log.info({ topic }, 'memq.subscribed');
    // kick off any waiting jobs
    this.drain(topic);
  }

  private async drain(topic: string) {
    this.ensure(topic);
    const subs = this.subs.get(topic) || [];
    if (subs.length === 0) return;
    const handler = subs[0];
    const q = this.queues.get(topic)!;
    const c = this.counts.get(topic)!;
    const now = Date.now();

    // Launch up to maxConcurrent jobs that are ready
    for (;;) {
      const active = this.active.get(topic) || 0;
      if (active >= this.maxConcurrent) break;
      const readyIdx = q.findIndex(j => j.runAt <= now);
      if (readyIdx === -1) break;
      const job = q.splice(readyIdx, 1)[0];
      if (job.runAt > now) { c.delayed = Math.max(0, c.delayed - 1); } else { c.waiting = Math.max(0, c.waiting - 1); }
      this.active.set(topic, active + 1);
      c.active += 1;
      this.updateGauges(topic);
      (async () => {
        try {
          await handler(job.payload);
          c.completed += 1;
          log.info({ topic, jobId: job.id, status: 'completed' }, 'memq.completed');
        } catch (err) {
          c.failed += 1;
          log.error({ topic, jobId: job.id, status: 'failed', err }, 'memq.failed');
          // retry with backoff schedule; on max, move to DLQ
          const rawPayload = job.payload;
          const payloadObject = (typeof rawPayload === 'object' && rawPayload !== null)
            ? rawPayload as Record<string, unknown>
            : {};
          const attempt = Number(payloadObject['__attempt'] ?? 1);
          const nextIndex = attempt; // index into backoffSchedule for next delay
          const nextDelay = this.backoffScheduleMs[nextIndex];
          if (Number.isFinite(nextDelay)) {
            const nextPayload = { ...payloadObject, __attempt: attempt + 1 };
            await this.enqueue(topic, nextPayload, { delay: nextDelay });
            try {
              const providerValue = payloadObject['provider'];
              const provider = typeof providerValue === 'string'
                ? providerValue
                : String(providerValue ?? 'queue');
              metrics.retriesTotal.inc({ provider });
            } catch {}
          } else {
            const dlqTopic = (topic === 'step.ready') ? 'step.dlq' : `${topic}.dlq`;
            const dlqs = this.dlq.get(dlqTopic) || [];
            dlqs.push({ id: this.idSeq++, payload: rawPayload, runAt: Date.now(), enqueuedAt: Date.now() } as Job);
            this.dlq.set(dlqTopic, dlqs);
            log.warn({ topic, jobId: job.id, attempts: attempt, dlqTopic }, 'memq.to_dlq');
          }
        } finally {
          c.active = Math.max(0, c.active - 1);
          this.active.set(topic, Math.max(0, (this.active.get(topic) || 1) - 1));
          this.updateGauges(topic);
          if (this.queues.get(topic)!.length) setImmediate(() => this.drain(topic));
        }
      })();
    }
  }

  async getCounts(topic: string) {
    this.ensure(topic);
    return this.counts.get(topic)!;
  }

  hasSubscribers(topic: string): boolean {
    const arr = this.subs.get(topic) || [];
    return arr.length > 0;
  }

  async listDlq(topic: string) {
    return (this.dlq.get(topic) || []).map(j => j.payload);
  }
  async rehydrateDlq(topic: string, max = 50) {
    const arr = this.dlq.get(topic) || [];
    const take = arr.splice(0, Math.max(0, Math.min(max, arr.length)));
    this.dlq.set(topic, arr);
    for (const job of take) {
      const rawPayload = job.payload;
      const payloadObject = (typeof rawPayload === 'object' && rawPayload !== null)
        ? rawPayload as Record<string, unknown>
        : {};
      const payload = { ...payloadObject, __attempt: 1 };
      const from = topic.endsWith('.dlq') ? topic.replace(/\.dlq$/, '.ready') : topic;
      await this.enqueue(from, payload, { delay: 0 });
    }
    return take.length;
  }

  /** Oldest waiting job age in ms (excludes delayed jobs not yet due). */
  getOldestAgeMs(topic: string): number | null {
    this.ensure(topic);
    const q = this.queues.get(topic)!;
    const now = Date.now();
    let oldest: number | null = null;
    for (const j of q) {
      if (j.runAt > now) continue; // not yet due
      const age = now - j.enqueuedAt;
      if (oldest == null || age > oldest) oldest = age;
    }
    return oldest;
  }
}
