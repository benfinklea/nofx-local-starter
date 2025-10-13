/**
 * Async Mutex for preventing race conditions in concurrent operations
 * Part of HEAVY MODE reliability patterns
 */

import { log } from '../logger';

interface QueueItem {
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * Async Mutex to ensure exclusive access to critical sections
 */
export class Mutex {
  private locked = false;
  private queue: QueueItem[] = [];

  /**
   * Acquire the lock. Waits if already locked.
   */
  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }

    // Wait in queue
    await new Promise<void>((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });

    return () => this.release();
  }

  /**
   * Release the lock and process next in queue
   */
  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    } else {
      this.locked = false;
    }
  }

  /**
   * Execute a function with exclusive lock
   */
  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Try to acquire lock without waiting. Returns null if locked.
   */
  tryAcquire(): (() => void) | null {
    if (this.locked) {
      return null;
    }
    this.locked = true;
    return () => this.release();
  }

  /**
   * Check if mutex is currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get number of waiters in queue
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * Mutex with timeout support
 */
export class TimedMutex extends Mutex {
  /**
   * Acquire lock with timeout. Throws if timeout exceeded.
   */
  async acquireWithTimeout(timeoutMs: number): Promise<() => void> {
    return Promise.race([
      this.acquire(),
      new Promise<() => void>((_, reject) =>
        setTimeout(() => reject(new Error(`Mutex acquire timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Execute function with lock and timeout
   */
  async runExclusiveWithTimeout<T>(fn: () => Promise<T> | T, timeoutMs: number): Promise<T> {
    const release = await this.acquireWithTimeout(timeoutMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
