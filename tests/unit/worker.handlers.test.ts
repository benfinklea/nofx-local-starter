/**
 * Worker Handlers Unit Tests (Optimized for Speed)
 * Tests individual handler implementations for different tools
 *
 * Performance optimizations applied:
 * - Comprehensive mocking to prevent module initialization
 * - Simplified mock child processes using process.nextTick
 * - Isolated fake timer usage only where needed
 * - Removed unnecessary async delays
 */

import type { StepHandler, Step } from '../../src/worker/handlers/types';

// CRITICAL: Mock ALL dependencies BEFORE any imports that use them
// This prevents module initialization code from running

// Mock fs-extra to prevent sync filesystem operations
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  ensureDir: jest.fn().mockResolvedValue(undefined),
  readJson: jest.fn().mockResolvedValue({}),
  writeJson: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../src/lib/store/StoreFactory', () => ({
  StoreFactory: {
    getInstance: jest.fn(() => ({})),
    driver: 'mock',
    reset: jest.fn()
  }
}));

jest.mock('../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn().mockResolvedValue(undefined),
    createStep: jest.fn().mockResolvedValue(undefined),
    getRun: jest.fn().mockResolvedValue(null),
    getLatestGate: jest.fn().mockResolvedValue(null),
    createOrGetGate: jest.fn().mockResolvedValue({ id: 'gate-123', status: 'pending' })
  }
}));

jest.mock('../../src/lib/events', () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('node:child_process', () => ({
  spawn: jest.fn()
}));

jest.mock('../../src/lib/projects', () => ({
  getProject: jest.fn().mockResolvedValue(null)
}));

jest.mock('../../src/lib/workspaces', () => ({
  workspaceManager: {
    ensureWorkspace: jest.fn().mockResolvedValue('/tmp/workspace')
  }
}));

jest.mock('../../src/lib/queue', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  STEP_READY_TOPIC: 'step.ready'
}));

// Now safe to import handlers after all mocks are in place
import testEchoHandler from '../../src/worker/handlers/test_echo';
import testFailHandler from '../../src/worker/handlers/test_fail';
import bashHandler from '../../src/worker/handlers/bash';
import manualHandler from '../../src/worker/handlers/manual';

const mockStore = require('../../src/lib/store').store;
const { recordEvent } = require('../../src/lib/events');
const { spawn } = require('node:child_process');

