/**
 * Comprehensive tests for BasicModeService
 * Target coverage: 100%
 */

import { jest } from '@jest/globals';
import { BasicModeService } from '../../../src/worker/handlers/git_ops/BasicModeService';
import { AdvancedModeService } from '../../../src/worker/handlers/git_ops/AdvancedModeService';
import { GitOpsInputs } from '../../../src/worker/handlers/git_ops/GitValidationService';
import { SimpleGit } from 'simple-git';

// Mock logger
jest.mock('../../../src/lib/logger', () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

import { log } from '../../../src/lib/logger';

describe('BasicModeService', () => {
  let service: BasicModeService;
  let mockGit: jest.Mocked<SimpleGit>;
  let mockAdvancedService: jest.Mocked<AdvancedModeService>;

  beforeEach(() => {
    // Create mock git instance
    mockGit = {
      status: jest.fn(),
      add: jest.fn(),
      commit: jest.fn(),
      log: jest.fn(),
      branch: jest.fn(),
      checkout: jest.fn(),
      checkoutBranch: jest.fn(),
      pull: jest.fn(),
      push: jest.fn(),
      reset: jest.fn()
    } as any;

    // Create mock advanced service
    mockAdvancedService = {
      executeOperation: jest.fn()
    } as any;

    service = new BasicModeService(mockAdvancedService);
  });

  describe('handleCommit', () => {
    it('should return early when repository is clean', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'commit',
        message: 'test commit'
      };

      mockGit.status.mockResolvedValue({
        isClean: () => true,
        files: [],
        current: 'main'
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(result.message).toBe('No changes to commit');
      expect(result.committed).toBe(false);
      expect(mockGit.add).not.toHaveBeenCalled();
      expect(mockGit.commit).not.toHaveBeenCalled();
    });

    it('should commit with custom message', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'commit',
        message: 'custom commit message'
      };

      mockGit.status.mockResolvedValue({
        isClean: () => false,
        files: [{ path: 'test.txt' }],
        current: 'main'
      } as any);

      mockGit.log.mockResolvedValue({
        latest: { hash: 'abc1234567890', message: 'test' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.add).toHaveBeenCalledWith('.');
      expect(mockGit.commit).toHaveBeenCalledWith('custom commit message');
      expect(result.message).toBe('Saved: custom commit message');
      expect(result.committed).toBe(true);
      expect(result.version).toBe('abc1234');
      expect(result.branch).toBe('main');
    });

    it('should commit with auto-generated message when no message provided', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'save'
        // No message
      };

      mockGit.status.mockResolvedValue({
        isClean: () => false,
        files: [{ path: 'test.txt' }],
        current: 'feature-branch'
      } as any);

      mockGit.log.mockResolvedValue({
        latest: { hash: 'def4567890123', message: 'test' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.commit).toHaveBeenCalledWith(
        expect.stringMatching(/^Save progress:/)
      );
      expect(result.committed).toBe(true);
      expect(result.branch).toBe('feature-branch');
    });
  });

  describe('handleBranch', () => {
    it('should list branches when no branch name provided', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch'
      };

      mockGit.branch.mockResolvedValue({
        current: 'main',
        all: ['main', 'develop', 'feature/test']
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(result.current).toBe('main');
      expect(result.branches).toEqual(['main', 'develop', 'feature/test']);
      expect(result.message).toBe('On branch: main');
    });

    it('should reject invalid branch names with path traversal', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch',
        branch_name: '../../../etc/passwd'
      };

      await expect(service.executeOperation(mockGit, inputs, {}))
        .rejects.toThrow('Invalid branch name');
    });

    it('should reject branch names with invalid characters', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch',
        branch_name: 'feature/$invalid'
      };

      await expect(service.executeOperation(mockGit, inputs, {}))
        .rejects.toThrow('Invalid branch name');
    });

    it('should accept valid branch names with slashes', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch',
        branch_name: 'feature/valid-branch',
        create_new: false
      };

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.checkout).toHaveBeenCalledWith('feature/valid-branch');
      expect(result.message).toBe('Switched to branch: feature/valid-branch');
    });

    it('should create new branch when create_new is true', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch',
        branch_name: 'new-feature',
        create_new: true
      };

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.checkoutBranch).toHaveBeenCalledWith('new-feature', 'HEAD');
      expect(result.message).toBe('Created and switched to branch: new-feature');
    });

    it('should switch to existing branch when create_new is false', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch',
        branch_name: 'existing-branch',
        create_new: false
      };

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.checkout).toHaveBeenCalledWith('existing-branch');
      expect(result.message).toBe('Switched to branch: existing-branch');
    });
  });

  describe('handlePull', () => {
    it('should detect when already up to date', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'pull'
      };

      const sameHash = 'abc123456';
      mockGit.log
        .mockResolvedValueOnce({ latest: { hash: sameHash } } as any)
        .mockResolvedValueOnce({ latest: { hash: sameHash } } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.pull).toHaveBeenCalled();
      expect(result.message).toBe('Already up to date');
      expect(result.updated).toBeUndefined();
    });

    it('should detect updates from remote', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'sync' // Also tests 'sync' alias
      };

      mockGit.log
        .mockResolvedValueOnce({
          latest: { hash: 'abc123' },
          total: 5
        } as any)
        .mockResolvedValueOnce({
          latest: { hash: 'def456' },
          total: 8
        } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.pull).toHaveBeenCalled();
      expect(result.message).toBe('Updated from remote');
      expect(result.updated).toBe(true);
      expect(result.newCommits).toBe(3);
    });
  });

  describe('handlePush', () => {
    it('should push to remote', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'push'
      };

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.push).toHaveBeenCalled();
      expect(result.message).toBe('Changes uploaded to remote');
    });
  });

  describe('handleRevert', () => {
    it('should revert to specific commit when commit_sha provided', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'revert',
        commit_sha: 'abc123456'
      };

      mockGit.log.mockResolvedValue({
        latest: { hash: 'abc123456789' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'abc123456']);
      expect(result.message).toBe('Reverted to previous version');
      expect(result.currentVersion).toBe('abc1234');
    });

    it('should revert one step back by default when steps_back is undefined', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'revert'
        // No commit_sha or steps_back (both undefined)
      };

      mockGit.log.mockResolvedValue({
        latest: { hash: 'def456789012' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~1']);
      expect(result.message).toBe('Reverted to previous version');
      expect(result.currentVersion).toBe('def4567');
    });

    it('should revert one step back when steps_back is 0', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'revert',
        steps_back: 0 // Falsy value that should become 1
      };

      mockGit.log.mockResolvedValue({
        latest: { hash: 'ghi789012345' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      // 0 should be treated as 1 (default)
      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~1']);
      expect(result.currentVersion).toBe('ghi7890');
    });

    it('should revert one step back when steps_back is null', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'revert',
        steps_back: null as any // Explicit null - should become 1
      };

      mockGit.log.mockResolvedValue({
        latest: { hash: 'jkl012345678' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      // null should be treated as 1 (default)
      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~1']);
      expect(result.currentVersion).toBe('jkl0123');
    });

    it('should revert multiple steps back when steps_back provided', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'revert',
        steps_back: 3
      };

      mockGit.log.mockResolvedValue({
        latest: { hash: 'ghi789012345' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'HEAD~3']);
      expect(result.message).toBe('Reverted to previous version');
      expect(result.currentVersion).toBe('ghi7890');
    });

    it('should prioritize commit_sha over steps_back', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'revert',
        commit_sha: 'specific123',
        steps_back: 5 // Should be ignored
      };

      mockGit.log.mockResolvedValue({
        latest: { hash: 'specific123456' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'specific123']);
      expect(result.currentVersion).toBe('specifi');
    });
  });

  describe('handleStatus', () => {
    it('should return complete status information', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'status'
      };

      mockGit.status.mockResolvedValue({
        isClean: () => false,
        files: [
          { path: 'file1.ts' },
          { path: 'file2.ts' },
          { path: 'file3.ts' }
        ],
        current: 'feature-branch',
        ahead: 2,
        behind: 1
      } as any);

      mockGit.log.mockResolvedValue({
        latest: { message: 'Last commit message' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(result.branch).toBe('feature-branch');
      expect(result.hasChanges).toBe(true);
      expect(result.filesChanged).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);
      expect(result.lastCommit).toBe('Last commit message');
      expect(result.ahead).toBe(2);
      expect(result.behind).toBe(1);
    });

    it('should handle clean repository', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'status'
      };

      mockGit.status.mockResolvedValue({
        isClean: () => true,
        files: [],
        current: 'main',
        ahead: 0,
        behind: 0
      } as any);

      mockGit.log.mockResolvedValue({
        latest: { message: 'Initial commit' }
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(result.hasChanges).toBe(false);
      expect(result.filesChanged).toEqual([]);
      expect(result.ahead).toBe(0);
      expect(result.behind).toBe(0);
    });
  });

  describe('executeOperation - fallback to advanced mode', () => {
    it('should delegate to advanced service for unknown operations', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'merge' as any, // Not a basic mode operation
        branch_name: 'feature-branch'
      };

      const project = { id: 'proj-123', name: 'Test Project' };

      mockAdvancedService.executeOperation.mockResolvedValue({
        merged: true,
        conflicts: false
      });

      const result = await service.executeOperation(mockGit, inputs, project);

      expect(log.warn).toHaveBeenCalledWith(
        { operation: 'merge' },
        'Advanced operation used in basic mode'
      );

      expect(mockAdvancedService.executeOperation).toHaveBeenCalledWith(
        mockGit,
        inputs,
        project
      );

      expect(result.merged).toBe(true);
    });

    it('should delegate checkout to advanced service', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'checkout',
        branch_name: 'feature'
      };

      mockAdvancedService.executeOperation.mockResolvedValue({
        branch: 'feature',
        isClean: true
      });

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockAdvancedService.executeOperation).toHaveBeenCalled();
      expect(result.branch).toBe('feature');
    });
  });

  describe('edge cases', () => {
    it('should handle git errors gracefully', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'push'
      };

      mockGit.push.mockRejectedValue(new Error('Authentication failed'));

      await expect(service.executeOperation(mockGit, inputs, {}))
        .rejects.toThrow('Authentication failed');
    });

    it('should handle missing log data', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'commit',
        message: 'test'
      };

      mockGit.status.mockResolvedValue({
        isClean: () => false,
        files: [{ path: 'test.txt' }],
        current: 'main'
      } as any);

      mockGit.log.mockResolvedValue({
        latest: undefined // No latest commit
      } as any);

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(result.version).toBeUndefined();
    });

    it('should handle branch with special characters in validation', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch',
        branch_name: 'feature/test-123_valid'
      };

      const result = await service.executeOperation(mockGit, inputs, {});

      expect(mockGit.checkout).toHaveBeenCalledWith('feature/test-123_valid');
    });

    it('should reject branch name with only dots', async () => {
      const inputs: GitOpsInputs = {
        project_id: 'proj-123',
        operation: 'branch',
        branch_name: '..'
      };

      await expect(service.executeOperation(mockGit, inputs, {}))
        .rejects.toThrow('Invalid branch name');
    });
  });
});
