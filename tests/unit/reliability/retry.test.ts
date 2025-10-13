/**
 * Tests for retry utility with exponential backoff
 */

import { retryWithBackoff, retryHttpOperation, RetryableError, NonRetryableError } from '../../../src/lib/reliability/retry';

describe('Reliability Module - Retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new RetryableError('fail'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect maxRetries limit', async () => {
      const fn = jest.fn().mockRejectedValue(new RetryableError('persistent failure'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow('persistent failure');

      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry NonRetryableError', async () => {
      const fn = jest.fn().mockRejectedValue(new NonRetryableError('fatal error'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 })
      ).rejects.toThrow('fatal error');

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use exponential backoff', async () => {
      jest.useFakeTimers();

      const fn = jest.fn()
        .mockRejectedValueOnce(new RetryableError('fail 1'))
        .mockRejectedValueOnce(new RetryableError('fail 2'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 100,
        backoffFactor: 2
      });

      // First retry after 100ms
      await jest.advanceTimersByTimeAsync(100);

      // Second retry after 200ms (100 * 2^1)
      await jest.advanceTimersByTimeAsync(200);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should respect maxDelay cap', async () => {
      jest.useFakeTimers();

      const fn = jest.fn()
        .mockRejectedValueOnce(new RetryableError('fail'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelay: 1000,
        backoffFactor: 10,
        maxDelay: 2000
      });

      // Should use maxDelay instead of baseDelay * backoffFactor^attempt
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn()
        .mockRejectedValueOnce(new RetryableError('fail'))
        .mockResolvedValue('success');

      await retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelay: 10,
        onRetry
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(RetryableError),
        1
      );
    });

    it('should only retry specific error types when retryableErrors provided', async () => {
      class CustomError extends Error {
        override name = 'CustomError';
      }

      const fn = jest.fn().mockRejectedValue(new Error('generic error'));

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 2,
          baseDelay: 10,
          retryableErrors: [CustomError]
        })
      ).rejects.toThrow('generic error');

      expect(fn).toHaveBeenCalledTimes(1); // No retries for non-custom error
    });

    it('should handle sync errors', async () => {
      const fn = jest.fn(() => {
        throw new RetryableError('sync error');
      });

      await expect(
        retryWithBackoff(fn, { maxRetries: 1, baseDelay: 10 })
      ).rejects.toThrow('sync error');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryHttpOperation', () => {
    it('should only retry RetryableError', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new RetryableError('network error'))
        .mockResolvedValue('success');

      const result = await retryHttpOperation(fn, { maxRetries: 2, baseDelay: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry generic errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('generic error'));

      await expect(
        retryHttpOperation(fn, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow('generic error');

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('RetryableError', () => {
    it('should store original error', () => {
      const originalError = new Error('original');
      const retryableError = new RetryableError('wrapped', originalError);

      expect(retryableError.name).toBe('RetryableError');
      expect(retryableError.message).toBe('wrapped');
      expect(retryableError.originalError).toBe(originalError);
    });
  });

  describe('NonRetryableError', () => {
    it('should store original error', () => {
      const originalError = new Error('original');
      const nonRetryableError = new NonRetryableError('fatal', originalError);

      expect(nonRetryableError.name).toBe('NonRetryableError');
      expect(nonRetryableError.message).toBe('fatal');
      expect(nonRetryableError.originalError).toBe(originalError);
    });
  });
});
