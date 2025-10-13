/**
 * Enhanced WorkspaceManager Unit Tests
 *
 * Comprehensive test suite for WorkspaceManager enhancements including:
 * - Worktree mode operations
 * - Workspace isolation and sandboxing
 * - Git operations safety
 * - Enhanced status reporting by git_mode
 * - Complete workspace lifecycle management
 *
 * @module tests/unit/workspaces.enhanced
 */

import { WorkspaceManager } from '../../src/lib/workspaces';
import type { Project } from '../../src/lib/projects';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'node:fs/promises';

// Mock dependencies
jest.mock('simple-git');
jest.mock('node:fs/promises');
jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../../src/lib/projects', () => ({
  updateProject: jest.fn().mockResolvedValue(undefined),
  getProject: jest.fn().mockImplementation((id: string) =>
    Promise.resolve({
      id,
      name: 'Test Project',
      workspace_mode: 'clone',
      git_mode: 'basic',
      initialized: false,
    })
  ),
}));

describe('WorkspaceManager Enhanced Features', () => {
  let manager: WorkspaceManager;
  let mockGit: jest.Mocked<SimpleGit>;

  // Test fixtures
  const createMockProject = (
    workspaceMode: 'local_path' | 'clone' | 'worktree' = 'clone',
    overrides: Partial<Project> = {}
  ): Project => ({
    id: 'test-project',
    name: 'Test Project',
    repo_url: 'https://github.com/test/repo.git',
    workspace_mode: workspaceMode,
    local_path: workspaceMode === 'local_path' ? '/test/local/path' : undefined,
    default_branch: 'main',
    git_mode: 'basic',
    initialized: false,
    ...overrides,
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup fs mocks
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true });

    // Setup simple-git mock
    mockGit = {
      clone: jest.fn().mockResolvedValue(undefined),
      checkout: jest.fn().mockResolvedValue(undefined),
      pull: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue({ commit: 'abc123' }),
      push: jest.fn().mockResolvedValue(undefined),
      status: jest.fn().mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        files: [],
        isClean: () => true,
      }),
      revparse: jest.fn().mockResolvedValue('abc123def456'),
      raw: jest.fn().mockResolvedValue(''),
      branch: jest.fn().mockResolvedValue({
        all: ['main', 'feature-1'],
        current: 'main',
        branches: {
          main: { current: true, name: 'main', commit: 'abc123' },
        },
      }),
      checkIsRepo: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<SimpleGit>;

    (simpleGit as unknown as jest.Mock).mockReturnValue(mockGit);

    // Initialize WorkspaceManager
    manager = new WorkspaceManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Worktree Mode Tests', () => {
    describe('createWorktree', () => {
      it('should create a new worktree for a project', async () => {
        const project = createMockProject('worktree');
        const branchName = 'feature/test-branch';

        const result = await manager.createWorktree(project, branchName);

        expect(mockGit.raw).toHaveBeenCalledWith(
          expect.arrayContaining(['worktree', 'add'])
        );
        expect(result).toContain('worktrees');
        expect(result).toContain('feature-test-branch');
      });

      it('should throw error if main workspace does not exist', async () => {
        const project = createMockProject('worktree');
        const branchName = 'feature/test';

        (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

        await expect(
          manager.createWorktree(project, branchName)
        ).rejects.toThrow();
      });

      it('should sanitize branch names for filesystem', async () => {
        const project = createMockProject('worktree');
        const branchName = 'feature/complex/branch-name';

        const result = await manager.createWorktree(project, branchName);

        expect(result).not.toContain('../');
        expect(result).toContain('feature-complex-branch-name');
      });
    });

    describe('listWorktrees', () => {
      it('should list all worktrees for a project', async () => {
        const project = createMockProject('worktree');

        (fs.readdir as jest.Mock).mockResolvedValue([
          'feature-1',
          'feature-2',
          'bugfix-3',
        ]);

        const worktrees = await manager.listWorktrees(project);

        expect(worktrees).toHaveLength(3);
        expect(worktrees[0]).toContain('feature-1');
      });

      it('should return empty array if worktrees directory does not exist', async () => {
        const project = createMockProject('worktree');

        (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

        const worktrees = await manager.listWorktrees(project);

        expect(worktrees).toEqual([]);
      });
    });

    describe('pruneWorktrees', () => {
      it('should remove all worktrees for a project', async () => {
        const project = createMockProject('worktree');

        (fs.readdir as jest.Mock).mockResolvedValue(['feature-1', 'feature-2']);

        await manager.pruneWorktrees(project);

        expect(mockGit.raw).toHaveBeenCalledWith(
          expect.arrayContaining(['worktree', 'remove', expect.any(String), '--force'])
        );
        expect(fs.rm).toHaveBeenCalled();
      });

      it('should do nothing if worktrees directory does not exist', async () => {
        const project = createMockProject('worktree');

        (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

        await manager.pruneWorktrees(project);

        expect(mockGit.raw).not.toHaveBeenCalled();
        expect(fs.rm).not.toHaveBeenCalled();
      });
    });
  });

  describe('Workspace Isolation Tests', () => {
    describe('local_path mode', () => {
      it('should not create sandbox for local_path mode', async () => {
        const project = createMockProject('local_path', {
          local_path: '/existing/local/path',
        });

        await manager.ensureWorkspace(project);

        expect(mockGit.clone).not.toHaveBeenCalled();
      });

      it('should return local_path as workspace path', async () => {
        const localPath = '/existing/local/path';
        const project = createMockProject('local_path', { local_path: localPath });

        const workspacePath = manager.getWorkspacePath(project);

        expect(workspacePath).toBe(localPath);
      });
    });

    describe('clone mode', () => {
      it('should create isolated directory for clone mode', async () => {
        const project = createMockProject('clone');

        await manager.ensureWorkspace(project);

        expect(fs.mkdir).toHaveBeenCalled();
        expect(mockGit.clone).toHaveBeenCalled();
      });

      it('should prevent path traversal in project ID', async () => {
        const project = createMockProject('clone', {
          id: '../../../etc/passwd',
        });

        const workspacePath = manager.getWorkspacePath(project);

        expect(workspacePath).not.toContain('..');
      });
    });

    describe('worktree mode', () => {
      it('should create proper worktree structure', async () => {
        const project = createMockProject('worktree');

        await manager.ensureWorkspace(project);

        expect(fs.mkdir).toHaveBeenCalled();
        expect(mockGit.clone).toHaveBeenCalled();
      });
    });
  });

  describe('Git Operations Safety Tests', () => {
    describe('commit operations', () => {
      it('should respect git_mode when committing', async () => {
        const project = createMockProject('clone', {
          git_mode: 'basic',
        });

        mockGit.status = jest.fn().mockResolvedValue({
          current: 'main',
          files: [{ path: 'test.txt' }],
          isClean: () => false,
        });

        await manager.autoCommit(project, 'Test commit');

        expect(mockGit.add).toHaveBeenCalledWith('.');
        expect(mockGit.commit).toHaveBeenCalled();
      });

      it('should generate appropriate commit message based on git_mode', async () => {
        const project = createMockProject('clone', {
          git_mode: 'hidden',
        });

        mockGit.status = jest.fn().mockResolvedValue({
          current: 'main',
          files: [{ path: 'test.txt' }],
          isClean: () => false,
        });

        await manager.autoCommit(project);

        expect(mockGit.commit).toHaveBeenCalledWith(
          expect.stringContaining(project.name)
        );
      });
    });

    describe('error handling', () => {
      it('should handle network failures during clone', async () => {
        const project = createMockProject('clone');

        mockGit.clone = jest.fn().mockRejectedValue(
          new Error('Network error: Could not resolve host')
        );

        await expect(
          manager.ensureWorkspace(project)
        ).rejects.toThrow();
      });

      it('should handle permission errors', async () => {
        const project = createMockProject('clone');

        (fs.mkdir as jest.Mock).mockRejectedValue(
          new Error('EACCES: permission denied')
        );

        await expect(
          manager.ensureWorkspace(project)
        ).rejects.toThrow();
      });
    });
  });

  describe('Enhanced Status Tests', () => {
    describe('basic mode', () => {
      it('should return user-friendly status in basic mode', async () => {
        const project = createMockProject('clone', {
          git_mode: 'basic',
        });

        mockGit.status = jest.fn().mockResolvedValue({
          current: 'main',
          tracking: 'origin/main',
          ahead: 0,
          behind: 0,
          files: [],
          isClean: () => true,
        });

        const status = await manager.getStatus(project);

        expect(status).toHaveProperty('branch', 'main');
        expect(status).toHaveProperty('hasChanges', false);
      });

      it('should indicate dirty workspace in basic mode', async () => {
        const project = createMockProject('clone', {
          git_mode: 'basic',
        });

        mockGit.status = jest.fn().mockResolvedValue({
          current: 'main',
          files: [{ path: 'test.txt' }],
          isClean: () => false,
        });

        const status = await manager.getStatus(project);

        expect(status).toHaveProperty('hasChanges', true);
      });
    });

    describe('advanced mode', () => {
      it('should return full git status in advanced mode', async () => {
        const project = createMockProject('clone', {
          git_mode: 'advanced',
        });

        const mockStatus = {
          current: 'feature-branch',
          tracking: 'origin/feature-branch',
          ahead: 2,
          behind: 1,
          files: [
            { path: 'modified.txt', index: 'M', working_dir: ' ' },
            { path: 'new.txt', index: 'A', working_dir: ' ' },
          ],
          isClean: () => false,
        };

        mockGit.status = jest.fn().mockResolvedValue(mockStatus);

        const status = await manager.getStatus(project);

        expect(status).toHaveProperty('current', 'feature-branch');
        expect(status).toHaveProperty('ahead', 2);
        expect(status).toHaveProperty('behind', 1);
        expect(status).toHaveProperty('files');
        expect((status as { files: unknown[] }).files).toHaveLength(2);
      });
    });
  });

  describe('Workspace Lifecycle Tests', () => {
    describe('initialization', () => {
      it('should initialize clone workspace', async () => {
        const project = createMockProject('clone');

        await manager.ensureWorkspace(project);

        expect(fs.mkdir).toHaveBeenCalled();
        expect(mockGit.clone).toHaveBeenCalled();
      });

      it('should skip initialization if workspace exists', async () => {
        const project = createMockProject('clone', { initialized: true });

        mockGit.checkIsRepo = jest.fn().mockResolvedValue(true);

        await manager.ensureWorkspace(project);

        expect(mockGit.clone).not.toHaveBeenCalled();
      });
    });

    describe('synchronization', () => {
      it('should pull latest changes in clone mode', async () => {
        const project = createMockProject('clone', { initialized: true });

        mockGit.checkIsRepo = jest.fn().mockResolvedValue(true);
        mockGit.status = jest.fn().mockResolvedValue({
          isClean: () => true,
        });

        await manager.syncWorkspace(project);

        expect(mockGit.pull).toHaveBeenCalled();
      });

      it('should handle merge conflicts during sync', async () => {
        const project = createMockProject('clone', { initialized: true });

        mockGit.checkIsRepo = jest.fn().mockResolvedValue(true);
        mockGit.status = jest.fn().mockResolvedValue({
          isClean: () => true,
        });
        mockGit.pull = jest.fn().mockRejectedValue(
          new Error('CONFLICT: Merge conflict')
        );

        await expect(
          manager.syncWorkspace(project)
        ).rejects.toThrow();
      });
    });

    describe('cleanup', () => {
      it('should not cleanup local_path workspace', async () => {
        const project = createMockProject('local_path', {
          local_path: '/test/path',
        });

        await manager.cleanupWorkspace(project);

        expect(fs.rm).not.toHaveBeenCalled();
      });

      it('should cleanup clone workspace', async () => {
        const project = createMockProject('clone');

        await manager.cleanupWorkspace(project);

        expect(fs.rm).toHaveBeenCalled();
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete worktree workflow', async () => {
      const project = createMockProject('worktree');

      // Initialize
      await manager.ensureWorkspace(project);

      // Create worktree
      await manager.createWorktree(project, 'feature-1');

      // List worktrees
      (fs.readdir as jest.Mock).mockResolvedValue(['feature-1']);
      const worktrees = await manager.listWorktrees(project);
      expect(worktrees).toHaveLength(1);

      // Prune worktrees
      await manager.pruneWorktrees(project);

      expect(mockGit.raw).toHaveBeenCalledWith(
        expect.arrayContaining(['worktree', 'remove'])
      );
    });
  });
});
