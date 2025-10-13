/**
 * Test Retry Utilities
 *
 * Provides retry logic for flaky tests to reduce false negatives in CI/CD
 */

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 100,
  exponentialBackoff: true,
  shouldRetry: (error: Error) => {
    // By default, retry all errors
    // This can be overridden with a custom shouldRetry function
    // For production use, you may want to be more selective
    const message = error.message.toLowerCase();

    // Don't retry assertion errors (they're usually permanent)
    if (message.includes('expected') && message.includes('received')) {
      return false;
    }

    // Retry on common transient failures
    return (
      message.includes('temporary') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('epipe') ||
      message.includes('socket hang up') ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('cannot read properties of undefined') ||
      message.includes('race condition') ||
      message.includes('database') ||
      message.includes('pool') ||
      message.includes('lock') ||
      true // Default to retrying
    );
  },
  onRetry: (attempt: number, error: Error) => {
    if (process.env.DEBUG_RETRY) {
      console.warn(`Test retry attempt ${attempt} after error:`, error.message);
    }
  }
};

/**
 * Retry an async function with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this is the last attempt
      if (attempt >= opts.maxAttempts) {
        break;
      }

      // Check if we should retry this error
      if (!opts.shouldRetry(lastError)) {
        break;
      }

      // Call onRetry callback
      opts.onRetry(attempt, lastError);

      // Calculate delay with exponential backoff if enabled
      const delay = opts.exponentialBackoff
        ? opts.delayMs * Math.pow(2, attempt - 1)
        : opts.delayMs;

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry a synchronous function
 */
export function retrySync<T>(
  fn: () => T,
  options: RetryOptions = {}
): T {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt >= opts.maxAttempts || !opts.shouldRetry(lastError)) {
        break;
      }

      opts.onRetry(attempt, lastError);
    }
  }

  throw lastError;
}

/**
 * Wrap a Jest test with retry logic
 *
 * Usage:
 * ```ts
 * it('flaky test', retryTest(async () => {
 *   // test code
 * }));
 * ```
 */
export function retryTest(
  testFn: () => void | Promise<void>,
  options: RetryOptions = {}
) {
  return async () => {
    return retryAsync(async () => {
      await testFn();
    }, options);
  };
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, timeoutMessage = 'Condition not met within timeout' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}

/**
 * Wait for a promise to resolve or reject within a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Eventually assertion - keeps retrying until the assertion passes or timeout
 */
export async function eventually(
  assertion: () => void | Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      await Promise.resolve(assertion());
      return; // Success
    } catch (error) {
      lastError = error as Error;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  // Throw the last error if we timed out
  throw new Error(
    `Assertion failed after ${timeout}ms. Last error: ${lastError?.message || 'Unknown'}`
  );
}

/**
 * Retry a fetch/HTTP request
 */
export async function retryFetch(
  url: string,
  options: RequestInit & { maxRetries?: number } = {}
): Promise<Response> {
  const { maxRetries = 3, ...fetchOptions } = options;

  return retryAsync(
    async () => {
      const response = await fetch(url, fetchOptions);
      if (!response.ok && response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    },
    {
      maxAttempts: maxRetries,
      shouldRetry: (error) => {
        return error.message.includes('HTTP 5') || error.message.includes('network');
      }
    }
  );
}

/**
 * Flush pending promises and timers
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

/**
 * Run cleanup with retry for teardown operations
 */
export async function cleanupWithRetry(
  cleanup: () => Promise<void>,
  maxAttempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await cleanup();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error('Cleanup failed after all retries:', error);
        // Don't throw - we don't want cleanup failures to fail tests
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
}
