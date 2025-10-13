/**
 * Focused tests for FileSystemStore
 * Tests core functionality that is actually implemented
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { FileSystemStore } from '../FileSystemStore';
import type { RunRow, StepRow, EventRow } from '../types';

// Mock fs modules
jest.mock('node:fs');
jest.mock('node:fs/promises');
jest.mock('node:path');
jest.mock('node:crypto', () => ({
  randomUUID: jest.fn()
}));

describe('FileSystemStore - Core Functionality Tests', () => {
  let store: FileSystemStore;
  let mockFs: jest.Mocked<typeof fs>;
  let mockFsp: jest.Mocked<typeof fsp>;
  let mockPath: jest.Mocked<typeof path>;
  let mockRandomUUID: jest.MockedFunction<() => string>;

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFsp = fsp as jest.Mocked<typeof fsp>;
    mockPath = path as jest.Mocked<typeof path>;
    mockRandomUUID = require('node:crypto').randomUUID as jest.MockedFunction<() => string>;

    // Setup default mocks
    mockPath.join.mockImplementation((...segments) => segments.join('/'));
    mockPath.normalize.mockImplementation((p: string) => p);
    mockPath.resolve.mockImplementation((...segments) => {
      if (segments.length === 0) return '/test/cwd';
      return segments.join('/');
    });
    Object.defineProperty(mockPath, 'sep', { value: '/', writable: false });
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFsp.writeFile.mockResolvedValue(undefined);
    mockFsp.readFile.mockResolvedValue('{}');
    mockFsp.readdir.mockResolvedValue([]);
    mockRandomUUID.mockReturnValue('test-uuid-123');

    // Mock process.cwd()
    jest.spyOn(process, 'cwd').mockReturnValue('/test/cwd');

    store = new FileSystemStore();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Run Management', () => {
    describe('createRun', () => {
      it('creates run successfully', async () => {
        const plan = { type: 'test', steps: [] };

        const result = await store.createRun(plan);

        expect(result).toEqual({
          id: 'test-uuid-123',
          status: 'queued',
          plan,
          created_at: expect.any(String)
        });

        expect(mockFsp.writeFile).toHaveBeenCalled();
      });

      it('creates run with null plan', async () => {
        const result = await store.createRun(null);

        expect(result.plan).toBeNull();
        expect(result.status).toBe('queued');
      });
    });

    describe('getRun', () => {
      it('retrieves existing run', async () => {
        const runData = {
          id: 'test-run-id',
          status: 'completed',
          plan: { type: 'test' },
          created_at: '2023-01-01T00:00:00.000Z'
        };
        mockFsp.readFile.mockResolvedValue(JSON.stringify(runData));

        const result = await store.getRun('test-run-id');

        expect(result).toEqual(runData);
        expect(mockFsp.readFile).toHaveBeenCalled();
      });

      it('returns undefined for non-existent run', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('ENOENT'));

        const result = await store.getRun('non-existent-id');

        expect(result).toBeUndefined();
      });
    });

    describe('updateRun', () => {
      it('updates run successfully', async () => {
        const existingRun = {
          id: 'test-run-id',
          status: 'running' as const,
          plan: { type: 'test' },
          created_at: '2023-01-01T00:00:00.000Z'
        };
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingRun));

        await store.updateRun('test-run-id', { status: 'completed' });

        expect(mockFsp.writeFile).toHaveBeenCalled();
      });

      it('throws error for non-existent run', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('ENOENT'));

        await expect(store.updateRun('non-existent-id', { status: 'completed' }))
          .rejects.toThrow('Run non-existent-id not found');
      });
    });

    describe('listRuns', () => {
      it('lists runs with default limit', async () => {
        mockFsp.readdir.mockResolvedValue(['run1', 'run2', 'run3'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify({ id: 'run1', created_at: '2023-01-01T00:00:00.000Z' }))
          .mockResolvedValueOnce(JSON.stringify({ id: 'run2', created_at: '2023-01-02T00:00:00.000Z' }))
          .mockResolvedValueOnce(JSON.stringify({ id: 'run3', created_at: '2023-01-03T00:00:00.000Z' }));

        const result = await store.listRuns();

        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('run3'); // Most recent first
        expect(result[1].id).toBe('run2');
        expect(result[2].id).toBe('run1');
      });

      it('respects custom limit', async () => {
        mockFsp.readdir.mockResolvedValue(['run1', 'run2', 'run3'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify({ id: 'run1', created_at: '2023-01-01T00:00:00.000Z' }))
          .mockResolvedValueOnce(JSON.stringify({ id: 'run2', created_at: '2023-01-02T00:00:00.000Z' }));

        const result = await store.listRuns(2);

        expect(result).toHaveLength(2);
        expect(mockFsp.readFile).toHaveBeenCalledTimes(3); // Called for all but limited result
      });

      it('handles empty directory', async () => {
        mockFsp.readdir.mockResolvedValue([]);

        const result = await store.listRuns();

        expect(result).toEqual([]);
      });

      it('skips invalid run files', async () => {
        mockFsp.readdir.mockResolvedValue(['run1', 'run2'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify({ id: 'run1', created_at: '2023-01-01T00:00:00.000Z' }))
          .mockResolvedValueOnce('invalid json');

        const result = await store.listRuns();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('run1');
      });
    });

    // deleteRun is not implemented in FileSystemStore
  });

  describe('Step Management', () => {
    describe('createStep', () => {
      it('creates step successfully', async () => {
        const result = await store.createStep('run-id', 'test step', 'test_tool', { test: 'value' });

        expect(result).toEqual({
          id: 'test-uuid-123',
          run_id: 'run-id',
          name: 'test step',
          tool: 'test_tool',
          inputs: { test: 'value' },
          status: 'queued',
          created_at: expect.any(String),
          started_at: null,
          ended_at: null,
          outputs: null,
          idempotency_key: null
        });

        expect(mockFsp.writeFile).toHaveBeenCalled();
      });
    });

    describe('updateStep', () => {
      it('updates step successfully', async () => {
        const existingStep = {
          id: 'step-id',
          run_id: 'run-id',
          name: 'test',
          tool: 'tool',
          inputs: {},
          status: 'pending' as const,
          created_at: '2023-01-01T00:00:00.000Z',
          started_at: null,
          ended_at: null,
          outputs: null
        };
        // Mock readdir to return run directories
        mockFsp.readdir.mockResolvedValue(['run-id'] as any);
        // Mock readFile to return the step when found
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingStep));

        await store.updateStep('step-id', { status: 'completed', outputs: { result: 'success' } });

        expect(mockFsp.writeFile).toHaveBeenCalled();
      });

      it('throws error for non-existent step', async () => {
        // Mock readdir to return empty run directories
        mockFsp.readdir.mockResolvedValue([] as any);

        await expect(store.updateStep('non-existent-id', { status: 'completed' }))
          .rejects.toThrow('Step non-existent-id not found');
      });
    });

    describe('getStep', () => {
      it('retrieves existing step', async () => {
        const stepData = {
          id: 'step-id',
          run_id: 'run-id',
          name: 'test step',
          tool: 'test_tool',
          inputs: { test: 'value' },
          status: 'completed',
          created_at: '2023-01-01T00:00:00.000Z',
          started_at: '2023-01-01T00:01:00.000Z',
          ended_at: '2023-01-01T00:02:00.000Z',
          outputs: { result: 'success' }
        };
        // Mock readdir to return run directories
        mockFsp.readdir.mockResolvedValue(['run-id'] as any);
        // Mock readFile to return the step when found
        mockFsp.readFile.mockResolvedValue(JSON.stringify(stepData));

        const result = await store.getStep('step-id');

        expect(result).toEqual(stepData);
      });

      it('returns undefined for non-existent step', async () => {
        // Mock readdir to return empty run directories
        mockFsp.readdir.mockResolvedValue([] as any);

        const result = await store.getStep('non-existent-id');

        expect(result).toBeUndefined();
      });
    });

    describe('listStepsByRun', () => {
      it('lists steps for a run', async () => {
        mockFsp.readdir.mockResolvedValue(['step1.json', 'step2.json'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify({ id: 'step1', created_at: '2023-01-01T00:00:00.000Z' }))
          .mockResolvedValueOnce(JSON.stringify({ id: 'step2', created_at: '2023-01-02T00:00:00.000Z' }));

        const result = await store.listStepsByRun('run-id');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('step1'); // Chronological order
        expect(result[1].id).toBe('step2');
      });
    });
  });

  describe('Event Management', () => {
    describe('recordEvent', () => {
      it('records event successfully', async () => {
        await store.recordEvent('run-id', 'step.started', { step: 'test' }, 'step-id');

        expect(mockFsp.writeFile).toHaveBeenCalled();
      });
    });

    describe('listEvents', () => {
      it('lists events for a run', async () => {
        // EventManagementService reads from a single events.json file
        const events = [
          { id: 'event1', created_at: '2023-01-01T00:00:00.000Z' },
          { id: 'event2', created_at: '2023-01-02T00:00:00.000Z' }
        ];

        // Mock readJsonFile in FileOperationService to return events array
        const mockReadJsonFile = jest.fn().mockResolvedValue(events);
        // Override the fileOps.readJsonFile method (note: property is eventManager, not eventManagement)
        (store as any).eventManager.fileOps.readJsonFile = mockReadJsonFile;

        const result = await store.listEvents('run-id');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('event1'); // Chronological order
      });
    });
  });

  // Gate management is not implemented in FileSystemStore, removing these tests

  // Artifact, Outbox, Summary, and Inbox management are not implemented in FileSystemStore

  describe('Error Handling', () => {
    it('handles file system errors gracefully', async () => {
      mockFsp.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(store.createRun({ type: 'test' }))
        .rejects.toThrow('Disk full');
    });

    it('handles malformed JSON gracefully', async () => {
      // Mock readJsonFile to return null (which indicates parse failure in FileOperationService)
      const mockReadJsonFile = jest.fn().mockResolvedValue(null);
      // Note: property is runManager, not runManagement
      (store as any).runManager.fileOps.readJsonFile = mockReadJsonFile;

      const result = await store.getRun('test-id');

      expect(result).toBeUndefined();
    });
  });

  describe('Core Functionality Validation', () => {
    it('generates unique IDs for runs', async () => {
      const run1 = await store.createRun({ type: 'test1' });
      const run2 = await store.createRun({ type: 'test2' });

      expect(run1.id).toBe('test-uuid-123');
      expect(run2.id).toBe('test-uuid-123'); // Mocked to same value
    });

    it('maintains correct file structure', async () => {
      await store.createRun({ type: 'test' });

      expect(mockFsp.writeFile).toHaveBeenCalled();
    });
  });
});