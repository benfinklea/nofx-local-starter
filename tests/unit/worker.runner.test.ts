/**
 * Worker Runner Unit Tests
 * Tests the step execution engine that processes individual workflow steps
 */

import { runStep, markStepTimedOut } from '../../src/worker/runner';
import type { StepRow, RunRow } from '../../src/lib/store';

// Mock all dependencies
jest.mock('../../src/lib/store', () => ({
  store: {
    getStep: jest.fn(),
    updateStep: jest.fn(),
    updateRun: jest.fn(),
    getRun: jest.fn(),
    listStepsByRun: jest.fn(),
    countRemainingSteps: jest.fn(),
    inboxMarkIfNew: jest.fn(),
    inboxDelete: jest.fn()
  }
}));

jest.mock('../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  STEP_READY_TOPIC: 'step.ready'
}));

const mockLoadHandlers = jest.fn(() => []);
jest.mock('../../src/worker/handlers/loader', () => ({
  loadHandlers: mockLoadHandlers
}));

jest.mock('../../src/lib/metrics', () => ({
  metrics: {
    stepDuration: {
      observe: jest.fn()
    },
    stepsTotal: {
      inc: jest.fn()
    }
  }
}));

jest.mock('../../src/lib/tx', () => ({
  runAtomically: jest.fn((fn) => fn())
}));

