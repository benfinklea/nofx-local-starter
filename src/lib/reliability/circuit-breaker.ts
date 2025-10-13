/**
 * Circuit Breaker pattern for external service protection
 * Part of HEAVY MODE reliability patterns
 */

import { log } from '../logger';
import { metrics } from '../metrics';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
  name?: string;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker to prevent cascading failures with external services
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private nextRetry = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000; // 30 seconds
    this.resetTimeout = options.resetTimeout ?? 60000; // 60 seconds
    this.name = options.name ?? 'circuit-breaker';
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'open') {
      if (Date.now() < this.nextRetry) {
        this.recordMetric('rejected');
        throw new CircuitBreakerError(
          `Circuit breaker "${this.name}" is open. Retry after ${new Date(this.nextRetry).toISOString()}`,
          'open'
        );
      }
      // Try half-open
      this.state = 'half-open';
      this.successCount = 0;
      log.info({ name: this.name }, 'Circuit breaker entering half-open state');
    }

    // Execute with timeout
    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Circuit breaker timeout after ${this.timeout}ms`)),
          this.timeout
        )
      )
    ]);
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
        log.info({ name: this.name }, 'Circuit breaker closed after successful recovery');
        this.recordMetric('closed');
      }
    }

    this.recordMetric('success');
  }

  private onFailure(error: unknown): void {
    this.failureCount++;
    this.successCount = 0;

    log.warn({
      name: this.name,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error instanceof Error ? error.message : String(error)
    }, 'Circuit breaker recorded failure');

    if (this.failureCount >= this.failureThreshold || this.state === 'half-open') {
      this.state = 'open';
      this.nextRetry = Date.now() + this.resetTimeout;
      log.error({
        name: this.name,
        resetAt: new Date(this.nextRetry).toISOString()
      }, 'Circuit breaker opened due to failures');
      this.recordMetric('opened');
    }

    this.recordMetric('failure');
  }

  private recordMetric(event: 'success' | 'failure' | 'rejected' | 'opened' | 'closed'): void {
    try {
      if ('circuitBreakerEvents' in metrics) {
        (metrics.circuitBreakerEvents as { inc: (labels: { name: string; event: string }) => void })
          .inc({ name: this.name, event });
      }
    } catch {
      // Metrics not available, skip
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failureCount: number; successCount: number; nextRetry: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextRetry: this.nextRetry
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextRetry = 0;
    log.info({ name: this.name }, 'Circuit breaker manually reset');
  }
}
