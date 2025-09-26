/**
 * Worker Outbox Relay Unit Tests
 * Tests the outbox relay system that processes outbox events
 */

import { startOutboxRelay } from '../../src/worker/relay';

// Mock all dependencies
jest.mock('../../src/lib/store', () => ({
  store: {
    outboxListUnsent: jest.fn(),
    outboxMarkSent: jest.fn()
  }
}));

jest.mock('../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  OUTBOX_TOPIC: 'outbox'
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Worker Outbox Relay Tests', () => {
  const mockStore = require('../../src/lib/store').store;
  const { enqueue, OUTBOX_TOPIC } = require('../../src/lib/queue');
  const { log } = require('../../src/lib/logger');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock environment variables
    process.env.OUTBOX_RELAY_INTERVAL_MS = '1000';
    process.env.OUTBOX_RELAY_BATCH = '25';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('startOutboxRelay', () => {
    test('does not start in test environment', () => {
      process.env.NODE_ENV = 'test';

      startOutboxRelay();

      // Should not start any timers in test environment
      expect(mockStore.outboxListUnsent).not.toHaveBeenCalled();
    });

    test('starts relay in non-test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockStore.outboxListUnsent.mockResolvedValue([]);

      startOutboxRelay();

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('relay tick processing', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('processes outbox events successfully', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'outbox',
          payload: {
            runId: 'run-123',
            type: 'step.succeeded',
            stepId: 'step-456'
          }
        },
        {
          id: 'outbox-2',
          topic: 'step.ready',
          payload: {
            runId: 'run-789',
            stepId: 'step-012'
          }
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);
      enqueue.mockResolvedValue(undefined);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockStore.outboxListUnsent).toHaveBeenCalledWith(25);

      // Check outbox topic processing
      expect(enqueue).toHaveBeenCalledWith('outbox', {
        runId: 'run-123',
        type: 'step.succeeded',
        stepId: 'step-456',
        __attempt: 1
      });

      // Check regular topic processing
      expect(enqueue).toHaveBeenCalledWith('step.ready', {
        runId: 'run-789',
        stepId: 'step-012',
        __attempt: 1
      });

      expect(mockStore.outboxMarkSent).toHaveBeenCalledWith('outbox-1');
      expect(mockStore.outboxMarkSent).toHaveBeenCalledWith('outbox-2');
    });

    test('handles enqueue errors gracefully', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'outbox',
          payload: {
            runId: 'run-123',
            type: 'step.succeeded'
          }
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);
      enqueue.mockRejectedValue(new Error('Queue full'));

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(enqueue).toHaveBeenCalled();
      // Should not mark as sent due to error
      expect(mockStore.outboxMarkSent).not.toHaveBeenCalled();
    });

    test('handles store errors gracefully', async () => {
      mockStore.outboxListUnsent.mockRejectedValue(new Error('Database error'));

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(log.error).toHaveBeenCalledWith(
        { e: expect.any(Error) },
        'outbox.tick.error'
      );
    });

    test('processes empty outbox list', async () => {
      mockStore.outboxListUnsent.mockResolvedValue([]);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockStore.outboxListUnsent).toHaveBeenCalledWith(25);
      expect(enqueue).not.toHaveBeenCalled();
      expect(mockStore.outboxMarkSent).not.toHaveBeenCalled();
    });

    test('schedules next tick after processing', async () => {
      mockStore.outboxListUnsent.mockResolvedValue([]);

      startOutboxRelay();

      // First tick
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockStore.outboxListUnsent).toHaveBeenCalledTimes(1);

      // Second tick
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockStore.outboxListUnsent).toHaveBeenCalledTimes(2);
    });

    test('handles outbox payload normalization', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'outbox',
          payload: {
            runId: 'run-123',
            type: 'step.succeeded',
            stepId: 'step-456',
            payload: { result: 'success' }
          }
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(enqueue).toHaveBeenCalledWith('outbox', {
        runId: 'run-123',
        type: 'step.succeeded',
        stepId: 'step-456',
        payload: { result: 'success' },
        __attempt: 1
      });
    });

    test('adds attempt counter to non-outbox topics', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'custom.topic',
          payload: {
            data: 'test'
          }
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(enqueue).toHaveBeenCalledWith('custom.topic', {
        data: 'test',
        __attempt: 1
      });
    });

    test('handles null payload for non-outbox topics', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'custom.topic',
          payload: null
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(enqueue).toHaveBeenCalledWith('custom.topic', {
        __attempt: 1
      });
    });

    test('respects custom batch size', async () => {
      process.env.OUTBOX_RELAY_BATCH = '50';
      mockStore.outboxListUnsent.mockResolvedValue([]);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockStore.outboxListUnsent).toHaveBeenCalledWith(50);
    });

    test('respects custom interval', async () => {
      process.env.OUTBOX_RELAY_INTERVAL_MS = '2000';
      mockStore.outboxListUnsent.mockResolvedValue([]);

      startOutboxRelay();

      // Should not trigger at 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockStore.outboxListUnsent).not.toHaveBeenCalled();

      // Should trigger at 2000ms
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockStore.outboxListUnsent).toHaveBeenCalled();
    });
  });

  describe('outbox payload validation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('handles invalid outbox payload gracefully', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'outbox',
          payload: null // Invalid payload
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      // Should not enqueue due to invalid payload, but should not crash
      expect(enqueue).not.toHaveBeenCalled();
      expect(mockStore.outboxMarkSent).not.toHaveBeenCalled();
    });

    test('handles missing runId in outbox payload', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'outbox',
          payload: {
            type: 'step.succeeded'
            // Missing runId
          }
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      // Should not enqueue due to missing runId
      expect(enqueue).not.toHaveBeenCalled();
      expect(mockStore.outboxMarkSent).not.toHaveBeenCalled();
    });

    test('handles missing type in outbox payload', async () => {
      const outboxRows = [
        {
          id: 'outbox-1',
          topic: 'outbox',
          payload: {
            runId: 'run-123'
            // Missing type
          }
        }
      ];

      mockStore.outboxListUnsent.mockResolvedValue(outboxRows);

      startOutboxRelay();

      // Advance timer to trigger first tick
      await jest.advanceTimersByTimeAsync(1000);

      // Should not enqueue due to missing type
      expect(enqueue).not.toHaveBeenCalled();
      expect(mockStore.outboxMarkSent).not.toHaveBeenCalled();
    });
  });
});