describe('Worker Runner Tests', () => {
  const mockStore = require('../../src/lib/store').store;
  const { recordEvent } = require('../../src/lib/events');
  const { log } = require('../../src/lib/logger');
  const { enqueue } = require('../../src/lib/queue');
  const { metrics } = require('../../src/lib/metrics');

  beforeEach(() => {
    jest.clearAllMocks();
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  describe('runStep', () => {
    const mockStep: StepRow = {
      id: 'step-123',
      run_id: 'run-456',
      name: 'test-step',
      tool: 'test:echo',
      inputs: { message: 'hello' },
      status: 'ready',
      created_at: '2023-01-01T00:00:00Z',
      started_at: null,
      ended_at: null,
      outputs: null
    };

    const mockHandler = {
      match: jest.fn().mockReturnValue(true),
      run: jest.fn().mockResolvedValue(undefined)
    };

    beforeEach(() => {
      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      mockStore.countRemainingSteps.mockResolvedValue(0);
      mockLoadHandlers.mockReturnValue([mockHandler]);
    });

    test('successfully executes a step', async () => {
      await runStep('run-456', 'step-123');

      expect(mockStore.getStep).toHaveBeenCalledWith('step-123');
      expect(mockStore.inboxMarkIfNew).toHaveBeenCalledWith('step-exec:step-123');
      expect(mockHandler.run).toHaveBeenCalledWith({
        runId: 'run-456',
        step: {
          id: 'step-123',
          run_id: 'run-456',
          name: 'test-step',
          tool: 'test:echo',
          inputs: { message: 'hello' }
        }
      });
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.succeeded', {
        tool: 'test:echo',
        name: 'test-step'
      }, 'step-123');
    });

    test('handles step not found error', async () => {
      mockStore.getStep.mockResolvedValue(null);

      await expect(runStep('run-456', 'invalid-step')).rejects.toThrow('step not found');
    });

    test('handles inbox duplicate (idempotency)', async () => {
      mockStore.inboxMarkIfNew.mockResolvedValue(false);

      await runStep('run-456', 'step-123');

      expect(log.warn).toHaveBeenCalledWith(
        { runId: 'run-456', stepId: 'step-123' },
        'inbox.duplicate'
      );
      expect(mockHandler.run).not.toHaveBeenCalled();
    });

    test('handles dependency checking - dependencies not ready', async () => {
      const stepWithDeps = {
        ...mockStep,
        inputs: { _dependsOn: ['prev-step'], message: 'hello' }
      };
      mockStore.getStep.mockResolvedValue(stepWithDeps);
      mockStore.listStepsByRun.mockResolvedValue([
        { name: 'prev-step', status: 'ready' } // Not succeeded yet
      ]);

      await runStep('run-456', 'step-123');

      expect(enqueue).toHaveBeenCalledWith('step.ready', {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      }, { delay: 2000 });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.waiting', {
        stepId: 'step-123',
        reason: 'deps_not_ready',
        deps: ['prev-step']
      }, 'step-123');
      expect(mockHandler.run).not.toHaveBeenCalled();
    });

    test('handles dependency checking - dependencies ready', async () => {
      const stepWithDeps = {
        ...mockStep,
        inputs: { _dependsOn: ['prev-step'], message: 'hello' }
      };
      mockStore.getStep.mockResolvedValue(stepWithDeps);
      mockStore.listStepsByRun.mockResolvedValue([
        { name: 'prev-step', status: 'succeeded' }
      ]);

      await runStep('run-456', 'step-123');

      expect(mockHandler.run).toHaveBeenCalled();
    });

    test('enforces tool policy - tool not allowed', async () => {
      const stepWithPolicy = {
        ...mockStep,
        inputs: { _policy: { tools_allowed: ['bash'] }, message: 'hello' }
      };
      mockStore.getStep.mockResolvedValue(stepWithPolicy);

      await runStep('run-456', 'step-123');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          error: 'policy: tool not allowed',
          tool: 'test:echo',
          toolsAllowed: ['bash']
        }
      });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'policy.denied', {
        stepId: 'step-123',
        reason: 'tool_not_allowed',
        tool: 'test:echo',
        toolsAllowed: ['bash']
      }, 'step-123');
      expect(mockHandler.run).not.toHaveBeenCalled();
    });

    test('enforces tool policy - tool allowed', async () => {
      const stepWithPolicy = {
        ...mockStep,
        inputs: { _policy: { tools_allowed: ['test:echo'] }, message: 'hello' }
      };
      mockStore.getStep.mockResolvedValue(stepWithPolicy);

      await runStep('run-456', 'step-123');

      expect(mockHandler.run).toHaveBeenCalled();
    });

    test('handles no handler found', async () => {
      mockLoadHandlers.mockReturnValue([]);

      await expect(runStep('run-456', 'step-123')).rejects.toThrow('no handler for test:echo');

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.failed', {
        error: 'no handler for tool',
        tool: 'test:echo'
      }, 'step-123');
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String)
      });
    });

    test('handles handler execution error', async () => {
      const error = new Error('Handler failed');
      mockHandler.run.mockRejectedValue(error);

      await expect(runStep('run-456', 'step-123')).rejects.toThrow('Handler failed');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String)
      });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.failed', {
        error: 'Handler failed'
      }, 'step-123');
      expect(mockStore.updateRun).toHaveBeenCalledWith('run-456', {
        status: 'failed',
        ended_at: expect.any(String)
      });
    });

    test('completes run when no remaining steps', async () => {
      mockStore.countRemainingSteps.mockResolvedValue(0);

      await runStep('run-456', 'step-123');

      expect(mockStore.updateRun).toHaveBeenCalledWith('run-456', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'run.succeeded', {});
    });

    test('does not complete run when remaining steps exist', async () => {
      mockStore.countRemainingSteps.mockResolvedValue(2);

      await runStep('run-456', 'step-123');

      expect(mockStore.updateRun).not.toHaveBeenCalled();
    });

    test('records metrics for successful step', async () => {
      await runStep('run-456', 'step-123');

      expect(metrics.stepDuration.observe).toHaveBeenCalledWith(
        { tool: 'test:echo', status: 'succeeded' },
        expect.any(Number)
      );
      expect(metrics.stepsTotal.inc).toHaveBeenCalledWith({ status: 'succeeded' });
    });

    test('records metrics for failed step', async () => {
      mockHandler.run.mockRejectedValue(new Error('Handler failed'));

      await expect(runStep('run-456', 'step-123')).rejects.toThrow();

      expect(metrics.stepDuration.observe).toHaveBeenCalledWith(
        { tool: 'test:echo', status: 'failed' },
        expect.any(Number)
      );
      expect(metrics.stepsTotal.inc).toHaveBeenCalledWith({ status: 'failed' });
    });

    test('cleans up inbox key on success', async () => {
      await runStep('run-456', 'step-123');

      expect(mockStore.inboxDelete).toHaveBeenCalledWith('step-exec:step-123');
    });

    test('cleans up inbox key on error', async () => {
      mockHandler.run.mockRejectedValue(new Error('Handler failed'));

      await expect(runStep('run-456', 'step-123')).rejects.toThrow();

      expect(mockStore.inboxDelete).toHaveBeenCalledWith('step-exec:step-123');
    });

    test('does not update step status if already timed out', async () => {
      mockHandler.run.mockRejectedValue(new Error('Handler failed'));
      mockStore.getStep
        .mockResolvedValueOnce(mockStep) // Initial call
        .mockResolvedValueOnce({ ...mockStep, status: 'timed_out' }); // Call in error handler

      await expect(runStep('run-456', 'step-123')).rejects.toThrow();

      // Should not update step status since it's already timed out
      expect(mockStore.updateStep).not.toHaveBeenCalledWith('step-123', expect.objectContaining({ status: 'failed' }));
    });
  });

  describe('markStepTimedOut', () => {
    const mockStep: StepRow = {
      id: 'step-123',
      run_id: 'run-456',
      name: 'test-step',
      tool: 'test:echo',
      inputs: {},
      status: 'running',
      created_at: '2023-01-01T00:00:00Z',
      started_at: '2023-01-01T00:01:00Z',
      ended_at: null,
      outputs: { partial: 'data' }
    };

    const mockRun: RunRow = {
      id: 'run-456',
      project_id: 'proj-1',
      status: 'running',
      created_at: '2023-01-01T00:00:00Z',
      started_at: '2023-01-01T00:00:00Z',
      ended_at: null,
      metadata: {}
    };

    beforeEach(() => {
      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.getRun.mockResolvedValue(mockRun);
    });

    test('marks step as timed out', async () => {
      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', expect.objectContaining({
        status: 'timed_out',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'timeout',
          timeoutMs: 30000
        })
      }));
    });

    test('records timeout event', async () => {
      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.timeout', {
        stepId: 'step-123',
        timeoutMs: 30000
      }, 'step-123');
    });

    test('marks run as failed due to timeout', async () => {
      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateRun).toHaveBeenCalledWith('run-456', {
        status: 'failed',
        ended_at: expect.any(String)
      });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'run.failed', {
        reason: 'timeout',
        stepId: 'step-123',
        timeoutMs: 30000
      });
    });

    test('does not update succeeded step', async () => {
      mockStore.getStep.mockResolvedValue({ ...mockStep, status: 'succeeded' });

      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateStep).not.toHaveBeenCalled();
    });

    test('does not update cancelled step', async () => {
      mockStore.getStep.mockResolvedValue({ ...mockStep, status: 'cancelled' });

      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateStep).not.toHaveBeenCalled();
    });

    test('does not update run if already failed', async () => {
      mockStore.getRun.mockResolvedValue({ ...mockRun, status: 'failed' });

      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateRun).not.toHaveBeenCalledWith('run-456', expect.objectContaining({ status: 'failed' }));
    });

    test('handles null/undefined outputs', async () => {
      mockStore.getStep.mockResolvedValue({ ...mockStep, outputs: null });

      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'timed_out',
        ended_at: expect.any(String),
        outputs: {
          error: 'timeout',
          timeoutMs: 30000
        }
      });
    });

    test('handles array outputs', async () => {
      mockStore.getStep.mockResolvedValue({ ...mockStep, outputs: ['item1', 'item2'] });

      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'timed_out',
        ended_at: expect.any(String),
        outputs: {
          error: 'timeout',
          timeoutMs: 30000
        }
      });
    });
  });
});