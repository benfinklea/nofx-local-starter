import { enqueue, subscribe, STEP_READY_TOPIC } from '../../src/lib/queue';

// Mock dependencies before they're imported
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn()
  }));
});

jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    close: jest.fn(),
    on: jest.fn()
  };

  const mockWorker = {
    run: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation((topic, processor, options) => {
      // Store the processor for testing
      (mockWorker as any).processor = processor;
      return mockWorker;
    })
  };
});

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Queue Module - Fixed Tests', () => {
  let mockQueue: any;
  let mockWorker: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { Queue, Worker } = require('bullmq');
    mockQueue = new Queue();
    mockWorker = new Worker();
  });

  describe('enqueue function', () => {
    test('enqueues simple payload successfully', async () => {
      const payload = { test: 'data' };

      await enqueue('test.topic', payload);

      expect(mockQueue.add).toHaveBeenCalledWith('job', payload, undefined);
    });

    test('enqueues with options', async () => {
      const payload = { test: 'data' };
      const options = { delay: 5000, attempts: 3 };

      await enqueue('test.topic', payload, options);

      expect(mockQueue.add).toHaveBeenCalledWith('job', payload, options);
    });

    test('handles various payload types', async () => {
      const payloads = [
        null,
        undefined,
        'string',
        123,
        true,
        { complex: { nested: 'object' } },
        [1, 2, 3]
      ];

      for (const payload of payloads) {
        await enqueue('test.topic', payload);
      }

      expect(mockQueue.add).toHaveBeenCalledTimes(payloads.length);
    });

    test('logs after enqueueing', async () => {
      const { log } = require('../../src/lib/logger');

      await enqueue('test.topic', { data: 'test' });

      expect(log.info).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'test.topic' }),
        'enqueued'
      );
    });

    test('handles queue errors gracefully', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Queue full'));

      await expect(enqueue('test.topic', {})).rejects.toThrow('Queue full');
    });
  });

  describe('subscribe function', () => {
    test('creates worker for topic', () => {
      const { Worker } = require('bullmq');
      const handler = jest.fn();

      subscribe('test.topic', handler);

      expect(Worker).toHaveBeenCalledWith(
        'test.topic',
        expect.any(Function),
        expect.objectContaining({ connection: expect.any(Object) })
      );
    });

    test('processes jobs with handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const jobData = { test: 'data' };

      // Mock the Worker to capture the processor
      const { Worker } = require('bullmq');
      let capturedProcessor: any;
      Worker.mockImplementationOnce((topic: string, processor: any) => {
        capturedProcessor = processor;
        return { on: jest.fn() };
      });

      subscribe('test.topic', handler);

      // Now call the captured processor
      await capturedProcessor({ data: jobData });

      expect(handler).toHaveBeenCalledWith(jobData);
    });

    test('handles and rethrows handler errors', async () => {
      const { Worker } = require('bullmq');
      const error = new Error('Handler failed');
      const handler = jest.fn().mockRejectedValue(error);

      let capturedProcessor: any;
      Worker.mockImplementationOnce((topic: string, processor: any) => {
        capturedProcessor = processor;
        return { on: jest.fn() };
      });

      subscribe('test.topic', handler);

      // The processor should call the handler and propagate the error
      await expect(capturedProcessor({ data: {} })).rejects.toThrow('Handler failed');
      expect(handler).toHaveBeenCalledWith({});
    });

    test('logs subscription', () => {
      const { log } = require('../../src/lib/logger');

      subscribe('test.topic', async () => {});

      expect(log.info).toHaveBeenCalledWith(
        { topic: 'test.topic' },
        'subscribed'
      );
    });
  });

  describe('Constants', () => {
    test('STEP_READY_TOPIC is correctly defined', () => {
      expect(STEP_READY_TOPIC).toBe('step.ready');
    });
  });

  describe('Queue reuse', () => {
    test('reuses queue instance for same topic', async () => {
      const { Queue } = require('bullmq');

      // Clear previous calls
      Queue.mockClear();

      // Enqueue to same topic multiple times
      await enqueue('same.topic', { data: 1 });
      await enqueue('same.topic', { data: 2 });
      await enqueue('same.topic', { data: 3 });

      // Should only create one Queue instance for the topic
      expect(Queue).toHaveBeenCalledTimes(1);
      expect(Queue).toHaveBeenCalledWith('same.topic', expect.any(Object));
    });

    test('creates different queues for different topics', async () => {
      const { Queue } = require('bullmq');

      Queue.mockClear();

      await enqueue('topic1', { data: 1 });
      await enqueue('topic2', { data: 2 });
      await enqueue('topic3', { data: 3 });

      // Should create three different Queue instances
      expect(Queue).toHaveBeenCalledTimes(3);
    });
  });
});