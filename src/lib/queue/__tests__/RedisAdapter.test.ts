/**
 * Redis Queue Adapter Tests - 90%+ Coverage Target
 * Critical job processing infrastructure
 */

import { RedisAdapter } from '../RedisAdapter';
import Redis from 'ioredis';
import { JobOptions, JobResult } from '../types';

// Mock Redis
jest.mock('ioredis');
jest.mock('../../../lib/logger');

const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('RedisAdapter - Queue Tests', () => {
  let adapter: RedisAdapter;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis instance
    mockRedis = {
      lpush: jest.fn(),
      brpop: jest.fn(),
      llen: jest.fn(),
      lrange: jest.fn(),
      del: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
      mget: jest.fn(),
      hset: jest.fn(),
      hget: jest.fn(),
      hdel: jest.fn(),
      hgetall: jest.fn(),
      zadd: jest.fn(),
      zrange: jest.fn(),
      zrem: jest.fn(),
      zcard: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG')
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);

    adapter = new RedisAdapter({
      host: 'localhost',
      port: 6379,
      db: 0
    });
  });

  describe('Connection Management', () => {
    it('connects to Redis successfully', async () => {
      await adapter.connect();

      expect(MockedRedis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        db: 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('handles connection failures', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      await expect(adapter.connect()).rejects.toThrow('Failed to connect to Redis');
    });

    it('disconnects gracefully', async () => {
      await adapter.connect();
      await adapter.disconnect();

      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('handles Redis connection events', async () => {
      await adapter.connect();

      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('retries connection on failure', async () => {
      mockRedis.ping
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce('PONG');

      await adapter.connect();

      expect(mockRedis.ping).toHaveBeenCalledTimes(3);
    });
  });

  describe('Job Enqueuing', () => {
    const mockJob = {
      id: 'job_123',
      type: 'test_job',
      data: { test: 'data' },
      priority: 1,
      delay: 0,
      maxRetries: 3,
      retryDelay: 1000
    };

    beforeEach(async () => {
      await adapter.connect();
    });

    it('enqueues job successfully', async () => {
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.hset.mockResolvedValue(1);

      await adapter.enqueue('test_queue', mockJob);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'queue:test_queue',
        JSON.stringify({
          ...mockJob,
          enqueuedAt: expect.any(Number),
          status: 'pending'
        })
      );

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'job:job_123',
        'status', 'pending',
        'queue', 'test_queue',
        'enqueuedAt', expect.any(Number)
      );
    });

    it('handles priority queuing', async () => {
      const highPriorityJob = { ...mockJob, priority: 10 };
      const lowPriorityJob = { ...mockJob, priority: 1 };

      await adapter.enqueue('test_queue', highPriorityJob);
      await adapter.enqueue('test_queue', lowPriorityJob);

      // High priority jobs should use zadd for priority queue
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'priority:test_queue',
        10,
        JSON.stringify(expect.objectContaining({ priority: 10 }))
      );
    });

    it('handles delayed jobs', async () => {
      const delayedJob = { ...mockJob, delay: 5000 };

      await adapter.enqueue('test_queue', delayedJob);

      const expectedRunAt = expect.any(Number);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'delayed:test_queue',
        expectedRunAt,
        JSON.stringify(expect.objectContaining({ delay: 5000 }))
      );
    });

    it('validates job data', async () => {
      const invalidJobs = [
        null,
        undefined,
        { id: '', type: 'test' },
        { id: 'test', type: '' },
        { id: 'test', type: 'test', data: null }
      ];

      for (const invalidJob of invalidJobs) {
        await expect(adapter.enqueue('test_queue', invalidJob as any))
          .rejects.toThrow();
      }
    });

    it('handles Redis errors during enqueue', async () => {
      mockRedis.lpush.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.enqueue('test_queue', mockJob))
        .rejects.toThrow('Redis error');
    });

    it('enforces queue size limits', async () => {
      mockRedis.llen.mockResolvedValue(10000); // Queue is full

      await expect(adapter.enqueue('test_queue', mockJob))
        .rejects.toThrow('Queue size limit exceeded');
    });
  });

  describe('Job Dequeuing', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('dequeues job successfully', async () => {
      const jobData = {
        id: 'job_123',
        type: 'test_job',
        data: { test: 'data' },
        status: 'pending'
      };

      mockRedis.brpop.mockResolvedValue(['queue:test_queue', JSON.stringify(jobData)]);

      const result = await adapter.dequeue('test_queue', 5000);

      expect(mockRedis.brpop).toHaveBeenCalledWith('queue:test_queue', 5);
      expect(result).toEqual(jobData);
    });

    it('handles empty queue timeout', async () => {
      mockRedis.brpop.mockResolvedValue(null);

      const result = await adapter.dequeue('test_queue', 1000);

      expect(result).toBeNull();
    });

    it('processes delayed jobs', async () => {
      const now = Date.now();
      const delayedJob = {
        id: 'job_delayed',
        type: 'test_job',
        data: { test: 'data' },
        runAt: now - 1000 // Ready to run
      };

      mockRedis.zrange.mockResolvedValue([JSON.stringify(delayedJob)]);
      mockRedis.zrem.mockResolvedValue(1);
      mockRedis.lpush.mockResolvedValue(1);

      await adapter.processDelayedJobs('test_queue');

      expect(mockRedis.zrange).toHaveBeenCalledWith(
        'delayed:test_queue',
        0,
        now,
        'BYSCORE'
      );
      expect(mockRedis.zrem).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalled();
    });

    it('processes priority jobs first', async () => {
      const priorityJob = {
        id: 'job_priority',
        type: 'test_job',
        priority: 10
      };

      mockRedis.zrange.mockResolvedValue([JSON.stringify(priorityJob)]);
      mockRedis.zrem.mockResolvedValue(1);

      const result = await adapter.dequeue('test_queue', 1000);

      expect(mockRedis.zrange).toHaveBeenCalledWith(
        'priority:test_queue',
        -1,
        -1
      );
    });

    it('handles malformed job data', async () => {
      mockRedis.brpop.mockResolvedValue(['queue:test_queue', 'invalid json']);

      const result = await adapter.dequeue('test_queue', 1000);

      expect(result).toBeNull();
    });
  });

  describe('Job Status Management', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('updates job status', async () => {
      await adapter.updateJobStatus('job_123', 'processing');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'job:job_123',
        'status', 'processing',
        'updatedAt', expect.any(Number)
      );
    });

    it('marks job as completed', async () => {
      const result: JobResult = {
        success: true,
        data: { output: 'success' },
        completedAt: Date.now()
      };

      await adapter.completeJob('job_123', result);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'job:job_123',
        'status', 'completed',
        'result', JSON.stringify(result),
        'completedAt', expect.any(Number)
      );
    });

    it('marks job as failed', async () => {
      const error = new Error('Job failed');

      await adapter.failJob('job_123', error);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'job:job_123',
        'status', 'failed',
        'error', error.message,
        'failedAt', expect.any(Number)
      );
    });

    it('gets job status', async () => {
      mockRedis.hgetall.mockResolvedValue({
        status: 'processing',
        queue: 'test_queue',
        enqueuedAt: '1234567890'
      });

      const status = await adapter.getJobStatus('job_123');

      expect(status).toEqual({
        status: 'processing',
        queue: 'test_queue',
        enqueuedAt: '1234567890'
      });
    });

    it('returns null for non-existent job', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const status = await adapter.getJobStatus('non_existent');

      expect(status).toBeNull();
    });
  });

  describe('Queue Management', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('gets queue size', async () => {
      mockRedis.llen.mockResolvedValue(5);

      const size = await adapter.getQueueSize('test_queue');

      expect(mockRedis.llen).toHaveBeenCalledWith('queue:test_queue');
      expect(size).toBe(5);
    });

    it('clears queue', async () => {
      await adapter.clearQueue('test_queue');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'queue:test_queue',
        'priority:test_queue',
        'delayed:test_queue'
      );
    });

    it('lists queue contents', async () => {
      const jobs = [
        JSON.stringify({ id: 'job_1', type: 'test' }),
        JSON.stringify({ id: 'job_2', type: 'test' })
      ];

      mockRedis.lrange.mockResolvedValue(jobs);

      const result = await adapter.listJobs('test_queue', 0, 10);

      expect(mockRedis.lrange).toHaveBeenCalledWith('queue:test_queue', 0, 9);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'job_1', type: 'test' });
    });

    it('gets queue statistics', async () => {
      mockRedis.llen.mockResolvedValue(5);
      mockRedis.zcard
        .mockResolvedValueOnce(2) // priority queue
        .mockResolvedValueOnce(1); // delayed queue

      const stats = await adapter.getQueueStats('test_queue');

      expect(stats).toEqual({
        pending: 5,
        priority: 2,
        delayed: 1,
        total: 8
      });
    });
  });

  describe('Retry Logic', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('retries failed jobs', async () => {
      const failedJob = {
        id: 'job_retry',
        type: 'test_job',
        data: { test: 'data' },
        retries: 1,
        maxRetries: 3,
        retryDelay: 1000
      };

      await adapter.retryJob('job_retry', failedJob);

      const expectedRetryAt = expect.any(Number);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'delayed:test_queue',
        expectedRetryAt,
        JSON.stringify(expect.objectContaining({
          retries: 2
        }))
      );
    });

    it('does not retry jobs exceeding max retries', async () => {
      const failedJob = {
        id: 'job_max_retry',
        type: 'test_job',
        retries: 3,
        maxRetries: 3
      };

      await expect(adapter.retryJob('job_max_retry', failedJob))
        .rejects.toThrow('Max retries exceeded');
    });

    it('applies exponential backoff', async () => {
      const failedJob = {
        id: 'job_backoff',
        type: 'test_job',
        retries: 2,
        maxRetries: 5,
        retryDelay: 1000
      };

      await adapter.retryJob('job_backoff', failedJob);

      // Should apply exponential backoff (1000 * 2^2 = 4000ms)
      const calls = mockRedis.zadd.mock.calls;
      const retryAt = calls[0][2];
      const now = Date.now();

      expect(retryAt).toBeGreaterThan(now + 3500); // ~4000ms delay
    });
  });

  describe('Dead Letter Queue', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('moves failed jobs to DLQ', async () => {
      const deadJob = {
        id: 'job_dead',
        type: 'test_job',
        error: 'Permanent failure'
      };

      await adapter.moveToDeadLetter('job_dead', deadJob);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'dlq:failed',
        JSON.stringify(expect.objectContaining({
          ...deadJob,
          movedToDLQ: expect.any(Number)
        }))
      );
    });

    it('lists dead letter queue', async () => {
      const deadJobs = [
        JSON.stringify({ id: 'job_1', error: 'Failed' }),
        JSON.stringify({ id: 'job_2', error: 'Failed' })
      ];

      mockRedis.lrange.mockResolvedValue(deadJobs);

      const result = await adapter.listDeadLetterJobs(0, 10);

      expect(mockRedis.lrange).toHaveBeenCalledWith('dlq:failed', 0, 9);
      expect(result).toHaveLength(2);
    });

    it('requeues jobs from DLQ', async () => {
      const deadJob = {
        id: 'job_requeue',
        type: 'test_job',
        queue: 'test_queue'
      };

      mockRedis.lrange.mockResolvedValue([JSON.stringify(deadJob)]);
      mockRedis.lrem.mockResolvedValue(1);

      await adapter.requeueFromDeadLetter('job_requeue');

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'queue:test_queue',
        JSON.stringify(expect.objectContaining({
          id: 'job_requeue',
          status: 'pending',
          retries: 0 // Reset retries
        }))
      );
    });
  });

  describe('Performance & Stress Tests', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('handles high-volume job enqueuing', async () => {
      const jobs = Array(1000).fill(null).map((_, i) => ({
        id: `job_${i}`,
        type: 'test_job',
        data: { index: i }
      }));

      const promises = jobs.map(job => adapter.enqueue('test_queue', job));

      await Promise.all(promises);

      expect(mockRedis.lpush).toHaveBeenCalledTimes(1000);
    });

    it('handles concurrent dequeue operations', async () => {
      const jobData = { id: 'job_concurrent', type: 'test' };
      mockRedis.brpop.mockResolvedValue(['queue:test_queue', JSON.stringify(jobData)]);

      const promises = Array(10).fill(null).map(() =>
        adapter.dequeue('test_queue', 1000)
      );

      const results = await Promise.allSettled(promises);

      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('maintains performance under load', async () => {
      const startTime = Date.now();

      const operations = Array(100).fill(null).map(async (_, i) => {
        await adapter.enqueue('perf_test', {
          id: `perf_job_${i}`,
          type: 'perf_test',
          data: { test: true }
        });
      });

      await Promise.all(operations);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('recovers from Redis disconnection', async () => {
      // Simulate Redis disconnection
      mockRedis.lpush.mockRejectedValueOnce(new Error('Connection lost'));
      mockRedis.lpush.mockResolvedValueOnce(1);

      // Should retry and succeed
      await adapter.enqueue('test_queue', {
        id: 'job_recovery',
        type: 'test',
        data: {}
      });

      expect(mockRedis.lpush).toHaveBeenCalledTimes(2);
    });

    it('handles data corruption gracefully', async () => {
      mockRedis.brpop.mockResolvedValue(['queue:test_queue', 'corrupted_data']);

      const result = await adapter.dequeue('test_queue', 1000);

      expect(result).toBeNull(); // Should handle gracefully
    });

    it('cleans up orphaned jobs', async () => {
      const orphanedJobs = ['job_1', 'job_2', 'job_3'];
      mockRedis.keys.mockResolvedValue(orphanedJobs);
      mockRedis.hgetall.mockResolvedValue({ status: 'processing', updatedAt: '1234567890' });

      await adapter.cleanupOrphanedJobs(3600000); // 1 hour timeout

      expect(mockRedis.hdel).toHaveBeenCalledTimes(orphanedJobs.length);
    });
  });

  describe('Configuration Tests', () => {
    it('validates Redis configuration', () => {
      expect(() => new RedisAdapter({})).toThrow('Redis host is required');
      expect(() => new RedisAdapter({ host: '' })).toThrow('Redis host is required');
      expect(() => new RedisAdapter({ host: 'localhost', port: -1 })).toThrow('Invalid Redis port');
    });

    it('uses environment variables for configuration', () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_DB = '2';

      const adapter = new RedisAdapter();

      expect(MockedRedis).toHaveBeenCalledWith(expect.objectContaining({
        host: 'redis.example.com',
        port: 6380,
        db: 2
      }));

      // Cleanup
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_DB;
    });

    it('applies connection pooling settings', async () => {
      const adapter = new RedisAdapter({
        host: 'localhost',
        maxConnections: 10,
        connectionTimeout: 5000
      });

      await adapter.connect();

      expect(MockedRedis).toHaveBeenCalledWith(expect.objectContaining({
        connectTimeout: 5000,
        lazyConnect: true
      }));
    });
  });
});