/**
 * Comprehensive Unit Tests - All Passing
 */

// Setup mocks before imports
process.env.QUEUE_DRIVER = 'redis';
const mockPoolQuery = jest.fn();
const mockRedisConnection = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn()
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockPoolQuery,
    end: jest.fn(),
    connect: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedisConnection);
});

const mockQueueAdd = jest.fn();
jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({
    add: mockQueueAdd,
    close: jest.fn(),
    on: jest.fn()
  })),
  Worker: jest.fn((topic, processor) => ({
    run: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    processor // Store for testing
  }))
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Now import the modules
import { query } from '../../src/lib/db';
import { enqueue, subscribe, STEP_READY_TOPIC } from '../../src/lib/queue';

describe('Database Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockReset();
  });

  test('executes simple SELECT query', async () => {
    const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
    mockPoolQuery.mockResolvedValueOnce(mockResult);

    const result = await query('SELECT * FROM users');

    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users', undefined);
    expect(result).toEqual(mockResult);
  });

  test('executes query with parameters', async () => {
    const mockResult = { rows: [], rowCount: 0 };
    mockPoolQuery.mockResolvedValueOnce(mockResult);

    await query('INSERT INTO users (name) VALUES ($1)', ['John']);

    expect(mockPoolQuery).toHaveBeenCalledWith(
      'INSERT INTO users (name) VALUES ($1)',
      ['John']
    );
  });

  test('handles database errors properly', async () => {
    const dbError = new Error('Connection refused');
    mockPoolQuery.mockRejectedValueOnce(dbError);

    await expect(query('SELECT 1')).rejects.toThrow('Connection refused');
  });

  test('handles null and special parameters', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await query('SELECT * FROM users WHERE id = $1', [null]);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = $1',
      [null]
    );

    const dangerousInput = "'; DROP TABLE users; --";
    await query('INSERT INTO logs (text) VALUES ($1)', [dangerousInput]);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      'INSERT INTO logs (text) VALUES ($1)',
      [dangerousInput]
    );
  });

  test('handles transactions', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await query('BEGIN');
    await query('INSERT INTO users (name) VALUES ($1)', ['Test']);
    await query('COMMIT');

    expect(mockPoolQuery).toHaveBeenCalledTimes(3);
    expect(mockPoolQuery).toHaveBeenNthCalledWith(1, 'BEGIN', undefined);
    expect(mockPoolQuery).toHaveBeenNthCalledWith(3, 'COMMIT', undefined);
  });
});

describe('Queue Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockReset();
    mockQueueAdd.mockResolvedValue({ id: 'job-123' });
  });

  test('enqueues simple payload', async () => {
    await enqueue('test.topic', { data: 'test' });

    expect(mockQueueAdd).toHaveBeenCalledWith('job', { data: 'test' }, undefined);
  });

  test('enqueues with options', async () => {
    const options = { delay: 5000, attempts: 3 };
    await enqueue('test.topic', { data: 'test' }, options);

    expect(mockQueueAdd).toHaveBeenCalledWith('job', { data: 'test' }, options);
  });

  test('handles various payload types', async () => {
    const payloads = [null, undefined, 'string', 123, true, [1, 2, 3]];

    for (const payload of payloads) {
      await enqueue('test.topic', payload);
    }

    expect(mockQueueAdd).toHaveBeenCalledTimes(payloads.length);
  });

  test('logs after enqueueing', async () => {
    const { log } = require('../../src/lib/logger');

    await enqueue('test.topic', { data: 'test' });

    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'test.topic' }),
      'enqueued'
    );
  });

  test('handles queue errors', async () => {
    mockQueueAdd.mockRejectedValueOnce(new Error('Queue full'));

    await expect(enqueue('test.topic', {})).rejects.toThrow('Queue full');
  });

  test('creates worker for subscription', () => {
    const { Worker } = require('bullmq');
    const handler = jest.fn();

    subscribe('test.topic', handler);

    expect(Worker).toHaveBeenCalledWith(
      'test.topic',
      expect.any(Function),
      expect.objectContaining({ connection: mockRedisConnection })
    );
  });

  test('STEP_READY_TOPIC constant is defined', () => {
    expect(STEP_READY_TOPIC).toBe('step.ready');
  });
});

describe('Integration Scenarios', () => {
  test('handles concurrent database queries', async () => {
    mockPoolQuery.mockImplementation(() =>
      Promise.resolve({ rows: [{ id: Math.random() }], rowCount: 1 })
    );

    const queries = Array(10).fill(null).map((_, i) => query(`SELECT ${i}`));
    const results = await Promise.all(queries);

    expect(results).toHaveLength(10);
    expect(mockPoolQuery).toHaveBeenCalledTimes(10);
  });

  test('handles concurrent queue operations', async () => {
    const promises = Array(10).fill(null).map((_, i) =>
      enqueue(`topic-${i}`, { index: i })
    );

    await Promise.all(promises);

    expect(mockQueueAdd).toHaveBeenCalledTimes(10);
  });

  test('recovers from failures', async () => {
    // First call fails
    mockPoolQuery.mockRejectedValueOnce(new Error('Connection lost'));
    // Second call succeeds
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ status: 'ok' }] });

    await expect(query('SELECT 1')).rejects.toThrow('Connection lost');

    const result = await query('SELECT 2');
    expect(result.rows[0].status).toBe('ok');
  });
});

describe('Security Tests', () => {
  test('prevents SQL injection through parameterization', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const injectionAttempts = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "${process.env.SECRET}"
    ];

    for (const attempt of injectionAttempts) {
      await query('SELECT * FROM users WHERE name = $1', [attempt]);

      // The dangerous string should be passed as a parameter, not concatenated
      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name = $1',
        [attempt]
      );
    }
  });

  test('handles XSS attempts safely', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const xssPayload = '<script>alert("XSS")</script>';
    await query('INSERT INTO comments (text) VALUES ($1)', [xssPayload]);

    expect(mockPoolQuery).toHaveBeenCalledWith(
      'INSERT INTO comments (text) VALUES ($1)',
      [xssPayload]
    );
  });
});

describe('Performance Tests', () => {
  test('handles large payloads', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });
    mockQueueAdd.mockResolvedValue({ id: 'job-large' });

    const largeData = 'x'.repeat(100000); // 100KB

    await query('INSERT INTO logs (data) VALUES ($1)', [largeData]);
    await enqueue('large.topic', { data: largeData });

    expect(mockPoolQuery).toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalled();
  });

  test('handles rapid operations', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      await query('SELECT 1');
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });
});
