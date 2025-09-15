import { Queue, Worker, JobsOptions, Job } from "bullmq";
import IORedis from "ioredis";
import { log } from "../logger";
import { metrics } from "../metrics";

export class RedisQueueAdapter {
  connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });
  queues = new Map<string, Queue>();
  private readonly backoffScheduleMs = [0, 2000, 5000, 10000];
  private readonly DLQ_TOPIC = 'step.dlq';

  private getQueue(topic: string) {
    if (!this.queues.has(topic)) {
      const q = new Queue(topic, { connection: this.connection });
      this.queues.set(topic, q);
    }
    return this.queues.get(topic)!;
  }
  private async updateGauges(topic: string) {
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
        const waiting = await (q as any).getWaiting(0, 19) as Job[];
        let oldestTs: number | null = null;
        for (const j of waiting) {
          const ts = (j as any).timestamp as number | undefined;
          if (typeof ts === 'number') {
            if (oldestTs == null || ts < oldestTs) oldestTs = ts;
          }
        }
        const age = oldestTs != null ? Math.max(0, now - oldestTs) : 0;
        metrics.queueOldestAgeMs.set({ topic }, age);
      } catch {}
    } catch {}
  }
  async enqueue(topic: string, payload: any, options?: JobsOptions) {
    await this.getQueue(topic).add("job", payload, options);
    log.info({ topic, payload }, "enqueued");
    this.updateGauges(topic);
  }
  subscribe(topic: string, handler: (payload:any)=>Promise<void>) {
    const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || process.env.NOFX_WORKER_CONCURRENCY || 1));
    const w = new Worker(topic, async (job) => {
      await handler(job.data);
    }, { connection: this.connection, concurrency });
    w.on('ready', () => { log.info({ topic }, 'worker.ready'); this.updateGauges(topic); });
    w.on('active', (job) => { log.info({ topic, jobId: job.id }, 'worker.active'); this.updateGauges(topic); });
    w.on('completed', (job) => { log.info({ topic, jobId: job.id, status: 'completed' }, 'worker.completed'); this.updateGauges(topic); });
    w.on('failed', async (job, err) => {
      log.error({ topic, jobId: job?.id, status: 'failed', err }, 'worker.failed');
      try {
        if (!job) return;
        const data = job.data || {};
        const attempt = Number(data.__attempt || 1);
        const nextDelay = this.backoffScheduleMs[attempt];
        if (Number.isFinite(nextDelay)) {
          const nextPayload = { ...data, __attempt: attempt + 1 };
          await this.getQueue(topic).add('job', nextPayload, { delay: nextDelay });
          try { metrics.retriesTotal.inc({ provider: String(data?.provider || 'queue') }); } catch {}
        } else {
          await this.getQueue(this.DLQ_TOPIC).add('job', data, { delay: 0 });
          log.warn({ topic, jobId: job.id, attempts: attempt }, 'redis.to_dlq');
        }
      } catch (e) {
        log.error({ e }, 'redis.failed-handler.error');
      }
      this.updateGauges(topic);
    });
    log.info({ topic }, "subscribed");
  }

  async getCounts(topic: string) {
    const q = this.getQueue(topic);
    return q.getJobCounts('waiting','active','completed','failed','delayed','paused');
  }

  constructor() {
    this.connection.on('connect', () => log.info('redis.connect'));
    this.connection.on('ready', () => log.info('redis.ready'));
    this.connection.on('error', (err) => log.error({ err }, 'redis.error'));
    this.connection.on('reconnecting', () => log.warn('redis.reconnecting'));
    this.connection.on('end', () => log.warn('redis.end'));
  }

  async listDlq(topic: string) {
    const q = this.getQueue(topic);
    const jobs: Job[] = await q.getJobs(['waiting','delayed']);
    return jobs.map(j => j.data);
  }
  async rehydrateDlq(topic: string, max = 50) {
    const q = this.getQueue(topic);
    const jobs: Job[] = await q.getJobs(['waiting','delayed']);
    const take = jobs.slice(0, max);
    let n = 0;
    for (const j of take) {
      await this.getQueue('step.ready').add('job', { ...j.data, __attempt: 1 }, { delay: 0 });
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
