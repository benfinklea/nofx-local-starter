/**
 * Tests for Mutex and TimedMutex
 */

import { Mutex, TimedMutex } from '../../../src/lib/reliability/mutex';

describe('Reliability Module - Mutex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mutex', () => {
    it('should allow exclusive access', async () => {
      const mutex = new Mutex();
      const results: number[] = [];

      const task = async (id: number) => {
        await mutex.runExclusive(async () => {
          results.push(id);
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      };

      // Run tasks concurrently
      await Promise.all([task(1), task(2), task(3)]);

      // Results should be in order (sequential execution)
      expect(results.length).toBe(3);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should queue multiple waiters', async () => {
      const mutex = new Mutex();
      const release = await mutex.acquire();

      expect(mutex.isLocked()).toBe(true);
      expect(mutex.getQueueLength()).toBe(0);

      // Queue some requests
      const promise1 = mutex.acquire();
      const promise2 = mutex.acquire();

      expect(mutex.getQueueLength()).toBe(2);

      // Release first lock
      release();

      // First queued request should acquire
      await promise1.then(release2 => {
        expect(mutex.isLocked()).toBe(true);
        expect(mutex.getQueueLength()).toBe(1);
        release2();
      });

      // Second queued request should acquire
      await promise2.then(release3 => {
        expect(mutex.isLocked()).toBe(true);
        expect(mutex.getQueueLength()).toBe(0);
        release3();
      });

      expect(mutex.isLocked()).toBe(false);
    });

    it('should release lock even if function throws', async () => {
      const mutex = new Mutex();

      await expect(
        mutex.runExclusive(async () => {
          throw new Error('task failed');
        })
      ).rejects.toThrow('task failed');

      expect(mutex.isLocked()).toBe(false);
    });

    it('should handle synchronous functions', async () => {
      const mutex = new Mutex();

      const result = await mutex.runExclusive(() => {
        return 'sync result';
      });

      expect(result).toBe('sync result');
      expect(mutex.isLocked()).toBe(false);
    });

    it('should support tryAcquire for non-blocking access', () => {
      const mutex = new Mutex();

      const release1 = mutex.tryAcquire();
      expect(release1).not.toBeNull();
      expect(mutex.isLocked()).toBe(true);

      const release2 = mutex.tryAcquire();
      expect(release2).toBeNull();

      if (release1) {
        release1();
      }

      expect(mutex.isLocked()).toBe(false);

      const release3 = mutex.tryAcquire();
      expect(release3).not.toBeNull();
    });

    it('should maintain FIFO order for queued requests', async () => {
      const mutex = new Mutex();
      const order: number[] = [];

      const release = await mutex.acquire();

      // Queue requests
      const promises = [
        mutex.runExclusive(async () => { order.push(1); }),
        mutex.runExclusive(async () => { order.push(2); }),
        mutex.runExclusive(async () => { order.push(3); })
      ];

      release();

      await Promise.all(promises);

      expect(order).toEqual([1, 2, 3]);
    });

    it('should prevent race conditions', async () => {
      const mutex = new Mutex();
      let counter = 0;

      const incrementWithDelay = async () => {
        await mutex.runExclusive(async () => {
          const temp = counter;
          await new Promise(resolve => setTimeout(resolve, 1));
          counter = temp + 1;
        });
      };

      // Run 10 concurrent increments
      await Promise.all(Array(10).fill(null).map(() => incrementWithDelay()));

      expect(counter).toBe(10); // No race condition
    });
  });

  describe('TimedMutex', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should acquire lock within timeout', async () => {
      const mutex = new TimedMutex();

      const releasePromise = mutex.acquireWithTimeout(1000);

      const release = await releasePromise;
      expect(mutex.isLocked()).toBe(true);

      release();
      expect(mutex.isLocked()).toBe(false);
    });

    it('should throw error when timeout exceeded', async () => {
      const mutex = new TimedMutex();

      // Lock the mutex
      const release1 = await mutex.acquire();

      // Try to acquire with timeout
      const promise = mutex.acquireWithTimeout(100);

      jest.advanceTimersByTime(101);

      await expect(promise).rejects.toThrow('Mutex acquire timeout after 100ms');

      release1();
    });

    it('should execute with timeout using runExclusiveWithTimeout', async () => {
      const mutex = new TimedMutex();

      const result = await mutex.runExclusiveWithTimeout(async () => {
        return 'completed';
      }, 1000);

      expect(result).toBe('completed');
      expect(mutex.isLocked()).toBe(false);
    });

    it('should timeout runExclusiveWithTimeout if lock not acquired', async () => {
      const mutex = new TimedMutex();

      // Lock the mutex
      const release = await mutex.acquire();

      // Try to run with timeout
      const promise = mutex.runExclusiveWithTimeout(async () => {
        return 'should not complete';
      }, 100);

      jest.advanceTimersByTime(101);

      await expect(promise).rejects.toThrow('timeout');

      release();
    });

    it('should release lock on error in runExclusiveWithTimeout', async () => {
      const mutex = new TimedMutex();

      await expect(
        mutex.runExclusiveWithTimeout(async () => {
          throw new Error('task error');
        }, 1000)
      ).rejects.toThrow('task error');

      expect(mutex.isLocked()).toBe(false);
    });

    it('should inherit all Mutex methods', async () => {
      const mutex = new TimedMutex();

      const result = await mutex.runExclusive(() => 'success');
      expect(result).toBe('success');

      const tryResult = mutex.tryAcquire();
      expect(tryResult).not.toBeNull();

      expect(mutex.isLocked()).toBe(true);
      expect(mutex.getQueueLength()).toBe(0);
    });
  });
});
