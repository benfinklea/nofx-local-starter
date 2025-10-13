/**
 * Comprehensive unit tests for runRecovery.ts
 * Target Coverage: 90%
 *
 * Tests cover:
 * - Step retry functionality
 * - Error handling for different scenarios
 * - Idempotency key management
 * - Step status validation
 * - Transaction atomicity
 * - Event recording
 * - Queue integration
 */

import { retryStep, StepNotFoundError, StepNotRetryableError } from '../runRecovery';
import type { StepRow } from '../store';

// Mock dependencies
jest.mock('../store', () => ({
  store: {
    getStep: jest.fn(),
    resetStep: jest.fn(),
    resetRun: jest.fn(),
    inboxDelete: jest.fn()
  }
}));

jest.mock('../events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../tx', () => ({
  runAtomically: jest.fn((fn) => fn()) // Execute immediately for testing
}));

jest.mock('../queue', () => ({
  enqueue: jest.fn(),
  STEP_READY_TOPIC: 'step.ready'
}));

jest.mock('node:crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => ({ slice: jest.fn(() => '1234567890ab') }))
  }))
}));

describe('runRecovery', () => {
  let mockStore: any;
  let mockRecordEvent: jest.Mock;
  let mockRunAtomically: jest.Mock;
  let mockEnqueue: jest.Mock;

  beforeEach(() => {
    mockStore = require('../store').store;
    mockRecordEvent = require('../events').recordEvent;
    mockRunAtomically = require('../tx').runAtomically;
    mockEnqueue = require('../queue').enqueue;

    // Reset all mocks
    jest.clearAllMocks();

    // Default mock implementations
    mockStore.getStep.mockResolvedValue(null);
    mockStore.resetStep.mockResolvedValue(undefined);
    mockStore.resetRun.mockResolvedValue(undefined);
    mockStore.inboxDelete.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
    mockEnqueue.mockResolvedValue(undefined);
  });

  describe('retryStep', () => {
    describe('Successful Retry', () => {
      it('retries failed step successfully', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test Step',
          tool: 'test_tool',
          inputs: { test: 'input' },
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: '2024-01-15T12:00:05.000Z',
          ended_at: '2024-01-15T12:00:10.000Z',
          outputs: { error: 'Test error' },
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockStore.resetStep).toHaveBeenCalledWith('step-123');
        expect(mockStore.resetRun).toHaveBeenCalledWith('run-456');
        expect(mockStore.inboxDelete).toHaveBeenCalledWith('step-exec:step-123');
        expect(mockRecordEvent).toHaveBeenCalledWith(
          'run-456',
          'step.retry',
          { stepId: 'step-123', previousStatus: 'failed' },
          'step-123'
        );
        expect(mockRecordEvent).toHaveBeenCalledWith(
          'run-456',
          'run.resumed',
          { stepId: 'step-123' }
        );
        expect(mockEnqueue).toHaveBeenCalledWith(
          'step.ready',
          { runId: 'run-456', stepId: 'step-123', __attempt: 1 }
        );
      });

      it('retries timed_out step', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Timeout Step',
          tool: 'test_tool',
          inputs: {},
          status: 'timed_out',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: '2024-01-15T12:00:05.000Z',
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockRecordEvent).toHaveBeenCalledWith(
          'run-456',
          'step.retry',
          { stepId: 'step-123', previousStatus: 'timed_out' },
          'step-123'
        );
      });

      it('retries cancelled step', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Cancelled Step',
          tool: 'test_tool',
          inputs: {},
          status: 'cancelled',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockRecordEvent).toHaveBeenCalledWith(
          'run-456',
          'step.retry',
          { stepId: 'step-123', previousStatus: 'cancelled' },
          'step-123'
        );
      });

      it('handles idempotency key cleanup', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Idempotent Step',
          tool: 'test_tool',
          inputs: { data: 'test' },
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        // Should delete both step-exec and natural idempotency keys
        expect(mockStore.inboxDelete).toHaveBeenCalledWith('step-exec:step-123');
        expect(mockStore.inboxDelete).toHaveBeenCalledWith(
          expect.stringMatching(/^run-456:Idempotent Step:/)
        );
      });

      it('executes all operations atomically', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockRunAtomically).toHaveBeenCalled();
      });
    });

    describe('Error Cases', () => {
      it('throws StepNotFoundError when step does not exist', async () => {
        mockStore.getStep.mockResolvedValue(null);

        await expect(retryStep('run-456', 'non-existent-step'))
          .rejects.toThrow(StepNotFoundError);

        expect(mockStore.resetStep).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
      });

      it('throws StepNotFoundError when step belongs to different run', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'different-run',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123'))
          .rejects.toThrow(StepNotFoundError);
      });

      it('throws StepNotRetryableError for queued step', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'queued',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123'))
          .rejects.toThrow(StepNotRetryableError);
      });

      it('throws StepNotRetryableError for running step', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'running',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: '2024-01-15T12:00:05.000Z',
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123'))
          .rejects.toThrow(StepNotRetryableError);
      });

      it('throws StepNotRetryableError for completed step', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'completed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: '2024-01-15T12:00:05.000Z',
          ended_at: '2024-01-15T12:00:10.000Z',
          outputs: { result: 'success' },
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123'))
          .rejects.toThrow(StepNotRetryableError);
      });

      it('handles case-insensitive status checking', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'FAILED' as any, // Uppercase
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123')).resolves.not.toThrow();
      });
    });

    describe('Idempotency Key Computation', () => {
      it('generates natural idempotency key from inputs', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Compute Task',
          tool: 'compute',
          inputs: { a: 1, b: 2 },
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        const deleteCalls = mockStore.inboxDelete.mock.calls;
        expect(deleteCalls).toHaveLength(2);
        expect(deleteCalls[1][0]).toMatch(/^run-456:Compute Task:/);
      });

      it('handles empty inputs for idempotency key', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'No Input Task',
          tool: 'test',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockStore.inboxDelete).toHaveBeenCalledWith(
          expect.stringMatching(/^run-456:No Input Task:/)
        );
      });

      it('handles null inputs for idempotency key', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Null Input Task',
          tool: 'test',
          inputs: null as any,
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockStore.inboxDelete).toHaveBeenCalled();
      });
    });

    describe('Event Recording', () => {
      it('records step.retry event with previous status', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockRecordEvent).toHaveBeenCalledWith(
          'run-456',
          'step.retry',
          { stepId: 'step-123', previousStatus: 'failed' },
          'step-123'
        );
      });

      it('records run.resumed event', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockRecordEvent).toHaveBeenCalledWith(
          'run-456',
          'run.resumed',
          { stepId: 'step-123' }
        );
      });
    });

    describe('Queue Integration', () => {
      it('enqueues step with attempt counter', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockEnqueue).toHaveBeenCalledWith(
          'step.ready',
          { runId: 'run-456', stepId: 'step-123', __attempt: 1 }
        );
      });

      it('uses correct topic for queueing', async () => {
        const { STEP_READY_TOPIC } = require('../queue');
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await retryStep('run-456', 'step-123');

        expect(mockEnqueue).toHaveBeenCalledWith(
          STEP_READY_TOPIC,
          expect.any(Object)
        );
      });
    });

    describe('Transaction Rollback', () => {
      it('rolls back on error during retry', async () => {
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);
        mockStore.resetStep.mockRejectedValue(new Error('Database error'));

        await expect(retryStep('run-456', 'step-123')).rejects.toThrow('Database error');
      });
    });

    describe('Edge Cases', () => {
      it('handles step with undefined status', async () => {
        const step: Partial<StepRow> = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Test',
          tool: 'tool',
          inputs: {},
          // status undefined
          created_at: '2024-01-15T12:00:00.000Z'
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123'))
          .rejects.toThrow(StepNotRetryableError);
      });

      it('handles very long step names in idempotency key', async () => {
        const longName = 'a'.repeat(1000);
        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: longName,
          tool: 'tool',
          inputs: {},
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123')).resolves.not.toThrow();
      });

      it('handles complex nested inputs in idempotency key', async () => {
        const complexInputs = {
          nested: {
            deep: {
              array: [1, 2, 3],
              object: { key: 'value' }
            }
          }
        };

        const step: StepRow = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'Complex Step',
          tool: 'tool',
          inputs: complexInputs,
          status: 'failed',
          created_at: '2024-01-15T12:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        };

        mockStore.getStep.mockResolvedValue(step);

        await expect(retryStep('run-456', 'step-123')).resolves.not.toThrow();
      });
    });
  });

  describe('Error Classes', () => {
    describe('StepNotFoundError', () => {
      it('has correct error message', () => {
        const error = new StepNotFoundError();
        expect(error.message).toBe('step_not_found');
      });

      it('is instance of Error', () => {
        const error = new StepNotFoundError();
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('StepNotRetryableError', () => {
      it('includes status in error message', () => {
        const error = new StepNotRetryableError('completed');
        expect(error.message).toBe('step_not_retryable:completed');
      });

      it('is instance of Error', () => {
        const error = new StepNotRetryableError('running');
        expect(error).toBeInstanceOf(Error);
      });

      it('handles different status values', () => {
        const statuses = ['queued', 'running', 'completed', 'skipped'];
        statuses.forEach(status => {
          const error = new StepNotRetryableError(status);
          expect(error.message).toBe(`step_not_retryable:${status}`);
        });
      });
    });
  });
});
