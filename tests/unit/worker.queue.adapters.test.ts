/**
 * Worker Queue Adapters Unit Tests
 * Tests for Memory and Redis queue adapter implementations
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe('Queue Adapters Tests', () => {
  let tmp: string;
  let originalCwd: string;
  let originalEnv: { [key: string]: string | undefined };

  beforeAll(() => {
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nofx-queue-test-'));
    process.chdir(tmp);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    Object.assign(process.env, originalEnv);
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('MemoryQueueAdapter', () => {
    let MemoryQueueAdapter: any;

    beforeEach(async () => {
      process.env.DATA_DRIVER = 'fs';
      process.env.QUEUE_DRIVER = 'memory';
      ({ MemoryQueueAdapter } = await import('../../src/lib/queue/MemoryAdapter'));
    });

    test('enqueues and processes jobs successfully', async () => {
      const adapter = new MemoryQueueAdapter();
      const handler = jest.fn().mockResolvedValue('success');

      adapter.subscribe('test.topic', handler);
      await adapter.enqueue('test.topic', { message: 'test' });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledWith({ message: 'test' });
    });

    test.skip('handles job failures with retries', async () => {
      const adapter = new MemoryQueueAdapter();
      let attempts = 0;
      const handler = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      adapter.subscribe('test.topic', handler);
      await adapter.enqueue('test.topic', { message: 'retry-test' });

      // Wait for all retries
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handler).toHaveBeenCalledTimes(3);
    });

    test.skip('sends failed jobs to DLQ after max attempts', async () => {
      const adapter = new MemoryQueueAdapter();
      const handler = jest.fn().mockRejectedValue(new Error('Always fails'));

      adapter.subscribe('test.topic', handler);
      await adapter.enqueue('test.topic', { message: 'dlq-test', __attempt: 4 });

      // Wait for processing and DLQ
      await new Promise(resolve => setTimeout(resolve, 100));

      const dlqItems = await adapter.listDlq('test.dlq');
      expect(dlqItems.length).toBeGreaterThan(0);
    });

    test('provides queue counts', async () => {
      const adapter = new MemoryQueueAdapter();

      await adapter.enqueue('count.topic', { item: 1 });
      await adapter.enqueue('count.topic', { item: 2 });

      const counts = await adapter.getCounts('count.topic');
      expect(counts).toHaveProperty('active');
      expect(counts).toHaveProperty('waiting');
      expect(counts).toHaveProperty('delayed');
    });

    test('checks for subscribers', () => {
      const adapter = new MemoryQueueAdapter();

      expect(adapter.hasSubscribers?.('no.subscribers')).toBe(false);

      adapter.subscribe('has.subscribers', async () => {});
      expect(adapter.hasSubscribers?.('has.subscribers')).toBe(true);
    });

    test.skip('rehydrates items from DLQ', async () => {
      const adapter = new MemoryQueueAdapter();
      const handler = jest.fn().mockResolvedValue('success');

      adapter.subscribe('rehydrate.topic', handler);

      // First add item that will fail and go to DLQ
      const failHandler = jest.fn().mockRejectedValue(new Error('Fail once'));
      adapter.subscribe('rehydrate.topic', failHandler);

      await adapter.enqueue('rehydrate.topic', { message: 'rehydrate-test', __attempt: 4 });

      // Wait for DLQ
      await new Promise(resolve => setTimeout(resolve, 100));

      let dlqItems = await adapter.listDlq('rehydrate.dlq');
      expect(dlqItems.length).toBeGreaterThan(0);

      // Now rehydrate
      const rehydratedCount = await adapter.rehydrateDlq?.('rehydrate.dlq', 10);
      expect(rehydratedCount).toBeGreaterThan(0);

      // DLQ should be empty after rehydration
      dlqItems = await adapter.listDlq('rehydrate.dlq');
      expect(dlqItems.length).toBe(0);
    });

    test('provides oldest job age', async () => {
      const adapter = new MemoryQueueAdapter();

      await adapter.enqueue('age.topic', { timestamp: Date.now() });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const oldestAge = adapter.getOldestAgeMs?.('age.topic');
      expect(oldestAge).toBeGreaterThanOrEqual(0);
    });

    test('handles concurrent job processing', async () => {
      const adapter = new MemoryQueueAdapter();
      const processedJobs: any[] = [];
      const handler = jest.fn().mockImplementation(async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        processedJobs.push(payload);
      });

      adapter.subscribe('concurrent.topic', handler);

      // Enqueue multiple jobs quickly
      const jobs = Array(5).fill(null).map((_, i) => ({ id: i }));
      await Promise.all(jobs.map(job => adapter.enqueue('concurrent.topic', job)));

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(processedJobs).toHaveLength(5);
      expect(handler).toHaveBeenCalledTimes(5);
    });

    test('handles payload serialization/deserialization', async () => {
      const adapter = new MemoryQueueAdapter();
      const handler = jest.fn().mockResolvedValue(undefined);

      adapter.subscribe('serialization.topic', handler);

      const complexPayload = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null,
        undefined: undefined
      };

      await adapter.enqueue('serialization.topic', complexPayload);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          string: 'test',
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          object: { nested: 'value' },
          null: null
        })
      );
    });

    test('respects job options like delay', async () => {
      const adapter = new MemoryQueueAdapter();
      const handler = jest.fn().mockResolvedValue(undefined);
      let callTime: number;

      adapter.subscribe('delayed.topic', async (payload: any) => {
        callTime = Date.now();
        return handler(payload);
      });

      const startTime = Date.now();
      await adapter.enqueue('delayed.topic', { message: 'delayed' }, { delay: 100 });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handler).toHaveBeenCalledWith({ message: 'delayed' });
      expect(callTime! - startTime).toBeGreaterThanOrEqual(90); // Allow some timing variance
    });
  });

  describe('RedisQueueAdapter', () => {
    let RedisQueueAdapter: any;

    beforeEach(async () => {
      process.env.QUEUE_DRIVER = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';

      // Mock bullmq and ioredis
      jest.doMock('bullmq', () => ({
        Queue: jest.fn().mockImplementation((name) => ({
          name,
          add: jest.fn().mockResolvedValue({ id: 'job-123' }),
          getWaiting: jest.fn().mockResolvedValue([]),
          getActive: jest.fn().mockResolvedValue([]),
          getDelayed: jest.fn().mockResolvedValue([]),
          getCompleted: jest.fn().mockResolvedValue([]),
          getFailed: jest.fn().mockResolvedValue([]),
          close: jest.fn()
        })),
        Worker: jest.fn().mockImplementation((name, processor) => ({
          name,
          processor,
          on: jest.fn(),
          close: jest.fn()
        }))
      }));

      jest.doMock('ioredis', () => {
        return jest.fn().mockImplementation(() => ({
          on: jest.fn(),
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined)
        }));
      });

      ({ RedisQueueAdapter } = await import('../../src/lib/queue/RedisAdapter'));
    });

    test('creates Redis queues and workers', () => {
      const adapter = new RedisQueueAdapter();
      const { Queue, Worker } = require('bullmq');

      adapter.subscribe('redis.topic', async () => {});

      expect(Worker).toHaveBeenCalledWith(
        'redis.topic',
        expect.any(Function),
        expect.objectContaining({
          connection: expect.any(Object)
        })
      );
    });

    test('enqueues jobs to Redis queue', async () => {
      const adapter = new RedisQueueAdapter();
      const { Queue } = require('bullmq');
      const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-123' }) };
      Queue.mockReturnValue(mockQueue);

      await adapter.enqueue('redis.topic', { data: 'test' });

      expect(mockQueue.add).toHaveBeenCalledWith('job', { data: 'test' }, undefined);
    });

    test('enqueues jobs with options', async () => {
      const adapter = new RedisQueueAdapter();
      const { Queue } = require('bullmq');
      const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-123' }) };
      Queue.mockReturnValue(mockQueue);

      await adapter.enqueue('redis.topic', { data: 'test' }, { delay: 5000, attempts: 3 });

      expect(mockQueue.add).toHaveBeenCalledWith('job', { data: 'test' }, { delay: 5000, attempts: 3 });
    });

    test.skip('provides queue counts from Redis', async () => {
      const adapter = new RedisQueueAdapter();
      const { Queue } = require('bullmq');
      const mockQueue = {
        getWaiting: jest.fn().mockResolvedValue(['job1', 'job2']),
        getActive: jest.fn().mockResolvedValue(['job3']),
        getDelayed: jest.fn().mockResolvedValue([]),
        getCompleted: jest.fn().mockResolvedValue(['job4']),
        getFailed: jest.fn().mockResolvedValue(['job5'])
      };
      Queue.mockReturnValue(mockQueue);

      const counts = await adapter.getCounts('redis.topic');

      expect(counts).toEqual({
        waiting: 2,
        active: 1,
        delayed: 0,
        completed: 1,
        failed: 1
      });
    });

    test.skip('handles Redis connection errors gracefully', async () => {
      const IORedis = require('ioredis');
      IORedis.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // Should not throw during construction
      expect(() => new RedisQueueAdapter()).not.toThrow();
    });

    test('wraps handler with error handling', async () => {
      const adapter = new RedisQueueAdapter();
      const { Worker } = require('bullmq');
      let capturedProcessor: any;

      Worker.mockImplementation((name: string, processor: any) => {
        capturedProcessor = processor;
        return { on: jest.fn() };
      });

      const handler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      adapter.subscribe('error.topic', handler);

      // Test the wrapped processor
      const mockJob = { data: { test: 'data' } };
      await expect(capturedProcessor(mockJob)).rejects.toThrow('Handler failed');
      expect(handler).toHaveBeenCalledWith({ test: 'data' });
    });

    test('reuses queue instances for same topic', async () => {
      const adapter = new RedisQueueAdapter();
      const { Queue } = require('bullmq');

      await adapter.enqueue('same.topic', { data: 1 });
      await adapter.enqueue('same.topic', { data: 2 });

      // Should only create one Queue instance for the topic
      expect(Queue).toHaveBeenCalledTimes(1);
      expect(Queue).toHaveBeenCalledWith('same.topic', expect.any(Object));
    });

    test('creates different queue instances for different topics', async () => {
      const adapter = new RedisQueueAdapter();
      const { Queue } = require('bullmq');

      await adapter.enqueue('topic1', { data: 1 });
      await adapter.enqueue('topic2', { data: 2 });

      expect(Queue).toHaveBeenCalledTimes(2);
      expect(Queue).toHaveBeenNthCalledWith(1, 'topic1', expect.any(Object));
      expect(Queue).toHaveBeenNthCalledWith(2, 'topic2', expect.any(Object));
    });

    test('uses environment Redis URL', () => {
      process.env.REDIS_URL = 'redis://custom:6380';
      const IORedis = require('ioredis');

      new RedisQueueAdapter();

      expect(IORedis).toHaveBeenCalledWith('redis://custom:6380', expect.any(Object));
    });

    test('falls back to default Redis URL', () => {
      delete process.env.REDIS_URL;
      const IORedis = require('ioredis');

      new RedisQueueAdapter();

      expect(IORedis).toHaveBeenCalledWith('redis://localhost:6379', expect.any(Object));
    });
  });

  describe('Queue Driver Selection', () => {
    test('selects memory adapter by default', async () => {
      delete process.env.QUEUE_DRIVER;
      jest.resetModules();

      const { enqueue } = await import('../../src/lib/queue');

      // The function should exist (meaning memory adapter was loaded)
      expect(typeof enqueue).toBe('function');
    });

    test('selects memory adapter when QUEUE_DRIVER=memory', async () => {
      process.env.QUEUE_DRIVER = 'memory';
      jest.resetModules();

      const { enqueue } = await import('../../src/lib/queue');

      expect(typeof enqueue).toBe('function');
    });

    test.skip('selects redis adapter when QUEUE_DRIVER=redis', async () => {
      process.env.QUEUE_DRIVER = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';
      jest.resetModules();

      // Mock bullmq and ioredis for this test
      jest.doMock('bullmq', () => ({
        Queue: jest.fn(),
        Worker: jest.fn()
      }));
      jest.doMock('ioredis', () => jest.fn());

      const { enqueue } = await import('../../src/lib/queue');

      expect(typeof enqueue).toBe('function');
    });

    test('queue interface consistency', async () => {
      // Test that both adapters implement the same interface
      process.env.QUEUE_DRIVER = 'memory';
      jest.resetModules();

      const memoryModule = await import('../../src/lib/queue');

      expect(typeof memoryModule.enqueue).toBe('function');
      expect(typeof memoryModule.subscribe).toBe('function');
      expect(typeof memoryModule.getCounts).toBe('function');
      expect(typeof memoryModule.hasSubscribers).toBe('function');
      expect(typeof memoryModule.listDlq).toBe('function');
      expect(typeof memoryModule.rehydrateDlq).toBe('function');
      expect(typeof memoryModule.getOldestAgeMs).toBe('function');
    });
  });
});