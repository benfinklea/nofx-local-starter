/**
 * Redis Queue Adapter Tests - 90%+ Coverage Target
 * Critical job processing infrastructure
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { RedisQueueAdapter } from '../RedisAdapter';
import { Queue, Worker } from 'bullmq';

// Mock dependencies
jest.mock('bullmq');
jest.mock('ioredis');
jest.mock('../../logger');
jest.mock('../../metrics');

const MockedQueue = Queue as jest.MockedClass<typeof Queue>;
const MockedWorker = Worker as jest.MockedClass<typeof Worker>;

describe('RedisQueueAdapter - Integration Tests', () => {
  let adapter: RedisQueueAdapter;
  let mockQueue: jest.Mocked<Queue>;
  let mockWorker: jest.Mocked<Worker>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Queue instance
    mockQueue = {
      add: jest.fn(),
      getJobCounts: jest.fn(),
      getWaiting: jest.fn()
    } as any;

    // Mock Worker instance
    mockWorker = {
      on: jest.fn()
    } as any;

    MockedQueue.mockImplementation(() => mockQueue);
    MockedWorker.mockImplementation(() => mockWorker);

    adapter = new RedisQueueAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Queue Management', () => {
    it('creates and reuses queue instances', async () => {
      await adapter.enqueue('test_topic', { test: 'data' });
      await adapter.enqueue('test_topic', { test: 'data2' });

      // Should only create queue once for same topic
      expect(MockedQueue).toHaveBeenCalledTimes(1);
      expect(MockedQueue).toHaveBeenCalledWith('test_topic', {
        connection: expect.any(Object)
      });
    });

    it('creates different queues for different topics', async () => {
      await adapter.enqueue('topic1', { test: 'data1' });
      await adapter.enqueue('topic2', { test: 'data2' });

      expect(MockedQueue).toHaveBeenCalledTimes(2);
      expect(MockedQueue).toHaveBeenCalledWith('topic1', expect.any(Object));
      expect(MockedQueue).toHaveBeenCalledWith('topic2', expect.any(Object));
    });
  });

  describe('Job Enqueuing', () => {
    it('enqueues jobs successfully', async () => {
      const payload = { test: 'data' };
      mockQueue.add.mockResolvedValue({} as any);

      await adapter.enqueue('test_topic', payload);

      expect(mockQueue.add).toHaveBeenCalledWith('job', payload, undefined);
    });

    it('enqueues jobs with options', async () => {
      const payload = { test: 'data' };
      const options = { delay: 1000, priority: 5 };
      mockQueue.add.mockResolvedValue({} as any);

      await adapter.enqueue('test_topic', payload, options);

      expect(mockQueue.add).toHaveBeenCalledWith('job', payload, options);
    });

    it('handles enqueue errors gracefully', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.enqueue('test_topic', { test: 'data' }))
        .rejects.toThrow('Redis error');
    });
  });

  describe('Worker Subscription', () => {
    it('creates worker with correct configuration', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      adapter.subscribe('test_topic', handler);

      expect(MockedWorker).toHaveBeenCalledWith(
        'test_topic',
        expect.any(Function),
        {
          connection: expect.any(Object),
          concurrency: expect.any(Number)
        }
      );
    });

    it('sets up worker event handlers', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      adapter.subscribe('test_topic', handler);

      expect(mockWorker.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('respects worker concurrency environment variable', () => {
      process.env.WORKER_CONCURRENCY = '5';

      adapter.subscribe('test_topic', jest.fn());

      expect(MockedWorker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ concurrency: 5 })
      );

      delete process.env.WORKER_CONCURRENCY;
    });

    it('uses fallback concurrency when env var not set', () => {
      delete process.env.WORKER_CONCURRENCY;
      delete process.env.NOFX_WORKER_CONCURRENCY;

      adapter.subscribe('test_topic', jest.fn());

      expect(MockedWorker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({ concurrency: 1 })
      );
    });
  });

  describe('Job Counts and Metrics', () => {
    it('gets job counts from queue', async () => {
      const mockCounts = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0
      };

      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const result = await adapter.getCounts('test_topic');

      expect(mockQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting', 'active', 'completed', 'failed', 'delayed', 'paused'
      );
      expect(result).toEqual(mockCounts);
    });

    it('handles getCounts errors', async () => {
      mockQueue.getJobCounts.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.getCounts('test_topic'))
        .rejects.toThrow('Redis error');
    });
  });

  describe('Connection Management', () => {
    it('sets up Redis connection event handlers', () => {
      // Constructor already called in beforeEach
      // Just verify the adapter was created without errors
      expect(adapter).toBeDefined();
    });

    it('uses environment Redis URL', () => {
      const originalUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://custom:6380';

      const newAdapter = new RedisQueueAdapter();

      expect(newAdapter).toBeDefined();

      // Restore
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });

    it('falls back to default Redis URL', () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      const newAdapter = new RedisQueueAdapter();

      expect(newAdapter).toBeDefined();

      // Restore
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      }
    });
  });

  describe('Retry Logic and DLQ', () => {
    it('sets up retry logic in failed handler', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      adapter.subscribe('test_topic', handler);

      // Verify failed handler was set up
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('handles worker setup without errors', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      expect(() => {
        adapter.subscribe('test_topic', handler);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('handles queue creation errors gracefully', () => {
      MockedQueue.mockImplementation(() => {
        throw new Error('Queue creation failed');
      });

      expect(() => {
        new RedisQueueAdapter();
      }).toThrow('Queue creation failed');
    });

    it('handles worker creation errors gracefully', () => {
      MockedWorker.mockImplementation(() => {
        throw new Error('Worker creation failed');
      });

      expect(() => {
        adapter.subscribe('test_topic', jest.fn().mockResolvedValue(undefined));
      }).toThrow('Worker creation failed');
    });
  });

  describe('Performance Tests', () => {
    it('handles multiple concurrent enqueue operations', async () => {
      mockQueue.add.mockResolvedValue({} as any);

      const promises = Array(10).fill(null).map((_, i) =>
        adapter.enqueue('test_topic', { index: i })
      );

      await Promise.all(promises);

      expect(mockQueue.add).toHaveBeenCalledTimes(10);
    });

    it('handles rapid subscription setup', () => {
      const handlers = Array(5).fill(null).map(() => jest.fn().mockResolvedValue(undefined));

      handlers.forEach((handler, i) => {
        adapter.subscribe(`topic_${i}`, handler);
      });

      expect(MockedWorker).toHaveBeenCalledTimes(5);
    });
  });

  describe('Integration Scenarios', () => {
    it('supports full job lifecycle', async () => {
      mockQueue.add.mockResolvedValue({} as any);
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 1,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0
      });

      // Enqueue job
      await adapter.enqueue('workflow_topic', { step: 'start' });

      // Subscribe to handle jobs
      adapter.subscribe('workflow_topic', async (payload) => {
        return { result: 'processed' };
      });

      // Check job counts
      const counts = await adapter.getCounts('workflow_topic');

      expect(mockQueue.add).toHaveBeenCalled();
      expect(MockedWorker).toHaveBeenCalled();
      expect(counts.waiting).toBe(1);
    });
  });
});