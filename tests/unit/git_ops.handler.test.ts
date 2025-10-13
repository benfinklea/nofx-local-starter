import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import gitOpsHandler from '../../src/worker/handlers/git_ops';
import { store } from '../../src/lib/store';
import type { StepRow } from '../../src/lib/store/types';
import { getProject, createProject } from '../../src/lib/projects';
import { workspaceManager } from '../../src/lib/workspaces';
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';

// Mock dependencies
jest.mock('../../src/lib/store');
jest.mock('../../src/lib/events');

// Type the mocked store
const mockStore = store as jest.Mocked<typeof store>;

describe('git_ops handler', () => {
  const testWorkspaceRoot = path.join(process.cwd(), 'test_git_ops_workspaces');
  const originalEnv = process.env.WORKSPACE_ROOT;

  let testProject: any;

  beforeEach(async () => {
    // Set test workspace root
    process.env.WORKSPACE_ROOT = testWorkspaceRoot;

    // Create test project
    testProject = {
      id: 'test_git_project',
      name: 'Test Git Project',
      workspace_mode: 'clone',
      git_mode: 'hidden',
      initialized: false
    };

    // Mock store methods
    mockStore.updateStep.mockResolvedValue(undefined);

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

    jest.clearAllMocks();
  });

  describe('match', () => {
    it('should match git_ops tool', () => {
      expect(gitOpsHandler.match('git_ops')).toBe(true);
      expect(gitOpsHandler.match('other')).toBe(false);
    });
  });

  describe('hidden mode operations', () => {
    it('should handle save operation in hidden mode', async () => {
      // Initialize project first
      await workspaceManager.initializeRepo(testProject);
      testProject.initialized = true;

      // Create a change to save
      const workspacePath = workspaceManager.getWorkspacePath(testProject);
      await fsp.writeFile(path.join(workspacePath, 'new_file.txt'), 'New content');

      // Mock getProject to return our test project
      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(testProject);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Save Progress',
          tool: 'git_ops',
          inputs: {
            project_id: testProject.id,
            operation: 'save'
          }
        }
      };

      await gitOpsHandler.run(context as any);

      // Verify store was updated with success
      expect(mockStore.updateStep).toHaveBeenCalledWith(
        'test_step',
        expect.objectContaining({ status: 'succeeded' })
      );
    });

    it('should handle status operation in hidden mode', async () => {
      await workspaceManager.initializeRepo(testProject);
      testProject.initialized = true;

      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(testProject);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Check Status',
          tool: 'git_ops',
          inputs: {
            project_id: testProject.id,
            operation: 'status'
          }
        }
      };

      await gitOpsHandler.run(context as any);

      // Verify store was updated with simplified status
      const updateCall = mockStore.updateStep.mock.calls.find(
        call => (call[1] as Partial<StepRow>)?.status === 'succeeded'
      );

      expect(updateCall).toBeDefined();
      const outputs = (updateCall?.[1] as Partial<StepRow>)?.outputs as Record<string, any>;
      expect(outputs).toHaveProperty('hasChanges');
      expect(outputs).toHaveProperty('filesChanged');
    });
  });

  describe('basic mode operations', () => {
    beforeEach(() => {
      testProject.git_mode = 'basic';
    });

    it('should handle commit with custom message in basic mode', async () => {
      await workspaceManager.initializeRepo(testProject);
      testProject.initialized = true;

      // Create a change
      const workspacePath = workspaceManager.getWorkspacePath(testProject);
      await fsp.writeFile(path.join(workspacePath, 'feature.js'), 'console.log("feature");');

      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(testProject);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Save Feature',
          tool: 'git_ops',
          inputs: {
            project_id: testProject.id,
            operation: 'commit',
            message: 'Added new feature'
          }
        }
      };

      await gitOpsHandler.run(context as any);

      const updateCall = mockStore.updateStep.mock.calls.find(
        call => (call[1] as Partial<StepRow>)?.status === 'succeeded'
      );

      expect(updateCall).toBeDefined();
      const outputs = (updateCall?.[1] as Partial<StepRow>)?.outputs as Record<string, any>;
      expect(outputs?.message).toContain('Added new feature');
      expect(outputs?.committed).toBe(true);
    });

    it('should handle branch creation in basic mode', async () => {
      await workspaceManager.initializeRepo(testProject);
      testProject.initialized = true;

      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(testProject);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Create Branch',
          tool: 'git_ops',
          inputs: {
            project_id: testProject.id,
            operation: 'branch',
            branch_name: 'feature/test',
            create_new: true
          }
        }
      };

      await gitOpsHandler.run(context as any);

      const updateCall = mockStore.updateStep.mock.calls.find(
        call => (call[1] as Partial<StepRow>)?.status === 'succeeded'
      );

      expect(updateCall).toBeDefined();
      const outputs = (updateCall?.[1] as Partial<StepRow>)?.outputs as Record<string, any>;
      expect(outputs?.message).toContain('Created and switched to branch: feature/test');
    });
  });

  describe('advanced mode operations', () => {
    beforeEach(() => {
      testProject.git_mode = 'advanced';
    });

    it('should handle selective file commits in advanced mode', async () => {
      await workspaceManager.initializeRepo(testProject);
      testProject.initialized = true;

      const workspacePath = workspaceManager.getWorkspacePath(testProject);
      await fsp.writeFile(path.join(workspacePath, 'file1.js'), 'content1');
      await fsp.writeFile(path.join(workspacePath, 'file2.js'), 'content2');

      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(testProject);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Selective Commit',
          tool: 'git_ops',
          inputs: {
            project_id: testProject.id,
            operation: 'commit',
            message: 'feat: add file1 only',
            files: ['file1.js']
          }
        }
      };

      await gitOpsHandler.run(context as any);

      const updateCall = mockStore.updateStep.mock.calls.find(
        call => (call[1] as Partial<StepRow>)?.status === 'succeeded'
      );

      expect(updateCall).toBeDefined();
      const outputs = (updateCall?.[1] as Partial<StepRow>)?.outputs as Record<string, any>;
      expect(outputs?.commit).toBeDefined();
    });

    it('should return full git status in advanced mode', async () => {
      await workspaceManager.initializeRepo(testProject);
      testProject.initialized = true;

      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(testProject);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Full Status',
          tool: 'git_ops',
          inputs: {
            project_id: testProject.id,
            operation: 'status'
          }
        }
      };

      await gitOpsHandler.run(context as any);

      const updateCall = mockStore.updateStep.mock.calls.find(
        call => (call[1] as Partial<StepRow>)?.status === 'succeeded'
      );

      expect(updateCall).toBeDefined();
      const outputs = (updateCall?.[1] as Partial<StepRow>)?.outputs as Record<string, any>;
      // Advanced mode returns full git status
      expect(outputs).toHaveProperty('current');
      expect(outputs).toHaveProperty('files');
      expect(outputs).toHaveProperty('ahead');
      expect(outputs).toHaveProperty('behind');
    });
  });

  describe('error handling', () => {
    it('should fail when project_id is missing', async () => {
      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Missing Project',
          tool: 'git_ops',
          inputs: {
            operation: 'save'
          }
        }
      };

      await gitOpsHandler.run(context as any);

      expect(mockStore.updateStep).toHaveBeenCalledWith(
        'test_step',
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('should fail when operation is missing', async () => {
      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(testProject);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Missing Operation',
          tool: 'git_ops',
          inputs: {
            project_id: testProject.id
          }
        }
      };

      await gitOpsHandler.run(context as any);

      expect(mockStore.updateStep).toHaveBeenCalledWith(
        'test_step',
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('should fail when project does not exist', async () => {
      jest.spyOn(require('../../src/lib/projects'), 'getProject').mockResolvedValue(undefined);

      const context = {
        runId: 'test_run',
        step: {
          id: 'test_step',
          name: 'Nonexistent Project',
          tool: 'git_ops',
          inputs: {
            project_id: 'nonexistent',
            operation: 'save'
          }
        }
      };

      await gitOpsHandler.run(context as any);

      const updateCall = mockStore.updateStep.mock.calls.find(
        call => (call[1] as Partial<StepRow>)?.status === 'failed'
      );

      expect(updateCall).toBeDefined();
      const outputs = (updateCall?.[1] as Partial<StepRow>)?.outputs as Record<string, any>;
      expect(outputs?.error).toContain('Project nonexistent not found');
    });
  });
});