/**
 * Worker Integration Unit Tests
 * Tests for complex worker scenarios, error handling, and edge cases
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

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
    inboxDelete: jest.fn(),
    outboxAdd: jest.fn(),
    outboxListUnsent: jest.fn(),
    outboxMarkSent: jest.fn()
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
  subscribe: jest.fn(),
  STEP_READY_TOPIC: 'step.ready',
  OUTBOX_TOPIC: 'outbox'
}));

jest.mock('../../src/lib/metrics', () => ({
  metrics: {
    stepDuration: { observe: jest.fn() },
    stepsTotal: { inc: jest.fn() }
  }
}));

jest.mock('../../src/lib/tx', () => ({
  runAtomically: jest.fn((fn) => fn())
}));

jest.mock('../../src/lib/observability', () => ({
  runWithContext: jest.fn((context, fn) => fn())
}));

describe('Worker Integration Tests', () => {
  const mockStore = require('../../src/lib/store').store;
  const { recordEvent } = require('../../src/lib/events');
  const { log } = require('../../src/lib/logger');
  const { enqueue } = require('../../src/lib/queue');
  const { metrics } = require('../../src/lib/metrics');
  let tmp: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nofx-worker-integration-'));
    process.chdir(tmp);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.STEP_TIMEOUT_MS = '30000';
  });

  describe('End-to-End Worker Flow', () => {
    test('complete successful workflow execution', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test-workflow',
        tool: 'test:echo',
        inputs: { message: 'workflow test' }
      };

      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      mockStore.countRemainingSteps.mockResolvedValue(0);

      // Mock handler loading to return a test handler
      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: (tool: string) => tool === 'test:echo',
          run: async ({ step }: any) => {
            await mockStore.updateStep(step.id, {
              outputs: { echo: step.inputs }
            });
          }
        }]
      }));

      await runStep('run-456', 'step-123');

      // Verify the complete flow
      expect(mockStore.getStep).toHaveBeenCalledWith('step-123');
      expect(mockStore.inboxMarkIfNew).toHaveBeenCalledWith('step-exec:step-123');
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
      expect(mockStore.updateRun).toHaveBeenCalledWith('run-456', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.succeeded', {
        tool: 'test:echo',
        name: 'test-workflow'
      }, 'step-123');
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'run.succeeded', {});
    });

    test('handles multi-step workflow with dependencies', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const step1 = {
        id: 'step-1',
        run_id: 'run-456',
        name: 'first-step',
        tool: 'test:echo',
        inputs: { message: 'first' }
      };

      const step2 = {
        id: 'step-2',
        run_id: 'run-456',
        name: 'second-step',
        tool: 'test:echo',
        inputs: { _dependsOn: ['first-step'], message: 'second' }
      };

      // Mock handlers
      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async () => {}
        }]
      }));

      // Test first step executes normally
      mockStore.getStep.mockResolvedValue(step1);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      mockStore.countRemainingSteps.mockResolvedValue(1);

      await runStep('run-456', 'step-1');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-1', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });

      // Test second step waits for dependency
      mockStore.getStep.mockResolvedValue(step2);
      mockStore.listStepsByRun.mockResolvedValue([
        { name: 'first-step', status: 'ready' } // Not succeeded yet
      ]);

      await runStep('run-456', 'step-2');

      expect(enqueue).toHaveBeenCalledWith('step.ready', {
        runId: 'run-456',
        stepId: 'step-2',
        __attempt: 1
      }, { delay: 2000 });
      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.waiting', {
        stepId: 'step-2',
        reason: 'deps_not_ready',
        deps: ['first-step']
      }, 'step-2');

      // Test second step executes after dependency is ready
      mockStore.listStepsByRun.mockResolvedValue([
        { name: 'first-step', status: 'succeeded' }
      ]);
      mockStore.countRemainingSteps.mockResolvedValue(0);

      await runStep('run-456', 'step-2');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-2', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('handles database connection failures gracefully', async () => {
      const { runStep } = await import('../../src/worker/runner');

      mockStore.getStep.mockRejectedValue(new Error('Database connection lost'));

      await expect(runStep('run-456', 'step-123')).rejects.toThrow('Database connection lost');
    });

    test('handles partial failures in atomic operations', async () => {
      const { runStep } = await import('../../src/worker/runner');
      const { runAtomically } = require('../../src/lib/tx');

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'atomic-test',
        tool: 'test:echo',
        inputs: {}
      };

      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      mockStore.updateStep.mockResolvedValue(undefined);
      mockStore.countRemainingSteps.mockRejectedValue(new Error('Count failed'));

      // Mock atomic operation to fail on countRemainingSteps
      runAtomically.mockImplementation(async (fn: Function) => {
        await fn();
      });

      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async () => {}
        }]
      }));

      await expect(runStep('run-456', 'step-123')).rejects.toThrow('Count failed');
    });

    test('handles handler loading failures', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'load-fail-test',
        tool: 'nonexistent:tool',
        inputs: {}
      };

      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);

      // Mock handler loading to fail initially, then return empty
      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => {
          throw new Error('Handler loading failed');
        }
      }));

      await expect(runStep('run-456', 'step-123')).rejects.toThrow('no handler for nonexistent:tool');

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.failed', {
        error: 'no handler for tool',
        tool: 'nonexistent:tool'
      }, 'step-123');
    });

    test('handles concurrent step execution attempts', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'concurrent-test',
        tool: 'test:echo',
        inputs: {}
      };

      mockStore.getStep.mockResolvedValue(mockStep);

      // First call succeeds, second call fails due to idempotency
      let callCount = 0;
      mockStore.inboxMarkIfNew.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1);
      });

      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async () => {}
        }]
      }));

      // Execute two concurrent calls
      const [result1, result2] = await Promise.all([
        runStep('run-456', 'step-123'),
        runStep('run-456', 'step-123')
      ]);

      // First should succeed, second should be ignored
      expect(log.warn).toHaveBeenCalledWith(
        { runId: 'run-456', stepId: 'step-123' },
        'inbox.duplicate'
      );
    });
  });

  describe('Memory and Performance', () => {
    test('handles large payload processing', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const largeInputs = {
        data: Array(10000).fill(null).map((_, i) => ({
          id: i,
          content: `Large content item ${i}`,
          metadata: { timestamp: Date.now(), index: i }
        }))
      };

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'large-payload-test',
        tool: 'test:echo',
        inputs: largeInputs
      };

      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      mockStore.countRemainingSteps.mockResolvedValue(0);

      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async ({ step }: any) => {
            // Simulate processing large payload
            expect(step.inputs.data).toHaveLength(10000);
          }
        }]
      }));

      await runStep('run-456', 'step-123');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });

    test('handles rapid sequential job processing', async () => {
      const MemoryQueueAdapter = (await import('../../src/lib/queue/MemoryAdapter')).MemoryQueueAdapter;
      const adapter = new MemoryQueueAdapter();

      const processedJobs: any[] = [];
      const handler = jest.fn().mockImplementation(async (payload) => {
        processedJobs.push(payload);
      });

      adapter.subscribe('rapid.topic', handler);

      // Enqueue 100 jobs rapidly
      const jobs = Array(100).fill(null).map((_, i) => ({ jobId: i, data: `job-${i}` }));
      await Promise.all(jobs.map(job => adapter.enqueue('rapid.topic', job)));

      // Wait for all jobs to process
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(processedJobs).toHaveLength(100);
      expect(handler).toHaveBeenCalledTimes(100);
    });
  });

  describe('Timeout and Cancellation', () => {
    test('handles timeout during step execution', async () => {
      const { markStepTimedOut } = await import('../../src/worker/runner');

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'timeout-test',
        tool: 'bash',
        inputs: { command: 'sleep 60' },
        status: 'running',
        outputs: { partial: 'data' }
      };

      const mockRun = {
        id: 'run-456',
        status: 'running'
      };

      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.getRun.mockResolvedValue(mockRun);

      await markStepTimedOut('run-456', 'step-123', 30000);

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'timed_out',
        ended_at: expect.any(String),
        outputs: {
          partial: 'data',
          error: 'timeout',
          timeoutMs: 30000
        }
      });

      expect(mockStore.updateRun).toHaveBeenCalledWith('run-456', {
        status: 'failed',
        ended_at: expect.any(String)
      });

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.timeout', {
        stepId: 'step-123',
        timeoutMs: 30000
      }, 'step-123');
    });

    test('does not timeout completed steps', async () => {
      const { markStepTimedOut } = await import('../../src/worker/runner');

      const mockStep = {
        id: 'step-123',
        status: 'succeeded'
      };

      mockStore.getStep.mockResolvedValue(mockStep);

      await markStepTimedOut('run-456', 'step-123', 30000);

      // Should not update anything
      expect(mockStore.updateStep).not.toHaveBeenCalled();
      expect(mockStore.updateRun).not.toHaveBeenCalled();
    });
  });

  describe('Metrics and Observability', () => {
    test('records comprehensive metrics for successful steps', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'metrics-test',
        tool: 'test:echo',
        inputs: {}
      };

      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      mockStore.countRemainingSteps.mockResolvedValue(0);

      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async () => {
            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }]
      }));

      await runStep('run-456', 'step-123');

      expect(metrics.stepDuration.observe).toHaveBeenCalledWith(
        { tool: 'test:echo', status: 'succeeded' },
        expect.any(Number)
      );
      expect(metrics.stepsTotal.inc).toHaveBeenCalledWith({ status: 'succeeded' });
    });

    test('records metrics for failed steps', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'metrics-fail-test',
        tool: 'test:fail',
        inputs: {}
      };

      mockStore.getStep.mockResolvedValue(mockStep);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);

      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async () => {
            throw new Error('Handler failed');
          }
        }]
      }));

      await expect(runStep('run-456', 'step-123')).rejects.toThrow('Handler failed');

      expect(metrics.stepDuration.observe).toHaveBeenCalledWith(
        { tool: 'test:fail', status: 'failed' },
        expect.any(Number)
      );
      expect(metrics.stepsTotal.inc).toHaveBeenCalledWith({ status: 'failed' });
    });
  });

  describe('Policy Enforcement Edge Cases', () => {
    test('handles malformed policy configuration', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const stepWithBadPolicy = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'policy-test',
        tool: 'bash',
        inputs: { _policy: 'invalid-policy-format' }
      };

      mockStore.getStep.mockResolvedValue(stepWithBadPolicy);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      mockStore.countRemainingSteps.mockResolvedValue(0);

      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async () => {}
        }]
      }));

      // Should continue execution despite malformed policy
      await runStep('run-456', 'step-123');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });

    test('handles empty tools_allowed array', async () => {
      const { runStep } = await import('../../src/worker/runner');

      const stepWithEmptyPolicy = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'empty-policy-test',
        tool: 'bash',
        inputs: { _policy: { tools_allowed: [] } }
      };

      mockStore.getStep.mockResolvedValue(stepWithEmptyPolicy);
      mockStore.inboxMarkIfNew.mockResolvedValue(true);

      jest.doMock('../../src/worker/handlers/loader', () => ({
        loadHandlers: () => [{
          match: () => true,
          run: async () => {}
        }]
      }));

      // Should continue execution since empty array means no restriction
      await runStep('run-456', 'step-123');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });
  });
});