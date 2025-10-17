/**
 * Tests for retry utilities
 * Validates that retry mechanisms work correctly
 */

import {
  retryAsync,
  retrySync,
  retryTest,
  waitFor,
  withTimeout,
  eventually,
  flushPromises,
  cleanupWithRetry
} from '../helpers/retry';

describe('Retry Utilities', () => {
  describe('retryAsync', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const result = await retryAsync(async () => {
        attempts++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const result = await retryAsync(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        { maxAttempts: 3, delayMs: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max attempts', async () => {
      let attempts = 0;
      await expect(
        retryAsync(
          async () => {
            attempts++;
            throw new Error('Persistent failure');
          },
          { maxAttempts: 3, delayMs: 10 }
        )
      ).rejects.toThrow('Persistent failure');

      expect(attempts).toBe(3);
    });

    it('should not retry on non-retryable errors', async () => {
      let attempts = 0;
      await expect(
        retryAsync(
          async () => {
            attempts++;
            throw new Error('Validation error');
          },
          {
            maxAttempts: 3,
            delayMs: 10,
            shouldRetry: (error) => error.message.includes('timeout')
          }
        )
      ).rejects.toThrow('Validation error');

      expect(attempts).toBe(1); // Should not retry
    });

    it('should use exponential backoff', async () => {
      let attempts = 0;
      const delays: number[] = [];
      let lastTime = Date.now();

      await retryAsync(
        async () => {
          attempts++;
          if (attempts > 1) {
            delays.push(Date.now() - lastTime);
          }
          lastTime = Date.now();
          if (attempts < 4) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        { maxAttempts: 4, delayMs: 50, exponentialBackoff: true }
      );

      expect(attempts).toBe(4);
      // Verify exponential backoff: each delay should be roughly 2x previous
      expect(delays[1]!).toBeGreaterThan(delays[0]! * 1.5);
    });

    it('should call onRetry callback', async () => {
      const retryCallbacks: number[] = [];
      let attempts = 0;

      await retryAsync(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        {
          maxAttempts: 3,
          delayMs: 10,
          onRetry: (attempt) => retryCallbacks.push(attempt)
        }
      );

      expect(retryCallbacks).toEqual([1, 2]);
    });
  });

  describe('retrySync', () => {
    it('should retry synchronous functions', () => {
      let attempts = 0;
      const result = retrySync(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      }, { maxAttempts: 3, delayMs: 0 });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('retryTest', () => {
    it('should wrap test function with retry logic', async () => {
      let attempts = 0;
      const testFn = retryTest(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        expect(true).toBe(true);
      }, { maxAttempts: 3, delayMs: 10 });

      await testFn();
      expect(attempts).toBe(2);
    });
  });

  describe('waitFor', () => {
    it('should wait for condition to be true', async () => {
      let ready = false;
      setTimeout(() => { ready = true; }, 50);

      await waitFor(() => ready, { timeout: 200, interval: 10 });
      expect(ready).toBe(true);
    });

    it('should timeout if condition never met', async () => {
      await expect(
        waitFor(() => false, { timeout: 100, interval: 10 })
      ).rejects.toThrow('Condition not met within timeout');
    });

    it('should work with async conditions', async () => {
      let count = 0;
      const checkAsync = async () => {
        count++;
        return count >= 3;
      };

      await waitFor(checkAsync, { timeout: 500, interval: 10 });
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes in time', async () => {
      const promise = new Promise<string>(resolve =>
        setTimeout(() => resolve('success'), 50)
      );

      const result = await withTimeout(promise, 200);
      expect(result).toBe('success');
    });

    it('should reject if promise times out', async () => {
      const promise = new Promise<string>(resolve =>
        setTimeout(() => resolve('success'), 500)
      );

      await expect(
        withTimeout(promise, 100, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });
  });

  describe('eventually', () => {
    it('should keep retrying assertion until it passes', async () => {
      let value = 0;
      setTimeout(() => { value = 10; }, 50);

      await eventually(() => {
        expect(value).toBe(10);
      }, { timeout: 200, interval: 10 });
    });

    it('should throw last error if timeout reached', async () => {
      await expect(
        eventually(() => {
          expect(false).toBe(true);
        }, { timeout: 100, interval: 10 })
      ).rejects.toThrow('Assertion failed after 100ms');
    });

    it('should work with async assertions', async () => {
      let count = 0;
      const incrementAsync = async () => {
        count++;
      };

      await eventually(async () => {
        await incrementAsync();
        expect(count).toBeGreaterThanOrEqual(3);
      }, { timeout: 500, interval: 10 });
    });
  });

  describe('flushPromises', () => {
    it('should flush all pending promises', async () => {
      let executed = false;
      Promise.resolve().then(() => { executed = true; });

      await flushPromises();
      expect(executed).toBe(true);
    });
  });

  describe('cleanupWithRetry', () => {
    it('should retry cleanup on failure', async () => {
      let attempts = 0;
      await cleanupWithRetry(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Cleanup failed');
        }
      }, 3);

      expect(attempts).toBe(2);
    });

    it('should not throw even if all attempts fail', async () => {
      let attempts = 0;
      // Should not throw
      await cleanupWithRetry(async () => {
        attempts++;
        throw new Error('Cleanup always fails');
      }, 3);

      expect(attempts).toBe(3);
    });
  });

  describe('global test utilities', () => {
    it('should have waitFor utility', async () => {
      expect(global.testUtils.waitFor).toBeDefined();

      let ready = false;
      setTimeout(() => { ready = true; }, 50);

      await global.testUtils.waitFor(() => ready, 200, 10);
      expect(ready).toBe(true);
    });

    it('should have flushPromises utility', async () => {
      expect(global.testUtils.flushPromises).toBeDefined();

      let executed = false;
      Promise.resolve().then(() => { executed = true; });

      await global.testUtils.flushPromises();
      expect(executed).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle flaky network requests', async () => {
      let attempts = 0;
      const flakyFetch = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ECONNREFUSED');
        }
        return { ok: true, data: 'success' };
      };

      const result = await retryAsync(flakyFetch, {
        maxAttempts: 5,
        delayMs: 10
      });

      expect(result.ok).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should handle database connection issues', async () => {
      let attempts = 0;
      const flakyDbQuery = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Cannot use a pool after calling end on the pool');
        }
        return [{ id: 1, name: 'test' }];
      };

      const result = await retryAsync(flakyDbQuery, {
        maxAttempts: 3,
        delayMs: 10
      });

      expect(result).toHaveLength(1);
      expect(attempts).toBe(2);
    });

    it('should handle race conditions', async () => {
      let value: any = undefined;
      setTimeout(() => { value = { data: 'loaded' }; }, 30);

      await eventually(() => {
        expect(value).toBeDefined();
        expect(value.data).toBe('loaded');
      }, { timeout: 200, interval: 10 });
    });
  });
});
