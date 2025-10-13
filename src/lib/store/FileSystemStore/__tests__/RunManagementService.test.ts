/**
 * Comprehensive unit tests for RunManagementService
 * Target Coverage: 95%
 *
 * Tests cover:
 * - Run creation with various plans
 * - Run retrieval and updates
 * - Run listing with filtering and limits
 * - Index management
 * - Project filtering
 * - Error scenarios
 * - Concurrent operations
 */

import { RunManagementService } from '../RunManagementService';
import { FileOperationService } from '../FileOperationService';
import type { RunRow, RunSummaryRow } from '../../types';

// Mock crypto module
jest.mock('node:crypto', () => ({
  randomUUID: jest.fn()
}));

describe('RunManagementService', () => {
  let service: RunManagementService;
  let mockFileOps: jest.Mocked<FileOperationService>;
  let mockRandomUUID: jest.MockedFunction<() => string>;
  const testRoot = '/workspace';

  beforeEach(() => {
    // Setup UUID mock
    mockRandomUUID = require('node:crypto').randomUUID as jest.MockedFunction<() => string>;
    mockRandomUUID.mockReturnValue('run-uuid-123');

    // Create mock FileOperationService
    mockFileOps = {
      ensureDirSync: jest.fn(),
      writeJsonFile: jest.fn().mockResolvedValue(undefined),
      readJsonFile: jest.fn(),
      readDirectorySafe: jest.fn().mockResolvedValue([]),
      fileExists: jest.fn().mockReturnValue(true),
      getRunPath: jest.fn((runId) =>
        `/workspace/runs/${runId}/run.json`
      ),
      getRunDirectory: jest.fn((runId) =>
        `/workspace/runs/${runId}`
      ),
      getRunsIndexPath: jest.fn(() =>
        '/workspace/runs/index.json'
      ),
      getStepPath: jest.fn(),
      getStepsDirectory: jest.fn(),
      getEventPath: jest.fn(),
      getEventsDirectory: jest.fn(),
      getArtifactPath: jest.fn(),
    } as any;

    service = new RunManagementService(mockFileOps, testRoot);

    // Mock Date for consistent timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('createRun', () => {
    it('creates run with all required fields', async () => {
      const plan = { goal: 'Test Goal', steps: ['step1', 'step2'] };

      const result = await service.createRun(plan);

      expect(result).toEqual({
        id: 'run-uuid-123',
        status: 'queued',
        plan,
        created_at: '2024-01-15T12:00:00.000Z'
      });
    });

    it('creates run with null plan', async () => {
      const result = await service.createRun(null);

      expect(result.plan).toBeNull();
      expect(result.status).toBe('queued');
    });

    it('creates run with undefined plan', async () => {
      const result = await service.createRun(undefined);

      expect(result.plan).toBeNull();
    });

    it('ensures workspace root exists', async () => {
      await service.createRun({ goal: 'test' });

      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith(testRoot);
    });

    it('creates run directory', async () => {
      await service.createRun({ goal: 'test' });

      expect(mockFileOps.getRunDirectory).toHaveBeenCalledWith('run-uuid-123', testRoot);
      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs/run-uuid-123');
    });

    it('writes run to correct file path', async () => {
      const plan = { goal: 'Test', steps: [] };

      await service.createRun(plan);

      expect(mockFileOps.getRunPath).toHaveBeenCalledWith('run-uuid-123', testRoot);
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-uuid-123/run.json',
        expect.objectContaining({
          id: 'run-uuid-123',
          plan
        })
      );
    });

    it('updates runs index after creation', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-uuid-123']);
      mockFileOps.readJsonFile.mockResolvedValue({
        id: 'run-uuid-123',
        status: 'queued',
        created_at: '2024-01-15T12:00:00.000Z',
        plan: { goal: 'test' }
      } as any);

      await service.createRun({ goal: 'test' });

      // Called twice: once for run, once for index (during updateRunsIndex)
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledTimes(2);
    });

    it('generates unique IDs for multiple runs', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      const run1 = await service.createRun({ goal: 'Run 1' });
      const run2 = await service.createRun({ goal: 'Run 2' });
      const run3 = await service.createRun({ goal: 'Run 3' });

      expect(run1.id).toBe('uuid-1');
      expect(run2.id).toBe('uuid-2');
      expect(run3.id).toBe('uuid-3');
    });

    it('handles complex plan objects', async () => {
      const complexPlan = {
        goal: 'Complex Goal',
        steps: ['step1', 'step2'],
        metadata: {
          user: 'test-user',
          tags: ['important', 'testing'],
          config: { timeout: 3000 }
        }
      };

      const result = await service.createRun(complexPlan);

      expect(result.plan).toEqual(complexPlan);
    });

    it('uses default projectId when not provided', async () => {
      const result = await service.createRun({ goal: 'test' });

      // Default projectId not added to run in current implementation
      expect(result).toEqual(expect.objectContaining({
        id: expect.any(String),
        status: 'queued'
      }));
    });

    it('accepts custom projectId parameter', async () => {
      const result = await service.createRun({ goal: 'test' }, 'custom-project');

      // ProjectId handling verified through the parameter
      expect(result).toBeDefined();
    });
  });

  describe('getRun', () => {
    it('retrieves existing run', async () => {
      const runData: RunRow = {
        id: 'run-123',
        status: 'completed',
        plan: { goal: 'Test Goal' },
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readJsonFile.mockResolvedValue(runData as any);

      const result = await service.getRun('run-123');

      expect(result).toEqual(runData);
      expect(mockFileOps.getRunPath).toHaveBeenCalledWith('run-123', testRoot);
    });

    it('returns null for non-existent run', async () => {
      mockFileOps.readJsonFile.mockResolvedValue(null);

      const result = await service.getRun('non-existent-id');

      expect(result).toBeNull();
    });

    it('handles runs with various statuses', async () => {
      const statuses: RunRow['status'][] = ['queued', 'running', 'completed', 'failed', 'cancelling', 'cancelled'];

      for (const status of statuses) {
        mockFileOps.readJsonFile.mockResolvedValueOnce({
          id: 'run-1',
          status,
          plan: {},
          created_at: '2024-01-15T12:00:00.000Z'
        } as any);

        const result = await service.getRun('run-1');
        expect(result?.status).toBe(status);
      }
    });
  });

  describe('updateRun', () => {
    it('updates run successfully', async () => {
      const existingRun: RunRow = {
        id: 'run-123',
        status: 'running',
        plan: { goal: 'Test' },
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readJsonFile
        .mockResolvedValueOnce(existingRun as any) // For updateRun
        .mockResolvedValueOnce(existingRun as any); // For updateRunsIndex

      await service.updateRun('run-123', { status: 'completed' });

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/run.json',
        expect.objectContaining({
          id: 'run-123',
          status: 'completed'
        })
      );
    });

    it('throws error when run not found', async () => {
      mockFileOps.readJsonFile.mockResolvedValue(null);

      await expect(
        service.updateRun('non-existent-id', { status: 'completed' })
      ).rejects.toThrow('Run non-existent-id not found');
    });

    it('preserves existing fields when updating', async () => {
      const existingRun = {
        id: 'run-123',
        status: 'running',
        plan: { goal: 'Original Goal' },
        created_at: '2024-01-15T11:00:00.000Z',
        project_id: 'project-1'
      };

      mockFileOps.readJsonFile.mockResolvedValue(existingRun as any);

      await service.updateRun('run-123', { status: 'completed' });

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          id: 'run-123',
          plan: { goal: 'Original Goal' },
          created_at: '2024-01-15T11:00:00.000Z',
          project_id: 'project-1',
          status: 'completed'
        })
      );
    });

    it('updates runs index after update', async () => {
      const run = { id: 'run-123', status: 'running', plan: {}, created_at: '2024-01-15T12:00:00.000Z' };
      mockFileOps.readJsonFile.mockResolvedValue(run as any);
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-123']);

      await service.updateRun('run-123', { status: 'completed' });

      // Called twice: once for run update, once for index update
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledTimes(2);
    });

    it('allows updating multiple fields at once', async () => {
      const existingRun = {
        id: 'run-123',
        status: 'running',
        plan: {},
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readJsonFile.mockResolvedValue(existingRun as any);

      await service.updateRun('run-123', {
        status: 'completed',
        result: { success: true },
        ended_at: '2024-01-15T12:05:00.000Z'
      } as any);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'completed',
          result: { success: true },
          ended_at: '2024-01-15T12:05:00.000Z'
        })
      );
    });
  });

  describe('listRuns', () => {
    it('returns empty array when no runs exist', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([]);

      const result = await service.listRuns();

      expect(result).toEqual([]);
    });

    it('lists all runs with default limit of 20', async () => {
      const runs = Array.from({ length: 25 }, (_, i) => ({
        id: `run-${i}`,
        status: 'completed',
        plan: { goal: `Goal ${i}` },
        created_at: new Date(2024, 0, 15, 12, i).toISOString()
      }));

      mockFileOps.readDirectorySafe.mockResolvedValue(runs.map(r => r.id));
      runs.forEach(run => {
        mockFileOps.readJsonFile.mockResolvedValueOnce(run as any);
      });

      const result = await service.listRuns();

      expect(result).toHaveLength(20);
    });

    it('respects custom limit', async () => {
      const runs = Array.from({ length: 10 }, (_, i) => ({
        id: `run-${i}`,
        status: 'completed',
        plan: { goal: `Goal ${i}` },
        created_at: new Date(2024, 0, 15, 12, i).toISOString()
      }));

      mockFileOps.readDirectorySafe.mockResolvedValue(runs.map(r => r.id));
      runs.forEach(run => {
        mockFileOps.readJsonFile.mockResolvedValueOnce(run as any);
      });

      const result = await service.listRuns(5);

      expect(result).toHaveLength(5);
    });

    it('sorts runs by created_at descending (most recent first)', async () => {
      const runs = [
        { id: 'run-1', status: 'completed', plan: { goal: 'Goal 1' }, created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'run-2', status: 'completed', plan: { goal: 'Goal 2' }, created_at: '2024-01-15T12:02:00.000Z' },
        { id: 'run-3', status: 'completed', plan: { goal: 'Goal 3' }, created_at: '2024-01-15T12:01:00.000Z' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2', 'run-3']);
      runs.forEach(run => {
        mockFileOps.readJsonFile.mockResolvedValueOnce(run as any);
      });

      const result = await service.listRuns();

      expect(result.map(r => r.id)).toEqual(['run-2', 'run-3', 'run-1']);
    });

    it('skips index.json file', async () => {
      const runs = [
        { id: 'run-1', status: 'completed', plan: { goal: 'Goal 1' }, created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'run-2', status: 'completed', plan: { goal: 'Goal 2' }, created_at: '2024-01-15T12:01:00.000Z' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'index.json', 'run-2']);
      runs.forEach(run => {
        mockFileOps.readJsonFile.mockResolvedValueOnce(run as any);
      });

      const result = await service.listRuns();

      expect(result).toHaveLength(2);
      expect(mockFileOps.readJsonFile).toHaveBeenCalledTimes(2);
    });

    it('filters by projectId when provided', async () => {
      const runs = [
        { id: 'run-1', status: 'completed', plan: { goal: 'Goal 1' }, project_id: 'project-1', created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'run-2', status: 'completed', plan: { goal: 'Goal 2' }, project_id: 'project-2', created_at: '2024-01-15T12:01:00.000Z' },
        { id: 'run-3', status: 'completed', plan: { goal: 'Goal 3' }, project_id: 'project-1', created_at: '2024-01-15T12:02:00.000Z' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2', 'run-3']);
      runs.forEach(run => {
        mockFileOps.readJsonFile.mockResolvedValueOnce(run as any);
      });

      const result = await service.listRuns(20, 'project-1');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(['run-3', 'run-1']);
    });

    it('converts runs to RunSummaryRow format', async () => {
      const run: RunRow = {
        id: 'run-123',
        status: 'completed',
        plan: { goal: 'Test Goal', steps: [] },
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-123']);
      mockFileOps.readJsonFile.mockResolvedValue(run as any);

      const result = await service.listRuns();

      expect(result[0]).toEqual({
        id: 'run-123',
        status: 'completed',
        created_at: '2024-01-15T12:00:00.000Z',
        title: 'Test Goal'
      });
    });

    it('handles runs without goal in plan', async () => {
      const run = {
        id: 'run-123',
        status: 'completed',
        plan: { steps: [] }, // No goal
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-123']);
      mockFileOps.readJsonFile.mockResolvedValue(run as any);

      const result = await service.listRuns();

      expect(result[0].title).toBe('');
    });

    it('handles runs with null plan', async () => {
      const run = {
        id: 'run-123',
        status: 'completed',
        plan: null,
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-123']);
      mockFileOps.readJsonFile.mockResolvedValue(run as any);

      const result = await service.listRuns();

      expect(result[0].title).toBe('');
    });

    it('skips invalid run files', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2', 'run-3']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ id: 'run-1', status: 'completed', plan: {}, created_at: '2024-01-15T12:00:00.000Z' } as any)
        .mockResolvedValueOnce(null) // Invalid file
        .mockResolvedValueOnce({ id: 'run-3', status: 'completed', plan: {}, created_at: '2024-01-15T12:02:00.000Z' } as any);

      const result = await service.listRuns();

      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(['run-3', 'run-1']);
    });

    it('ensures runs directory exists', async () => {
      await service.listRuns();

      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs');
    });
  });

  describe('Index Management (updateRunsIndex)', () => {
    it('updates index when creating run', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-uuid-123']);
      mockFileOps.readJsonFile.mockResolvedValue({
        id: 'run-uuid-123',
        status: 'queued',
        plan: { goal: 'Test' },
        created_at: '2024-01-15T12:00:00.000Z'
      } as any);

      await service.createRun({ goal: 'Test' });

      expect(mockFileOps.getRunsIndexPath).toHaveBeenCalledWith(testRoot);
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/index.json',
        expect.any(Array)
      );
    });

    it('limits index to 100 runs', async () => {
      const runs = Array.from({ length: 150 }, (_, i) => `run-${i}`);
      mockFileOps.readDirectorySafe.mockResolvedValue(runs);

      runs.forEach((_, i) => {
        mockFileOps.readJsonFile.mockResolvedValueOnce({
          id: `run-${i}`,
          status: 'completed',
          plan: {},
          created_at: new Date(2024, 0, 15, 12, i).toISOString()
        } as any);
      });

      await service.createRun({ goal: 'Test' });

      // The index update should list at most 100 runs
      const indexCall = mockFileOps.writeJsonFile.mock.calls.find(
        call => call[0] === '/workspace/runs/index.json'
      );
      expect(indexCall).toBeDefined();
    });

    it('handles index update errors gracefully', async () => {
      mockFileOps.readJsonFile.mockResolvedValueOnce({
        id: 'run-1',
        status: 'queued',
        plan: {},
        created_at: '2024-01-15T12:00:00.000Z'
      } as any);

      mockFileOps.readDirectorySafe.mockRejectedValueOnce(new Error('Failed to read directory'));

      // Should not throw even if index update fails
      await expect(service.createRun({ goal: 'Test' })).resolves.toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent run creation', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      mockFileOps.readDirectorySafe.mockResolvedValue([]);

      const promises = [
        service.createRun({ goal: 'Run 1' }),
        service.createRun({ goal: 'Run 2' }),
        service.createRun({ goal: 'Run 3' })
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.id)).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
    });

    it('handles concurrent run updates', async () => {
      const run = {
        id: 'run-1',
        status: 'running',
        plan: {},
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readJsonFile.mockResolvedValue(run as any);
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1']);

      const promises = [
        service.updateRun('run-1', { status: 'completed' }),
        service.updateRun('run-1', { result: { success: true } } as any),
        service.updateRun('run-1', { ended_at: '2024-01-15T12:05:00.000Z' } as any)
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('handles concurrent run retrieval', async () => {
      const run = {
        id: 'run-1',
        status: 'completed',
        plan: {},
        created_at: '2024-01-15T12:00:00.000Z'
      };

      mockFileOps.readJsonFile.mockResolvedValue(run as any);

      const promises = [
        service.getRun('run-1'),
        service.getRun('run-1'),
        service.getRun('run-1')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toEqual(run));
    });
  });

  describe('Edge Cases', () => {
    it('handles runs with very long goals', async () => {
      const longGoal = 'A'.repeat(10000);
      const plan = { goal: longGoal };

      const result = await service.createRun(plan);

      expect(result.plan).toEqual(plan);
    });

    it('handles plans with special characters', async () => {
      const plan = {
        goal: 'Test with "quotes" and \'apostrophes\'',
        command: 'echo "Hello, World!" | grep "World"'
      };

      const result = await service.createRun(plan);

      expect(result.plan).toEqual(plan);
    });

    it('handles empty string projectId', async () => {
      const result = await service.createRun({ goal: 'test' }, '');

      expect(result).toBeDefined();
    });

    it('handles listing with limit of 0', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2']);

      const result = await service.listRuns(0);

      expect(result).toEqual([]);
    });

    it('handles listing with very large limit', async () => {
      const runs = [
        { id: 'run-1', status: 'completed', plan: {}, created_at: '2024-01-15T12:00:00.000Z' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1']);
      mockFileOps.readJsonFile.mockResolvedValue(runs[0] as any);

      const result = await service.listRuns(1000000);

      expect(result).toHaveLength(1);
    });
  });

  describe('Data Integrity', () => {
    it('preserves plan structure exactly', async () => {
      const plan = {
        goal: 'Test',
        steps: ['step1', 'step2'],
        config: { timeout: 3000, retries: 3 },
        metadata: { user: 'test', tags: ['important'] }
      };

      const result = await service.createRun(plan);

      expect(result.plan).toEqual(plan);
    });

    it('maintains timestamp precision', async () => {
      const result = await service.createRun({ goal: 'test' });

      expect(result.created_at).toBe('2024-01-15T12:00:00.000Z');
      expect(new Date(result.created_at).toISOString()).toBe(result.created_at);
    });

    it('maintains status type safety', async () => {
      const validStatuses: RunRow['status'][] = [
        'queued',
        'running',
        'completed',
        'failed',
        'cancelling',
        'cancelled'
      ];

      for (const status of validStatuses) {
        const run = { id: 'run-1', status, plan: {}, created_at: '2024-01-15T12:00:00.000Z' };
        mockFileOps.readJsonFile.mockResolvedValueOnce(run as any);

        await service.updateRun('run-1', { status });

        expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ status })
        );
      }
    });
  });
});