describe('Worker Handlers Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Ensure fake timers are always cleaned up
    if (jest.isMockFunction(setTimeout)) {
      jest.useRealTimers();
    }
  });

  describe('test_echo handler', () => {
    test('matches test:echo tool', () => {
      expect(testEchoHandler.match('test:echo')).toBe(true);
      expect(testEchoHandler.match('test:other')).toBe(false);
      expect(testEchoHandler.match('bash')).toBe(false);
    });

    test('processes step successfully', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'echo-test',
        tool: 'test:echo',
        inputs: { message: 'hello', data: { key: 'value' } }
      };

      await testEchoHandler.run({ runId: 'run-456', step });

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

      await testEchoHandler.run({ runId: 'run-456', step });

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

      await testEchoHandler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: { echo: {} }
      });
    });
  });

  describe('test_fail handler', () => {
    test('matches test:fail tool', () => {
      expect(testFailHandler.match('test:fail')).toBe(true);
      expect(testFailHandler.match('test:echo')).toBe(false);
    });

    test('always fails as expected', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'fail-test',
        tool: 'test:fail',
        inputs: { message: 'should fail' }
      };

      await expect(testFailHandler.run({ runId: 'run-456', step })).rejects.toThrow();

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
    const createMockChild = (exitCode = 0, stdout = '', stderr = '') => {
      const callbacks = {
        stdout: null as ((data: Buffer) => void) | null,
        stderr: null as ((data: Buffer) => void) | null,
        close: null as ((code: number) => void) | null
      };

      const mockChild = {
        stdout: {
          on: jest.fn((event: string, cb: (data: Buffer) => void) => {
            if (event === 'data') callbacks.stdout = cb;
          })
        },
        stderr: {
          on: jest.fn((event: string, cb: (data: Buffer) => void) => {
            if (event === 'data') callbacks.stderr = cb;
          })
        },
        on: jest.fn((event: string, cb: (code: number) => void) => {
          if (event === 'close') callbacks.close = cb;
        }),
        kill: jest.fn()
      };

      // Trigger callbacks immediately on next tick for fast execution
      process.nextTick(() => {
        if (stdout && callbacks.stdout) callbacks.stdout(Buffer.from(stdout));
        if (stderr && callbacks.stderr) callbacks.stderr(Buffer.from(stderr));
        if (callbacks.close) callbacks.close(exitCode);
      });

      return mockChild;
    };

    test('matches bash tool', () => {
      expect(bashHandler.match('bash')).toBe(true);
      expect(bashHandler.match('test:echo')).toBe(false);
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

      await bashHandler.run({ runId: 'run-456', step });

      expect(spawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'echo "Hello World"'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: ['ignore', 'pipe', 'pipe']
        })
      );

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

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

      await bashHandler.run({ runId: 'run-456', step });

      // Check that step was marked as running first
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(1, 'step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Then check that step was marked as failed
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(2, 'step-123', {
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

    test.skip('handles command timeout', async () => {
      // Use fake timers for this test
      jest.useFakeTimers();

      try {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        };
        spawn.mockReturnValue(mockChild);

        const step: Step = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'bash-test',
          tool: 'bash',
          inputs: { command: 'sleep 60', timeout: 1000 }
        };

        const runPromise = bashHandler.run({ runId: 'run-456', step });

        // Fast forward past the timeout
        jest.advanceTimersByTime(1500);

        // Wait for the promise to resolve/reject
        await runPromise;

        expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: {
            error: 'Command timed out after 1000ms',
            command: 'sleep 60'
          }
        });
      } finally {
        // Always restore real timers
        jest.useRealTimers();
      }
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

      await bashHandler.run({ runId: 'run-456', step });

      expect(spawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'echo "No command provided"'],
        expect.objectContaining({
          cwd: expect.any(String)
        })
      );
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

      await bashHandler.run({ runId: 'run-456', step });

      expect(spawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'pwd'],
        expect.objectContaining({
          cwd: '/custom/path',
          stdio: ['ignore', 'pipe', 'pipe']
        })
      );
    });

    test.skip('uses default timeout', async () => {
      jest.useFakeTimers();

      try {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'close') {
              // Simulate quick completion
              setTimeout(() => cb(), 100);
            }
          }),
          kill: jest.fn()
        };
        spawn.mockReturnValue(mockChild);

        const step: Step = {
          id: 'step-123',
          run_id: 'run-456',
          name: 'bash-test',
          tool: 'bash',
          inputs: { command: 'echo test' }
        };

        const runPromise = bashHandler.run({ runId: 'run-456', step });

        // Should not timeout at 29 seconds (less than 30 second default)
        jest.advanceTimersByTime(29000);
        expect(mockChild.kill).not.toHaveBeenCalled();

        // Complete the command normally
        jest.advanceTimersByTime(200);
        await runPromise;
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('manual handler', () => {
    test('matches manual tool', () => {
      expect(manualHandler.match('manual:review')).toBe(true);
      expect(manualHandler.match('manual:approval')).toBe(true);
      expect(manualHandler.match('bash')).toBe(false);
    });

    test('creates gate for manual step that requires human intervention', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'manual-review',
        tool: 'manual:review',
        inputs: { description: 'Please review this manually' }
      };

      await manualHandler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      expect(mockStore.createOrGetGate).toHaveBeenCalledWith('run-456', 'step-123', 'manual:review');

      expect(recordEvent).toHaveBeenCalledWith('run-456', 'gate.created', {
        stepId: 'step-123',
        tool: 'manual:review'
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
