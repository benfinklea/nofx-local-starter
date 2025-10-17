import { createClient } from '@supabase/supabase-js';
import type { JobsOptions } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

/**
 * PostgreSQL-based Queue Adapter using Supabase
 *
 * This adapter uses Supabase's PostgreSQL as a queue backend,
 * eliminating the need for a separate Redis service.
 *
 * Perfect for Vercel + Supabase stack without additional dependencies.
 */

interface QueueJob {
  id: string;
  topic: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dlq';
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  locked_until?: string;
  error?: string;
  worker_id?: string;
}

export class PostgresQueueAdapter {
  private supabase: any;
  private workerId: string;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private handlers: Map<string, (payload: unknown) => Promise<unknown>> = new Map();

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for PostgresQueueAdapter');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.workerId = `worker-${process.pid}-${uuidv4().slice(0, 8)}`;

    // Initialize queue tables if needed
    this.initializeTables();
  }

  private async initializeTables() {
    // Create queue table if it doesn't exist
    const { error } = await this.supabase.rpc('create_queue_tables_if_not_exists');

    if (error && !error.message.includes('already exists')) {
      console.error('Failed to initialize queue tables:', error);
    }
  }

  async enqueue(topic: string, payload: unknown, options?: JobsOptions): Promise<void> {
    const job: Partial<QueueJob> = {
      id: uuidv4(),
      topic,
      payload,
      status: 'pending',
      attempts: 0,
      max_attempts: options?.attempts || 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (options?.delay) {
      const delayMs = typeof options.delay === 'number' ? options.delay : 0;
      job.locked_until = new Date(Date.now() + delayMs).toISOString();
    }

    const { error } = await this.supabase
      .from('queue_jobs')
      .insert(job);

    if (error) {
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }
  }

  subscribe(topic: string, handler: (payload: unknown) => Promise<unknown>): void {
    console.log(`[PostgresAdapter] subscribe() called for topic: ${topic}`);
    this.handlers.set(topic, handler);

    // Stop existing polling for this topic
    const existingInterval = this.pollingIntervals.get(topic);
    if (existingInterval) {
      console.log(`[PostgresAdapter] Clearing existing interval for topic: ${topic}`);
      clearInterval(existingInterval);
    }

    // Start polling for jobs
    console.log(`[PostgresAdapter] Setting up polling interval for topic: ${topic} (every 1000ms)`);
    const pollInterval = setInterval(async () => {
      console.log(`[PostgresAdapter] Interval tick - about to call pollForJobs for topic: ${topic}`);
      await this.pollForJobs(topic);
    }, 1000); // Poll every second

    this.pollingIntervals.set(topic, pollInterval);
    console.log(`[PostgresAdapter] Polling interval created and stored for topic: ${topic}`);

    // Immediate poll
    console.log(`[PostgresAdapter] Calling immediate poll for topic: ${topic}`);
    this.pollForJobs(topic);
  }

  private async pollForJobs(topic: string) {
    const handler = this.handlers.get(topic);
    if (!handler) return;

    console.log(`[PostgresAdapter] Polling for jobs on topic: ${topic}, workerId: ${this.workerId}`);

    // Atomic job claim using PostgreSQL's FOR UPDATE SKIP LOCKED
    const { data, error } = await this.supabase.rpc('claim_next_job', {
      p_topic: topic,
      p_worker_id: this.workerId,
      p_lock_duration_seconds: 30
    });

    console.log(`[PostgresAdapter] RPC claim_next_job response:`, {
      error: error ? error.message : null,
      dataType: Array.isArray(data) ? 'array' : typeof data,
      dataLength: Array.isArray(data) ? data.length : 'N/A',
      data: data
    });

    if (error) {
      console.error(`[PostgresAdapter] Error calling claim_next_job:`, error);
      return;
    }

    // RPC returns an array, get the first element
    const job = Array.isArray(data) ? data[0] : data;

    if (!job) {
      console.log(`[PostgresAdapter] No jobs available for topic: ${topic}`);
      return; // No jobs available
    }

    console.log(`[PostgresAdapter] Claimed job:`, {
      id: job.id,
      topic: topic,
      attempts: job.attempts,
      max_attempts: job.max_attempts
    });

    try {
      // Process the job
      await handler(job.payload);

      // Mark as completed
      await this.supabase
        .from('queue_jobs')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

    } catch (error: any) {
      // Handle failure
      const attempts = job.attempts + 1;

      if (attempts >= job.max_attempts) {
        // Move to DLQ
        await this.supabase
          .from('queue_jobs')
          .update({
            status: 'dlq',
            error: error.message || String(error),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      } else {
        // Retry with exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, attempts), 30000);
        await this.supabase
          .from('queue_jobs')
          .update({
            status: 'pending',
            attempts,
            locked_until: new Date(Date.now() + backoffMs).toISOString(),
            error: error.message || String(error),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }

      throw error;
    }
  }

  async getCounts(topic: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('queue_jobs')
      .select('status', { count: 'exact' })
      .eq('topic', topic);

    if (error) {
      throw new Error(`Failed to get counts: ${error.message}`);
    }

    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dlq: 0
    };

    data?.forEach((row: any) => {
      const status = row.status as keyof typeof counts;
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }

  hasSubscribers(topic: string): boolean {
    return this.handlers.has(topic);
  }

  async listDlq(topic: string): Promise<unknown[]> {
    const { data, error } = await this.supabase
      .from('queue_jobs')
      .select('*')
      .eq('topic', topic)
      .eq('status', 'dlq')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to list DLQ: ${error.message}`);
    }

    return data || [];
  }

  async rehydrateDlq(topic: string, max: number = 10): Promise<number> {
    const { data, error } = await this.supabase
      .from('queue_jobs')
      .update({
        status: 'pending',
        attempts: 0,
        error: null,
        locked_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('topic', topic)
      .eq('status', 'dlq')
      .limit(max)
      .select();

    if (error) {
      throw new Error(`Failed to rehydrate DLQ: ${error.message}`);
    }

    return data?.length || 0;
  }

  getOldestAgeMs(_topic: string): number | null {
    // This would require an async operation, so we'd need to refactor the interface
    // For now, return null
    return null;
  }

  // Cleanup method
  async shutdown() {
    // Clear all polling intervals
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.handlers.clear();
  }
}