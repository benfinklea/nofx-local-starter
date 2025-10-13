/**
 * Tests for git_pr handler
 * Provides coverage for GitHub pull request creation with artifacts
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn(),
    getLatestGate: jest.fn(),
    createOrGetGate: jest.fn(),
    listStepsByRun: jest.fn(),
    listArtifactsByRun: jest.fn(),
    driver: 'fs'
  }
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        download: jest.fn()
      }))
    }
  },
  ARTIFACT_BUCKET: 'artifacts'
}));

jest.mock('../../../src/lib/logger', () => ({
  log: {
    warn: jest.fn()
  }
}));

jest.mock('../../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  STEP_READY_TOPIC: 'step-ready'
}));

jest.mock('../../../src/lib/secrets', () => ({
  buildMinimalEnv: jest.fn(),
  getSecret: jest.fn()
}));

jest.mock('../../../src/lib/json', () => ({
  toJsonObject: jest.fn(obj => obj)
}));

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn()
}));

jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    readFile: jest.fn()
  },
  default: {
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    promises: {
      readFile: jest.fn()
    }
  }
}));

// Mock fetch globally
(global as any).fetch = jest.fn();

import gitPrHandler from '../../../src/worker/handlers/git_pr';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { supabase } from '../../../src/lib/supabase';
import { enqueue } from '../../../src/lib/queue';
import { buildMinimalEnv, getSecret } from '../../../src/lib/secrets';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);
const mockSupabase = jest.mocked(supabase);
const mockEnqueue = jest.mocked(enqueue);
const mockBuildMinimalEnv = jest.mocked(buildMinimalEnv);
const mockGetSecret = jest.mocked(getSecret);
const mockSpawnSync = jest.mocked(spawnSync);
const mockFs = jest.mocked(fs);
const mockFetch = jest.mocked(fetch);

describe('git_pr handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
    mockEnqueue.mockResolvedValue(undefined);
    mockBuildMinimalEnv.mockReturnValue({ NODE_ENV: 'test' });
    mockGetSecret.mockReturnValue('ghp_test_token');

    // Mock successful git operations by default
    mockSpawnSync.mockImplementation((cmd: string, args?: any, options?: any) => {
      const argArray = Array.isArray(args) ? args : [];
      if (cmd === 'git' && argArray.includes('config')) {
        if (argArray.includes('--get')) {
          if (argArray.includes('remote.origin.url')) {
            return { status: 0, stdout: 'git@github.com:owner/repo.git', stderr: '' } as any;
          }
          if (argArray.includes('user.email')) {
            return { status: 0, stdout: 'test@example.com', stderr: '' } as any;
          }
          if (argArray.includes('user.name')) {
            return { status: 0, stdout: 'Test User', stderr: '' } as any;
          }
        }
      }
      return { status: 0, stdout: '', stderr: '' } as any;
    });

    // Mock successful GitHub API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        html_url: 'https://github.com/owner/repo/pull/123',
        number: 123
      })
    } as any);

    // Mock file system operations
    mockFs.promises.readFile.mockResolvedValue(Buffer.from('test content'));
  });

  describe('match', () => {
    it('should match git_pr tool', () => {
      expect(gitPrHandler.match('git_pr')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(gitPrHandler.match('git')).toBe(false);
      expect(gitPrHandler.match('pr')).toBe(false);
      expect(gitPrHandler.match('github')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'Test PR',
        body: 'Test PR description',
        commits: [
          {
            path: 'test.txt',
            content: 'Hello world'
          }
        ]
      }
    };

    beforeEach(() => {
      // Mock no existing gate (approved flow)
      mockStore.getLatestGate.mockResolvedValue({ status: 'passed' } as any);
    });

    it('should require manual approval by default', async () => {
      // Mock no existing gate
      mockStore.getLatestGate.mockResolvedValue(null);

      await gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should create manual gate
      expect(mockStore.createOrGetGate).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        'manual:git_pr'
      );

      // Should enqueue for retry
      expect(mockEnqueue).toHaveBeenCalledWith(
        'step-ready',
        { runId: 'run-123', stepId: 'step-123' },
        { delay: 5000 }
      );

      // Should record gate creation and waiting events
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'gate.created',
        { stepId: 'step-123', tool: 'manual:git_pr' },
        'step-123'
      );
    });

    it('should wait when gate is pending', async () => {
      // Mock pending gate
      mockStore.getLatestGate.mockResolvedValue({ status: 'pending' } as any);

      await gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should enqueue for retry without creating new gate
      expect(mockStore.createOrGetGate).not.toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledWith(
        'step-ready',
        { runId: 'run-123', stepId: 'step-123' },
        { delay: 5000 }
      );
    });

    it('should fail when gate is rejected', async () => {
      // Mock failed gate
      mockStore.getLatestGate.mockResolvedValue({ status: 'failed', id: 'gate-1' } as any);

      await expect(gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('git_pr not approved');

      // Should mark step as failed
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: { error: 'git_pr not approved' }
      });

      // Should record failure event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.failed',
        { stepId: 'step-123', tool: 'git_pr', manual: true, gateId: 'gate-1' },
        'step-123'
      );
    });

    it('should create PR with inline content', async () => {
      await gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should write file with inline content
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test.txt'),
        'Hello world',
        'utf8'
      );

      // Should execute git commands - check that key commands were called
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['rev-parse', '--is-inside-work-tree']), expect.objectContaining({ cwd: expect.any(String) }));
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['fetch', 'origin', 'main']), expect.objectContaining({ cwd: expect.any(String) }));
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout', '-B']), expect.objectContaining({ cwd: expect.any(String) }));
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['add', '--all']), expect.objectContaining({ cwd: expect.any(String) }));
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['commit', '-m', 'Test PR']), expect.objectContaining({ cwd: expect.any(String) }));
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['push', '-u', 'origin']), expect.objectContaining({ cwd: expect.any(String) }));

      // Should create GitHub PR
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'token ghp_test_token'
          }),
          body: expect.stringContaining('"title":"Test PR"')
        })
      );

      // Should update step to succeeded
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          branch: expect.stringMatching(/feat\/run-/),
          base: 'main',
          prUrl: 'https://github.com/owner/repo/pull/123',
          files: ['test.txt']
        }
      });
    });

    it('should handle artifact from direct path', async () => {
      const stepWithArtifact = {
        ...baseStep,
        inputs: {
          ...baseStep.inputs,
          commits: [
            {
              path: 'output.txt',
              fromArtifact: 'run-123/step-456/output.txt'
            }
          ]
        }
      };

      await gitPrHandler.run({
        runId: 'run-123',
        step: stepWithArtifact as any
      });

      // Should read from filesystem (fs driver)
      expect(mockFs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('run-123/step-456/output.txt')
      );

      // Should write buffer content
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('output.txt'),
        expect.any(Buffer)
      );
    });

    it('should handle artifact from step name and filename', async () => {
      const stepWithStepArtifact = {
        ...baseStep,
        inputs: {
          ...baseStep.inputs,
          commits: [
            {
              path: 'readme.md',
              fromStep: 'generate-readme',
              artifactName: 'README.md'
            }
          ]
        }
      };

      // Mock step and artifact lookup
      mockStore.listStepsByRun.mockResolvedValue([
        { id: 'step-456', name: 'generate-readme' }
      ] as any);

      mockStore.listArtifactsByRun.mockResolvedValue([
        { step_id: 'step-456', path: 'run-123/step-456/README.md' }
      ] as any);

      await gitPrHandler.run({
        runId: 'run-123',
        step: stepWithStepArtifact as any
      });

      // Should find step and artifact
      expect(mockStore.listStepsByRun).toHaveBeenCalledWith('run-123');
      expect(mockStore.listArtifactsByRun).toHaveBeenCalledWith('run-123');

      // Should read the artifact
      expect(mockFs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('run-123/step-456/README.md')
      );
    });

    it('should handle Supabase storage artifacts when driver is not fs', async () => {
      // Mock Supabase storage
      (mockStore as any).driver = 'postgres';

      const mockDownload = jest.fn() as any;
      mockDownload.mockResolvedValue({
        data: {
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        },
        error: null
      });

      mockSupabase.storage.from.mockReturnValue({
        download: mockDownload
      } as any);

      const stepWithArtifact = {
        ...baseStep,
        inputs: {
          ...baseStep.inputs,
          commits: [
            {
              path: 'file.txt',
              fromArtifact: 'artifacts/run-123/step-456/file.txt'
            }
          ]
        }
      };

      await gitPrHandler.run({
        runId: 'run-123',
        step: stepWithArtifact as any
      });

      // Should download from Supabase
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('artifacts');
      expect(mockDownload).toHaveBeenCalledWith('artifacts/run-123/step-456/file.txt');
    });

    it('should validate required inputs', async () => {
      const invalidStep = {
        ...baseStep,
        inputs: {
          title: 'Test PR',
          commits: [] // Empty commits array
        }
      };

      await expect(gitPrHandler.run({
        runId: 'run-123',
        step: invalidStep as any
      })).rejects.toThrow('git_pr requires commits');
    });

    it('should prevent path traversal', async () => {
      const maliciousStep = {
        ...baseStep,
        inputs: {
          ...baseStep.inputs,
          commits: [
            {
              path: '../../../etc/passwd',
              content: 'malicious content'
            }
          ]
        }
      };

      await expect(gitPrHandler.run({
        runId: 'run-123',
        step: maliciousStep as any
      })).rejects.toThrow('path traversal not allowed');
    });

    it('should handle git command failures', async () => {
      // Mock git command failure
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'fatal: not a git repository'
      } as any);

      await expect(gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('not a git repo');
    });

    it('should set git user config if not configured', async () => {
      // Mock git config commands failing initially
      mockSpawnSync.mockImplementation((cmd: string, args?: any, options?: any) => {
        const argArray = Array.isArray(args) ? args : [];
        if (cmd === 'git' && argArray[0] === 'config') {
          // Check if it's a GET operation (2 args = config <key>, without a value)
          // SET operations have 3 args = config <key> <value>
          if (argArray.length === 2) {
            if (argArray.includes('user.email') || argArray.includes('user.name')) {
              return { status: 1, stdout: '', stderr: 'not set' } as any;
            }
            if (argArray.includes('remote.origin.url')) {
              return { status: 0, stdout: 'https://github.com/owner/repo.git', stderr: '' } as any;
            }
          }
        }
        return { status: 0, stdout: '', stderr: '' } as any;
      });

      await gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should set git user config
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['config', 'user.email', 'nofx@example.com']), expect.objectContaining({ cwd: expect.any(String) }));
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['config', 'user.name', 'NOFX Bot']), expect.objectContaining({ cwd: expect.any(String) }));
    });

    it('should handle GitHub API errors gracefully', async () => {
      // Mock GitHub API failure
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('API rate limit exceeded')
      } as any);

      await gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should succeed even if PR creation fails
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          branch: expect.stringMatching(/feat\/run-/),
          base: 'main',
          prUrl: undefined, // No PR URL due to API failure
          files: ['test.txt']
        }
      });
    });

    it('should handle missing GitHub token', async () => {
      // Mock missing token
      mockGetSecret.mockReturnValue(null);

      await gitPrHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should still succeed with git push but no PR
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          prUrl: undefined
        })
      });
    });

    it('should use custom branch and base', async () => {
      const customStep = {
        ...baseStep,
        inputs: {
          ...baseStep.inputs,
          branch: 'feature/custom-branch',
          base: 'develop'
        }
      };

      await gitPrHandler.run({
        runId: 'run-123',
        step: customStep as any
      });

      // Should use custom branch and base
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['fetch', 'origin', 'develop']), expect.objectContaining({ cwd: expect.any(String) }));
      expect(mockSpawnSync).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout', '-B', 'feature/custom-branch', 'origin/develop']), expect.objectContaining({ cwd: expect.any(String) }));

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          branch: 'feature/custom-branch',
          base: 'develop'
        })
      });
    });

    it('should create draft PR when specified', async () => {
      const draftStep = {
        ...baseStep,
        inputs: {
          ...baseStep.inputs,
          draft: true
        }
      };

      await gitPrHandler.run({
        runId: 'run-123',
        step: draftStep as any
      });

      // Should create draft PR
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"draft":true')
        })
      );
    });

    it('should handle missing step or artifact in fromStep resolution', async () => {
      const invalidStepArtifact = {
        ...baseStep,
        inputs: {
          ...baseStep.inputs,
          commits: [
            {
              path: 'missing.txt',
              fromStep: 'nonexistent-step',
              artifactName: 'missing.txt'
            }
          ]
        }
      };

      mockStore.listStepsByRun.mockResolvedValue([]);

      await expect(gitPrHandler.run({
        runId: 'run-123',
        step: invalidStepArtifact as any
      })).rejects.toThrow('step not found: nonexistent-step');
    });
  });
});