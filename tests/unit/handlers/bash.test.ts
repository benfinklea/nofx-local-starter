/**
 * Tests for bash handler
 * Provides coverage for command execution functionality
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn()
  }
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../../src/lib/projects', () => ({
  getProject: jest.fn()
}));

jest.mock('../../../src/lib/workspaces', () => ({
  workspaceManager: {
    ensureWorkspace: jest.fn()
  }
}));

jest.mock('node:child_process', () => ({
  spawn: jest.fn()
}));

import bashHandler from '../../../src/worker/handlers/bash';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { getProject } from '../../../src/lib/projects';
import { workspaceManager } from '../../../src/lib/workspaces';
import { spawn } from 'node:child_process';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);
const mockGetProject = jest.mocked(getProject);
const mockWorkspaceManager = jest.mocked(workspaceManager);
const mockSpawn = jest.mocked(spawn);

// Mock EventEmitter for child process
class MockChildProcess {
  stdout = { on: jest.fn(), setEncoding: jest.fn() };
  stderr = { on: jest.fn(), setEncoding: jest.fn() };
  on = jest.fn();
  kill = jest.fn();

  // Helper to simulate successful command
  simulateSuccess(stdout = '', stderr = '', exitCode = 0) {
    // Simulate data events
    if (stdout) {
      const stdoutCallback = this.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (stdoutCallback) (stdoutCallback as any)(stdout);
    }
    if (stderr) {
      const stderrCallback = this.stderr.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (stderrCallback) (stderrCallback as any)(stderr);
    }

    // Simulate close event
    const closeCallback = this.on.mock.calls.find(call => call[0] === 'close')?.[1];
    if (closeCallback) (closeCallback as any)(exitCode);
  }

  // Helper to simulate command timeout
  simulateTimeout() {
    const errorCallback = this.on.mock.calls.find(call => call[0] === 'error')?.[1];
    if (errorCallback) (errorCallback as any)(new Error('Command timed out'));
  }
}

describe('bash handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
    // Reset process.cwd mock
    jest.spyOn(process, 'cwd').mockReturnValue('/default/cwd');
  });

  describe('match', () => {
    it('should match bash tool', () => {
      expect(bashHandler.match('bash')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(bashHandler.match('shell')).toBe(false);
      expect(bashHandler.match('bash_script')).toBe(false);
      expect(bashHandler.match('sh')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'run-command',
      tool: 'bash',
      inputs: {
        command: 'echo "hello world"'
      }
    };

    it('should execute simple command successfully', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      // Start the handler execution
      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Simulate successful command execution
      setTimeout(() => {
        mockProcess.simulateSuccess('hello world\n', '', 0);
      }, 10);

      await runPromise;

      // Should spawn with correct command
      expect(mockSpawn).toHaveBeenCalledWith('bash', ['-c', 'echo "hello world"'], {
        cwd: '/default/cwd',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Should update step to running first, then succeeded
      expect(mockStore.updateStep).toHaveBeenCalledTimes(2);
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(1, 'step-123', {
        status: 'running',
        started_at: expect.any(String)
      });
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(2, 'step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          command: 'echo "hello world"',
          stdout: 'hello world', // Handler trims output
          stderr: '',
          exitCode: 0,
          success: true
        }
      });

      // Should record start and completion events
      expect(mockRecordEvent).toHaveBeenCalledTimes(2);
      expect(mockRecordEvent).toHaveBeenNthCalledWith(
        1,
        'run-123',
        'step.started',
        { name: 'run-command', tool: 'bash' },
        'step-123'
      );
      expect(mockRecordEvent).toHaveBeenNthCalledWith(
        2,
        'run-123',
        'step.finished',
        { outputs: expect.objectContaining({ exitCode: 0 }) },
        'step-123'
      );
    });

    it('should handle command with stderr output', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: { command: 'ls nonexistent_file' }
        } as any
      });

      setTimeout(() => {
        mockProcess.simulateSuccess('', 'ls: nonexistent_file: No such file or directory\n', 1);
      }, 10);

      await runPromise;

      // Non-zero exit code now marks step as failed
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(2, 'step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          command: 'ls nonexistent_file',
          stdout: '',
          stderr: 'ls: nonexistent_file: No such file or directory', // Handler trims output
          exitCode: 1,
          success: false
        }
      });

      // Should record failed event
      expect(mockRecordEvent).toHaveBeenNthCalledWith(
        2,
        'run-123',
        'step.failed',
        {
          outputs: expect.objectContaining({ exitCode: 1 }),
          error: 'Command failed with exit code 1'
        },
        'step-123'
      );
    });

    it('should use project workspace when project_id provided', async () => {
      const project = { id: 'proj-123', name: 'Test Project' };
      mockGetProject.mockResolvedValue(project as any);
      mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/project/workspace');

      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            command: 'pwd',
            project_id: 'proj-123'
          }
        } as any
      });

      setTimeout(() => {
        mockProcess.simulateSuccess('/project/workspace\n', '', 0);
      }, 10);

      await runPromise;

      expect(mockGetProject).toHaveBeenCalledWith('proj-123');
      expect(mockWorkspaceManager.ensureWorkspace).toHaveBeenCalledWith(project);
      expect(mockSpawn).toHaveBeenCalledWith('bash', ['-c', 'pwd'], {
        cwd: '/project/workspace',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should use workspace parameter as project_id', async () => {
      const project = { id: 'proj-456', name: 'Workspace Project' };
      mockGetProject.mockResolvedValue(project as any);
      mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/workspace/path');

      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            command: 'ls',
            workspace: 'proj-456'
          }
        } as any
      });

      setTimeout(() => {
        mockProcess.simulateSuccess('file1.txt\nfile2.txt\n', '', 0);
      }, 10);

      await runPromise;

      expect(mockGetProject).toHaveBeenCalledWith('proj-456');
      expect(mockSpawn).toHaveBeenCalledWith('bash', ['-c', 'ls'], {
        cwd: '/workspace/path',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should use workspace parameter as direct path when project not found', async () => {
      mockGetProject.mockResolvedValue(undefined);

      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            command: 'ls',
            workspace: '/direct/path'
          }
        } as any
      });

      setTimeout(() => {
        mockProcess.simulateSuccess('direct_file.txt\n', '', 0);
      }, 10);

      await runPromise;

      expect(mockSpawn).toHaveBeenCalledWith('bash', ['-c', 'ls'], {
        cwd: '/direct/path',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should use custom cwd when provided', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            command: 'pwd',
            cwd: '/custom/working/dir'
          }
        } as any
      });

      setTimeout(() => {
        mockProcess.simulateSuccess('/custom/working/dir\n', '', 0);
      }, 10);

      await runPromise;

      expect(mockSpawn).toHaveBeenCalledWith('bash', ['-c', 'pwd'], {
        cwd: '/custom/working/dir',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should handle command timeout', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      // Set a very short timeout to trigger it
      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            command: 'sleep 60',
            timeout: 10 // Very short timeout
          }
        } as any
      });

      // Expect the promise to reject with timeout error
      await expect(runPromise).rejects.toThrow('Command timed out');

      // Should have tried to kill the process
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should use default command when none provided', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {} // No command
        } as any
      });

      setTimeout(() => {
        mockProcess.simulateSuccess('No command provided\n', '', 0);
      }, 10);

      await runPromise;

      expect(mockSpawn).toHaveBeenCalledWith('bash', ['-c', 'echo "No command provided"'], {
        cwd: '/default/cwd',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    });

    it('should use default timeout when none provided', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const runPromise = bashHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      setTimeout(() => {
        mockProcess.simulateSuccess('output\n', '', 0);
      }, 10);

      await runPromise;

      // Should not timeout with default 30 second timeout
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    it('should handle spawn errors', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Command not found');
      });

      await expect(bashHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('Command not found');

      // Should have started the step
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });
    });
  });
});