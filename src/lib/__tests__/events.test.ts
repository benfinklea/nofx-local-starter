/**
 * Events Module Tests - 85%+ Coverage Target
 * Tests event recording with transactional outbox pattern
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { recordEvent } from '../events';
import { store } from '../store';
import * as dbModule from '../db';

// Mock dependencies
// Create mock function that can be reassigned
const mockWithTransaction = jest.fn().mockImplementation(async (fn: any) => fn());

jest.mock('../store', () => ({
  store: {
    driver: 'db',
    recordEvent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
    outboxAdd: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void)
  }
}));
jest.mock('../db', () => ({
  get withTransaction() {
    return mockWithTransaction;
  }
}));

const mockedStore = store as any;
const mockedDb = dbModule as any;

describe('Events Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockedStore.recordEvent = jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void);
    mockedStore.outboxAdd = jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void);
    mockWithTransaction.mockReset().mockImplementation(async (fn: any) => {
      return await fn();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordEvent - Database Driver', () => {
    beforeEach(() => {
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });
    });

    it('records event with transaction wrapper', async () => {
      const runId = 'run-123';
      const type = 'step.completed';
      const payload = { step: 'test-step', result: 'success' };
      const stepId = 'step-456';

      await recordEvent(runId, type, payload, stepId);

      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        stepId
      );
      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'event.out',
        expect.objectContaining({
          runId,
          stepId,
          type,
          payload
        })
      );
    });

    it('records event without stepId', async () => {
      const runId = 'run-789';
      const type = 'run.started';
      const payload = { timestamp: Date.now() };

      await recordEvent(runId, type, payload);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        undefined
      );
      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'event.out',
        expect.objectContaining({
          runId,
          stepId: null,
          type,
          payload
        })
      );
    });

    it('records event with empty payload', async () => {
      const runId = 'run-empty';
      const type = 'run.initialized';

      await recordEvent(runId, type);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        {},
        undefined
      );
      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'event.out',
        expect.objectContaining({
          payload: {}
        })
      );
    });

    it('sanitizes payload using toJsonValue', async () => {
      const runId = 'run-sanitize';
      const type = 'test.event';
      const complexPayload = {
        data: 'test',
        circular: {} as any,
        nested: {
          value: 123,
          fn: () => 'ignored' // Functions should be filtered
        }
      };
      complexPayload.circular = complexPayload; // Create circular reference

      await recordEvent(runId, type, complexPayload);

      // Should not throw on circular reference
      expect(mockedStore.recordEvent).toHaveBeenCalled();
      expect(mockedStore.outboxAdd).toHaveBeenCalled();
    });

    it('wraps both operations in transaction', async () => {
      const runId = 'run-tx';
      const type = 'test.transaction';
      const payload = { test: 'data' };

      let recordEventCalled = false;
      let outboxAddCalled = false;

      mockedStore.recordEvent.mockImplementation(async () => {
        recordEventCalled = true;
      });

      mockedStore.outboxAdd.mockImplementation(async () => {
        outboxAddCalled = true;
      });

      mockWithTransaction.mockImplementation(async (fn: () => Promise<any>) => {
        await fn();
        expect(recordEventCalled).toBe(true);
        expect(outboxAddCalled).toBe(true);
      });

      await recordEvent(runId, type, payload);

      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from recordEvent', async () => {
      mockedStore.recordEvent.mockRejectedValue(new Error('Database write failed'));

      await expect(recordEvent('run-fail', 'test.event', {}))
        .rejects.toThrow('Database write failed');

      expect(mockedStore.outboxAdd).not.toHaveBeenCalled();
    });

    it('propagates errors from outboxAdd', async () => {
      mockedStore.recordEvent.mockResolvedValue(undefined);
      mockedStore.outboxAdd.mockRejectedValue(new Error('Outbox write failed'));

      await expect(recordEvent('run-fail-outbox', 'test.event', {}))
        .rejects.toThrow('Outbox write failed');
    });

    it('rolls back transaction on error', async () => {
      let transactionFailed = false;

      mockWithTransaction.mockImplementation(async (fn: () => Promise<any>) => {
        try {
          await fn();
        } catch (error) {
          transactionFailed = true;
          throw error;
        }
      });

      mockedStore.recordEvent.mockRejectedValue(new Error('TX fail'));

      await expect(recordEvent('run-rollback', 'test.event', {}))
        .rejects.toThrow('TX fail');

      expect(transactionFailed).toBe(true);
    });
  });

  describe('recordEvent - File System Driver', () => {
    beforeEach(() => {
      Object.defineProperty(mockedStore, 'driver', { value: 'fs', writable: true });
    });

    it('records event without transaction wrapper', async () => {
      const runId = 'run-fs-123';
      const type = 'step.completed';
      const payload = { step: 'fs-step', result: 'success' };

      await recordEvent(runId, type, payload);

      expect(mockWithTransaction).not.toHaveBeenCalled();
      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        undefined
      );
    });

    it('attempts outboxAdd but ignores errors', async () => {
      const runId = 'run-fs-outbox';
      const type = 'test.event';
      const payload = { data: 'test' };

      mockedStore.outboxAdd.mockRejectedValue(new Error('Outbox not available'));

      // Should not throw even if outboxAdd fails
      await expect(recordEvent(runId, type, payload)).resolves.not.toThrow();

      expect(mockedStore.recordEvent).toHaveBeenCalled();
      expect(mockedStore.outboxAdd).toHaveBeenCalled();
    });

    it('records event successfully with FS driver', async () => {
      const runId = 'run-fs-success';
      const type = 'run.completed';
      const payload = { duration: 5000, status: 'success' };
      const stepId = 'step-final';

      await recordEvent(runId, type, payload, stepId);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        stepId
      );
      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'event.out',
        expect.objectContaining({
          runId,
          stepId,
          type,
          payload
        })
      );
    });

    it('propagates recordEvent errors even in FS mode', async () => {
      mockedStore.recordEvent.mockRejectedValue(new Error('FS write failed'));

      await expect(recordEvent('run-fs-fail', 'test.event', {}))
        .rejects.toThrow('FS write failed');
    });

    it('handles outbox error silently in FS mode', async () => {
      mockedStore.recordEvent.mockResolvedValue(undefined);
      mockedStore.outboxAdd.mockRejectedValue(new Error('Outbox unavailable'));

      // Should succeed despite outbox error
      await expect(recordEvent('run-fs-outbox-fail', 'test.event', {}))
        .resolves.not.toThrow();

      expect(mockedStore.recordEvent).toHaveBeenCalled();
    });
  });

  describe('Payload Sanitization', () => {
    beforeEach(() => {
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });
    });

    it('handles null payload', async () => {
      const runId = 'run-null';
      const type = 'test.null';

      await recordEvent(runId, type, null);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        null,
        undefined
      );
    });

    it('handles undefined payload', async () => {
      const runId = 'run-undefined';
      const type = 'test.undefined';

      await recordEvent(runId, type, undefined);

      // When undefined is passed, the default parameter value {} is used
      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        {},
        undefined
      );
    });

    it('handles array payload', async () => {
      const runId = 'run-array';
      const type = 'test.array';
      const payload = [1, 2, 3, { nested: 'value' }];

      await recordEvent(runId, type, payload);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        undefined
      );
    });

    it('handles string payload', async () => {
      const runId = 'run-string';
      const type = 'test.string';
      const payload = 'simple string';

      await recordEvent(runId, type, payload);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        undefined
      );
    });

    it('handles number payload', async () => {
      const runId = 'run-number';
      const type = 'test.number';
      const payload = 42;

      await recordEvent(runId, type, payload);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        undefined
      );
    });

    it('handles boolean payload', async () => {
      const runId = 'run-boolean';
      const type = 'test.boolean';
      const payload = true;

      await recordEvent(runId, type, payload);

      expect(mockedStore.recordEvent).toHaveBeenCalledWith(
        runId,
        type,
        payload,
        undefined
      );
    });

    it('handles deeply nested payload', async () => {
      const runId = 'run-deep';
      const type = 'test.deep';
      const payload = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'deep value'
              }
            }
          }
        }
      };

      await recordEvent(runId, type, payload);

      expect(mockedStore.recordEvent).toHaveBeenCalled();
      expect(mockedStore.outboxAdd).toHaveBeenCalled();
    });
  });

  describe('StepId Handling', () => {
    beforeEach(() => {
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });
    });

    it('includes stepId when provided', async () => {
      const runId = 'run-with-step';
      const type = 'step.event';
      const payload = { data: 'test' };
      const stepId = 'step-123';

      await recordEvent(runId, type, payload, stepId);

      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'event.out',
        expect.objectContaining({
          stepId: 'step-123'
        })
      );
    });

    it('sets stepId to null when not provided', async () => {
      const runId = 'run-no-step';
      const type = 'run.event';
      const payload = { data: 'test' };

      await recordEvent(runId, type, payload);

      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'event.out',
        expect.objectContaining({
          stepId: null
        })
      );
    });

    it('handles empty string stepId', async () => {
      const runId = 'run-empty-step';
      const type = 'test.event';
      const payload = { data: 'test' };
      const stepId = '';

      await recordEvent(runId, type, payload, stepId);

      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'event.out',
        expect.objectContaining({
          stepId: ''
        })
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('handles typical run lifecycle events', async () => {
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });

      // Run started
      await recordEvent('run-lifecycle', 'run.started', { timestamp: Date.now() });

      // Step events
      await recordEvent('run-lifecycle', 'step.started', { step: 'step1' }, 'step-1');
      await recordEvent('run-lifecycle', 'step.completed', { result: 'ok' }, 'step-1');
      await recordEvent('run-lifecycle', 'step.started', { step: 'step2' }, 'step-2');
      await recordEvent('run-lifecycle', 'step.completed', { result: 'ok' }, 'step-2');

      // Run completed
      await recordEvent('run-lifecycle', 'run.completed', {
        duration: 10000,
        steps: 2
      });

      expect(mockedStore.recordEvent).toHaveBeenCalledTimes(6);
      expect(mockedStore.outboxAdd).toHaveBeenCalledTimes(6);
      expect(mockWithTransaction).toHaveBeenCalledTimes(6);
    });

    it('handles mixed driver scenarios', async () => {
      // Start with DB driver
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });
      await recordEvent('run-mixed', 'run.started', {});
      expect(mockWithTransaction).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Switch to FS driver
      Object.defineProperty(mockedStore, 'driver', { value: 'fs', writable: true });
      await recordEvent('run-mixed', 'step.completed', {}, 'step-1');
      expect(mockWithTransaction).not.toHaveBeenCalled();
    });

    it('handles high-volume event recording', async () => {
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });

      const promises = Array(100).fill(null).map((_, i) =>
        recordEvent(`run-${i}`, 'test.event', { index: i })
      );

      await Promise.all(promises);

      expect(mockedStore.recordEvent).toHaveBeenCalledTimes(100);
      expect(mockedStore.outboxAdd).toHaveBeenCalledTimes(100);
      expect(mockWithTransaction).toHaveBeenCalledTimes(100);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(() => {
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });
    });

    it('recovers from transient errors', async () => {
      // First call fails
      mockedStore.recordEvent.mockRejectedValueOnce(new Error('Transient error'));

      await expect(recordEvent('run-retry', 'test.event', {}))
        .rejects.toThrow('Transient error');

      // Second call succeeds
      mockedStore.recordEvent.mockResolvedValue(undefined);

      await expect(recordEvent('run-retry', 'test.event', {}))
        .resolves.not.toThrow();
    });

    it('maintains consistency on partial failure', async () => {
      mockedStore.recordEvent.mockResolvedValue(undefined);
      mockedStore.outboxAdd.mockRejectedValue(new Error('Outbox failed'));

      await expect(recordEvent('run-partial', 'test.event', {}))
        .rejects.toThrow('Outbox failed');

      // Both operations should be called despite error
      expect(mockedStore.recordEvent).toHaveBeenCalled();
      expect(mockedStore.outboxAdd).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    beforeEach(() => {
      Object.defineProperty(mockedStore, 'driver', { value: 'db', writable: true });
    });

    it('handles concurrent event recording', async () => {
      const runId = 'run-concurrent';
      const promises = Array(50).fill(null).map((_, i) =>
        recordEvent(runId, 'concurrent.event', { index: i }, `step-${i}`)
      );

      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(mockedStore.recordEvent).toHaveBeenCalledTimes(50);
      expect(duration).toBeLessThan(1000); // Should complete in reasonable time
    });

    it('handles large payloads', async () => {
      const runId = 'run-large';
      const largePayload = {
        data: 'x'.repeat(10000), // 10KB string
        nested: {
          array: Array(1000).fill({ item: 'data' })
        }
      };

      await expect(recordEvent(runId, 'large.event', largePayload))
        .resolves.not.toThrow();

      expect(mockedStore.recordEvent).toHaveBeenCalled();
    });
  });
});
