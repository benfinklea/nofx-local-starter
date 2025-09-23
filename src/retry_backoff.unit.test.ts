import { describe, it, expect, beforeAll, vi } from 'vitest';
import { enqueue, subscribe, getCounts } from './lib/queue/index';

interface RetryPayload {
  __attempt?: number;
}

interface QueueCountsSnapshot {
  delayed: number;
  waiting: number;
  active: number;
}

describe('Memory queue retry backoff and exactly-once (delayed)', () => {
  beforeAll(() => {
    process.env.QUEUE_DRIVER = 'memory';
  });

  it('retries with backoff [0,2s,5s] and succeeds once on third attempt', async () => {
    vi.useFakeTimers();
    const topic = 'test.backoff.' + Date.now();
    const attempts: number[] = [];

    subscribe(topic, async (payload: RetryPayload) => {
      const n = Number(payload.__attempt ?? 1);
      attempts.push(n);
      if (n < 3) throw new Error('boom');
      // success on third attempt
      return;
    });

    await enqueue(topic, { __attempt: 1 });

    // Initial immediate attempt (0ms)
    await vi.advanceTimersByTimeAsync(1);
    const c1 = await getCounts(topic) as QueueCountsSnapshot;
    expect(attempts).toEqual([1]);
    // After failure, next job should be delayed (>=1 delayed)
    expect(c1.delayed).toBeGreaterThanOrEqual(1);

    // Advance to run second attempt (2s)
    await vi.advanceTimersByTimeAsync(2001);
    const c2 = await getCounts(topic) as QueueCountsSnapshot;
    expect(attempts).toEqual([1,2]);
    expect(c2.delayed).toBeGreaterThanOrEqual(1);

    // Advance to run third attempt (5s)
    await vi.advanceTimersByTimeAsync(5001);
    const c3 = await getCounts(topic) as QueueCountsSnapshot;
    expect(attempts).toEqual([1,2,3]);
    // Queue should be drained
    expect(c3.waiting).toBe(0);
    expect(c3.active).toBe(0);

    vi.useRealTimers();
  });
});
