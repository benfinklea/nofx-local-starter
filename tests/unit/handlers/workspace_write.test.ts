/**
 * Unit tests for workspace_write handler
 * Coverage target: 90%+
 */

import type { StepHandler, Step } from '../../../src/worker/handlers/types';
import type { SimpleGit } from 'simple-git';

// Mock all dependencies
jest.mock('../../../src/lib/store');
jest.mock('../../../src/lib/events');
jest.mock('../../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../../../src/lib/projects');
jest.mock('../../../src/lib/workspaces');
jest.mock('node:fs/promises');
jest.mock('simple-git');

describe('workspace_write handler', () => {
  let handler: StepHandler;
  const mockStore = require('../../../src/lib/store').store;
  const mockRecordEvent = require('../../../src/lib/events').recordEvent;
  const mockGetProject = require('../../../src/lib/projects').getProject;
  const { WorkspaceManager } = require('../../../src/lib/workspaces');
  const mockFs = require('node:fs/promises');
  const mockSimpleGit = require('simple-git');
  const mockLog = require('../../../src/lib/logger').log;

  beforeAll(async () => {
    handler = (await import('../../../src/worker/handlers/workspace_write')).default;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockStore.updateStep = jest.fn().mockResolvedValue(undefined);
    mockStore.listStepsByRun = jest.fn().mockResolvedValue([]);
    mockStore.listArtifactsByRun = jest.fn().mockResolvedValue([]);
    mockRecordEvent.mockResolvedValue(undefined);
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Test Project' });

    WorkspaceManager.mockImplementation(() => ({
      ensureWorkspace: jest.fn().mockResolvedValue('/workspace/test-project')
    }));

    mockFs.readFile = jest.fn().mockResolvedValue('test content');
    mockFs.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  describe('match', () => {
    it('should match workspace:write tool', () => {
      expect(handler.match('workspace:write')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(handler.match('bash')).toBe(false);
      expect(handler.match('codegen')).toBe(false);
      expect(handler.match('workspace')).toBe(false);
    });
  });

  describe('run - successful operations', () => {
    it('should write file with direct sourceArtifact', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('runs/run-456/output.ts'),
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/workspace/test-project/src/output.ts',
        'test content',
        'utf-8'
      );
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          workspacePath: '/workspace/test-project',
          targetPath: 'src/output.ts',
          bytesWritten: Buffer.byteLength('test content', 'utf-8')
        })
      });
    });

    it('should write file from previous step artifact', async () => {
      mockStore.listStepsByRun.mockResolvedValue([
        { id: 'step-100', name: 'codegen-step', run_id: 'run-456' }
      ]);
      mockStore.listArtifactsByRun.mockResolvedValue([
        { id: 'art-1', step_id: 'step-100', path: 'runs/run-456/generated.ts' }
      ]);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          fromStep: 'codegen-step',
          artifactName: 'generated.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.listStepsByRun).toHaveBeenCalledWith('run-456');
      expect(mockStore.listArtifactsByRun).toHaveBeenCalledWith('run-456');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/workspace/test-project/src/output.ts',
        'test content',
        'utf-8'
      );
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          targetPath: 'src/output.ts'
        })
      });
    });

    it('should create nested directory structure', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/deep/nested/path/file.ts',
          sourceArtifact: 'runs/run-456/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        '/workspace/test-project/src/deep/nested/path',
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/workspace/test-project/src/deep/nested/path/file.ts',
        'test content',
        'utf-8'
      );
    });

    it('should commit changes when commit flag is true', async () => {
      const mockGit = {
        checkIsRepo: jest.fn().mockResolvedValue(true),
        add: jest.fn().mockResolvedValue(undefined),
        status: jest.fn().mockResolvedValue({ files: [{ path: 'src/output.ts' }] }),
        commit: jest.fn().mockResolvedValue({ commit: 'abc123def' })
      };
      mockSimpleGit.mockReturnValue(mockGit);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts',
          commit: true,
          commitMessage: 'Add new feature'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockGit.checkIsRepo).toHaveBeenCalled();
      expect(mockGit.add).toHaveBeenCalledWith('src/output.ts');
      expect(mockGit.commit).toHaveBeenCalledWith('Add new feature');
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          commit: true,
          commitSha: 'abc123def'
        })
      });
    });

    it('should use default commit message when not provided', async () => {
      const mockGit = {
        checkIsRepo: jest.fn().mockResolvedValue(true),
        add: jest.fn().mockResolvedValue(undefined),
        status: jest.fn().mockResolvedValue({ files: [{ path: 'src/output.ts' }] }),
        commit: jest.fn().mockResolvedValue({ commit: 'abc123def' })
      };
      mockSimpleGit.mockReturnValue(mockGit);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts',
          commit: true
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockGit.commit).toHaveBeenCalledWith('Update from NOFX run');
    });

    it('should skip commit when no changes to commit', async () => {
      const mockGit = {
        checkIsRepo: jest.fn().mockResolvedValue(true),
        add: jest.fn().mockResolvedValue(undefined),
        status: jest.fn().mockResolvedValue({ files: [] }),
        commit: jest.fn()
      };
      mockSimpleGit.mockReturnValue(mockGit);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts',
          commit: true
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockGit.commit).not.toHaveBeenCalled();
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          commit: true,
          commitSha: undefined
        })
      });
    });

    it('should handle non-git workspace gracefully', async () => {
      const mockGit = {
        checkIsRepo: jest.fn().mockResolvedValue(false)
      };
      mockSimpleGit.mockReturnValue(mockGit);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts',
          commit: true
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockGit.checkIsRepo).toHaveBeenCalled();
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          commit: true,
          commitSha: undefined
        })
      });
    });
  });

  describe('run - error handling', () => {
    it('should fail when projectId is missing', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: { error: 'workspace:write requires projectId in inputs' },
        ended_at: expect.any(String)
      });
    });

    it('should fail when targetPath is missing', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          sourceArtifact: 'runs/run-456/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: { error: 'workspace:write requires targetPath in inputs' },
        ended_at: expect.any(String)
      });
    });

    it('should fail when source specification is invalid', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: { error: 'workspace:write requires either sourceArtifact or (fromStep + artifactName)' },
        ended_at: expect.any(String)
      });
    });

    it('should fail with invalid source specification edge case', async () => {
      // This tests the validation logic with fromStep but null artifactName
      // In JavaScript, (fromStep && null) evaluates to null, so !(fromStep && null) is true
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          fromStep: 'prev-step',
          artifactName: null as any // Force null - validation will catch this
        }
      };

      await handler.run({ runId: 'run-456', step });

      // Check the final call (should be the second one)
      expect(mockStore.updateStep).toHaveBeenLastCalledWith('step-123', {
        status: 'failed',
        outputs: { error: 'workspace:write requires either sourceArtifact or (fromStep + artifactName)' },
        ended_at: expect.any(String)
      });
    });

    it('should fail when fromStep is not found', async () => {
      mockStore.listStepsByRun.mockResolvedValue([]);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          fromStep: 'missing-step',
          artifactName: 'output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: { error: 'Step not found: missing-step' },
        ended_at: expect.any(String)
      });
    });

    it('should fail when artifact is not found in step', async () => {
      mockStore.listStepsByRun.mockResolvedValue([
        { id: 'step-100', name: 'codegen-step', run_id: 'run-456' }
      ]);
      mockStore.listArtifactsByRun.mockResolvedValue([]);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          fromStep: 'codegen-step',
          artifactName: 'missing.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: { error: 'Artifact not found: missing.ts in step codegen-step' },
        ended_at: expect.any(String)
      });
    });

    it('should fail when project is not found', async () => {
      mockGetProject.mockResolvedValue(null);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'missing-proj',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: { error: 'Project not found: missing-proj' },
        ended_at: expect.any(String)
      });
    });

    it('should fail when source artifact cannot be read', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/missing.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: { error: expect.stringContaining('Failed to read source artifact') },
        ended_at: expect.any(String)
      });
    });

    it('should not fail step when git commit fails', async () => {
      const mockGit = {
        checkIsRepo: jest.fn().mockResolvedValue(true),
        add: jest.fn().mockRejectedValue(new Error('Git error'))
      };
      mockSimpleGit.mockReturnValue(mockGit);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts',
          commit: true
        }
      };

      await handler.run({ runId: 'run-456', step });

      // Should succeed despite git failure
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          commit: true,
          commitSha: undefined
        })
      });
    });
  });

  describe('edge cases', () => {
    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      mockFs.readFile.mockResolvedValue(largeContent);

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/large.bin',
          sourceArtifact: 'runs/run-456/large.bin'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: expect.objectContaining({
          bytesWritten: Buffer.byteLength(largeContent, 'utf-8')
        })
      });
    });

    it('should handle paths with special characters', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/special chars & symbols/file (1).ts',
          sourceArtifact: 'runs/run-456/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/workspace/test-project/src/special chars & symbols/file (1).ts',
        'test content',
        'utf-8'
      );
    });

    it('should emit proper events throughout execution', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'write-file',
        tool: 'workspace:write',
        inputs: {
          projectId: 'proj-1',
          targetPath: 'src/output.ts',
          sourceArtifact: 'runs/run-456/output.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-456',
        'step.started',
        { name: 'write-file', tool: 'workspace:write' },
        'step-123'
      );
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-456',
        'step.finished',
        expect.objectContaining({ targetPath: 'src/output.ts' }),
        'step-123'
      );
    });
  });
});
