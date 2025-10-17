/**
 * Resilience patterns for Agent SDK integration
 *
 * Implements:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Rate limit handling
 *
 * Heavy mode reliability enhancements
 */

import { log } from '../logger';

/**
 * Configuration for retry logic
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2, // Exponential: 1s, 2s, 4s, 8s (capped at 10s)
  retryableErrors: [
    '429', // Rate limit
    '500', // Internal server error
    '502', // Bad gateway
    '503', // Service unavailable
    '504', // Gateway timeout
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'network',
  ],
};

/**
 * Execute operation with retry logic and exponential backoff
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: { runId?: string; stepId?: string }
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < retryConfig.maxRetries) {
    try {
      const result = await operation();

      if (attempt > 0) {
        log.info({
          ...context,
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries,
        }, 'Operation succeeded after retry');
      }

      return result;
    } catch (error) {
      attempt++;
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = retryConfig.retryableErrors.some(
        errorPattern => lastError!.message.toLowerCase().includes(errorPattern.toLowerCase())
      );

      if (!isRetryable) {
        log.debug({
          ...context,
          error: lastError.message,
          attempt,
        }, 'Non-retryable error encountered');
        throw lastError;
      }

      if (attempt >= retryConfig.maxRetries) {
        log.error({
          ...context,
          error: lastError.message,
          attempts: attempt,
          maxRetries: retryConfig.maxRetries,
        }, 'Max retries exceeded');
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelayMs
      );

      log.warn({
        ...context,
        error: lastError.message,
        attempt,
        maxRetries: retryConfig.maxRetries,
        retryInMs: delay,
      }, 'Retrying operation after delay');

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes in half-open to close circuit
  timeout: number; // Time in ms before attempting to close circuit
  monitoringPeriod: number; // Time window for failure tracking
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open after 5 consecutive failures
  successThreshold: 2, // Close after 2 consecutive successes in half-open
  timeout: 30000, // Wait 30 seconds before trying again
  monitoringPeriod: 60000, // Track failures over 60 seconds
};

/**
 * Simple circuit breaker implementation for external services
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private nextRetryTime = 0;
  private failures: number[] = []; // Timestamps of failures

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG
  ) {}

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T>,
    context?: { runId?: string; stepId?: string }
  ): Promise<T> {
    // Check circuit state
    if (this.state === 'open') {
      if (Date.now() < this.nextRetryTime) {
        const error = new Error(
          `Circuit breaker "${this.name}" is open. Service temporarily unavailable.`
        );
        log.warn({
          ...context,
          circuitBreaker: this.name,
          state: this.state,
          nextRetryIn: this.nextRetryTime - Date.now(),
        }, 'Circuit breaker prevented execution');
        throw error;
      }

      // Transition to half-open to test if service recovered
      this.state = 'half-open';
      this.successCount = 0;
      log.info({
        circuitBreaker: this.name,
        state: this.state,
      }, 'Circuit breaker transitioning to half-open');
    }

    try {
      const result = await operation();
      this.onSuccess(context);
      return result;
    } catch (error) {
      this.onFailure(context);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(context?: { runId?: string; stepId?: string }): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
        this.failures = [];
        log.info({
          ...context,
          circuitBreaker: this.name,
          state: this.state,
        }, 'Circuit breaker closed after successful recoveries');
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(context?: { runId?: string; stepId?: string }): void {
    const now = Date.now();
    this.failures.push(now);

    // Clean up old failures outside monitoring period
    this.failures = this.failures.filter(
      timestamp => now - timestamp < this.config.monitoringPeriod
    );

    if (this.state === 'half-open') {
      // Failure in half-open immediately reopens circuit
      this.state = 'open';
      this.nextRetryTime = now + this.config.timeout;
      this.successCount = 0;

      log.warn({
        ...context,
        circuitBreaker: this.name,
        state: this.state,
        nextRetryIn: this.config.timeout,
      }, 'Circuit breaker reopened after failure in half-open state');
      return;
    }

    this.failureCount++;

    if (this.failures.length >= this.config.failureThreshold) {
      this.state = 'open';
      this.nextRetryTime = now + this.config.timeout;

      log.error({
        ...context,
        circuitBreaker: this.name,
        state: this.state,
        failures: this.failures.length,
        threshold: this.config.failureThreshold,
        nextRetryIn: this.config.timeout,
      }, 'Circuit breaker opened due to repeated failures');
    }
  }

  /**
   * Get current circuit state (for monitoring)
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing/manual intervention)
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.failures = [];
    this.nextRetryTime = 0;

    log.info({
      circuitBreaker: this.name,
    }, 'Circuit breaker manually reset');
  }
}

/**
 * Global circuit breakers for different services
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create circuit breaker for a service
 */
export function getCircuitBreaker(
  serviceName: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    const fullConfig = config ? { ...DEFAULT_CIRCUIT_CONFIG, ...config } : DEFAULT_CIRCUIT_CONFIG;
    circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, fullConfig));
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Rate limit tracker for respectful API usage
 */
export class RateLimiter {
  private requests: number[] = []; // Timestamps of requests

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * Check if request is allowed and track it
   */
  async checkAndTrack(): Promise<boolean> {
    const now = Date.now();

    // Clean up old requests
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);

      if (waitTime > 0) {
        log.warn({
          waitMs: waitTime,
          requestsInWindow: this.requests.length,
          maxRequests: this.maxRequests,
        }, 'Rate limit reached, waiting');

        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requests.push(Date.now());
    return true;
  }
}
