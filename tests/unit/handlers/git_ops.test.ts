/**
 * Tests for git_ops handler
 * Provides coverage for git operations in different modes
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

jest.mock('../../../src/lib/logger', () => ({
  log: {
    warn: jest.fn()
  }
}));

jest.mock('simple-git', () => {
  const mockGit = {
    status: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
    pull: jest.fn(),
    push: jest.fn(),
    reset: jest.fn(),
    log: jest.fn(),
    branch: jest.fn(),
    checkout: jest.fn(),
    checkoutBranch: jest.fn(),
    merge: jest.fn()
  };
  return jest.fn(() => mockGit);
});

import gitOpsHandler from '../../../src/worker/handlers/git_ops';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { getProject } from '../../../src/lib/projects';
import { workspaceManager } from '../../../src/lib/workspaces';
import simpleGit from 'simple-git';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);
const mockGetProject = jest.mocked(getProject);
const mockWorkspaceManager = jest.mocked(workspaceManager);
const mockSimpleGit = jest.mocked(simpleGit);

describe('git_ops handler', () => {
  let mockGit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
    mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/workspace/path');

    // Create mock git instance
    mockGit = {
      status: jest.fn(),
      add: jest.fn(),
      commit: jest.fn(),
      pull: jest.fn(),
      push: jest.fn(),
      reset: jest.fn(),
      log: jest.fn(),
      branch: jest.fn(),
      checkout: jest.fn(),
      checkoutBranch: jest.fn(),
      merge: jest.fn()
    };
    mockSimpleGit.mockReturnValue(mockGit);

    // Default git status mock
    mockGit.status.mockResolvedValue({
      isClean: () => false,
      files: [{ path: 'test.txt' }],
      current: 'main',
      ahead: 0,
      behind: 0
    });
  });

  describe('match', () => {
    it('should match git_ops tool', () => {
      expect(gitOpsHandler.match('git_ops')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(gitOpsHandler.match('git')).toBe(false);
      expect(gitOpsHandler.match('ops')).toBe(false);
      expect(gitOpsHandler.match('bash')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'git-operation',
      tool: 'git_ops',
      inputs: {
        project_id: 'project-456',
        operation: 'save' as const
      }
    };

    beforeEach(() => {
      mockGetProject.mockResolvedValue({
        id: 'project-456',
        name: 'Test Project',
        git_mode: 'hidden'
      } as any);
    });

    it('should validate required inputs', async () => {
      const invalidStep = {
        ...baseStep,
        inputs: {}
      };

      await gitOpsHandler.run({
        runId: 'run-123',
        step: invalidStep as any
      });

      // Should have updated step to running first
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should have updated step to failed
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: expect.stringContaining('project_id is required')
        })
      });
    });

    it('should fail when project not found', async () => {
      mockGetProject.mockResolvedValue(undefined);

      await gitOpsHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should have updated step to failed
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: expect.stringContaining('Project project-456 not found')
        })
      });
    });

    describe('hidden mode operations', () => {
      beforeEach(() => {
        mockGetProject.mockResolvedValue({
          id: 'project-456',
          name: 'Test Project',
          git_mode: 'hidden'
        } as any);
      });

      it('should execute save operation successfully', async () => {
        mockGit.commit.mockResolvedValue({ commit: 'abc123' });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: baseStep as any
        });

        // Should add all files and commit
        expect(mockGit.add).toHaveBeenCalledWith('.');
        expect(mockGit.commit).toHaveBeenCalledWith(
          expect.stringContaining('Saved progress for Test Project')
        );

        // Should update step to succeeded
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'save',
            git_mode: 'hidden',
            workspace: '/workspace/path',
            message: 'Progress saved successfully',
            saved: true
          }
        });
      });

      it('should handle save when no changes exist', async () => {
        mockGit.status.mockResolvedValue({
          isClean: () => true,
          files: [],
          current: 'main',
          ahead: 0,
          behind: 0
        });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: baseStep as any
        });

        // Should not commit when no changes
        expect(mockGit.add).not.toHaveBeenCalled();
        expect(mockGit.commit).not.toHaveBeenCalled();

        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'save',
            git_mode: 'hidden',
            workspace: '/workspace/path',
            message: 'No changes to save'
          }
        });
      });

      it('should execute sync operation', async () => {
        const syncStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'sync' as const }
        };

        mockGit.pull.mockResolvedValue({ summary: { changes: 1 } });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: syncStep as any
        });

        expect(mockGit.pull).toHaveBeenCalled();
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'sync',
            git_mode: 'hidden',
            workspace: '/workspace/path',
            message: 'Project updated to latest version'
          }
        });
      });

      it('should handle sync when pull fails', async () => {
        const syncStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'sync' as const }
        };

        mockGit.pull.mockRejectedValue(new Error('Nothing to pull'));

        await gitOpsHandler.run({
          runId: 'run-123',
          step: syncStep as any
        });

        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'sync',
            git_mode: 'hidden',
            workspace: '/workspace/path',
            message: 'Project is up to date'
          }
        });
      });

      it('should execute revert operation', async () => {
        const revertStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'revert' as const,
            steps_back: 2
          }
        };

        await gitOpsHandler.run({
          runId: 'run-123',
          step: revertStep as any
        });

        expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~2']);
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'revert',
            git_mode: 'hidden',
            workspace: '/workspace/path',
            message: 'Restored previous version'
          }
        });
      });

      it('should execute status operation', async () => {
        const statusStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'status' as const }
        };

        await gitOpsHandler.run({
          runId: 'run-123',
          step: statusStep as any
        });

        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'status',
            git_mode: 'hidden',
            workspace: '/workspace/path',
            hasChanges: true,
            filesChanged: 1,
            message: '1 file(s) modified'
          }
        });
      });

      it('should reject unsupported operations in hidden mode', async () => {
        const invalidStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'push' as any }
        };

        await gitOpsHandler.run({
          runId: 'run-123',
          step: invalidStep as any
        });

        // Should have updated step to failed
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            error: expect.stringContaining('Operation push not available in hidden mode')
          })
        });
      });
    });

    describe('basic mode operations', () => {
      beforeEach(() => {
        mockGetProject.mockResolvedValue({
          id: 'project-456',
          name: 'Test Project',
          git_mode: 'basic'
        } as any);

        mockGit.log.mockResolvedValue({
          latest: { hash: 'abc123456789', message: 'Test commit' },
          total: 5
        });
      });

      it('should execute commit with custom message', async () => {
        const commitStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'commit' as const,
            message: 'Custom commit message'
          }
        };

        mockGit.commit.mockResolvedValue({ commit: 'def456' });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: commitStep as any
        });

        expect(mockGit.commit).toHaveBeenCalledWith('Custom commit message');
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'commit',
            git_mode: 'basic',
            workspace: '/workspace/path',
            message: 'Saved: Custom commit message',
            committed: true,
            version: 'abc1234',
            branch: 'main'
          }
        });
      });

      it('should handle branch operations', async () => {
        const branchStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'branch' as const,
            branch_name: 'feature-branch',
            create_new: true
          }
        };

        await gitOpsHandler.run({
          runId: 'run-123',
          step: branchStep as any
        });

        expect(mockGit.checkoutBranch).toHaveBeenCalledWith('feature-branch', 'HEAD');
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'branch',
            git_mode: 'basic',
            workspace: '/workspace/path',
            message: 'Created and switched to branch: feature-branch'
          }
        });
      });

      it('should list branches when no branch name provided', async () => {
        const branchStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'branch' as const }
        };

        mockGit.branch.mockResolvedValue({
          current: 'main',
          all: ['main', 'feature-branch']
        });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: branchStep as any
        });

        expect(mockGit.branch).toHaveBeenCalled();
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'branch',
            git_mode: 'basic',
            workspace: '/workspace/path',
            current: 'main',
            branches: ['main', 'feature-branch'],
            message: 'On branch: main'
          }
        });
      });

      it('should execute push operation', async () => {
        const pushStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'push' as const }
        };

        await gitOpsHandler.run({
          runId: 'run-123',
          step: pushStep as any
        });

        expect(mockGit.push).toHaveBeenCalled();
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'push',
            git_mode: 'basic',
            workspace: '/workspace/path',
            message: 'Changes uploaded to remote'
          }
        });
      });

      it('should detect changes in pull operation', async () => {
        const pullStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'pull' as const }
        };

        // Mock before and after log to show changes
        mockGit.log
          .mockResolvedValueOnce({ latest: { hash: 'abc123' }, total: 5 })
          .mockResolvedValueOnce({ latest: { hash: 'def456' }, total: 7 });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: pullStep as any
        });

        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'pull',
            git_mode: 'basic',
            workspace: '/workspace/path',
            message: 'Updated from remote',
            updated: true,
            newCommits: 2
          }
        });
      });
    });

    describe('advanced mode operations', () => {
      beforeEach(() => {
        mockGetProject.mockResolvedValue({
          id: 'project-456',
          name: 'Test Project',
          git_mode: 'advanced'
        } as any);
      });

      it('should execute commit with specific files', async () => {
        const commitStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'commit' as const,
            message: 'Advanced commit',
            files: ['src/file1.ts', 'src/file2.ts']
          }
        };

        mockGit.commit.mockResolvedValue({
          commit: 'abc123',
          branch: 'main',
          summary: { changes: 2, insertions: 10, deletions: 5 }
        });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: commitStep as any
        });

        expect(mockGit.add).toHaveBeenCalledWith(['src/file1.ts', 'src/file2.ts']);
        expect(mockGit.commit).toHaveBeenCalledWith('Advanced commit', undefined);
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'commit',
            git_mode: 'advanced',
            workspace: '/workspace/path',
            commit: 'abc123',
            branch: 'main',
            summary: { changes: 2, insertions: 10, deletions: 5 }
          }
        });
      });

      it('should require commit message in advanced mode', async () => {
        const commitStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'commit' as const
            // No message provided
          }
        };

        await gitOpsHandler.run({
          runId: 'run-123',
          step: commitStep as any
        });

        // Should have updated step to failed
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            error: expect.stringContaining('Commit message is required in advanced mode')
          })
        });
      });

      it('should execute advanced push with options', async () => {
        const pushStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'push' as const,
            remote: 'upstream',
            branch_name: 'feature-branch',
            options: { force: true }
          }
        };

        mockGit.push.mockResolvedValue({ pushed: ['feature-branch'] });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: pushStep as any
        });

        expect(mockGit.push).toHaveBeenCalledWith('upstream', 'feature-branch', { force: true });
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'push',
            git_mode: 'advanced',
            workspace: '/workspace/path',
            pushed: true,
            remote: 'upstream',
            branch: 'feature-branch',
            result: { pushed: ['feature-branch'] }
          }
        });
      });

      it('should execute merge operation', async () => {
        const mergeStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'merge' as const,
            branch_name: 'feature-branch'
          }
        };

        mockGit.merge.mockResolvedValue({
          merges: ['file1.txt'],
          conflicts: [],
          summary: { changes: 1 }
        });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: mergeStep as any
        });

        expect(mockGit.merge).toHaveBeenCalledWith(['feature-branch']);
        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'merge',
            git_mode: 'advanced',
            workspace: '/workspace/path',
            merged: true,
            conflicts: false,
            result: {
              merges: ['file1.txt'],
              conflicts: [],
              summary: { changes: 1 }
            }
          }
        });
      });

      it('should handle merge conflicts', async () => {
        const mergeStep = {
          ...baseStep,
          inputs: {
            ...baseStep.inputs,
            operation: 'merge' as const,
            branch_name: 'feature-branch'
          }
        };

        mockGit.merge.mockResolvedValue({
          merges: [],
          conflicts: ['file1.txt'],
          summary: { conflicts: 1 }
        });

        await gitOpsHandler.run({
          runId: 'run-123',
          step: mergeStep as any
        });

        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'merge',
            git_mode: 'advanced',
            workspace: '/workspace/path',
            merged: false,
            conflicts: true,
            result: {
              merges: [],
              conflicts: ['file1.txt'],
              summary: { conflicts: 1 }
            }
          }
        });
      });

      it('should return full status in advanced mode', async () => {
        const statusStep = {
          ...baseStep,
          inputs: { ...baseStep.inputs, operation: 'status' as const }
        };

        const fullStatus = {
          current: 'main',
          tracking: 'origin/main',
          ahead: 2,
          behind: 1,
          files: [{ path: 'test.txt', working_dir: 'M' }]
        };

        mockGit.status.mockResolvedValue(fullStatus);

        await gitOpsHandler.run({
          runId: 'run-123',
          step: statusStep as any
        });

        expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: {
            operation: 'status',
            git_mode: 'advanced',
            workspace: '/workspace/path',
            ...fullStatus
          }
        });
      });
    });

    it('should handle git errors properly', async () => {
      mockGit.status.mockRejectedValue(new Error('Git repository not found'));

      await gitOpsHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should record failure
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          error: 'Git repository not found',
          operation: 'save',
          project_id: 'project-456'
        }
      });
    });
  });
});