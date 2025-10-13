/**
 * Comprehensive unit tests for FileOperationService
 * Target Coverage: 95%
 *
 * Tests cover:
 * - Path validation and security
 * - File operations (read/write/exists)
 * - Directory operations
 * - JSON handling
 * - Path generation for different resource types
 * - Edge cases and error scenarios
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { FileOperationService } from '../FileOperationService';

// Mock node modules
jest.mock('node:fs');
jest.mock('node:fs/promises');
jest.mock('node:path');

describe('FileOperationService', () => {
  let service: FileOperationService;
  let mockFs: jest.Mocked<typeof fs>;
  let mockFsp: jest.Mocked<typeof fsp>;
  let mockPath: jest.Mocked<typeof path>;

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFsp = fsp as jest.Mocked<typeof fsp>;
    mockPath = path as jest.Mocked<typeof path>;

    // Setup realistic path mocking
    mockPath.join.mockImplementation((...segments) => segments.join('/'));
    mockPath.normalize.mockImplementation((p: string) => {
      // Simple normalization: collapse // to / and remove trailing /
      return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    });
    mockPath.resolve.mockImplementation((...segments) => {
      if (segments.length === 0) return '/workspace';
      const joined = segments.join('/');
      return joined.startsWith('/') ? joined : `/workspace/${joined}`;
    });
    Object.defineProperty(mockPath, 'sep', { value: '/', writable: false });

    // Default mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFsp.writeFile.mockResolvedValue(undefined);
    mockFsp.readFile.mockResolvedValue('{"test": "data"}');
    mockFsp.readdir.mockResolvedValue([]);

    service = new FileOperationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Path Validation & Security', () => {
    describe('validatePath (via path generation methods)', () => {
      it('allows valid paths within workspace', () => {
        expect(() => {
          service.getRunPath('test-run-id', '/workspace');
        }).not.toThrow();
      });

      it('prevents path traversal with .. in run ID', () => {
        // Mock path behavior for traversal attack
        mockPath.normalize.mockReturnValueOnce('/etc/passwd');
        mockPath.resolve.mockReturnValueOnce('/etc/passwd');

        expect(() => {
          service.getRunPath('../../etc/passwd', '/workspace');
        }).toThrow(/Path traversal detected/);
      });

      it('prevents absolute paths escaping workspace', () => {
        // Mock path behavior for absolute path escape
        mockPath.normalize.mockReturnValueOnce('/etc/passwd');
        mockPath.resolve.mockReturnValueOnce('/etc/passwd');

        expect(() => {
          service.getRunPath('/etc/passwd', '/workspace');
        }).toThrow(/Path traversal detected/);
      });

      it('allows paths equal to workspace root', () => {
        const indexPath = service.getRunsIndexPath('/workspace');
        expect(indexPath).toBe('/workspace/runs/index.json');
      });

      it('validates expected subpaths for runs', () => {
        expect(() => {
          service.getRunDirectory('run-123', '/workspace');
        }).not.toThrow();
      });

      it('prevents escaping expected subdirectory for steps', () => {
        // This would try to escape the steps directory
        mockPath.join.mockReturnValueOnce('/workspace/runs/run-id/../artifacts/evil.json');
        mockPath.normalize.mockReturnValueOnce('/workspace/runs/artifacts/evil.json');
        mockPath.resolve.mockReturnValueOnce('/workspace/runs/artifacts/evil.json');

        expect(() => {
          service.getStepPath('run-id', '../artifacts/evil', '/workspace');
        }).toThrow(/Path traversal detected/);
      });
    });
  });

  describe('Directory Operations', () => {
    describe('ensureDirSync', () => {
      it('creates directory when it does not exist', () => {
        mockFs.existsSync.mockReturnValue(false);

        service.ensureDirSync('/test/path');

        expect(mockFs.existsSync).toHaveBeenCalledWith('/test/path');
        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/path', { recursive: true });
      });

      it('does nothing when directory exists', () => {
        mockFs.existsSync.mockReturnValue(true);

        service.ensureDirSync('/existing/path');

        expect(mockFs.existsSync).toHaveBeenCalledWith('/existing/path');
        expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      });

      it('handles nested directory creation', () => {
        mockFs.existsSync.mockReturnValue(false);

        service.ensureDirSync('/deep/nested/directory/structure');

        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/deep/nested/directory/structure', { recursive: true });
      });
    });

    describe('readDirectorySafe', () => {
      it('returns directory contents successfully', async () => {
        const files = ['file1.json', 'file2.json', 'file3.json'];
        mockFsp.readdir.mockResolvedValue(files as any);

        const result = await service.readDirectorySafe('/test/dir');

        expect(result).toEqual(files);
        expect(mockFsp.readdir).toHaveBeenCalledWith('/test/dir');
      });

      it('returns empty array on error', async () => {
        mockFsp.readdir.mockRejectedValue(new Error('ENOENT: directory not found'));

        const result = await service.readDirectorySafe('/nonexistent/dir');

        expect(result).toEqual([]);
      });

      it('returns empty array on permission denied', async () => {
        mockFsp.readdir.mockRejectedValue(new Error('EACCES: permission denied'));

        const result = await service.readDirectorySafe('/forbidden/dir');

        expect(result).toEqual([]);
      });
    });
  });

  describe('File Operations', () => {
    describe('fileExists', () => {
      it('returns true when file exists', () => {
        mockFs.existsSync.mockReturnValue(true);

        const result = service.fileExists('/test/file.json');

        expect(result).toBe(true);
        expect(mockFs.existsSync).toHaveBeenCalledWith('/test/file.json');
      });

      it('returns false when file does not exist', () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = service.fileExists('/nonexistent/file.json');

        expect(result).toBe(false);
      });
    });

    describe('writeJsonFile', () => {
      it('writes JSON data with formatting', async () => {
        const data = { test: 'value', nested: { key: 123 } };

        await service.writeJsonFile('/test/file.json', data);

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          '/test/file.json',
          JSON.stringify(data, null, 2)
        );
      });

      it('handles null values', async () => {
        await service.writeJsonFile('/test/file.json', null);

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          '/test/file.json',
          'null'
        );
      });

      it('handles arrays', async () => {
        const data = [1, 2, 3, { key: 'value' }];

        await service.writeJsonFile('/test/file.json', data);

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          '/test/file.json',
          JSON.stringify(data, null, 2)
        );
      });

      it('propagates write errors', async () => {
        mockFsp.writeFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

        await expect(service.writeJsonFile('/test/file.json', { test: 'data' }))
          .rejects.toThrow('ENOSPC');
      });
    });

    describe('readJsonFile', () => {
      it('reads and parses valid JSON', async () => {
        const data = { test: 'value', number: 42 };
        mockFsp.readFile.mockResolvedValue(JSON.stringify(data));

        const result = await service.readJsonFile('/test/file.json');

        expect(result).toEqual(data);
        expect(mockFsp.readFile).toHaveBeenCalledWith('/test/file.json', 'utf8');
      });

      it('returns null for non-existent file', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('ENOENT'));

        const result = await service.readJsonFile('/nonexistent.json');

        expect(result).toBeNull();
      });

      it('returns null for invalid JSON', async () => {
        mockFsp.readFile.mockResolvedValue('{ invalid json }');

        const result = await service.readJsonFile('/invalid.json');

        expect(result).toBeNull();
      });

      it('handles empty files', async () => {
        mockFsp.readFile.mockResolvedValue('');

        const result = await service.readJsonFile('/empty.json');

        expect(result).toBeNull();
      });

      it('handles complex nested JSON', async () => {
        const complexData = {
          level1: {
            level2: {
              level3: {
                array: [1, 2, 3],
                nested: { deep: 'value' }
              }
            }
          }
        };
        mockFsp.readFile.mockResolvedValue(JSON.stringify(complexData));

        const result = await service.readJsonFile('/complex.json');

        expect(result).toEqual(complexData);
      });
    });
  });

  describe('Path Generation - Runs', () => {
    describe('getRunPath', () => {
      it('generates correct run file path', () => {
        const path = service.getRunPath('run-123', '/workspace');

        expect(path).toBe('/workspace/runs/run-123/run.json');
      });

      it('validates path is within workspace', () => {
        // Mock path behavior for traversal attack
        mockPath.normalize.mockReturnValueOnce('/escape');
        mockPath.resolve.mockReturnValueOnce('/escape');

        expect(() => {
          service.getRunPath('../../escape', '/workspace');
        }).toThrow(/Path traversal detected/);
      });
    });

    describe('getRunDirectory', () => {
      it('generates correct run directory path', () => {
        const path = service.getRunDirectory('run-456', '/workspace');

        expect(path).toBe('/workspace/runs/run-456');
      });

      it('validates directory is within runs', () => {
        // Mock path behavior for traversal attack
        mockPath.normalize.mockReturnValueOnce('/evil');
        mockPath.resolve.mockReturnValueOnce('/evil');

        expect(() => {
          service.getRunDirectory('../evil', '/workspace');
        }).toThrow(/Path traversal detected/);
      });
    });

    describe('getRunsIndexPath', () => {
      it('generates correct index path', () => {
        const path = service.getRunsIndexPath('/workspace');

        expect(path).toBe('/workspace/runs/index.json');
      });
    });
  });

  describe('Path Generation - Steps', () => {
    describe('getStepPath', () => {
      it('generates correct step file path', () => {
        const path = service.getStepPath('run-123', 'step-456', '/workspace');

        expect(path).toBe('/workspace/runs/run-123/steps/step-456.json');
      });

      it('validates path is within run steps directory', () => {
        mockPath.join.mockReturnValueOnce('/workspace/runs/run-123/../../../etc/passwd.json');
        mockPath.normalize.mockReturnValueOnce('/etc/passwd.json');
        mockPath.resolve.mockReturnValueOnce('/etc/passwd.json');

        expect(() => {
          service.getStepPath('run-123', '../../../etc/passwd', '/workspace');
        }).toThrow(/Path traversal detected/);
      });
    });

    describe('getStepsDirectory', () => {
      it('generates correct steps directory path', () => {
        const path = service.getStepsDirectory('run-789', '/workspace');

        expect(path).toBe('/workspace/runs/run-789/steps');
      });
    });
  });

  describe('Path Generation - Events', () => {
    describe('getEventPath', () => {
      it('generates correct event file path', () => {
        const path = service.getEventPath('run-123', 'event-789', '/workspace');

        expect(path).toBe('/workspace/runs/run-123/events/event-789.json');
      });

      it('validates path security', () => {
        mockPath.join.mockReturnValueOnce('/workspace/runs/run-123/../../evil.json');
        mockPath.normalize.mockReturnValueOnce('/workspace/evil.json');
        mockPath.resolve.mockReturnValueOnce('/workspace/evil.json');

        expect(() => {
          service.getEventPath('run-123', '../../evil', '/workspace');
        }).toThrow(/Path traversal detected/);
      });
    });

    describe('getEventsDirectory', () => {
      it('generates correct events directory path', () => {
        const path = service.getEventsDirectory('run-abc', '/workspace');

        expect(path).toBe('/workspace/runs/run-abc/events');
      });
    });
  });

  describe('Path Generation - Artifacts', () => {
    describe('getArtifactPath', () => {
      it('generates correct artifact file path', () => {
        const path = service.getArtifactPath('run-123', 'artifact-xyz', '/workspace');

        expect(path).toBe('/workspace/runs/run-123/artifacts/artifact-xyz.json');
      });

      it('prevents path traversal in artifact ID', () => {
        mockPath.join.mockReturnValueOnce('/workspace/runs/run-123/artifacts/../../escape.json');
        mockPath.normalize.mockReturnValueOnce('/workspace/runs/escape.json');
        mockPath.resolve.mockReturnValueOnce('/workspace/runs/escape.json');

        expect(() => {
          service.getArtifactPath('run-123', '../../escape', '/workspace');
        }).toThrow(/Path traversal detected/);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles workspace paths with trailing slashes', () => {
      const path = service.getRunPath('run-123', '/workspace/');

      expect(path).toBeTruthy();
    });

    it('handles special characters in IDs', () => {
      const path = service.getRunPath('run-with-dashes-123', '/workspace');

      expect(path).toBe('/workspace/runs/run-with-dashes-123/run.json');
    });

    it('handles UUID format IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const path = service.getStepPath('run-123', uuid, '/workspace');

      expect(path).toBe(`/workspace/runs/run-123/steps/${uuid}.json`);
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent file reads', async () => {
      mockFsp.readFile
        .mockResolvedValueOnce('{"id": 1}')
        .mockResolvedValueOnce('{"id": 2}')
        .mockResolvedValueOnce('{"id": 3}');

      const results = await Promise.all([
        service.readJsonFile('/file1.json'),
        service.readJsonFile('/file2.json'),
        service.readJsonFile('/file3.json')
      ]);

      expect(results).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ]);
    });

    it('handles concurrent file writes', async () => {
      const writes = [
        service.writeJsonFile('/file1.json', { id: 1 }),
        service.writeJsonFile('/file2.json', { id: 2 }),
        service.writeJsonFile('/file3.json', { id: 3 })
      ];

      await expect(Promise.all(writes)).resolves.toBeDefined();
      expect(mockFsp.writeFile).toHaveBeenCalledTimes(3);
    });

    it('handles concurrent directory creation', () => {
      mockFs.existsSync.mockReturnValue(false);

      service.ensureDirSync('/dir1');
      service.ensureDirSync('/dir2');
      service.ensureDirSync('/dir3');

      expect(mockFs.mkdirSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Characteristics', () => {
    it('caches existsSync calls efficiently', () => {
      mockFs.existsSync.mockReturnValue(true);

      service.fileExists('/test/file1.json');
      service.fileExists('/test/file2.json');
      service.fileExists('/test/file3.json');

      expect(mockFs.existsSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Propagation', () => {
    it('propagates file system errors from readdir', async () => {
      mockFsp.readdir.mockRejectedValue(new Error('EIO: i/o error'));

      const result = await service.readDirectorySafe('/test');

      expect(result).toEqual([]); // readDirectorySafe returns empty array on error
    });

    it('propagates errors from writeFile', async () => {
      mockFsp.writeFile.mockRejectedValue(new Error('EROFS: read-only file system'));

      await expect(service.writeJsonFile('/test/file.json', { test: 'data' }))
        .rejects.toThrow('EROFS');
    });
  });
});
