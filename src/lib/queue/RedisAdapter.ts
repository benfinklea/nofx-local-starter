import { Queue, Worker, JobsOptions, Job } from "bullmq";
import { log } from "../logger";
import { metrics } from "../metrics";
import { STEP_DLQ_TOPIC } from "./constants";
import {
  toRetryablePayload,
  getAttemptNumber,
  createRetryPayload,
  getProvider,
} from "../typeGuards";

// Use synchronous require for IORedis to work properly with jest mocks
function getIORedis() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const IORedis = require("ioredis");
  return IORedis.default || IORedis;
}

export class RedisQueueAdapter {
  private redisUrl: string;
  queues = new Map<string, Queue>();
  private readonly backoffScheduleMs: readonly number[] = [0, 2000, 5000, 10000] as const;
  private readonly DLQ_TOPIC = STEP_DLQ_TOPIC;

  constructor() {
    this.redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  }

  private getQueue(topic: string): Queue {
    // Input validation
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      throw new Error('Queue topic must be a non-empty string');
    }

    if (!this.queues.has(topic)) {
      try {
        const IORedis = getIORedis();
        const connection = new IORedis(this.redisUrl, {
          maxRetriesPerRequest: null,
          retryStrategy: (times: number) => {
            // Exponential backoff with max delay of 3 seconds
            return Math.min(times * 50, 3000);
          }
        });

        // Handle connection errors
        connection.on('error', (err: Error) => {
          log.error({ topic, error: err }, 'Redis connection error');
        });

        const q = new Queue(topic, { connection });
        this.queues.set(topic, q);
      } catch (error) {
        log.error({ topic, error }, 'Failed to create queue');
        throw new Error(`Failed to initialize queue "${topic}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const queue = this.queues.get(topic);
    if (!queue) {
      throw new Error(`Queue ${topic} not found after initialization`);
    }
    return queue;
  }
  private async updateGauges(topic: string): Promise<void> {
    try {
      const q = this.getQueue(topic);
      const c = await q.getJobCounts('waiting','active','completed','failed','delayed','paused');
      metrics.queueDepth.set({ topic, state: 'waiting' }, c.waiting || 0);
      metrics.queueDepth.set({ topic, state: 'active' }, c.active || 0);
      metrics.queueDepth.set({ topic, state: 'completed' }, c.completed || 0);
      metrics.queueDepth.set({ topic, state: 'failed' }, c.failed || 0);
      metrics.queueDepth.set({ topic, state: 'delayed' }, c.delayed || 0);
      metrics.queueDepth.set({ topic, state: 'paused' }, c.paused || 0);
      metrics.dlqSize.set({ topic }, c.failed || 0);
      // Oldest waiting job age (approximate, scans up to 20 waiting jobs)
      try {
        const now = Date.now();
        const waiting = await q.getWaiting(0, 19);
        let oldestTs: number | null = null;
        for (const job of waiting as Job[]) {
          const ts = Number(job.timestamp);
          if (Number.isFinite(ts)) {
            oldestTs = oldestTs == null ? ts : Math.min(oldestTs, ts);
          }
        }
        const age = oldestTs != null ? Math.max(0, now - oldestTs) : 0;
        metrics.queueOldestAgeMs.set({ topic }, age);
      } catch {}
    } catch {}
  }
  async enqueue(topic: string, payload: unknown, options?: JobsOptions): Promise<void> {
    // Input validation
    if (!topic || typeof topic !== 'string') {
      throw new Error('Topic must be a non-empty string');
    }

    try {
      const q = this.getQueue(topic);
      await q.add("job", payload, options);
      log.info({ topic, payload }, "enqueued");
      // Update gauges in background, don't block on failure
      this.updateGauges(topic).catch(err => {
        log.warn({ topic, error: err }, 'Failed to update gauges after enqueue');
      });
    } catch (error) {
      log.error({ topic, payload, error }, 'Failed to enqueue job');
      throw new Error(`Failed to enqueue job to "${topic}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>): void {
    // Input validation
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      throw new Error('Topic must be a non-empty string');
    }

    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    try {
      const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || process.env.NOFX_WORKER_CONCURRENCY || 1));
      const IORedis = getIORedis();
      const connection = new IORedis(this.redisUrl, { maxRetriesPerRequest: null });

      // Handle connection errors
      connection.on('error', (err: Error) => {
        log.error({ topic, error: err }, 'Worker Redis connection error');
      });

      const w = new Worker(topic, async (job) => {
        try {
          await handler(job.data);
        } catch (error) {
          log.error({ topic, jobId: job.id, error }, 'Handler execution failed');
          throw error; // Re-throw to trigger retry logic
        }
      }, { connection, concurrency });

      w.on('ready', () => { log.info({ topic }, 'worker.ready'); this.updateGauges(topic); });
      w.on('active', (job) => { log.info({ topic, jobId: job.id }, 'worker.active'); this.updateGauges(topic); });
      w.on('completed', (job) => { log.info({ topic, jobId: job.id, status: 'completed' }, 'worker.completed'); this.updateGauges(topic); });
      w.on('failed', async (job, err) => {
        log.error({ topic, jobId: job?.id, status: 'failed', err }, 'worker.failed');
        try {
          if (!job) return;

          // Use type guard to safely extract payload data
          const rawData = job.data;
          const payload = toRetryablePayload(rawData);
          const attempt = getAttemptNumber(payload);
          const nextDelay = this.backoffScheduleMs[attempt];

          if (Number.isFinite(nextDelay)) {
            // Create retry payload with incremented attempt
            const nextPayload = createRetryPayload(rawData);
            const q = this.getQueue(topic);
            await q.add('job', nextPayload, { delay: nextDelay });

            try {
              // Use type guard to safely extract provider
              const provider = getProvider(payload);
              metrics.retriesTotal.inc({ provider });
            } catch {}
          } else {
            // Max retries reached, move to DLQ
            const dlq = this.getQueue(this.DLQ_TOPIC);
            await dlq.add('job', payload, { delay: 0 });
            log.warn({ topic, jobId: job.id, attempts: attempt }, 'redis.to_dlq');
          }
        } catch (e) {
          log.error({ e }, 'redis.failed-handler.error');
        }
        this.updateGauges(topic);
      });

      log.info({ topic }, "subscribed");
    } catch (error) {
      log.error({ topic, error }, 'Failed to subscribe to topic');
      throw new Error(`Failed to subscribe to "${topic}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCounts(topic: string): Promise<Record<string, number>> {
    const q = this.getQueue(topic);
    return q.getJobCounts('waiting','active','completed','failed','delayed','paused');
  }

  async listDlq(topic: string): Promise<unknown[]> {
    const q = this.getQueue(topic);
    const jobs: Job[] = await q.getJobs(['waiting','delayed']);
    return jobs.map(j => j.data);
  }
  async rehydrateDlq(topic: string, max = 50): Promise<number> {
    const q = this.getQueue(topic);
    const jobs: Job[] = await q.getJobs(['waiting','delayed']);
    const take = jobs.slice(0, max);
    let n = 0;
    for (const j of take) {
      const readyQ = this.getQueue('step.ready');
      await readyQ.add('job', { ...j.data, __attempt: 1 }, { delay: 0 });
      await j.remove();
      n += 1;
    }
    return n;
  }

  // Not easily available without scanning Redis sorted sets; return null for now
  getOldestAgeMs(_topic: string): number | null {
    return null;
  }
}
