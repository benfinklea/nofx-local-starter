import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { log } from "../logger";

export class RedisQueueAdapter {
  connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });
  queues = new Map<string, Queue>();

  private getQueue(topic: string) {
    if (!this.queues.has(topic)) {
      this.queues.set(topic, new Queue(topic, { connection: this.connection }));
    }
    return this.queues.get(topic)!;
  }
  async enqueue(topic: string, payload: any, options?: JobsOptions) {
    await this.getQueue(topic).add("job", payload, options);
    log.info({ topic, payload }, "enqueued");
  }
  subscribe(topic: string, handler: (payload:any)=>Promise<void>) {
    // eslint-disable-next-line no-new
    new Worker(topic, async (job) => {
      await handler(job.data);
    }, { connection: this.connection });
    log.info({ topic }, "subscribed");
  }
}