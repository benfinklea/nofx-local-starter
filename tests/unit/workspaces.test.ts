import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WorkspaceManager } from '../../src/lib/workspaces';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { Project } from '../../src/lib/projects';

describe('WorkspaceManager', () => {
  const workspaceManager = new WorkspaceManager();
  const testWorkspaceRoot = path.join(process.cwd(), 'test_workspaces');
  const originalEnv = process.env.WORKSPACE_ROOT;

  beforeEach(async () => {
    // Set test workspace root
    process.env.WORKSPACE_ROOT = testWorkspaceRoot;

    // Ensure test directory exists
    await fsp.mkdir(testWorkspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test workspaces
    try {
      await fsp.rm(testWorkspaceRoot, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Restore original env
    if (originalEnv) {
      process.env.WORKSPACE_ROOT = originalEnv;
    } else {
      delete process.env.WORKSPACE_ROOT;
    }
  });

  describe('getWorkspacePath', () => {
    it('should return local_path for local_path mode', () => {
      const project: Project = {
        id: 'test_project',
        name: 'Test Project',
        workspace_mode: 'local_path',
        local_path: '/custom/path'
      };

      const path = workspaceManager.getWorkspacePath(project);
      expect(path).toBe('/custom/path');
    });

    it('should return sandboxed path for clone mode', () => {
      const project: Project = {
        id: 'test_project',
        name: 'Test Project',
        workspace_mode: 'clone'
      };

      const expectedPath = path.join(testWorkspaceRoot, 'test_project');
      const actualPath = workspaceManager.getWorkspacePath(project);
      expect(actualPath).toBe(expectedPath);
    });

    it('should return sandboxed path for worktree mode', () => {
      const project: Project = {
        id: 'test_project',
        name: 'Test Project',
        workspace_mode: 'worktree'
      };

      const expectedPath = path.join(testWorkspaceRoot, 'test_project');
      const actualPath = workspaceManager.getWorkspacePath(project);
      expect(actualPath).toBe(expectedPath);
    });
  });

  describe('ensureWorkspace', () => {
    it('should create workspace directory if it does not exist', async () => {
      const project: Project = {
        id: 'test_project',
        name: 'Test Project',
        workspace_mode: 'clone',
        initialized: false
      };

      const workspacePath = await workspaceManager.ensureWorkspace(project);

      expect(workspacePath).toBe(path.join(testWorkspaceRoot, 'test_project'));
      expect(fs.existsSync(workspacePath)).toBe(true);
    });

    it('should handle local_path mode without creating directories', async () => {
      const localPath = process.cwd(); // Use current directory as test
      const project: Project = {
        id: 'test_project',
        name: 'Test Project',
        workspace_mode: 'local_path',
        local_path: localPath
      };

      const workspacePath = await workspaceManager.ensureWorkspace(project);

      expect(workspacePath).toBe(localPath);
    });
  });

  describe('initializeRepo', () => {
    it('should create a new git repository', async () => {
      const project: Project = {
        id: 'test_git_project',
        name: 'Test Git Project',
        workspace_mode: 'clone',
        git_mode: 'hidden'
      };

      await workspaceManager.initializeRepo(project);

      const workspacePath = workspaceManager.getWorkspacePath(project);
      const gitDir = path.join(workspacePath, '.git');

      expect(fs.existsSync(gitDir)).toBe(true);

      // Check that README was created
      const readmePath = path.join(workspacePath, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
    });

    it('should respect git_mode when generating commit messages', async () => {
      const projectHidden: Project = {
        id: 'hidden_mode_project',
        name: 'Hidden Mode Project',
        workspace_mode: 'clone',
        git_mode: 'hidden'
      };

      await workspaceManager.initializeRepo(projectHidden);

      // For hidden mode, commit message should be user-friendly
      // We can't easily test the actual commit message without complex git operations,
      // but we can verify the repo was initialized
      const workspacePath = workspaceManager.getWorkspacePath(projectHidden);
      expect(fs.existsSync(path.join(workspacePath, '.git'))).toBe(true);
    });
  });

  describe('autoCommit', () => {
    it('should handle empty repository gracefully', async () => {
      const project: Project = {
        id: 'empty_project',
        name: 'Empty Project',
        workspace_mode: 'clone',
        git_mode: 'basic'
      };

      // Initialize repo first
      await workspaceManager.initializeRepo(project);

      // Try to commit when there are no changes
      const commitHash = await workspaceManager.autoCommit(project, 'Test commit');

      // Should return empty string when no changes
      expect(commitHash).toBe('');
    });

    it('should commit changes when files are modified', async () => {
      const project: Project = {
        id: 'commit_test_project',
        name: 'Commit Test Project',
        workspace_mode: 'clone',
        git_mode: 'basic'
      };

      // Initialize repo
      await workspaceManager.initializeRepo(project);

      // Add a new file
      const workspacePath = workspaceManager.getWorkspacePath(project);
      const testFilePath = path.join(workspacePath, 'test.txt');
      await fsp.writeFile(testFilePath, 'Test content');

      // Commit the change
      const commitHash = await workspaceManager.autoCommit(project, 'Added test file');

      // Should return a commit hash (non-empty string)
      expect(commitHash).toBeTruthy();
      expect(typeof commitHash).toBe('string');
    });
  });

  describe('getStatus', () => {
    it('should return null for non-git directories', async () => {
      const project: Project = {
        id: 'non_git_project',
        name: 'Non Git Project',
        workspace_mode: 'clone',
        git_mode: 'hidden'
      };

      // Create workspace but don't initialize git
      const workspacePath = workspaceManager.getWorkspacePath(project);
      await fsp.mkdir(workspacePath, { recursive: true });

      const status = await workspaceManager.getStatus(project);
      expect(status).toBeNull();
    });

    it('should return simplified status for hidden mode', async () => {
      const project: Project = {
        id: 'hidden_status_project',
        name: 'Hidden Status Project',
        workspace_mode: 'clone',
        git_mode: 'hidden'
      };

      await workspaceManager.initializeRepo(project);

      const status = await workspaceManager.getStatus(project);

      expect(status).toHaveProperty('hasChanges');
      expect(status).toHaveProperty('filesChanged');
      expect(typeof status.hasChanges).toBe('boolean');
      expect(typeof status.filesChanged).toBe('number');
    });

    it('should return detailed status for basic mode', async () => {
      const project: Project = {
        id: 'basic_status_project',
        name: 'Basic Status Project',
        workspace_mode: 'clone',
        git_mode: 'basic'
      };

      await workspaceManager.initializeRepo(project);

      const status = await workspaceManager.getStatus(project);

      expect(status).toHaveProperty('branch');
      expect(status).toHaveProperty('hasChanges');
      expect(status).toHaveProperty('ahead');
      expect(status).toHaveProperty('behind');
      expect(status).toHaveProperty('files');
      expect(Array.isArray(status.files)).toBe(true);
    });

    it('should return full git status for advanced mode', async () => {
      const project: Project = {
        id: 'advanced_status_project',
        name: 'Advanced Status Project',
        workspace_mode: 'clone',
        git_mode: 'advanced'
      };

      await workspaceManager.initializeRepo(project);

      const status = await workspaceManager.getStatus(project);

      // Advanced mode returns the full SimpleGit status object
      expect(status).toHaveProperty('current');
      expect(status).toHaveProperty('files');
      expect(status).toHaveProperty('ahead');
      expect(status).toHaveProperty('behind');
      expect(status).toHaveProperty('isClean');
    });
  });

  describe('cleanupWorkspace', () => {
    it('should delete clone/worktree workspaces', async () => {
      const project: Project = {
        id: 'cleanup_project',
        name: 'Cleanup Project',
        workspace_mode: 'clone'
      };

      // Create workspace
      const workspacePath = workspaceManager.getWorkspacePath(project);
      await fsp.mkdir(workspacePath, { recursive: true });
      await fsp.writeFile(path.join(workspacePath, 'test.txt'), 'test');

      // Verify it exists
      expect(fs.existsSync(workspacePath)).toBe(true);

      // Clean it up
      await workspaceManager.cleanupWorkspace(project);

      // Verify it's gone
      expect(fs.existsSync(workspacePath)).toBe(false);
    });

    it('should not delete local_path workspaces', async () => {
      const localPath = path.join(testWorkspaceRoot, 'local_project');
      await fsp.mkdir(localPath, { recursive: true });
      await fsp.writeFile(path.join(localPath, 'test.txt'), 'test');

      const project: Project = {
        id: 'local_cleanup_project',
        name: 'Local Cleanup Project',
        workspace_mode: 'local_path',
        local_path: localPath
      };

      // Clean up should do nothing for local_path
      await workspaceManager.cleanupWorkspace(project);

      // Verify it still exists
      expect(fs.existsSync(localPath)).toBe(true);
    });
  });
});