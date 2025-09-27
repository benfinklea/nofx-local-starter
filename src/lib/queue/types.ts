/**
 * Queue System Types
 */

export interface JobOptions {
  priority?: number;
  delay?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  completedAt?: number;
}

export interface QueueStats {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  priority?: number;
}

export interface Job {
  id: string;
  type: string;
  data: any;
  priority?: number;
  delay?: number;
  maxRetries?: number;
  retryDelay?: number;
  retries?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'delayed';
  enqueuedAt?: number;
  processedAt?: number;
  completedAt?: number;
  failedAt?: number;
}