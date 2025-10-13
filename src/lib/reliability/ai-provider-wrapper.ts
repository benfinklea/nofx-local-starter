/**
 * Circuit breaker wrapper for AI provider calls
 * Protects against cascading failures from AI provider outages
 */

import { CircuitBreaker } from './circuit-breaker';
import { retryWithBackoff, RetryableError } from './retry';
import { log } from '../logger';

// Create circuit breakers for each AI provider
export const anthropicBreaker = new CircuitBreaker({
  name: 'anthropic-ai',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 60 seconds for AI calls
  resetTimeout: 120000 // 2 minutes cooldown
});

export const openaiBreaker = new CircuitBreaker({
  name: 'openai',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  resetTimeout: 120000
});

/**
 * Wrapper for Anthropic API calls with circuit breaker and retry logic
 */
export async function callAnthropicWithProtection<T>(
  operation: () => Promise<T>,
  context: { operation: string; model?: string }
): Promise<T> {
  return anthropicBreaker.execute(async () => {
    return retryWithBackoff(
      async () => {
        try {
          return await operation();
        } catch (error) {
          // Check if error is retryable
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Retry on rate limits and transient failures
          if (
            errorMessage.includes('rate_limit') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('503') ||
            errorMessage.includes('502') ||
            errorMessage.includes('overloaded')
          ) {
            throw new RetryableError('Anthropic API transient error', error instanceof Error ? error : undefined);
          }

          // Don't retry on auth errors or invalid requests
          throw error;
        }
      },
      {
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 15000,
        onRetry: (error, attempt) => {
          log.warn({
            provider: 'anthropic',
            operation: context.operation,
            model: context.model,
            attempt,
            error: error.message
          }, 'Retrying Anthropic API call');
        }
      }
    );
  });
}

/**
 * Wrapper for OpenAI API calls with circuit breaker and retry logic
 */
export async function callOpenAIWithProtection<T>(
  operation: () => Promise<T>,
  context: { operation: string; model?: string }
): Promise<T> {
  return openaiBreaker.execute(async () => {
    return retryWithBackoff(
      async () => {
        try {
          return await operation();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Retry on rate limits and transient failures
          if (
            errorMessage.includes('rate_limit_exceeded') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('503') ||
            errorMessage.includes('502') ||
            errorMessage.includes('server_error')
          ) {
            throw new RetryableError('OpenAI API transient error', error instanceof Error ? error : undefined);
          }

          throw error;
        }
      },
      {
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 15000,
        onRetry: (error, attempt) => {
          log.warn({
            provider: 'openai',
            operation: context.operation,
            model: context.model,
            attempt,
            error: error.message
          }, 'Retrying OpenAI API call');
        }
      }
    );
  });
}

/**
 * Get circuit breaker health status for monitoring
 */
export function getAIProviderHealth() {
  return {
    anthropic: anthropicBreaker.getStats(),
    openai: openaiBreaker.getStats()
  };
}

/**
 * Manual circuit breaker reset (for admin/ops use)
 */
export function resetAIProviderCircuits() {
  anthropicBreaker.reset();
  openaiBreaker.reset();
  log.info('AI provider circuit breakers manually reset');
}
