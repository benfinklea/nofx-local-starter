/**
 * Queue System Types
 *
 * This module provides type-safe queue operations with generic constraints
 * to ensure compile-time type safety for job payloads and results.
 */

/**
 * Base constraint for all queue job payloads
 * All job data must be JSON-serializable for storage and transmission
 */
export interface QueuePayload {
  [key: string]: unknown;
}

/**
 * Configuration options for queue jobs
 */
export interface JobOptions {
  priority?: number;
  delay?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Generic job result with type-safe data
 *
 * @template T - The type of data returned by the job (must extend QueuePayload)
 *
 * @example
 * ```typescript
 * interface RunJobResult extends QueuePayload {
 *   runId: string;
 *   status: 'completed' | 'failed';
 * }
 *
 * const result: JobResult<RunJobResult> = {
 *   success: true,
 *   data: { runId: 'run_123', status: 'completed' },
 *   completedAt: Date.now()
 * };
 * ```
 */
export interface JobResult<T extends QueuePayload = QueuePayload> {
  success: boolean;
  data?: T;
  error?: string;
  completedAt?: number;
}

/**
 * Queue statistics for monitoring
 */
export interface QueueStats {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  priority?: number;
}

/**
 * Job lifecycle status
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'delayed';

/**
 * Generic job with type-safe payload
 *
 * @template T - The type of job data (must extend QueuePayload for serializability)
 *
 * @example
 * ```typescript
 * interface RunJobPayload extends QueuePayload {
 *   runId: string;
 *   stepId: string;
 *   idempotencyKey: string;
 * }
 *
 * const job: Job<RunJobPayload> = {
 *   id: 'job_123',
 *   type: 'run',
 *   data: {
 *     runId: 'run_123',
 *     stepId: 'step_456',
 *     idempotencyKey: 'run_123:step_456:hash'
 *   },
 *   priority: 1
 * };
 * ```
 */
export interface Job<T extends QueuePayload = QueuePayload> {
  id: string;
  type: string;
  data: T;
  priority?: number;
  delay?: number;
  maxRetries?: number;
  retryDelay?: number;
  retries?: number;
  status?: JobStatus;
  enqueuedAt?: number;
  processedAt?: number;
  completedAt?: number;
  failedAt?: number;
}