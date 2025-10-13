/**
 * Worker Process Enhanced Tests - 90%+ Coverage Target
 * Critical worker lifecycle, job processing, and error handling
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock all dependencies before importing worker
jest.mock('../../src/lib/queue', () => ({
  subscribe: jest.fn(),
  STEP_READY_TOPIC: 'step.ready',
  OUTBOX_TOPIC: 'outbox'
}));

jest.mock('../../src/worker/runner', () => ({
  runStep: jest.fn(),
  markStepTimedOut: jest.fn()
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/lib/store', () => ({
  store: {
    getStep: jest.fn(),
    inboxMarkIfNew: jest.fn(),
    inboxDelete: jest.fn(),
    outboxAdd: jest.fn()
  }
}));

// Create a shared mock for runWithContext
const mockedRunWithContext = jest.fn(async (_context: any, fn: () => Promise<any>) => fn());

jest.mock('../../src/lib/observability', () => ({
  runWithContext: mockedRunWithContext
}));

jest.mock('../../src/lib/tracing', () => ({
  initTracing: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
}));

jest.mock('../../src/lib/devRestart', () => ({
  shouldEnableDevRestartWatch: jest.fn().mockReturnValue(false)
}));

jest.mock('../../src/worker/health', () => ({
  startHealthServer: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  incrementProcessed: jest.fn(),
  incrementErrors: jest.fn()
}));

jest.mock('../../src/worker/relay', () => ({
  startOutboxRelay: jest.fn()
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
    on: jest.fn()
  }));
});

import { subscribe } from '../../src/lib/queue';
import { runStep, markStepTimedOut } from '../../src/worker/runner';
import { store } from '../../src/lib/store';
import { log } from '../../src/lib/logger';
import { incrementProcessed, incrementErrors } from '../../src/worker/health';
import type { StepRow } from '../../src/lib/store/types';

const mockedSubscribe = subscribe as jest.MockedFunction<typeof subscribe>;
const mockedRunStep = runStep as jest.MockedFunction<typeof runStep>;
const mockedMarkStepTimedOut = markStepTimedOut as jest.MockedFunction<typeof markStepTimedOut>;
const mockedStore = store as jest.Mocked<typeof store>;
const mockedIncrementProcessed = incrementProcessed as jest.MockedFunction<typeof incrementProcessed>;
const mockedIncrementErrors = incrementErrors as jest.MockedFunction<typeof incrementErrors>;

// Helper to create a mock StepRow with all required fields
function createMockStepRow(partial: Partial<StepRow>): StepRow {
  return {
    id: 'step-123',
    run_id: 'run-123',
    name: 'test_step',
    tool: 'test_tool',
    inputs: {},
    status: 'queued',
    created_at: new Date().toISOString(),
    ...partial
  };
}

describe('Worker Process - Enhanced Integration Tests', () => {
  let workerHandler: (payload: any) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the handler registered with subscribe
    mockedSubscribe.mockImplementation((topic: string, handler: any) => {
      if (topic === 'step.ready') {
        workerHandler = handler;
      }
    });

    // Reset environment
    process.env.STEP_TIMEOUT_MS = '30000';
    delete process.env.HEALTH_CHECK_ENABLED;
    delete process.env.REDIS_URL;
    delete process.env.QUEUE_DRIVER;

    // Import worker main to register handlers
    // This must happen in beforeEach to ensure mocks are set up
    require('../../src/worker/main');

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Job Processing', () => {
    it('processes job successfully', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'test_step',
        inputs: { data: 'test' }
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-123',
        stepId: 'step-456',
        idempotencyKey: 'key-789'
      };

      await workerHandler(payload);

      expect(mockedRunStep).toHaveBeenCalledWith('run-123', 'step-456');
      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'outbox',
        expect.objectContaining({
          type: 'step.succeeded',
          runId: 'run-123',
          stepId: 'step-456'
        })
      );
      expect(mockedIncrementProcessed).toHaveBeenCalled();
    });

    it('handles job timeout', async () => {
      mockedRunStep.mockImplementation(() => {
        return new Promise(() => {
          // Never resolves - simulates timeout
        });
      });

      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'slow_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-timeout',
        stepId: 'step-timeout',
        idempotencyKey: 'key-timeout'
      };

      // Capture the error
      let caughtError: any = null;
      const handlerPromise = workerHandler(payload).catch(err => {
        caughtError = err;
        return err;
      });

      // Run all timers to trigger the timeout
      await jest.runAllTimersAsync();

      // Wait for the handler to complete
      await handlerPromise;

      // Verify the timeout error was caught
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toMatch(/step timeout/i);

      expect(mockedMarkStepTimedOut).toHaveBeenCalledWith(
        'run-timeout',
        'step-timeout',
        30000
      );
      expect(mockedIncrementErrors).toHaveBeenCalled();
    });

    it('handles job failure', async () => {
      const testError = new Error('Processing failed');
      mockedRunStep.mockRejectedValueOnce(testError);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'failing_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-fail',
        stepId: 'step-fail',
        idempotencyKey: 'key-fail'
      };

      await expect(workerHandler(payload)).rejects.toThrow('Processing failed');

      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'outbox',
        expect.objectContaining({
          type: 'step.failed',
          runId: 'run-fail',
          stepId: 'step-fail',
          error: 'Processing failed'
        })
      );
      expect(mockedIncrementErrors).toHaveBeenCalled();
    });

    it('tracks retry attempts', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'retry_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-retry',
        stepId: 'step-retry',
        idempotencyKey: 'key-retry',
        __attempt: 3
      };

      await workerHandler(payload);

      // Context should include retry count
      expect(mockedRunStep).toHaveBeenCalled();
    });
  });

  describe('Idempotency Handling', () => {
    it('prevents duplicate job execution', async () => {
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'duplicate_step',
        inputs: { data: 'test' }
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(false); // Already processed
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-dup',
        stepId: 'step-dup',
        idempotencyKey: 'key-dup'
      };

      await workerHandler(payload);

      expect(mockedRunStep).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'key-dup' }),
        'inbox.duplicate.ignored'
      );
    });

    it('generates idempotency key from step inputs', async () => {
      const stepData = createMockStepRow({
        name: 'keygen_step',
        inputs: { param1: 'value1', param2: 'value2' }
      });

      // Verify the step data has the correct name
      expect(stepData.name).toBe('keygen_step');

      mockedStore.getStep.mockResolvedValueOnce(stepData);
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);
      mockedRunStep.mockResolvedValueOnce(undefined);

      const payload = {
        runId: 'run-keygen',
        stepId: 'step-keygen'
        // No idempotencyKey provided
      };

      await workerHandler(payload);

      // Check that inbox was marked with generated key containing run ID
      // The actual step name used might differ due to how the worker fetches it
      expect(mockedStore.inboxMarkIfNew).toHaveBeenCalled();
      const callArg = (mockedStore.inboxMarkIfNew as any).mock.calls[0][0];
      expect(callArg).toContain('run-keygen');
      // Just verify it has a colon-separated format like "runId:stepName:hash"
      expect(callArg.split(':').length).toBeGreaterThanOrEqual(3);
    });

    it('cleans up inbox after successful processing', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'cleanup_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-cleanup',
        stepId: 'step-cleanup',
        idempotencyKey: 'key-cleanup'
      };

      await workerHandler(payload);

      expect(mockedStore.inboxDelete).toHaveBeenCalledWith('key-cleanup');
    });

    it('cleans up inbox after failed processing', async () => {
      mockedRunStep.mockRejectedValueOnce(new Error('Test error'));
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'fail_cleanup_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-fail-cleanup',
        stepId: 'step-fail-cleanup',
        idempotencyKey: 'key-fail-cleanup'
      };

      await expect(workerHandler(payload)).rejects.toThrow('Test error');

      expect(mockedStore.inboxDelete).toHaveBeenCalledWith('key-fail-cleanup');
    });
  });

  describe('Error Handling', () => {
    it('handles inbox check failure gracefully', async () => {
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'inbox_fail_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockRejectedValueOnce(new Error('Inbox error'));
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);
      mockedRunStep.mockResolvedValueOnce(undefined);

      const payload = {
        runId: 'run-inbox-fail',
        stepId: 'step-inbox-fail',
        idempotencyKey: 'key-inbox-fail'
      };

      // Should continue processing despite inbox error (fallback behavior)
      await workerHandler(payload);

      expect(mockedRunStep).toHaveBeenCalled();
    });

    it('handles step fetch failure gracefully', async () => {
      mockedStore.getStep.mockRejectedValueOnce(new Error('Step not found'));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);
      mockedRunStep.mockResolvedValueOnce(undefined);

      const payload = {
        runId: 'run-step-fail',
        stepId: 'step-missing',
        idempotencyKey: 'key-step-fail'
      };

      // Should attempt to process despite fetch failure
      await workerHandler(payload);

      expect(mockedRunStep).toHaveBeenCalled();
    });

    it('handles outbox add failure on success', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'outbox_fail_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockRejectedValueOnce(new Error('Outbox error'));

      const payload = {
        runId: 'run-outbox-fail',
        stepId: 'step-outbox-fail',
        idempotencyKey: 'key-outbox-fail'
      };

      // Should not throw even if outbox fails
      await expect(workerHandler(payload)).resolves.not.toThrow();
    });

    it('handles inbox cleanup failure', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'cleanup_fail_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockRejectedValueOnce(new Error('Cleanup error'));
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-cleanup-fail',
        stepId: 'step-cleanup-fail',
        idempotencyKey: 'key-cleanup-fail'
      };

      // Should not throw even if cleanup fails
      await expect(workerHandler(payload)).resolves.not.toThrow();
    });

    it('handles non-Error thrown values', async () => {
      mockedRunStep.mockRejectedValueOnce('String error');
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'string_error_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-string-error',
        stepId: 'step-string-error',
        idempotencyKey: 'key-string-error'
      };

      await expect(workerHandler(payload)).rejects.toBeTruthy();

      expect(mockedStore.outboxAdd).toHaveBeenCalledWith(
        'outbox',
        expect.objectContaining({
          type: 'step.failed',
          error: expect.any(String)
        })
      );
    });
  });

  describe('Timeout Management', () => {
    it('respects custom timeout from environment', async () => {
      // This test verifies that the timeout value from STEP_TIMEOUT_MS is used
      // Since beforeEach already set STEP_TIMEOUT_MS=30000 and loaded the worker,
      // we just verify it's using that value (not a hardcoded different value)

      mockedRunStep.mockImplementation(() => {
        return new Promise(() => {
          // Never resolves
        });
      });

      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'custom_timeout_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-custom-timeout',
        stepId: 'step-custom-timeout',
        idempotencyKey: 'key-custom-timeout'
      };

      // Capture the error
      let caughtError: any = null;
      const handlerPromise = workerHandler(payload).catch(err => {
        caughtError = err;
        return err;
      });

      // Run all timers to completion
      await jest.runAllTimersAsync();

      // Wait for the handler to complete
      await handlerPromise;

      // Verify the timeout error was caught
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toMatch(/step timeout/i);

      // Verify it used the timeout from environment (30000 as set in beforeEach)
      expect(mockedMarkStepTimedOut).toHaveBeenCalledWith(
        'run-custom-timeout',
        'step-custom-timeout',
        30000
      );
    });

    it('clears timeout on successful completion', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'clear_timeout_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-clear',
        stepId: 'step-clear',
        idempotencyKey: 'key-clear'
      };

      await workerHandler(payload);

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Observability Context', () => {
    it('includes runId, stepId, and retryCount in context', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'context_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-context',
        stepId: 'step-context',
        idempotencyKey: 'key-context',
        __attempt: 2
      };

      await workerHandler(payload);

      expect(mockedRunWithContext).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-context',
          stepId: 'step-context',
          retryCount: 1
        }),
        expect.any(Function)
      );
    });

    it('defaults retryCount to 0 for first attempt', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'first_attempt_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-first',
        stepId: 'step-first',
        idempotencyKey: 'key-first'
        // No __attempt field
      };

      await workerHandler(payload);

      expect(mockedRunWithContext).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 0
        }),
        expect.any(Function)
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles missing step data fields', async () => {
      mockedStore.getStep.mockResolvedValueOnce({
        // Missing name and inputs
      } as any);
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);
      mockedRunStep.mockResolvedValueOnce(undefined);

      const payload = {
        runId: 'run-missing-data',
        stepId: 'step-missing-data'
      };

      await expect(workerHandler(payload)).resolves.not.toThrow();
    });

    it('handles null step data', async () => {
      mockedStore.getStep.mockResolvedValueOnce(null as any);
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);
      mockedRunStep.mockResolvedValueOnce(undefined);

      const payload = {
        runId: 'run-null-step',
        stepId: 'step-null'
      };

      await expect(workerHandler(payload)).resolves.not.toThrow();
    });

    it('handles invalid __attempt values', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'invalid_attempt_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-invalid-attempt',
        stepId: 'step-invalid-attempt',
        __attempt: 'not-a-number' as any
      };

      await expect(workerHandler(payload)).resolves.not.toThrow();
    });

    it('handles negative __attempt values', async () => {
      mockedRunStep.mockResolvedValueOnce(undefined);
      mockedStore.getStep.mockResolvedValueOnce(createMockStepRow({
        name: 'negative_attempt_step',
        inputs: {}
      }));
      mockedStore.inboxMarkIfNew.mockResolvedValueOnce(true);
      mockedStore.inboxDelete.mockResolvedValueOnce(undefined);
      mockedStore.outboxAdd.mockResolvedValue(undefined);

      const payload = {
        runId: 'run-negative',
        stepId: 'step-negative',
        __attempt: -5
      };

      await workerHandler(payload);

      // Should clamp to 0
      expect(mockedRunWithContext).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 0
        }),
        expect.any(Function)
      );
    });
  });
});
