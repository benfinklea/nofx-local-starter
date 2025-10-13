import { log } from "../logger";
import { metrics } from "../metrics";
import { Mutex } from "../reliability/mutex";
import {
  toRetryablePayload,
  getAttemptNumber,
  createRetryPayload,
  getProvider,
} from "../typeGuards";

type Job = { id: number; payload: unknown; runAt: number; enqueuedAt: number };

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export class MemoryQueueAdapter {
  private subs = new Map<string, Array<(payload: unknown) => Promise<unknown>>>();
  private queues = new Map<string, Job[]>();
  private active = new Map<string, number>();
  private counts = new Map<string, QueueCounts>();
  private idSeq = 1;
  private dlq = new Map<string, Job[]>();
  private readonly backoffScheduleMs: readonly number[] = [0, 2000, 5000, 10000] as const;
  private maxConcurrent = Math.max(1, Number(process.env.WORKER_CONCURRENCY || process.env.NOFX_WORKER_CONCURRENCY || 4));
  private readonly drainMutex = new Map<string, Mutex>(); // Prevent race conditions in drain()

  private ensure(topic: string): void {
    if (!this.queues.has(topic)) this.queues.set(topic, []);
    if (!this.counts.has(topic)) this.counts.set(topic, { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });
    if (!this.active.has(topic)) this.active.set(topic, 0);
  }

  private getQueueData(topic: string): { queue: Job[]; counts: QueueCounts; active: number } {
    this.ensure(topic);
    const queue = this.queues.get(topic);
    const counts = this.counts.get(topic);
    const active = this.active.get(topic);

    if (!queue || !counts || active === undefined) {
      throw new Error(`Queue ${topic} not properly initialized`);
    }

    return { queue, counts, active };
  }

  private updateGauges(topic: string): void {
    try {
      const { counts } = this.getQueueData(topic);
      metrics.queueDepth.set({ topic, state: 'waiting' }, counts.waiting);
      metrics.queueDepth.set({ topic, state: 'active' }, counts.active);
      metrics.queueDepth.set({ topic, state: 'completed' }, counts.completed);
      metrics.queueDepth.set({ topic, state: 'failed' }, counts.failed);
      metrics.queueDepth.set({ topic, state: 'delayed' }, counts.delayed);
      metrics.queueDepth.set({ topic, state: 'paused' }, counts.paused);
      const dlqSize = (this.dlq.get(topic) || []).length;
      metrics.dlqSize.set({ topic }, dlqSize);
      const oldest = this.getOldestAgeMs(topic) || 0;
      metrics.queueOldestAgeMs.set({ topic }, oldest);
    } catch {}
  }

  async enqueue(topic: string, payload: unknown, options?: { delay?: number }): Promise<void> {
    const { queue, counts } = this.getQueueData(topic);
    const delay = Math.max(0, Number(options?.delay || 0));
    const now = Date.now();
    const runAt = now + delay;
    const job: Job = { id: this.idSeq++, payload, runAt, enqueuedAt: now };
    queue.push(job);
    if (delay > 0) counts.delayed += 1; else counts.waiting += 1;
    log.info({ topic, payload, delay }, 'memq.enqueued');
    this.updateGauges(topic);
    setTimeout(() => this.drain(topic), Math.max(0, runAt - Date.now()));
  }

  subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>): void {
    const arr = this.subs.get(topic) || [];
    arr.push(handler);
    this.subs.set(topic, arr);
    log.info({ topic }, 'memq.subscribed');
    // kick off any waiting jobs
    this.drain(topic);
  }

  private async drain(topic: string): Promise<void> {
    const subs = this.subs.get(topic) || [];
    if (subs.length === 0) return;
    const handler = subs[0];

    // Ensure mutex exists for this topic
    if (!this.drainMutex.has(topic)) {
      this.drainMutex.set(topic, new Mutex());
    }
    const mutex = this.drainMutex.get(topic)!;

    // Use mutex to prevent race condition in check-then-act pattern
    await mutex.runExclusive(async () => {
      const { queue, counts } = this.getQueueData(topic);
      const now = Date.now();

      // Launch up to maxConcurrent jobs that are ready
      for (;;) {
        const currentActive = this.active.get(topic) || 0;
        if (currentActive >= this.maxConcurrent) break;
        const readyIdx = queue.findIndex(j => j.runAt <= now);
        if (readyIdx === -1) break;
        const job = queue.splice(readyIdx, 1)[0];

        // Type safety: ensure job was extracted (should always be true)
        if (!job) continue;

        if (job.runAt > now) { counts.delayed = Math.max(0, counts.delayed - 1); } else { counts.waiting = Math.max(0, counts.waiting - 1); }
        this.active.set(topic, currentActive + 1);
        counts.active += 1;
        this.updateGauges(topic);
        (async () => {
        try {
          // Call handler (already validated above)
          if (handler) {
            await handler(job.payload);
          }
          counts.completed += 1;
          log.info({ topic, jobId: job.id, status: 'completed' }, 'memq.completed');
        } catch (err) {
          counts.failed += 1;
          log.error({ topic, jobId: job.id, status: 'failed', err }, 'memq.failed');

          // Retry with backoff schedule; on max, move to DLQ
          const rawPayload = job.payload;

          // Use type guard to safely extract payload data
          const payloadObject = toRetryablePayload(rawPayload);
          const attempt = getAttemptNumber(payloadObject);
          const nextIndex = attempt; // index into backoffSchedule for next delay
          const nextDelay = this.backoffScheduleMs[nextIndex];

          if (Number.isFinite(nextDelay)) {
            // Create retry payload with incremented attempt
            const nextPayload = createRetryPayload(rawPayload);
            await this.enqueue(topic, nextPayload, { delay: nextDelay });

            try {
              // Use type guard to safely extract provider
              const provider = getProvider(payloadObject);
              metrics.retriesTotal.inc({ provider });
            } catch {}
          } else {
            // Max retries reached, move to DLQ
            const dlqTopic = (topic === 'step.ready') ? 'step.dlq' : `${topic}.dlq`;
            const dlqs = this.dlq.get(dlqTopic) || [];
            dlqs.push({ id: this.idSeq++, payload: rawPayload, runAt: Date.now(), enqueuedAt: Date.now() } as Job);
            this.dlq.set(dlqTopic, dlqs);
            log.warn({ topic, jobId: job.id, attempts: attempt, dlqTopic }, 'memq.to_dlq');
          }
        } finally {
          counts.active = Math.max(0, counts.active - 1);
          this.active.set(topic, Math.max(0, (this.active.get(topic) || 1) - 1));
          this.updateGauges(topic);
          const currentQueue = this.queues.get(topic);
          if (currentQueue && currentQueue.length > 0) {
            setImmediate(() => this.drain(topic));
          }
        }
        })();
      }
    });
  }

  async getCounts(topic: string): Promise<QueueCounts> {
    const { counts } = this.getQueueData(topic);
    return counts;
  }

  hasSubscribers(topic: string): boolean {
    const arr = this.subs.get(topic) || [];
    return arr.length > 0;
  }

  async listDlq(topic: string): Promise<unknown[]> {
    return (this.dlq.get(topic) || []).map(j => j.payload);
  }
  async rehydrateDlq(topic: string, max = 50): Promise<number> {
    const arr = this.dlq.get(topic) || [];
    const take = arr.splice(0, Math.max(0, Math.min(max, arr.length)));
    this.dlq.set(topic, arr);

    for (const job of take) {
      // Use type guard to safely convert payload
      const payloadObject = toRetryablePayload(job.payload);

      // Reset attempt counter for rehydration
      const payload = { ...payloadObject, __attempt: 1 };
      const from = topic.endsWith('.dlq') ? topic.replace(/\.dlq$/, '.ready') : topic;
      await this.enqueue(from, payload, { delay: 0 });
    }

    return take.length;
  }

  /** Oldest waiting job age in ms (excludes delayed jobs not yet due). */
  getOldestAgeMs(topic: string): number | null {
    const { queue } = this.getQueueData(topic);
    const now = Date.now();
    let oldest: number | null = null;
    for (const j of queue) {
      if (j.runAt > now) continue; // not yet due
      const age = now - j.enqueuedAt;
      if (oldest == null || age > oldest) oldest = age;
    }
    return oldest;
  }
}
