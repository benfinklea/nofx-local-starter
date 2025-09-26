/**
 * Worker Handlers Unit Tests
 * Tests individual handler implementations for different tools
 */

import type { StepHandler, Step } from '../../src/worker/handlers/types';

// Mock all dependencies
jest.mock('../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn()
  }
}));

jest.mock('../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('node:child_process', () => ({
  spawn: jest.fn()
}));

describe('Worker Handlers Tests', () => {
  const mockStore = require('../../src/lib/store').store;
  const { recordEvent } = require('../../src/lib/events');
  const { spawn } = require('node:child_process');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('test_echo handler', () => {
    let handler: StepHandler;

    beforeAll(async () => {
      handler = (await import('../../src/worker/handlers/test_echo')).default;
    });

    test('matches test:echo tool', () => {
      expect(handler.match('test:echo')).toBe(true);
      expect(handler.match('test:other')).toBe(false);
      expect(handler.match('bash')).toBe(false);
    });

    test('processes step successfully', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'echo-test',
        tool: 'test:echo',
        inputs: { message: 'hello', data: { key: 'value' } }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.started', {
        name: 'echo-test',
        tool: 'test:echo'
      }, 'step-123');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          echo: { message: 'hello', data: { key: 'value' } }
        }
      });

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.finished', {
        outputs: {
          echo: { message: 'hello', data: { key: 'value' } }
        }
      }, 'step-123');
    });

    test('handles empty inputs', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'echo-test',
        tool: 'test:echo',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: { echo: {} }
      });
    });

    test('handles null inputs', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'echo-test',
        tool: 'test:echo',
        inputs: null
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: { echo: {} }
      });
    });
  });

  describe('test_fail handler', () => {
    let handler: StepHandler;

    beforeAll(async () => {
      handler = (await import('../../src/worker/handlers/test_fail')).default;
    });

    test('matches test:fail tool', () => {
      expect(handler.match('test:fail')).toBe(true);
      expect(handler.match('test:echo')).toBe(false);
    });

    test('always fails as expected', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'fail-test',
        tool: 'test:fail',
        inputs: { message: 'should fail' }
      };

      await expect(handler.run({ runId: 'run-456', step })).rejects.toThrow();

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.started', {
        name: 'fail-test',
        tool: 'test:fail'
      }, 'step-123');
    });
  });

  describe('bash handler', () => {
    let handler: StepHandler;

    beforeAll(async () => {
      handler = (await import('../../src/worker/handlers/bash')).default;
    });

    const createMockChild = (exitCode = 0, stdout = '', stderr = '') => {
      const mockChild = {
        stdout: {
          on: jest.fn()
        },
        stderr: {
          on: jest.fn()
        },
        on: jest.fn(),
        kill: jest.fn()
      };

      // Setup stdout data handler
      mockChild.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(stdout)), 10);
        }
      });

      // Setup stderr data handler
      mockChild.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(stderr)), 10);
        }
      });

      // Setup close handler
      mockChild.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(exitCode), 20);
        } else if (event === 'error') {
          // Store error callback for potential use
        }
      });

      return mockChild;
    };

    test('matches bash tool', () => {
      expect(handler.match('bash')).toBe(true);
      expect(handler.match('test:echo')).toBe(false);
    });

    test('executes bash command successfully', async () => {
      const mockChild = createMockChild(0, 'Hello World', '');
      spawn.mockReturnValue(mockChild);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'bash-test',
        tool: 'bash',
        inputs: { command: 'echo "Hello World"' }
      };

      await handler.run({ runId: 'run-456', step });

      expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "Hello World"'], {
        cwd: expect.any(String),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Fast forward timers to complete the command
      jest.advanceTimersByTime(50);

      await new Promise(resolve => setTimeout(resolve, 0)); // Allow promises to resolve

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          command: 'echo "Hello World"',
          stdout: 'Hello World',
          stderr: '',
          exitCode: 0,
          success: true
        }
      });
    });

    test('handles command failure', async () => {
      const mockChild = createMockChild(1, '', 'Command not found');
      spawn.mockReturnValue(mockChild);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'bash-test',
        tool: 'bash',
        inputs: { command: 'nonexistent-command' }
      };

      await handler.run({ runId: 'run-456', step });

      jest.advanceTimersByTime(50);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          command: 'nonexistent-command',
          stdout: '',
          stderr: 'Command not found',
          exitCode: 1,
          success: false
        }
      });

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.failed', {
        outputs: expect.objectContaining({ exitCode: 1 }),
        error: 'Command failed with exit code 1'
      }, 'step-123');
    });

    test('handles command timeout', async () => {
      const mockChild = createMockChild(0, 'output', '');
      spawn.mockReturnValue(mockChild);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'bash-test',
        tool: 'bash',
        inputs: { command: 'sleep 60', timeout: 1000 }
      };

      const runPromise = handler.run({ runId: 'run-456', step });

      // Fast forward past the timeout
      jest.advanceTimersByTime(1000);

      await expect(runPromise).resolves.toBeUndefined();

      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          error: 'Command timed out after 1000ms',
          command: 'sleep 60'
        }
      });
    });

    test('uses default command when none provided', async () => {
      const mockChild = createMockChild(0, 'No command provided', '');
      spawn.mockReturnValue(mockChild);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'bash-test',
        tool: 'bash',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'echo "No command provided"'], expect.any(Object));
    });

    test('uses custom working directory', async () => {
      const mockChild = createMockChild(0, '', '');
      spawn.mockReturnValue(mockChild);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'bash-test',
        tool: 'bash',
        inputs: { command: 'pwd', cwd: '/custom/path' }
      };

      await handler.run({ runId: 'run-456', step });

      expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'pwd'], {
        cwd: '/custom/path',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    test('uses default timeout', async () => {
      const mockChild = createMockChild(0, '', '');
      spawn.mockReturnValue(mockChild);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'bash-test',
        tool: 'bash',
        inputs: { command: 'echo test' }
      };

      const runPromise = handler.run({ runId: 'run-456', step });

      // Should not timeout at 29 seconds (less than 30 second default)
      jest.advanceTimersByTime(29000);
      expect(mockChild.kill).not.toHaveBeenCalled();

      // Complete the command normally
      jest.advanceTimersByTime(50);
      await runPromise;
    });
  });

  describe('manual handler', () => {
    let handler: StepHandler;

    beforeAll(async () => {
      handler = (await import('../../src/worker/handlers/manual')).default;
    });

    test('matches manual tool', () => {
      expect(handler.match('manual')).toBe(true);
      expect(handler.match('bash')).toBe(false);
    });

    test('creates manual step that requires human intervention', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'manual-review',
        tool: 'manual',
        inputs: { description: 'Please review this manually' }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.started', {
        name: 'manual-review',
        tool: 'manual'
      }, 'step-123');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'manual',
        outputs: { description: 'Please review this manually' }
      });

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'step.manual', {
        description: 'Please review this manually'
      }, 'step-123');
    });
  });

  describe('handler types and interface', () => {
    test('StepHandler interface requirements', () => {
      // This test ensures the handler interface is properly defined
      const mockHandler: StepHandler = {
        match: jest.fn().mockReturnValue(true),
        run: jest.fn().mockResolvedValue(undefined)
      };

      expect(typeof mockHandler.match).toBe('function');
      expect(typeof mockHandler.run).toBe('function');

      // Test the match function signature
      expect(mockHandler.match('test')).toBe(true);

      // Test the run function signature
      const step: Step = {
        id: 'test',
        run_id: 'run',
        name: 'name',
        tool: 'tool',
        inputs: {}
      };

      expect(mockHandler.run({ runId: 'run', step })).resolves.toBeUndefined();
    });

    test('Step interface requirements', () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test-step',
        tool: 'test:tool',
        inputs: { key: 'value' }
      };

      expect(step.id).toBe('step-123');
      expect(step.run_id).toBe('run-456');
      expect(step.name).toBe('test-step');
      expect(step.tool).toBe('test:tool');
      expect(step.inputs).toEqual({ key: 'value' });
    });
  });
});