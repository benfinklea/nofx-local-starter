/**
 * Comprehensive unit tests for ArtifactManagementService
 * Target Coverage: 90%
 *
 * Tests cover:
 * - Artifact creation with various data types
 * - Artifact listing and retrieval
 * - Artifact with step name resolution
 * - Error handling and edge cases
 * - Concurrent operations
 * - Data integrity
 */

import { ArtifactManagementService } from '../ArtifactManagementService';
import { FileOperationService } from '../FileOperationService';
import type { ArtifactRow } from '../../types';

// Mock crypto module
jest.mock('node:crypto', () => ({
  randomUUID: jest.fn()
}));

describe('ArtifactManagementService', () => {
  let service: ArtifactManagementService;
  let mockFileOps: jest.Mocked<FileOperationService>;
  let mockRandomUUID: jest.MockedFunction<() => string>;
  const testRoot = '/workspace';

  beforeEach(() => {
    // Setup UUID mock
    mockRandomUUID = require('node:crypto').randomUUID as jest.MockedFunction<() => string>;
    mockRandomUUID.mockReturnValue('artifact-uuid-123');

    // Create mock FileOperationService
    mockFileOps = {
      ensureDirSync: jest.fn(),
      writeJsonFile: jest.fn().mockResolvedValue(undefined),
      readJsonFile: jest.fn(),
      readDirectorySafe: jest.fn().mockResolvedValue([]),
      fileExists: jest.fn().mockReturnValue(true),
      getArtifactPath: jest.fn((runId, artifactId) =>
        `/workspace/runs/${runId}/artifacts/${artifactId}.json`
      ),
      getStepsDirectory: jest.fn((runId) =>
        `/workspace/runs/${runId}/steps`
      ),
      getRunPath: jest.fn(),
      getRunDirectory: jest.fn(),
      getStepPath: jest.fn(),
      getEventsDirectory: jest.fn(),
      getEventPath: jest.fn(),
      getRunsIndexPath: jest.fn(),
    } as any;

    service = new ArtifactManagementService(mockFileOps, testRoot);

    // Mock Date for consistent timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('createArtifact', () => {
    it('creates artifact with all required fields', async () => {
      const runId = 'run-123';
      const stepId = 'step-456';
      const name = 'output.txt';
      const type = 'file';
      const data = { content: 'test data', size: 1024 };

      const result = await service.createArtifact(runId, stepId, name, type, data);

      expect(result).toEqual({
        id: 'artifact-uuid-123',
        step_id: stepId,
        type,
        path: `${stepId}/${name}`,
        metadata: data,
        created_at: '2024-01-15T12:00:00.000Z'
      });
    });

    it('ensures artifacts directory exists', async () => {
      await service.createArtifact('run-123', 'step-456', 'test.txt', 'file', {});

      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs/run-123/artifacts');
    });

    it('writes artifact to correct file path', async () => {
      const runId = 'run-789';
      const artifactData = { key: 'value' };

      await service.createArtifact(runId, 'step-1', 'artifact.json', 'json', artifactData);

      expect(mockFileOps.getArtifactPath).toHaveBeenCalledWith(runId, 'artifact-uuid-123', testRoot);
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-789/artifacts/artifact-uuid-123.json',
        expect.objectContaining({
          id: 'artifact-uuid-123',
          metadata: artifactData
        })
      );
    });

    it('handles different artifact types', async () => {
      const types = ['file', 'image', 'json', 'binary', 'log'];

      for (const type of types) {
        const result = await service.createArtifact('run-1', 'step-1', 'test', type, {});
        expect(result.type).toBe(type);
      }
    });

    it('handles complex metadata objects', async () => {
      const complexMetadata = {
        nested: {
          deeply: {
            structured: {
              data: [1, 2, 3],
              boolean: true,
              null: null
            }
          }
        }
      };

      const result = await service.createArtifact('run-1', 'step-1', 'complex', 'json', complexMetadata);

      expect(result.metadata).toEqual(complexMetadata);
    });

    it('handles null metadata', async () => {
      const result = await service.createArtifact('run-1', 'step-1', 'null-data', 'file', null);

      expect(result.metadata).toBeNull();
    });

    it('handles array metadata', async () => {
      const arrayData = [1, 2, 3, 4, 5];

      const result = await service.createArtifact('run-1', 'step-1', 'array', 'json', arrayData);

      expect(result.metadata).toEqual(arrayData);
    });

    it('generates unique IDs for multiple artifacts', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      const result1 = await service.createArtifact('run-1', 'step-1', 'art1', 'file', {});
      const result2 = await service.createArtifact('run-1', 'step-1', 'art2', 'file', {});
      const result3 = await service.createArtifact('run-1', 'step-1', 'art3', 'file', {});

      expect(result1.id).toBe('uuid-1');
      expect(result2.id).toBe('uuid-2');
      expect(result3.id).toBe('uuid-3');
    });

    it('constructs correct artifact path format', async () => {
      const result = await service.createArtifact('run-1', 'step-abc', 'output.log', 'log', {});

      expect(result.path).toBe('step-abc/output.log');
    });

    it('propagates file write errors', async () => {
      mockFileOps.writeJsonFile.mockRejectedValue(new Error('ENOSPC: no space left'));

      await expect(
        service.createArtifact('run-1', 'step-1', 'test', 'file', {})
      ).rejects.toThrow('ENOSPC');
    });

    it('handles special characters in artifact names', async () => {
      const result = await service.createArtifact(
        'run-1',
        'step-1',
        'file-with-dashes_and_underscores.txt',
        'file',
        {}
      );

      expect(result.path).toBe('step-1/file-with-dashes_and_underscores.txt');
    });
  });

  describe('listArtifacts', () => {
    it('returns empty array when no artifacts exist', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([]);

      const result = await service.listArtifacts('run-123');

      expect(result).toEqual([]);
      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs/run-123/artifacts');
    });

    it('lists all artifacts in a run', async () => {
      const artifactFiles = ['artifact-1.json', 'artifact-2.json', 'artifact-3.json'];
      mockFileOps.readDirectorySafe.mockResolvedValue(artifactFiles);

      const mockArtifacts = [
        { id: 'artifact-1', step_id: 'step-1', type: 'file', path: 'test1', metadata: {}, created_at: '2024-01-01' },
        { id: 'artifact-2', step_id: 'step-2', type: 'image', path: 'test2', metadata: {}, created_at: '2024-01-02' },
        { id: 'artifact-3', step_id: 'step-3', type: 'json', path: 'test3', metadata: {}, created_at: '2024-01-03' }
      ];

      mockFileOps.readJsonFile
        .mockResolvedValueOnce(mockArtifacts[0] as any)
        .mockResolvedValueOnce(mockArtifacts[1] as any)
        .mockResolvedValueOnce(mockArtifacts[2] as any);

      const result = await service.listArtifacts('run-123');

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockArtifacts);
    });

    it('skips non-JSON files', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([
        'artifact-1.json',
        'readme.txt',
        'artifact-2.json',
        'binary.dat'
      ]);

      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ id: 'artifact-1' } as any)
        .mockResolvedValueOnce({ id: 'artifact-2' } as any);

      const result = await service.listArtifacts('run-123');

      expect(result).toHaveLength(2);
      expect(mockFileOps.readJsonFile).toHaveBeenCalledTimes(2);
    });

    it('skips invalid JSON files', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([
        'artifact-1.json',
        'artifact-2.json',
        'artifact-3.json'
      ]);

      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ id: 'artifact-1' } as any)
        .mockResolvedValueOnce(null) // Invalid/corrupted file
        .mockResolvedValueOnce({ id: 'artifact-3' } as any);

      const result = await service.listArtifacts('run-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('artifact-1');
      expect(result[1].id).toBe('artifact-3');
    });

    it('ensures artifacts directory exists before reading', async () => {
      await service.listArtifacts('run-456');

      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs/run-456/artifacts');
    });

    it('handles empty artifact directory gracefully', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([]);

      const result = await service.listArtifacts('run-empty');

      expect(result).toEqual([]);
    });

    it('preserves artifact order from file system', async () => {
      const files = ['c.json', 'a.json', 'b.json'];
      mockFileOps.readDirectorySafe.mockResolvedValue(files);

      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ id: 'c' } as any)
        .mockResolvedValueOnce({ id: 'a' } as any)
        .mockResolvedValueOnce({ id: 'b' } as any);

      const result = await service.listArtifacts('run-1');

      expect(result.map(a => a.id)).toEqual(['c', 'a', 'b']);
    });
  });

  describe('listArtifactsWithStepName', () => {
    it('returns artifacts with resolved step names', async () => {
      const artifacts = [
        { id: 'art-1', step_id: 'step-1', type: 'file', path: 'test1', metadata: {}, created_at: '2024-01-01' },
        { id: 'art-2', step_id: 'step-2', type: 'file', path: 'test2', metadata: {}, created_at: '2024-01-02' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue(['art-1.json', 'art-2.json']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(artifacts[0] as any)
        .mockResolvedValueOnce(artifacts[1] as any)
        .mockResolvedValueOnce({ name: 'Setup Environment' } as any)
        .mockResolvedValueOnce({ name: 'Run Tests' } as any);

      const result = await service.listArtifactsWithStepName('run-123');

      expect(result).toEqual([
        { ...artifacts[0], step_name: 'Setup Environment' },
        { ...artifacts[1], step_name: 'Run Tests' }
      ]);
    });

    it('handles missing step files with default name', async () => {
      const artifact = {
        id: 'art-1',
        step_id: 'missing-step',
        type: 'file',
        path: 'test',
        metadata: {},
        created_at: '2024-01-01'
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['art-1.json']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(artifact as any)
        .mockResolvedValueOnce(null); // Step file not found

      const result = await service.listArtifactsWithStepName('run-123');

      expect(result[0].step_name).toBe('Unknown Step');
    });

    it('reads step data from correct directory', async () => {
      const artifact = {
        id: 'art-1',
        step_id: 'step-abc',
        type: 'file',
        path: 'test',
        metadata: {},
        created_at: '2024-01-01'
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['art-1.json']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(artifact as any)
        .mockResolvedValueOnce({ name: 'Test Step' } as any);

      await service.listArtifactsWithStepName('run-789');

      expect(mockFileOps.getStepsDirectory).toHaveBeenCalledWith('run-789', testRoot);
    });

    it('handles multiple artifacts from same step', async () => {
      const artifacts = [
        { id: 'art-1', step_id: 'step-1', type: 'file', path: 'output1', metadata: {}, created_at: '2024-01-01' },
        { id: 'art-2', step_id: 'step-1', type: 'file', path: 'output2', metadata: {}, created_at: '2024-01-02' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue(['art-1.json', 'art-2.json']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(artifacts[0] as any)
        .mockResolvedValueOnce(artifacts[1] as any)
        .mockResolvedValueOnce({ name: 'Shared Step' } as any)
        .mockResolvedValueOnce({ name: 'Shared Step' } as any);

      const result = await service.listArtifactsWithStepName('run-1');

      expect(result[0].step_name).toBe('Shared Step');
      expect(result[1].step_name).toBe('Shared Step');
    });

    it('returns empty array when no artifacts exist', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([]);

      const result = await service.listArtifactsWithStepName('run-empty');

      expect(result).toEqual([]);
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent artifact creation', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      const promises = [
        service.createArtifact('run-1', 'step-1', 'art1', 'file', { data: 1 }),
        service.createArtifact('run-1', 'step-1', 'art2', 'file', { data: 2 }),
        service.createArtifact('run-1', 'step-1', 'art3', 'file', { data: 3 })
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.id)).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
    });

    it('handles concurrent artifact listing', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['art-1.json']);
      mockFileOps.readJsonFile.mockResolvedValue({ id: 'art-1' } as any);

      const promises = [
        service.listArtifacts('run-1'),
        service.listArtifacts('run-2'),
        service.listArtifacts('run-3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toHaveLength(1));
    });
  });

  describe('Data Integrity', () => {
    it('preserves metadata structure exactly', async () => {
      const metadata = {
        user: 'test-user',
        timestamp: Date.now(),
        tags: ['important', 'verified'],
        nested: { deep: { value: 42 } }
      };

      const result = await service.createArtifact('run-1', 'step-1', 'test', 'json', metadata);

      expect(result.metadata).toEqual(metadata);
    });

    it('maintains type information in artifacts', async () => {
      const types = ['file', 'image', 'video', 'json', 'binary'];

      for (const type of types) {
        const artifact = await service.createArtifact('run-1', 'step-1', 'test', type, {});
        expect(artifact.type).toBe(type);
      }
    });

    it('generates consistent timestamps', async () => {
      const before = new Date('2024-01-15T12:00:00.000Z').toISOString();

      const artifact1 = await service.createArtifact('run-1', 'step-1', 'art1', 'file', {});

      jest.advanceTimersByTime(1000);
      jest.setSystemTime(new Date('2024-01-15T12:00:01.000Z'));

      const artifact2 = await service.createArtifact('run-1', 'step-1', 'art2', 'file', {});

      expect(artifact1.created_at).toBe(before);
      expect(artifact2.created_at).toBe('2024-01-15T12:00:01.000Z');
    });
  });

  describe('Edge Cases', () => {
    it('handles very large metadata objects', async () => {
      const largeMetadata = {
        data: new Array(1000).fill(null).map((_, i) => ({ id: i, value: `item-${i}` }))
      };

      const result = await service.createArtifact('run-1', 'step-1', 'large', 'json', largeMetadata);

      expect(result.metadata).toEqual(largeMetadata);
    });

    it('handles empty artifact name', async () => {
      const result = await service.createArtifact('run-1', 'step-1', '', 'file', {});

      expect(result.path).toBe('step-1/');
    });

    it('handles artifacts with same name in different steps', async () => {
      const art1 = await service.createArtifact('run-1', 'step-1', 'output.txt', 'file', {});
      const art2 = await service.createArtifact('run-1', 'step-2', 'output.txt', 'file', {});

      expect(art1.path).toBe('step-1/output.txt');
      expect(art2.path).toBe('step-2/output.txt');
    });
  });
});
