/**
 * Fixed PostgreSQL Queue Adapter with memory leak fixes and exponential backoff
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { QueueAdapter, QueueHandler } from '../queue';
import { log } from '../logger';

interface QueueJob {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  created_at: string;
  processed_at?: string;
  error?: string;
  attempt: number;
}

interface PollConfig {
  interval: NodeJS.Timeout;
  backoffMs: number;
  lastPollTime: number;
  consecutiveEmptyPolls: number;
}

export class PostgresQueueAdapter implements QueueAdapter {
  private supabase: SupabaseClient;
  private handlers = new Map<string, QueueHandler>();
  private pollConfigs = new Map<string, PollConfig>();
  private isShuttingDown = false;

  // Exponential backoff configuration
  private readonly MIN_POLL_INTERVAL_MS = 100;
  private readonly MAX_POLL_INTERVAL_MS = 30000; // 30 seconds
  private readonly BACKOFF_MULTIPLIER = 1.5;
  private readonly RESET_AFTER_EMPTY_POLLS = 10;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;

    // Graceful shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async enqueue(
    topic: string,
    payload: Record<string, unknown>,
    options?: { delay?: number }
  ): Promise<void> {
    const scheduledFor = options?.delay
      ? new Date(Date.now() + options.delay).toISOString()
      : new Date().toISOString();

    const { error } = await this.supabase
      .from('queue_jobs')
      .insert({
        topic,
        payload,
        scheduled_for: scheduledFor,
        attempt: 0,
      });

    if (error) {
      log.error({ error, topic }, 'Failed to enqueue job');
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }
  }

  async subscribe(topic: string, handler: QueueHandler): Promise<void> {
    // Clean up any existing subscription
    this.unsubscribe(topic);

    this.handlers.set(topic, handler);

    // Initialize poll config with adaptive intervals
    const config: PollConfig = {
      interval: null as unknown as NodeJS.Timeout,
      backoffMs: this.MIN_POLL_INTERVAL_MS,
      lastPollTime: 0,
      consecutiveEmptyPolls: 0
    };

    this.pollConfigs.set(topic, config);

    // Start adaptive polling
    this.scheduleNextPoll(topic);

    // Immediate poll
    this.pollForJobs(topic);
  }

  private scheduleNextPoll(topic: string): void {
    if (this.isShuttingDown) return;

    const config = this.pollConfigs.get(topic);
    if (!config) return;

    // Clear existing interval if any
    if (config.interval) {
      clearTimeout(config.interval);
    }

    // Schedule next poll with current backoff
    config.interval = setTimeout(() => {
      if (!this.isShuttingDown) {
        this.pollForJobs(topic);
      }
    }, config.backoffMs);

    // Don't let the timer keep the process alive
    if (config.interval.unref) {
      config.interval.unref();
    }
  }

  private async pollForJobs(topic: string): Promise<void> {
    if (this.isShuttingDown) return;

    const handler = this.handlers.get(topic);
    const config = this.pollConfigs.get(topic);
    if (!handler || !config) return;

    try {
      // Record poll time
      config.lastPollTime = Date.now();

      // Atomic job claim using PostgreSQL's FOR UPDATE SKIP LOCKED
      const { data: job, error } = await this.supabase.rpc('claim_next_job', {
        p_topic: topic,
        p_now: new Date().toISOString()
      });

      if (error) {
        log.error({ error, topic }, 'Error claiming job');
        // On error, use exponential backoff
        this.increaseBackoff(config);
        this.scheduleNextPoll(topic);
        return;
      }

      if (!job) {
        // No jobs available
        config.consecutiveEmptyPolls++;

        // Increase backoff when queue is empty
        if (config.consecutiveEmptyPolls >= this.RESET_AFTER_EMPTY_POLLS) {
          this.increaseBackoff(config);
        }

        this.scheduleNextPoll(topic);
        return;
      }

      // Job found - reset backoff
      config.consecutiveEmptyPolls = 0;
      config.backoffMs = this.MIN_POLL_INTERVAL_MS;

      // Process the job
      try {
        await handler(job.payload);

        // Mark job as completed
        await this.supabase
          .from('queue_jobs')
          .update({
            processed_at: new Date().toISOString(),
            status: 'completed'
          })
          .eq('id', job.id);

      } catch (handlerError) {
        log.error({ error: handlerError, job }, 'Job handler failed');

        // Update job with error
        await this.supabase
          .from('queue_jobs')
          .update({
            error: String(handlerError),
            attempt: job.attempt + 1,
            status: job.attempt >= 3 ? 'failed' : 'pending',
            // Exponential backoff for retries
            scheduled_for: new Date(Date.now() + Math.pow(2, job.attempt) * 1000).toISOString()
          })
          .eq('id', job.id);
      }

      // Schedule next poll immediately after processing
      this.scheduleNextPoll(topic);

    } catch (error) {
      log.error({ error, topic }, 'Poll cycle error');
      // On unexpected error, use exponential backoff
      this.increaseBackoff(config);
      this.scheduleNextPoll(topic);
    }
  }

  private increaseBackoff(config: PollConfig): void {
    config.backoffMs = Math.min(
      config.backoffMs * this.BACKOFF_MULTIPLIER,
      this.MAX_POLL_INTERVAL_MS
    );
  }

  unsubscribe(topic: string): void {
    const config = this.pollConfigs.get(topic);

    if (config?.interval) {
      clearTimeout(config.interval);
    }

    this.handlers.delete(topic);
    this.pollConfigs.delete(topic);
  }

  hasSubscribers(topic: string): boolean {
    return this.handlers.has(topic);
  }

  getOldestAgeMs(topic: string): number | null {
    // This would require a database query to check the oldest unprocessed job
    // For now, return null to indicate unknown
    return null;
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    log.info('Shutting down PostgreSQL queue adapter');
    this.isShuttingDown = true;

    // Clean up all polling intervals
    for (const [topic, config] of this.pollConfigs.entries()) {
      if (config.interval) {
        clearTimeout(config.interval);
      }
      log.info({ topic }, 'Stopped polling for topic');
    }

    this.handlers.clear();
    this.pollConfigs.clear();
  }

  // Get queue statistics for monitoring
  async getQueueStats(topic?: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    oldestPendingAge?: number;
  }> {
    const baseQuery = this.supabase
      .from('queue_jobs')
      .select('status, created_at', { count: 'exact' });

    if (topic) {
      baseQuery.eq('topic', topic);
    }

    const { data, error } = await baseQuery;

    if (error) {
      log.error({ error }, 'Failed to get queue stats');
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      oldestPendingAge: undefined as number | undefined
    };

    let oldestPending: Date | null = null;

    for (const job of data || []) {
      stats[job.status as keyof typeof stats]++;

      if (job.status === 'pending') {
        const createdAt = new Date(job.created_at);
        if (!oldestPending || createdAt < oldestPending) {
          oldestPending = createdAt;
        }
      }
    }

    if (oldestPending) {
      stats.oldestPendingAge = Date.now() - oldestPending.getTime();
    }

    return stats;
  }
}

// Database function for atomic job claiming (add to migration)
const CLAIM_JOB_FUNCTION = `
CREATE OR REPLACE FUNCTION claim_next_job(p_topic text, p_now timestamp)
RETURNS TABLE (
  id uuid,
  topic text,
  payload jsonb,
  attempt int,
  created_at timestamp
) AS $$
BEGIN
  RETURN QUERY
  UPDATE queue_jobs
  SET status = 'processing',
      locked_until = p_now + interval '5 minutes'
  WHERE id = (
    SELECT id
    FROM queue_jobs
    WHERE topic = p_topic
      AND status = 'pending'
      AND scheduled_for <= p_now
      AND (locked_until IS NULL OR locked_until < p_now)
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    queue_jobs.id,
    queue_jobs.topic,
    queue_jobs.payload,
    queue_jobs.attempt,
    queue_jobs.created_at;
END;
$$ LANGUAGE plpgsql;
`;