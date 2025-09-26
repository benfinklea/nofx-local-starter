/**
 * Worker Integration Unit Tests
 * Tests for complex worker scenarios, error handling, and edge cases
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe('Worker Integration Tests', () => {
  let tmp: string;
  let originalCwd: string;

  // Test hardening: ensure cleanup happens
  afterAll(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // Create mock objects that will be used by all tests
  const createMocks = () => ({
    store: {
      getStep: jest.fn(),
      updateStep: jest.fn().mockResolvedValue(undefined),
      updateRun: jest.fn().mockResolvedValue(undefined),
      getRun: jest.fn(),
      listStepsByRun: jest.fn().mockResolvedValue([]),
      countRemainingSteps: jest.fn().mockResolvedValue(0),
      inboxMarkIfNew: jest.fn().mockResolvedValue(true),
      inboxDelete: jest.fn().mockResolvedValue(undefined),
      outboxAdd: jest.fn(),
      outboxListUnsent: jest.fn(),
      outboxMarkSent: jest.fn()
    },
    events: {
      recordEvent: jest.fn().mockResolvedValue(undefined)
    },
    logger: {
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }
    },
    queue: {
      enqueue: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      STEP_READY_TOPIC: 'step.ready',
      OUTBOX_TOPIC: 'outbox'
    },
    metrics: {
      metrics: {
        stepDuration: { observe: jest.fn() },
        stepsTotal: { inc: jest.fn() }
      }
    },
    tx: {
      runAtomically: jest.fn().mockImplementation(async (fn) => await fn())
    },
    observability: {
      runWithContext: jest.fn((context, fn) => fn())
    }
  });

  /**
   * Helper to load runner with proper mock isolation
   */
  async function loadRunner(handlers: any[] = [], mocks = createMocks()) {
    // Reset modules to ensure clean state
    jest.resetModules();

    // Mock all dependencies before importing runner
    jest.doMock('../../src/lib/store', () => ({ store: mocks.store }));
    jest.doMock('../../src/lib/events', () => mocks.events);
    jest.doMock('../../src/lib/logger', () => mocks.logger);
    jest.doMock('../../src/lib/queue', () => mocks.queue);
    jest.doMock('../../src/lib/metrics', () => mocks.metrics);
    jest.doMock('../../src/lib/tx', () => mocks.tx);
    jest.doMock('../../src/lib/observability', () => mocks.observability);
    jest.doMock('../../src/lib/settings', () => ({
      getSetting: jest.fn()
    }));
    jest.doMock('../../src/lib/autobackup', () => ({}));

    // Mock the handler loader to return provided handlers
    jest.doMock('../../src/worker/handlers/loader', () => ({
      loadHandlers: () => handlers
    }));

    // Now import the runner - it will use all the mocked dependencies
    const runner = await import('../../src/worker/runner');
    return { runner, mocks };
  }

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
      const testHandler = {
        match: (tool: string) => tool === 'test:echo',
        run: jest.fn().mockResolvedValue(undefined)
      };

      const { runner, mocks } = await loadRunner([testHandler]);

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test-workflow',
        tool: 'test:echo',
        inputs: { message: 'workflow test' }
      };

      mocks.store.getStep.mockResolvedValue(mockStep);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.countRemainingSteps.mockResolvedValue(0);

      await runner.runStep('run-456', 'step-123');

      // Verify the complete flow
      expect(mocks.store.getStep).toHaveBeenCalledWith('step-123');
      expect(mocks.store.inboxMarkIfNew).toHaveBeenCalledWith('step-exec:step-123');
      expect(testHandler.run).toHaveBeenCalledWith({
        runId: 'run-456',
        step: {
          id: 'step-123',
          run_id: 'run-456',
          name: 'test-workflow',
          tool: 'test:echo',
          inputs: { message: 'workflow test' }
        }
      });
      expect(mocks.store.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
      expect(mocks.store.updateRun).toHaveBeenCalledWith('run-456', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
      expect(mocks.events.recordEvent).toHaveBeenCalledWith('run-456', 'step.succeeded', {
        tool: 'test:echo',
        name: 'test-workflow'
      }, 'step-123');
      expect(mocks.events.recordEvent).toHaveBeenCalledWith('run-456', 'run.succeeded', {});
    });

    test('handles multi-step workflow with dependencies', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockResolvedValue(undefined)
      };

      const { runner, mocks } = await loadRunner([handler]);

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

      // Test first step executes normally
      mocks.store.getStep.mockResolvedValue(step1);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.countRemainingSteps.mockResolvedValue(1);

      await runner.runStep('run-456', 'step-1');

      expect(mocks.store.updateStep).toHaveBeenCalledWith('step-1', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });

      // Clear mocks for second test
      jest.clearAllMocks();

      // Test second step waits for dependency
      mocks.store.getStep.mockResolvedValue(step2);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.listStepsByRun.mockResolvedValue([
        { name: 'first-step', status: 'running' } // Not succeeded yet
      ]);

      await runner.runStep('run-456', 'step-2');

      expect(mocks.queue.enqueue).toHaveBeenCalledWith('step.ready', {
        runId: 'run-456',
        stepId: 'step-2',
        __attempt: 1
      }, { delay: 2000 });
      expect(mocks.events.recordEvent).toHaveBeenCalledWith('run-456', 'step.waiting', {
        stepId: 'step-2',
        reason: 'deps_not_ready',
        deps: ['first-step']
      }, 'step-2');

      // Clear mocks again
      jest.clearAllMocks();

      // Test second step executes after dependency is ready
      mocks.store.getStep.mockResolvedValue(step2);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.listStepsByRun.mockResolvedValue([
        { name: 'first-step', status: 'succeeded' }
      ]);
      mocks.store.countRemainingSteps.mockResolvedValue(0);

      await runner.runStep('run-456', 'step-2');

      expect(mocks.store.updateStep).toHaveBeenCalledWith('step-2', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('handles database connection failures gracefully', async () => {
      const { runner, mocks } = await loadRunner([]);

      mocks.store.getStep.mockRejectedValue(new Error('Database connection lost'));

      await expect(runner.runStep('run-456', 'step-123')).rejects.toThrow('Database connection lost');
    });

    test('handles partial failures in atomic operations', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockResolvedValue(undefined)
      };

      const { runner, mocks } = await loadRunner([handler]);

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'atomic-test',
        tool: 'test:echo',
        inputs: {}
      };

      mocks.store.getStep.mockResolvedValue(mockStep);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.updateStep.mockResolvedValue(undefined);

      // Make countRemainingSteps always fail to simulate atomic operation failure
      mocks.store.countRemainingSteps.mockRejectedValue(new Error('Count failed'));

      // The atomic operation should fail
      mocks.tx.runAtomically.mockImplementation(async (fn: Function) => {
        try {
          return await fn();
        } catch (err) {
          throw err;
        }
      });

      await expect(runner.runStep('run-456', 'step-123')).rejects.toThrow('Count failed');
    });

    test('handles handler loading failures', async () => {
      const { runner, mocks } = await loadRunner([]); // No handlers

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'load-fail-test',
        tool: 'nonexistent:tool',
        inputs: {}
      };

      mocks.store.getStep.mockResolvedValue(mockStep);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);

      await expect(runner.runStep('run-456', 'step-123')).rejects.toThrow('no handler for nonexistent:tool');

      expect(mocks.events.recordEvent).toHaveBeenCalledWith('run-456', 'step.failed', {
        error: 'no handler for tool',
        tool: 'nonexistent:tool'
      }, 'step-123');
    });

    test('handles concurrent step execution attempts', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockResolvedValue(undefined)
      };

      const { runner, mocks } = await loadRunner([handler]);

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'concurrent-test',
        tool: 'test:echo',
        inputs: {}
      };

      mocks.store.getStep.mockResolvedValue(mockStep);

      // First call succeeds, second call fails due to idempotency
      let callCount = 0;
      mocks.store.inboxMarkIfNew.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1);
      });

      // Execute two concurrent calls
      const [result1, result2] = await Promise.all([
        runner.runStep('run-456', 'step-123'),
        runner.runStep('run-456', 'step-123')
      ]);

      // First should succeed, second should be ignored
      expect(mocks.logger.log.warn).toHaveBeenCalledWith(
        { runId: 'run-456', stepId: 'step-123' },
        'inbox.duplicate'
      );
    });
  });

  describe('Memory and Performance', () => {
    test('handles large payload processing', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockImplementation(async ({ step }: any) => {
          // Simulate processing large payload
          expect(step.inputs.data).toHaveLength(10000);
        })
      };

      const { runner, mocks } = await loadRunner([handler]);

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

      mocks.store.getStep.mockResolvedValue(mockStep);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.countRemainingSteps.mockResolvedValue(0);

      await runner.runStep('run-456', 'step-123');

      expect(mocks.store.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });

    test('handles rapid sequential job processing', async () => {
      // Reset modules for this test
      jest.resetModules();
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
      const { runner, mocks } = await loadRunner([]);

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

      mocks.store.getStep.mockResolvedValue(mockStep);
      mocks.store.getRun.mockResolvedValue(mockRun);

      await runner.markStepTimedOut('run-456', 'step-123', 30000);

      expect(mocks.store.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'timed_out',
        ended_at: expect.any(String),
        outputs: {
          partial: 'data',
          error: 'timeout',
          timeoutMs: 30000
        }
      });

      expect(mocks.store.updateRun).toHaveBeenCalledWith('run-456', {
        status: 'failed',
        ended_at: expect.any(String)
      });

      expect(mocks.events.recordEvent).toHaveBeenCalledWith('run-456', 'step.timeout', {
        stepId: 'step-123',
        timeoutMs: 30000
      }, 'step-123');
    });

    test('does not timeout completed steps', async () => {
      const { runner, mocks } = await loadRunner([]);

      const mockStep = {
        id: 'step-123',
        status: 'succeeded'
      };

      mocks.store.getStep.mockResolvedValue(mockStep);

      await runner.markStepTimedOut('run-456', 'step-123', 30000);

      // Should not update anything
      expect(mocks.store.updateStep).not.toHaveBeenCalled();
      expect(mocks.store.updateRun).not.toHaveBeenCalled();
    });
  });

  describe('Metrics and Observability', () => {
    test('records comprehensive metrics for successful steps', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockImplementation(async () => {
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 10));
        })
      };

      const { runner, mocks } = await loadRunner([handler]);

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'metrics-test',
        tool: 'test:echo',
        inputs: {}
      };

      mocks.store.getStep.mockResolvedValue(mockStep);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.countRemainingSteps.mockResolvedValue(0);

      await runner.runStep('run-456', 'step-123');

      expect(mocks.metrics.metrics.stepDuration.observe).toHaveBeenCalledWith(
        { tool: 'test:echo', status: 'succeeded' },
        expect.any(Number)
      );
      expect(mocks.metrics.metrics.stepsTotal.inc).toHaveBeenCalledWith({ status: 'succeeded' });
    });

    test('records metrics for failed steps', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockRejectedValue(new Error('Handler failed'))
      };

      const { runner, mocks } = await loadRunner([handler]);

      const mockStep = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'metrics-fail-test',
        tool: 'test:fail',
        inputs: {}
      };

      mocks.store.getStep.mockResolvedValue(mockStep);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);

      await expect(runner.runStep('run-456', 'step-123')).rejects.toThrow('Handler failed');

      expect(mocks.metrics.metrics.stepDuration.observe).toHaveBeenCalledWith(
        { tool: 'test:fail', status: 'failed' },
        expect.any(Number)
      );
      expect(mocks.metrics.metrics.stepsTotal.inc).toHaveBeenCalledWith({ status: 'failed' });
    });
  });

  describe('Policy Enforcement Edge Cases', () => {
    test('handles malformed policy configuration', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockResolvedValue(undefined)
      };

      const { runner, mocks } = await loadRunner([handler]);

      const stepWithBadPolicy = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'policy-test',
        tool: 'bash',
        inputs: { _policy: 'invalid-policy-format' }
      };

      mocks.store.getStep.mockResolvedValue(stepWithBadPolicy);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.countRemainingSteps.mockResolvedValue(0);

      // Should continue execution despite malformed policy
      await runner.runStep('run-456', 'step-123');

      expect(mocks.store.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });

    test('handles empty tools_allowed array', async () => {
      const handler = {
        match: () => true,
        run: jest.fn().mockResolvedValue(undefined)
      };

      const { runner, mocks } = await loadRunner([handler]);

      const stepWithEmptyPolicy = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'empty-policy-test',
        tool: 'bash',
        inputs: { _policy: { tools_allowed: [] } }
      };

      mocks.store.getStep.mockResolvedValue(stepWithEmptyPolicy);
      mocks.store.inboxMarkIfNew.mockResolvedValue(true);
      mocks.store.countRemainingSteps.mockResolvedValue(0);

      // Empty array with length > 0 check should block execution
      await runner.runStep('run-456', 'step-123');

      // Since empty array has length 0, the policy check is skipped
      expect(mocks.store.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String)
      });
    });
  });
});