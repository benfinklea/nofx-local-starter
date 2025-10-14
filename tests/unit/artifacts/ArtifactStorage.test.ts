/**
 * Comprehensive Test Suite for ArtifactStorage Service
 *
 * Tests the two-stage artifact handling system:
 * - Stage 1: Artifact Generation (save to local_data/runs/{runId}/steps/{stepId}/)
 * - Stage 2: Workspace Writing (optional copy to project workspace)
 *
 * Coverage targets:
 * - Unit test coverage: 90%+
 * - All success and failure scenarios
 * - Edge cases and error conditions
 * - Path security and validation
 */

import fs from 'node:fs/promises';
import { ArtifactStorage } from '../../../src/lib/artifacts/ArtifactStorage';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('../../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../../../src/lib/store', () => ({
  store: {
    createArtifact: jest.fn(),
    getArtifact: jest.fn(),
    listArtifactsByRun: jest.fn(),
    listArtifactsByStep: jest.fn(),
    deleteArtifact: jest.fn(),
  },
}));

// Mock Supabase client
const mockSupabaseClient = {
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      remove: jest.fn(),
      list: jest.fn(),
    })),
  },
} as unknown as SupabaseClient;

describe('ArtifactStorage', () => {
  let artifactStorage: ArtifactStorage;
  const testRunId = 'run_123456789';
  const testStepId = 'step_987654321';
  const testFilename = 'test-artifact.txt';
  const testContent = 'Test artifact content';
  const testMimeType = 'text/plain';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    process.env.DATA_DRIVER = 'fs';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;

    // Setup mock store
    const { store } = require('../../../src/lib/store');
    store.createArtifact.mockResolvedValue({
      id: 'artifact_123',
      step_id: testStepId,
      path: testFilename,
      type: testMimeType,
      metadata: {
        size: testContent.length,
      },
      created_at: new Date().toISOString(),
    });

    artifactStorage = new ArtifactStorage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Artifact Creation', () => {
    describe('saveArtifact', () => {
      it('should save artifact to correct directory structure', async () => {
        (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        const result = await artifactStorage.saveArtifact(
          testRunId,
          testStepId,
          testFilename,
          testContent,
          testMimeType
        );

        expect(fs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining(`runs/${testRunId}/steps/${testStepId}`),
          { recursive: true }
        );
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining(testFilename),
          testContent,
          'utf-8'
        );
        expect(result).toHaveProperty('path');
      });

      it('should create directories automatically if they do not exist', async () => {
        (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        await artifactStorage.saveArtifact(
          testRunId,
          testStepId,
          testFilename,
          testContent,
          testMimeType
        );

        expect(fs.mkdir).toHaveBeenCalledWith(
          expect.any(String),
          { recursive: true }
        );
      });

      it('should store artifact metadata', async () => {
        (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        const { store } = require('../../../src/lib/store');

        await artifactStorage.saveArtifact(
          testRunId,
          testStepId,
          testFilename,
          testContent,
          testMimeType
        );

        expect(store.createArtifact).toHaveBeenCalledWith(
          expect.objectContaining({
            step_id: testStepId,
            path: expect.stringContaining(testFilename),
            type: testMimeType,
          })
        );
      });

      it('should handle binary content', async () => {
        (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

        await artifactStorage.saveArtifact(
          testRunId,
          testStepId,
          'image.png',
          binaryContent,
          'image/png'
        );

        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.any(String),
          binaryContent,
          expect.any(String)
        );
      });
    });

    describe('path traversal prevention', () => {
      it('should reject path traversal attempts in filename', async () => {
        await expect(
          artifactStorage.saveArtifact(
            testRunId,
            testStepId,
            '../../../etc/passwd',
            testContent,
            testMimeType
          )
        ).rejects.toThrow();
      });

      it('should reject absolute paths in filename', async () => {
        await expect(
          artifactStorage.saveArtifact(
            testRunId,
            testStepId,
            '/etc/passwd',
            testContent,
            testMimeType
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('Artifact Retrieval', () => {
    describe('getArtifact', () => {
      it('should retrieve artifact content from filesystem', async () => {
        const { store } = require('../../../src/lib/store');
        store.getArtifact.mockResolvedValue({
          id: 'artifact_123',
          step_id: testStepId,
          path: `runs/${testRunId}/steps/${testStepId}/${testFilename}`,
          type: testMimeType,
          metadata: { size: testContent.length },
          created_at: new Date().toISOString(),
        });

        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(testContent));

        const result = await artifactStorage.getArtifact(
          testRunId,
          testStepId,
          testFilename
        );

        expect(fs.readFile).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should return null for non-existent artifact', async () => {
        const { store } = require('../../../src/lib/store');
        store.getArtifact.mockResolvedValue(null);

        const result = await artifactStorage.getArtifact(
          testRunId,
          testStepId,
          'non-existent.txt'
        );

        expect(result).toBeNull();
      });
    });

    describe('listArtifacts', () => {
      it('should list all artifacts for a run', async () => {
        const { store } = require('../../../src/lib/store');
        const mockArtifacts = [
          {
            id: 'artifact_1',
            step_id: testStepId,
            path: 'file1.txt',
            type: 'text/plain',
            metadata: { size: 100 },
            created_at: new Date().toISOString(),
            step_name: 'Test Step',
          },
        ];
        store.listArtifactsByRun.mockResolvedValue(mockArtifacts);

        const result = await artifactStorage.listArtifacts(testRunId);

        expect(store.listArtifactsByRun).toHaveBeenCalledWith(testRunId);
        expect(result).toEqual(mockArtifacts);
      });

      it('should list artifacts for a specific step', async () => {
        const { store } = require('../../../src/lib/store');
        const mockArtifacts = [
          {
            id: 'artifact_1',
            step_id: testStepId,
            path: 'file1.txt',
            type: 'text/plain',
            metadata: { size: 100 },
            created_at: new Date().toISOString(),
          },
        ];
        store.listArtifactsByStep.mockResolvedValue(mockArtifacts);

        const result = await artifactStorage.listArtifacts(testRunId, testStepId);

        expect(store.listArtifactsByStep).toHaveBeenCalledWith(testRunId, testStepId);
        expect(result).toEqual(mockArtifacts);
      });
    });
  });

  describe('Artifact Cleanup', () => {
    describe('deleteArtifact', () => {
      it('should delete artifact from filesystem and database', async () => {
        const { store } = require('../../../src/lib/store');
        store.getArtifact.mockResolvedValue({
          id: 'artifact_123',
          step_id: testStepId,
          path: `runs/${testRunId}/steps/${testStepId}/${testFilename}`,
          type: testMimeType,
          metadata: {},
          created_at: new Date().toISOString(),
        });

        (fs.unlink as jest.Mock).mockResolvedValue(undefined);

        await artifactStorage.deleteArtifact(testRunId, testStepId, testFilename);

        expect(fs.unlink).toHaveBeenCalled();
        expect(store.deleteArtifact).toHaveBeenCalled();
      });

      it('should handle deletion of non-existent artifact gracefully', async () => {
        const { store } = require('../../../src/lib/store');
        store.getArtifact.mockResolvedValue(null);

        await expect(
          artifactStorage.deleteArtifact(testRunId, testStepId, 'non-existent.txt')
        ).resolves.not.toThrow();
      });
    });

    describe('deleteArtifactsByRun', () => {
      it('should delete all artifacts for a run', async () => {
        (fs.rm as jest.Mock).mockResolvedValue(undefined);

        await artifactStorage.deleteArtifactsByRun(testRunId);

        expect(fs.rm).toHaveBeenCalledWith(
          expect.stringContaining(`runs/${testRunId}`),
          { recursive: true, force: true }
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle filesystem errors', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('ENOSPC: no space left'));

      await expect(
        artifactStorage.saveArtifact(
          testRunId,
          testStepId,
          testFilename,
          testContent,
          testMimeType
        )
      ).rejects.toThrow();
    });

    it('should handle permission errors', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        artifactStorage.saveArtifact(
          testRunId,
          testStepId,
          testFilename,
          testContent,
          testMimeType
        )
      ).rejects.toThrow();
    });
  });

  describe('Storage Driver Selection', () => {
    it('should use filesystem driver for DATA_DRIVER=fs', () => {
      process.env.DATA_DRIVER = 'fs';
      const storage = new ArtifactStorage();

      expect(storage.getDriverType()).toBe('filesystem');
    });

    it('should use Supabase driver for DATA_DRIVER=postgres with credentials', () => {
      process.env.DATA_DRIVER = 'postgres';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_KEY = 'test_key';

      const storage = new ArtifactStorage(mockSupabaseClient);

      expect(storage.getDriverType()).toBe('supabase');
    });
  });
});
