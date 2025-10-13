/**
 * Tests for project_init handler
 * Provides coverage for project initialization workflow
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
    getWorkspacePath: jest.fn(),
    ensureWorkspace: jest.fn(),
    autoCommit: jest.fn(),
    getStatus: jest.fn()
  }
}));

jest.mock('../../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

// Mock fs promises for template creation
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(() => Promise.resolve()),
    writeFile: jest.fn(() => Promise.resolve())
  }
}));

import projectInitHandler from '../../../src/worker/handlers/project_init';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { getProject } from '../../../src/lib/projects';
import { workspaceManager } from '../../../src/lib/workspaces';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);
const mockGetProject = jest.mocked(getProject);
const mockWorkspaceManager = jest.mocked(workspaceManager);

describe('project_init handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
  });

  describe('match', () => {
    it('should match project_init tool', () => {
      expect(projectInitHandler.match('project_init')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(projectInitHandler.match('bash')).toBe(false);
      expect(projectInitHandler.match('project_init_other')).toBe(false);
      expect(projectInitHandler.match('init')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'init-project',
      tool: 'project_init',
      inputs: {
        project_id: 'project-456'
      }
    };

    it('should fail when project_id is missing', async () => {
      const stepMissingProject = {
        ...baseStep,
        inputs: {}
      };

      await projectInitHandler.run({
        runId: 'run-123',
        step: stepMissingProject as any
      });

      // Should update step to running first
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(1, 'step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should record start event
      expect(mockRecordEvent).toHaveBeenNthCalledWith(1,
        'run-123',
        'step.started',
        { name: 'init-project', tool: 'project_init' },
        'step-123'
      );

      // Should update step to failed
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(2, 'step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          error: 'project_id is required',
          project_id: undefined
        }
      });

      // Should record failure event
      expect(mockRecordEvent).toHaveBeenNthCalledWith(2,
        'run-123',
        'step.failed',
        { outputs: { error: 'project_id is required', project_id: undefined }, error: 'project_id is required' },
        'step-123'
      );
    });

    it('should fail when project is not found', async () => {
      mockGetProject.mockResolvedValue(null);

      await projectInitHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      expect(mockGetProject).toHaveBeenCalledWith('project-456');

      // Should update step to running first
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(1, 'step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should update step to failed
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(2, 'step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          error: 'Project project-456 not found',
          project_id: 'project-456'
        }
      });

      // Should record failure event
      expect(mockRecordEvent).toHaveBeenNthCalledWith(2,
        'run-123',
        'step.failed',
        { outputs: { error: 'Project project-456 not found', project_id: 'project-456' }, error: 'Project project-456 not found' },
        'step-123'
      );
    });

    it('should skip initialization when project already initialized', async () => {
      const initializedProject = {
        id: 'project-456',
        name: 'Test Project',
        initialized: true
      };

      mockGetProject.mockResolvedValue(initializedProject as any);
      mockWorkspaceManager.getWorkspacePath.mockReturnValue('/workspace/path');

      await projectInitHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should update step to running first
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(1, 'step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should record start event
      expect(mockRecordEvent).toHaveBeenNthCalledWith(1,
        'run-123',
        'step.started',
        { name: 'init-project', tool: 'project_init' },
        'step-123'
      );

      // Should update step to succeeded
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(2, 'step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          message: 'Project already initialized',
          workspace: '/workspace/path',
          initialized: true
        }
      });

      // Should record finished event
      expect(mockRecordEvent).toHaveBeenNthCalledWith(2,
        'run-123',
        'step.finished',
        { outputs: { message: 'Project already initialized', workspace: '/workspace/path', initialized: true } },
        'step-123'
      );

      // Should not try to setup template for already initialized projects
      expect(mockWorkspaceManager.autoCommit).not.toHaveBeenCalled();
    });

    it('should initialize project when not initialized', async () => {
      const uninitializedProject = {
        id: 'project-456',
        name: 'Test Project',
        initialized: false
      };

      mockGetProject.mockResolvedValue(uninitializedProject as any);
      mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/workspace/path');
      mockWorkspaceManager.autoCommit.mockResolvedValue(undefined);
      mockWorkspaceManager.getStatus.mockResolvedValue({ branch: 'main', clean: true });

      await projectInitHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            project_id: 'project-456',
            template: 'ecommerce'
          }
        } as any
      });

      // Should ensure workspace exists
      expect(mockWorkspaceManager.ensureWorkspace).toHaveBeenCalledWith(uninitializedProject);

      // Should have auto-committed changes
      expect(mockWorkspaceManager.autoCommit).toHaveBeenCalledWith(
        uninitializedProject,
        'Initialize Test Project with ecommerce template'
      );

      // Should get final status
      expect(mockWorkspaceManager.getStatus).toHaveBeenCalledWith(uninitializedProject);

      // Should update step to succeeded
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          message: 'Initialized new project Test Project',
          workspace: '/workspace/path',
          template: 'ecommerce',
          git_status: { branch: 'main', clean: true },
          initialized: true
        }
      });
    });

    it('should force re-initialization when force flag is set', async () => {
      const initializedProject = {
        id: 'project-456',
        name: 'Test Project',
        initialized: true
      };

      mockGetProject.mockResolvedValue(initializedProject as any);
      mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/workspace/path');
      mockWorkspaceManager.autoCommit.mockResolvedValue(undefined);
      mockWorkspaceManager.getStatus.mockResolvedValue({ branch: 'main', clean: true });

      await projectInitHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            project_id: 'project-456',
            template: 'saas',
            force: true
          }
        } as any
      });

      // Should have auto-committed changes even if already initialized
      expect(mockWorkspaceManager.autoCommit).toHaveBeenCalledWith(
        initializedProject,
        'Initialize Test Project with saas template'
      );

      // Should update step to succeeded
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          message: 'Initialized new project Test Project',
          workspace: '/workspace/path',
          template: 'saas',
          git_status: { branch: 'main', clean: true },
          initialized: true
        }
      });
    });

    it('should use default blank template when no template specified', async () => {
      const project = {
        id: 'project-456',
        name: 'Test Project',
        initialized: false
      };

      mockGetProject.mockResolvedValue(project as any);
      mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/workspace/path');
      mockWorkspaceManager.autoCommit.mockResolvedValue(undefined);
      mockWorkspaceManager.getStatus.mockResolvedValue({ branch: 'main', clean: true });

      await projectInitHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should have auto-committed without template
      expect(mockWorkspaceManager.autoCommit).toHaveBeenCalledWith(
        project,
        'Initialize Test Project'
      );
    });

    it('should handle workspace setup errors properly', async () => {
      const project = {
        id: 'project-456',
        name: 'Test Project',
        initialized: false
      };

      mockGetProject.mockResolvedValue(project as any);
      mockWorkspaceManager.ensureWorkspace.mockRejectedValue(new Error('Workspace creation failed'));

      await projectInitHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should have tried to ensure workspace
      expect(mockWorkspaceManager.ensureWorkspace).toHaveBeenCalledWith(project);

      // Should update step to failed
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          error: 'Workspace creation failed',
          project_id: 'project-456'
        }
      });

      // Should record failure event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.failed',
        { outputs: { error: 'Workspace creation failed', project_id: 'project-456' }, error: 'Workspace creation failed' },
        'step-123'
      );
    });

    it('should validate all supported template types', async () => {
      const project = {
        id: 'project-456',
        name: 'Test Project',
        initialized: false
      };

      mockGetProject.mockResolvedValue(project as any);
      mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/workspace/path');
      mockWorkspaceManager.autoCommit.mockResolvedValue(undefined);
      mockWorkspaceManager.getStatus.mockResolvedValue({ branch: 'main', clean: true });

      const templates = ['ecommerce', 'saas', 'blog', 'portfolio', 'blank'];

      for (const template of templates) {
        jest.clearAllMocks();
        mockGetProject.mockResolvedValue(project as any);
        mockWorkspaceManager.ensureWorkspace.mockResolvedValue('/workspace/path');
        mockWorkspaceManager.autoCommit.mockResolvedValue(undefined);
      mockWorkspaceManager.getStatus.mockResolvedValue({ branch: 'main', clean: true });

        await projectInitHandler.run({
          runId: 'run-123',
          step: {
            ...baseStep,
            inputs: {
              project_id: 'project-456',
              template: template as any
            }
          } as any
        });

        expect(mockWorkspaceManager.autoCommit).toHaveBeenCalledWith(
          project,
          `Initialize Test Project with ${template} template`
        );
      }
    });
  });
});