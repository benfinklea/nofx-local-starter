/**
 * Tests for gate handler
 * Provides coverage for gate execution with artifact management
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn(),
    getRun: jest.fn()
  }
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/lib/settings', () => ({
  getSettings: jest.fn(),
  shouldGateBlock: jest.fn()
}));

jest.mock('../../../src/lib/artifacts', () => ({
  saveArtifact: jest.fn()
}));

jest.mock('../../../src/lib/secrets', () => ({
  buildMinimalEnv: jest.fn()
}));

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn()
}));

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  default: {
    existsSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    unlinkSync: jest.fn(),
    rmdirSync: jest.fn()
  }
}));

jest.mock('../../../src/lib/projects', () => ({
  getProject: jest.fn()
}));

jest.mock('../../../src/lib/workspaces', () => ({
  workspaceManager: {
    ensureWorkspace: jest.fn()
  }
}));

import gateHandler from '../../../src/worker/handlers/gate';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { getSettings, shouldGateBlock } from '../../../src/lib/settings';
import { saveArtifact } from '../../../src/lib/artifacts';
import { buildMinimalEnv } from '../../../src/lib/secrets';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { getProject } from '../../../src/lib/projects';
import { workspaceManager } from '../../../src/lib/workspaces';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);
const mockGetSettings = jest.mocked(getSettings);
const mockShouldGateBlock = jest.mocked(shouldGateBlock);
const mockSaveArtifact = jest.mocked(saveArtifact);
const mockBuildMinimalEnv = jest.mocked(buildMinimalEnv);
const mockSpawnSync = jest.mocked(spawnSync);
const mockFs = jest.mocked(fs);
const mockGetProject = jest.mocked(getProject);
const mockWorkspaceManager = jest.mocked(workspaceManager);

describe('gate handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockStore.getRun.mockResolvedValue(undefined); // No project_id by default
    mockRecordEvent.mockResolvedValue(undefined);
    mockGetSettings.mockResolvedValue({
      gates: { coverageThreshold: 0.9, test: true }
    } as any);
    mockSaveArtifact.mockResolvedValue('https://example.com/artifact.json');
    mockBuildMinimalEnv.mockReturnValue({ NODE_ENV: 'test' });
    mockGetProject.mockResolvedValue(undefined);
    mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/mock/workspace');
    mockShouldGateBlock.mockReturnValue(true); // Default to blocking for critical gates

    // Mock successful fs operations by default
    // Return false for lock files to avoid waiting, true for everything else
    mockFs.existsSync.mockImplementation((path) => {
      if (String(path).includes('.lock')) return false;
      return true;
    });
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
  });

  describe('match', () => {
    it('should match tools starting with "gate:"', () => {
      expect(gateHandler.match('gate:test')).toBe(true);
      expect(gateHandler.match('gate:coverage')).toBe(true);
      expect(gateHandler.match('gate:security')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(gateHandler.match('test')).toBe(false);
      expect(gateHandler.match('gate')).toBe(false);
      expect(gateHandler.match('manual')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'run-test-gate',
      tool: 'gate:test',
      inputs: {}
    };

    it('should execute gate successfully', async () => {
      // Mock successful gate execution
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ summary: { gate: 'test', passed: true, details: 'All tests passed' } }),
        stderr: '',
        signal: null
      } as any);

      await gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should update step to running
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should execute gate script
      expect(mockSpawnSync).toHaveBeenCalledWith('npx', ['zx', expect.stringContaining('runGate.mjs'), 'test'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { NODE_ENV: 'test', COVERAGE_THRESHOLD: '0.9' },
        timeout: 600000
      });

      // Should save summary artifact
      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        'gate-summary.json',
        expect.stringContaining('"passed": true'),
        'application/json'
      );

      // Should update step to succeeded
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          gate: 'test',
          summary: { gate: 'test', passed: true, details: 'All tests passed', severity: 'warning' },
          artifacts: ['https://example.com/artifact.json']
        }
      });

      // Should record finish event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.finished',
        { gate: 'test', summary: { gate: 'test', passed: true, details: 'All tests passed', severity: 'warning' } },
        'step-123'
      );
    });

    it('should handle gate failure', async () => {
      // Mock failed gate execution
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: JSON.stringify({ summary: { gate: 'test', passed: false, error: 'Tests failed' } }),
        stderr: 'Test execution failed',
        signal: null
      } as any);

      await expect(gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('gate test failed');

      // Should update step to failed
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          gate: 'test',
          summary: { gate: 'test', passed: false, error: 'Tests failed', severity: 'warning' },
          artifacts: ['https://example.com/artifact.json']
        }
      });

      // Should record failure event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.failed',
        { gate: 'test', summary: { gate: 'test', passed: false, error: 'Tests failed', severity: 'warning' }, severity: 'warning', blocked: true, stderr: 'Test execution failed' },
        'step-123'
      );
    });

    it('should skip gate when disabled in settings', async () => {
      mockGetSettings.mockResolvedValue({
        gates: { test: false }
      } as any);

      await gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should not execute gate script
      expect(mockSpawnSync).not.toHaveBeenCalled();

      // Should update step to succeeded with skipped flag
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: { gate: 'test', skipped: true }
      });

      // Should record finish event with skipped flag
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.finished',
        { gate: 'test', skipped: true },
        'step-123'
      );
    });

    it('should handle missing gate runner script', async () => {
      // Mock script not found
      mockFs.existsSync.mockImplementation((path) => {
        return !String(path).includes('runGate.mjs');
      });

      await expect(gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('Gate runner script not found');

      // Should update step to failed
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: { gate: 'test', error: 'Gate runner script not found' }
      });
    });

    it('should handle gate timeout', async () => {
      // Mock timeout (SIGTERM signal)
      mockSpawnSync.mockReturnValue({
        status: null,
        stdout: '',
        stderr: '',
        signal: 'SIGTERM'
      } as any);

      await expect(gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('Gate test timed out');

      // Should update step to failed with timeout error
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          gate: 'test',
          summary: { gate: 'test', passed: false, error: 'Gate execution timed out after 10 minutes' }
        }
      });

      // Should record failure event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.failed',
        { gate: 'test', summary: { gate: 'test', passed: false, error: 'Gate execution timed out after 10 minutes' }, stderr: 'Timeout' },
        'step-123'
      );
    });

    it('should handle malformed gate output', async () => {
      // Mock gate with invalid JSON output
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'Invalid JSON output\nsome other lines',
        stderr: '',
        signal: null
      } as any);

      await gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should use default summary when JSON parsing fails
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          gate: 'test',
          summary: { gate: 'test', passed: true, severity: 'warning' },
          artifacts: ['https://example.com/artifact.json']
        }
      });
    });

    it('should process gate artifacts', async () => {
      // Mock artifacts directory with files
      mockFs.existsSync.mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('.lock')) return false; // No lock file
        if (pathStr.includes('gate-artifacts') && !pathStr.endsWith('.json') && !pathStr.endsWith('.txt')) return true; // Directory exists
        if (pathStr.includes('test-results.json') || pathStr.includes('coverage.txt')) return true; // Files exist
        return true; // Other paths
      });

      mockFs.readdirSync.mockReturnValue(['test-results.json', 'coverage.txt'] as any);
      mockFs.readFileSync.mockImplementation((path: any, options?: any): any => {
        const content = (() => {
          if (String(path).includes('test-results.json')) {
            return JSON.stringify({ tests: 5, passed: 5 });
          }
          if (String(path).includes('coverage.txt')) {
            return 'Coverage: 95%';
          }
          return '';
        })();

        // Return Buffer if no encoding specified, otherwise return string
        return options?.encoding || typeof options === 'string' ? content : Buffer.from(content);
      });

      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ summary: { gate: 'test', passed: true } }),
        stderr: '',
        signal: null
      } as any);

      await gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should upload artifacts
      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        'gate-artifacts/test-results.json',
        '{"tests":5,"passed":5}',
        'application/json'
      );

      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        'gate-artifacts/coverage.txt',
        'Coverage: 95%',
        'text/plain'
      );

      // Should clean up artifacts after upload
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('test-results.json')
      );
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('coverage.txt')
      );
    });

    it.skip('should handle file locking for concurrent access', async () => {
      // Mock lock file exists initially
      mockFs.existsSync.mockImplementation((path) => {
        if (String(path).includes('.lock')) return true;
        if (String(path).includes('gate-artifacts')) return true;
        return true;
      });

      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ summary: { gate: 'test', passed: true } }),
        stderr: '',
        signal: null
      } as any);

      // Use fake timers to control setTimeout
      jest.useFakeTimers();

      const runPromise = gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Simulate lock being released after some time
      setTimeout(() => {
        mockFs.existsSync.mockImplementation((path) => {
          if (String(path).includes('.lock')) return false;
          if (String(path).includes('gate-artifacts')) return true;
          return true;
        });
      }, 5000);

      // Fast-forward time
      jest.advanceTimersByTime(6000);

      await runPromise;

      // Should have waited for lock and then proceeded
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.lock'),
        'step-123'
      );

      jest.useRealTimers();
    });

    it('should respect environment restrictions from policy', async () => {
      const stepWithPolicy = {
        ...baseStep,
        inputs: {
          _policy: {
            env_allowed: ['NODE_ENV', 'CUSTOM_VAR']
          }
        }
      };

      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ summary: { gate: 'test', passed: true } }),
        stderr: '',
        signal: null
      } as any);

      await gateHandler.run({
        runId: 'run-123',
        step: stepWithPolicy as any
      });

      // Should pass allowed environment variables to buildMinimalEnv
      expect(mockBuildMinimalEnv).toHaveBeenCalledWith(['NODE_ENV', 'CUSTOM_VAR']);
    });

    it('should handle artifact upload failures gracefully', async () => {
      mockSaveArtifact.mockResolvedValue('' as any); // Simulate upload failure

      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ summary: { gate: 'test', passed: true } }),
        stderr: '',
        signal: null
      } as any);

      await gateHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should still succeed even if artifact upload fails
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          gate: 'test',
          summary: { gate: 'test', passed: true, severity: 'warning' },
          artifacts: [] // Empty due to upload failure
        }
      });
    });
  });
});