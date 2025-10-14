/**
 * Retry utility with exponential backoff for external operations
 * Part of HEAVY MODE reliability patterns
 */

import { log } from '../logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: Array<new (...args: any[]) => Error>;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryableError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableErrors = [],
    onRetry
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry NonRetryableError
      if (lastError instanceof NonRetryableError) {
        throw lastError;
      }

      // Check if error type is retryable
      if (retryableErrors.length > 0) {
        const isRetryable = retryableErrors.some(ErrorClass => lastError instanceof ErrorClass);
        if (!isRetryable) {
          throw lastError;
        }
      }

      // Last attempt, throw error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      log.warn({
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: lastError.message
      }, 'Retrying failed operation');

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Retry specifically for network/HTTP operations
 */
export async function retryHttpOperation<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, 'retryableErrors'> = {}
): Promise<T> {
  return retryWithBackoff(fn, {
    ...options,
    retryableErrors: [RetryableError]
  });
}
