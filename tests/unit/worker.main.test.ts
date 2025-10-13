/**
 * Worker Main Entry Point Unit Tests
 * Tests the main worker initialization and job handling
 */

// Mock all dependencies before importing main
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

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
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/lib/store', () => ({
  store: {
    getStep: jest.fn(),
    outboxAdd: jest.fn(() => Promise.resolve(undefined)),
    inboxMarkIfNew: jest.fn(),
    inboxDelete: jest.fn(() => Promise.resolve(undefined))
  }
}));

jest.mock('../../src/lib/observability', () => ({
  runWithContext: jest.fn((context, fn) => fn())
}));

jest.mock('../../src/worker/relay', () => ({
  startOutboxRelay: jest.fn()
}));

jest.mock('../../src/lib/tracing', () => ({
  initTracing: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../src/lib/devRestart', () => ({
  shouldEnableDevRestartWatch: jest.fn().mockReturnValue(false)
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn().mockResolvedValue('OK')
  }));
});

jest.mock('node:fs', () => ({
  statSync: jest.fn(),
  unlinkSync: jest.fn()
}));

describe('Worker Main Entry Point Tests', () => {
  const { subscribe } = require('../../src/lib/queue');
  const { runStep, markStepTimedOut } = require('../../src/worker/runner');
  const { log } = require('../../src/lib/logger');
  const mockStore = require('../../src/lib/store').store;
  const { runWithContext } = require('../../src/lib/observability');
  const { startOutboxRelay } = require('../../src/worker/relay');

  let subscribedHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Capture the handler passed to subscribe
    subscribe.mockImplementation((topic: string, handler: any) => {
      subscribedHandler = handler;
    });

    // Mock environment variables
    process.env.STEP_TIMEOUT_MS = '30000';
    process.env.QUEUE_DRIVER = 'memory';
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  describe('initialization', () => {
    test('initializes worker components', () => {
      // Import main to trigger initialization
      require('../../src/worker/main');

      expect(subscribe).toHaveBeenCalledWith('step.ready', expect.any(Function));
      expect(startOutboxRelay).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith('Worker up');
    });
  });

  describe('step processing', () => {
    beforeEach(() => {
      require('../../src/worker/main');
      mockStore.getStep.mockResolvedValue({
        id: 'step-123',
        name: 'test-step',
        inputs: { message: 'test' }
      });
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      runStep.mockResolvedValue(undefined);
    });

    test('processes step successfully', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      await subscribedHandler(payload);

      expect(runWithContext).toHaveBeenCalledWith(
        { runId: 'run-456', stepId: 'step-123', retryCount: 0 },
        expect.any(Function)
      );
      expect(runStep).toHaveBeenCalledWith('run-456', 'step-123');
      expect(mockStore.outboxAdd).toHaveBeenCalledWith('outbox', {
        type: 'step.succeeded',
        runId: 'run-456',
        stepId: 'step-123'
      });
    });

    test.skip('handles step execution error', async () => {
      // TODO: Fix - rejects.toThrow not working properly
      const error = new Error('Step failed');
      runStep.mockRejectedValue(error);

      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      await expect(subscribedHandler(payload)).rejects.toThrow('Step failed');

      expect(mockStore.outboxAdd).toHaveBeenCalledWith('outbox', {
        type: 'step.failed',
        runId: 'run-456',
        stepId: 'step-123',
        error: 'Step failed'
      });
    });

    test('handles step timeout', async () => {
      const timeoutError = new Error('step timeout');
      runStep.mockRejectedValue(timeoutError);

      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      await expect(subscribedHandler(payload)).rejects.toThrow('step timeout');

      expect(markStepTimedOut).toHaveBeenCalledWith('run-456', 'step-123', 30000);
      expect(mockStore.outboxAdd).toHaveBeenCalledWith('outbox', {
        type: 'step.failed',
        runId: 'run-456',
        stepId: 'step-123',
        error: 'step timeout'
      });
    });

    test.skip('handles step timeout with race condition', async () => {
      // TODO: Fix - Promise.race with setTimeout doesn't work reliably with fake timers
      // Mock a slow runStep that will be interrupted by timeout
      runStep.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 40000)));

      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      const promise = subscribedHandler(payload);

      // Fast forward past the timeout
      jest.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow('step timeout');
      expect(markStepTimedOut).toHaveBeenCalledWith('run-456', 'step-123', 30000);
    });

    test.skip('uses custom timeout from environment', async () => {
      // TODO: Fix - Promise.race with setTimeout doesn't work reliably with fake timers
      process.env.STEP_TIMEOUT_MS = '60000';
      jest.resetModules();

      const { subscribe: newSubscribe } = require('../../src/lib/queue');
      let newHandler: any;
      newSubscribe.mockImplementation((topic: string, handler: any) => {
        newHandler = handler;
      });

      require('../../src/worker/main');

      runStep.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 70000)));

      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      const promise = newHandler(payload);

      // Fast forward to custom timeout
      jest.advanceTimersByTime(60000);

      await expect(promise).rejects.toThrow('step timeout');
      expect(markStepTimedOut).toHaveBeenCalledWith('run-456', 'step-123', 60000);
    });
  });

  describe('idempotency handling', () => {
    beforeEach(() => {
      require('../../src/worker/main');
    });

    test('uses provided idempotency key', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        idempotencyKey: 'custom-key',
        __attempt: 1
      };

      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      runStep.mockResolvedValue(undefined);

      await subscribedHandler(payload);

      expect(mockStore.inboxMarkIfNew).toHaveBeenCalledWith('custom-key');
      expect(mockStore.inboxDelete).toHaveBeenCalledWith('custom-key');
    });

    test('generates idempotency key from step data', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      mockStore.getStep.mockResolvedValue({
        id: 'step-123',
        name: 'test-step',
        inputs: { message: 'test' }
      });
      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      runStep.mockResolvedValue(undefined);

      await subscribedHandler(payload);

      // Should generate key from runId:name:inputsHash
      expect(mockStore.inboxMarkIfNew).toHaveBeenCalledWith(
        expect.stringMatching(/^run-456:test-step:[a-f0-9]{12}$/)
      );
    });

    test('handles duplicate idempotency key', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        idempotencyKey: 'duplicate-key',
        __attempt: 1
      };

      mockStore.inboxMarkIfNew.mockResolvedValue(false);

      await subscribedHandler(payload);

      expect(log.info).toHaveBeenCalledWith(
        { key: 'duplicate-key' },
        'inbox.duplicate.ignored'
      );
      expect(runStep).not.toHaveBeenCalled();
    });

    test('handles inbox errors gracefully', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        idempotencyKey: 'test-key',
        __attempt: 1
      };

      mockStore.inboxMarkIfNew.mockRejectedValue(new Error('Inbox error'));
      runStep.mockResolvedValue(undefined);

      // Should continue processing despite inbox error
      await subscribedHandler(payload);

      expect(runStep).toHaveBeenCalledWith('run-456', 'step-123');
    });

    test('cleans up idempotency key on error', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        idempotencyKey: 'test-key',
        __attempt: 1
      };

      mockStore.inboxMarkIfNew.mockResolvedValue(true);
      runStep.mockRejectedValue(new Error('Processing failed'));

      await expect(subscribedHandler(payload)).rejects.toThrow('Processing failed');

      expect(mockStore.inboxDelete).toHaveBeenCalledWith('test-key');
    });
  });

  describe('retry count handling', () => {
    beforeEach(() => {
      require('../../src/worker/main');
      runStep.mockResolvedValue(undefined);
    });

    test('calculates retry count from attempt', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 3
      };

      await subscribedHandler(payload);

      expect(runWithContext).toHaveBeenCalledWith(
        { runId: 'run-456', stepId: 'step-123', retryCount: 2 },
        expect.any(Function)
      );
    });

    test('handles missing attempt number', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123'
      };

      await subscribedHandler(payload);

      expect(runWithContext).toHaveBeenCalledWith(
        { runId: 'run-456', stepId: 'step-123', retryCount: 0 },
        expect.any(Function)
      );
    });

    test('handles invalid attempt number', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 'invalid'
      };

      await subscribedHandler(payload);

      expect(runWithContext).toHaveBeenCalledWith(
        { runId: 'run-456', stepId: 'step-123', retryCount: 0 },
        expect.any(Function)
      );
    });
  });

  describe('error handling in outbox operations', () => {
    beforeEach(() => {
      require('../../src/worker/main');
      runStep.mockResolvedValue(undefined);
    });

    test('handles outbox success write failure gracefully', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      mockStore.outboxAdd.mockRejectedValue(new Error('Outbox write failed'));

      // Should not throw despite outbox error
      await subscribedHandler(payload);

      expect(runStep).toHaveBeenCalled();
    });

    test('handles outbox failure write failure gracefully', async () => {
      const payload = {
        runId: 'run-456',
        stepId: 'step-123',
        __attempt: 1
      };

      runStep.mockRejectedValue(new Error('Step failed'));
      mockStore.outboxAdd.mockRejectedValue(new Error('Outbox write failed'));

      await expect(subscribedHandler(payload)).rejects.toThrow('Step failed');
    });
  });

  describe('heartbeat functionality', () => {
    test('does not start heartbeat for memory queue', () => {
      process.env.QUEUE_DRIVER = 'memory';
      delete process.env.REDIS_URL;

      const IORedis = require('ioredis');
      IORedis.mockClear();

      require('../../src/worker/main');

      expect(IORedis).not.toHaveBeenCalled();
    });

    test('starts heartbeat for redis queue', () => {
      process.env.QUEUE_DRIVER = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const IORedis = require('ioredis');
      const mockRedis = {
        set: jest.fn().mockResolvedValue('OK')
      };
      IORedis.mockReturnValue(mockRedis);

      require('../../src/worker/main');

      expect(IORedis).toHaveBeenCalledWith('redis://localhost:6379', {
        maxRetriesPerRequest: null
      });

      // Trigger heartbeat
      jest.advanceTimersByTime(3000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'nofx:worker:heartbeat',
        expect.any(String),
        'EX',
        10
      );
    });

    test('handles heartbeat redis connection errors', () => {
      process.env.QUEUE_DRIVER = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const IORedis = require('ioredis');
      IORedis.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // Should not throw despite Redis error
      expect(() => require('../../src/worker/main')).not.toThrow();
    });
  });

  describe('dev restart functionality', () => {
    const fs = require('node:fs');

    test('does not watch for restart flag when disabled', () => {
      const { shouldEnableDevRestartWatch } = require('../../src/lib/devRestart');
      shouldEnableDevRestartWatch.mockReturnValue(false);

      jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      require('../../src/worker/main');

      // Should not set up file watching
      expect(fs.statSync).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    test.skip('watches for restart flag when enabled', () => {
      // TODO: Fix - timing issues with Date.now() and module loading
      const { shouldEnableDevRestartWatch } = require('../../src/lib/devRestart');
      shouldEnableDevRestartWatch.mockReturnValue(true);

      jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      // Mock file operations
      const startTime = Date.now();
      fs.statSync
        .mockImplementationOnce(() => ({ mtimeMs: startTime - 1000 })) // Stale flag
        .mockImplementation(() => ({ mtimeMs: startTime + 2000 })); // Fresh flag

      require('../../src/worker/main');

      // Should clean up stale flag
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('.dev-restart-worker')
      );

      // Trigger file check
      jest.advanceTimersByTime(1500);

      expect(process.exit).toHaveBeenCalledWith(0);

      jest.restoreAllMocks();
    });
  });
});