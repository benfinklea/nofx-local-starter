/**
 * Comprehensive unit tests for StepManagementService
 * Target Coverage: 90%
 *
 * Tests cover:
 * - Step creation with and without idempotency keys
 * - Step retrieval and updates
 * - Idempotency key handling
 * - Step listing and ordering
 * - Error scenarios
 * - Concurrent operations
 */

import { StepManagementService } from '../StepManagementService';
import { FileOperationService } from '../FileOperationService';
import type { StepRow } from '../../types';

// Mock crypto module
jest.mock('node:crypto', () => ({
  randomUUID: jest.fn()
}));

// Mock path module
jest.mock('node:path', () => ({
  join: jest.fn((...segments) => segments.join('/')),
}));

describe('StepManagementService', () => {
  let service: StepManagementService;
  let mockFileOps: jest.Mocked<FileOperationService>;
  let mockRandomUUID: jest.MockedFunction<() => string>;
  const testRoot = '/workspace';

  beforeEach(() => {
    // Setup UUID mock
    mockRandomUUID = require('node:crypto').randomUUID as jest.MockedFunction<() => string>;
    mockRandomUUID.mockReturnValue('step-uuid-123');

    // Create mock FileOperationService
    mockFileOps = {
      ensureDirSync: jest.fn(),
      writeJsonFile: jest.fn().mockResolvedValue(undefined),
      readJsonFile: jest.fn(),
      readDirectorySafe: jest.fn().mockResolvedValue([]),
      fileExists: jest.fn().mockReturnValue(true),
      getStepPath: jest.fn((runId, stepId) =>
        `/workspace/runs/${runId}/steps/${stepId}.json`
      ),
      getStepsDirectory: jest.fn((runId) =>
        `/workspace/runs/${runId}/steps`
      ),
      getArtifactPath: jest.fn(),
      getRunPath: jest.fn(),
      getRunDirectory: jest.fn(),
      getEventsDirectory: jest.fn(),
      getEventPath: jest.fn(),
      getRunsIndexPath: jest.fn(),
    } as any;

    service = new StepManagementService(mockFileOps, testRoot);

    // Mock Date for consistent timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('createStep', () => {
    it('creates step with all required fields', async () => {
      const runId = 'run-123';
      const name = 'Execute Test';
      const tool = 'test_runner';
      const inputs = { command: 'npm test' };

      const result = await service.createStep(runId, name, tool, inputs);

      expect(result).toEqual({
        id: 'step-uuid-123',
        run_id: runId,
        name,
        tool,
        inputs,
        status: 'queued',
        created_at: '2024-01-15T12:00:00.000Z',
        started_at: null,
        ended_at: null,
        outputs: null,
        idempotency_key: null
      });
    });

    it('creates step without inputs', async () => {
      const result = await service.createStep('run-123', 'Simple Step', 'simple_tool');

      expect(result?.inputs).toEqual({});
    });

    it('creates step with idempotency key', async () => {
      const idempotencyKey = 'unique-operation-key';

      const result = await service.createStep(
        'run-123',
        'Idempotent Step',
        'tool',
        {},
        idempotencyKey
      );

      expect(result?.idempotency_key).toBe(idempotencyKey);
    });

    it('returns existing step when idempotency key matches', async () => {
      const idempotencyKey = 'duplicate-key';
      const existingStep: StepRow = {
        id: 'existing-step-id',
        run_id: 'run-123',
        name: 'Original Step',
        tool: 'tool',
        inputs: {},
        status: 'completed',
        created_at: '2024-01-15T11:00:00.000Z',
        started_at: '2024-01-15T11:00:05.000Z',
        ended_at: '2024-01-15T11:00:10.000Z',
        outputs: { result: 'success' },
        idempotency_key: idempotencyKey
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['existing-step-id.json']);
      mockFileOps.readJsonFile.mockResolvedValue(existingStep as any);

      const result = await service.createStep(
        'run-123',
        'New Step Attempt',
        'tool',
        {},
        idempotencyKey
      );

      expect(result).toEqual(existingStep);
      expect(mockFileOps.writeJsonFile).not.toHaveBeenCalled();
    });

    it('ensures steps directory exists', async () => {
      await service.createStep('run-456', 'Test', 'tool');

      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs/run-456/steps');
    });

    it('writes step to correct file path', async () => {
      await service.createStep('run-789', 'Test Step', 'tool', { key: 'value' });

      expect(mockFileOps.getStepPath).toHaveBeenCalledWith('run-789', 'step-uuid-123', testRoot);
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-789/steps/step-uuid-123.json',
        expect.objectContaining({
          id: 'step-uuid-123',
          name: 'Test Step'
        })
      );
    });

    it('generates unique IDs for multiple steps', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      const step1 = await service.createStep('run-1', 'Step 1', 'tool');
      const step2 = await service.createStep('run-1', 'Step 2', 'tool');
      const step3 = await service.createStep('run-1', 'Step 3', 'tool');

      expect(step1?.id).toBe('uuid-1');
      expect(step2?.id).toBe('uuid-2');
      expect(step3?.id).toBe('uuid-3');
    });

    it('handles null inputs gracefully', async () => {
      const result = await service.createStep('run-1', 'Test', 'tool', null as any);

      expect(result?.inputs).toEqual({});
    });

    it('handles undefined inputs', async () => {
      const result = await service.createStep('run-1', 'Test', 'tool', undefined);

      expect(result?.inputs).toEqual({});
    });
  });

  describe('getStep', () => {
    it('retrieves existing step by ID', async () => {
      const stepData: StepRow = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'Test Step',
        tool: 'test_tool',
        inputs: { test: 'value' },
        status: 'completed',
        created_at: '2024-01-15T12:00:00.000Z',
        started_at: '2024-01-15T12:00:05.000Z',
        ended_at: '2024-01-15T12:00:10.000Z',
        outputs: { result: 'success' },
        idempotency_key: null
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-456']);
      mockFileOps.readJsonFile.mockResolvedValue(stepData as any);

      const result = await service.getStep('step-123');

      expect(result).toEqual(stepData);
    });

    it('returns undefined for non-existent step', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2']);
      mockFileOps.readJsonFile.mockResolvedValue(null);

      const result = await service.getStep('non-existent-step');

      expect(result).toBeUndefined();
    });

    it('searches across all runs', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2', 'run-3']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(null) // run-1
        .mockResolvedValueOnce(null) // run-2
        .mockResolvedValueOnce({ id: 'step-found' } as any); // run-3

      const result = await service.getStep('step-found');

      expect(result).toEqual({ id: 'step-found' });
      expect(mockFileOps.readJsonFile).toHaveBeenCalledTimes(3);
    });

    it('skips index.json file when searching', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'index.json', 'run-2']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(null) // run-1
        .mockResolvedValueOnce({ id: 'step-123' } as any); // run-2

      await service.getStep('step-123');

      expect(mockFileOps.getStepPath).toHaveBeenCalledTimes(2);
      expect(mockFileOps.getStepPath).not.toHaveBeenCalledWith('index.json', expect.anything(), expect.anything());
    });

    it('returns first matching step found', async () => {
      const stepInRun1 = { id: 'step-123', run_id: 'run-1' };

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2']);
      mockFileOps.readJsonFile.mockResolvedValueOnce(stepInRun1 as any);

      const result = await service.getStep('step-123');

      expect(result).toEqual(stepInRun1);
      expect(mockFileOps.readJsonFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStepByIdempotencyKey', () => {
    it('retrieves step by idempotency key', async () => {
      const step: StepRow = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'Test',
        tool: 'tool',
        inputs: {},
        status: 'completed',
        created_at: '2024-01-15T12:00:00.000Z',
        started_at: null,
        ended_at: null,
        outputs: null,
        idempotency_key: 'unique-key-123'
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['step-123.json']);
      mockFileOps.readJsonFile.mockResolvedValue(step as any);

      const result = await service.getStepByIdempotencyKey('run-456', 'unique-key-123');

      expect(result).toEqual(step);
    });

    it('returns undefined when key not found', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['step-1.json', 'step-2.json']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ idempotency_key: 'key-1' } as any)
        .mockResolvedValueOnce({ idempotency_key: 'key-2' } as any);

      const result = await service.getStepByIdempotencyKey('run-1', 'non-existent-key');

      expect(result).toBeUndefined();
    });

    it('searches all steps in the run', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['step-1.json', 'step-2.json', 'step-3.json']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ idempotency_key: 'key-1' } as any)
        .mockResolvedValueOnce({ idempotency_key: 'key-2' } as any)
        .mockResolvedValueOnce({ idempotency_key: 'target-key' } as any);

      const result = await service.getStepByIdempotencyKey('run-1', 'target-key');

      expect(result).toBeDefined();
      expect(mockFileOps.readJsonFile).toHaveBeenCalledTimes(3);
    });
  });

  describe('updateStep', () => {
    it('updates step successfully', async () => {
      const existingStep: StepRow = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'Test',
        tool: 'tool',
        inputs: {},
        status: 'running',
        created_at: '2024-01-15T12:00:00.000Z',
        started_at: '2024-01-15T12:00:05.000Z',
        ended_at: null,
        outputs: null,
        idempotency_key: null
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-456']);
      mockFileOps.readJsonFile.mockResolvedValue(existingStep as any);

      await service.updateStep('step-123', {
        status: 'completed',
        ended_at: '2024-01-15T12:00:10.000Z',
        outputs: { result: 'success' }
      });

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-456/steps/step-123.json',
        expect.objectContaining({
          id: 'step-123',
          status: 'completed',
          ended_at: '2024-01-15T12:00:10.000Z',
          outputs: { result: 'success' }
        })
      );
    });

    it('throws error when step not found', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2']);
      mockFileOps.readJsonFile.mockResolvedValue(null);

      await expect(
        service.updateStep('non-existent-step', { status: 'completed' })
      ).rejects.toThrow('Step non-existent-step not found');
    });

    it('searches all runs to find step', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'run-2', 'run-3']);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'step-123', status: 'running' } as any);

      await service.updateStep('step-123', { status: 'completed' });

      expect(mockFileOps.readJsonFile).toHaveBeenCalledTimes(3);
    });

    it('preserves existing fields when updating', async () => {
      const existingStep = {
        id: 'step-123',
        run_id: 'run-1',
        name: 'Original Name',
        tool: 'original_tool',
        inputs: { original: 'input' },
        status: 'running',
        created_at: '2024-01-15T11:00:00.000Z',
        started_at: '2024-01-15T11:00:05.000Z',
        ended_at: null,
        outputs: null,
        idempotency_key: 'original-key'
      };

      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1']);
      mockFileOps.readJsonFile.mockResolvedValue(existingStep as any);

      await service.updateStep('step-123', { status: 'completed' });

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: 'Original Name',
          tool: 'original_tool',
          inputs: { original: 'input' },
          idempotency_key: 'original-key',
          status: 'completed'
        })
      );
    });

    it('skips index.json when searching for step', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1', 'index.json']);
      mockFileOps.readJsonFile.mockResolvedValue({ id: 'step-123' } as any);

      await service.updateStep('step-123', { status: 'completed' });

      expect(mockFileOps.getStepPath).toHaveBeenCalledTimes(1);
    });
  });

  describe('listStepsByRun', () => {
    it('returns empty array when no steps exist', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([]);

      const result = await service.listStepsByRun('run-123');

      expect(result).toEqual([]);
    });

    it('lists all steps in a run', async () => {
      const steps = [
        { id: 'step-1', created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'step-2', created_at: '2024-01-15T12:01:00.000Z' },
        { id: 'step-3', created_at: '2024-01-15T12:02:00.000Z' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue([
        'step-1.json',
        'step-2.json',
        'step-3.json'
      ]);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(steps[0] as any)
        .mockResolvedValueOnce(steps[1] as any)
        .mockResolvedValueOnce(steps[2] as any);

      const result = await service.listStepsByRun('run-123');

      expect(result).toHaveLength(3);
      expect(result.map(s => s.id)).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('sorts steps by created_at in ascending order', async () => {
      const steps = [
        { id: 'step-3', created_at: '2024-01-15T12:02:00.000Z' },
        { id: 'step-1', created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'step-2', created_at: '2024-01-15T12:01:00.000Z' }
      ];

      mockFileOps.readDirectorySafe.mockResolvedValue([
        'step-3.json',
        'step-1.json',
        'step-2.json'
      ]);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce(steps[0] as any)
        .mockResolvedValueOnce(steps[1] as any)
        .mockResolvedValueOnce(steps[2] as any);

      const result = await service.listStepsByRun('run-123');

      expect(result.map(s => s.id)).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('skips non-JSON files', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([
        'step-1.json',
        'readme.txt',
        'step-2.json',
        '.DS_Store'
      ]);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ id: 'step-1' } as any)
        .mockResolvedValueOnce({ id: 'step-2' } as any);

      const result = await service.listStepsByRun('run-123');

      expect(result).toHaveLength(2);
      expect(mockFileOps.readJsonFile).toHaveBeenCalledTimes(2);
    });

    it('skips invalid JSON files', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue([
        'step-1.json',
        'step-2.json',
        'step-3.json'
      ]);
      mockFileOps.readJsonFile
        .mockResolvedValueOnce({ id: 'step-1' } as any)
        .mockResolvedValueOnce(null) // Corrupted file
        .mockResolvedValueOnce({ id: 'step-3' } as any);

      const result = await service.listStepsByRun('run-123');

      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toEqual(['step-1', 'step-3']);
    });

    it('ensures steps directory exists', async () => {
      await service.listStepsByRun('run-456');

      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs/run-456/steps');
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent step creation', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      const promises = [
        service.createStep('run-1', 'Step 1', 'tool'),
        service.createStep('run-1', 'Step 2', 'tool'),
        service.createStep('run-1', 'Step 3', 'tool')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.map(r => r?.id)).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
    });

    it('handles concurrent step updates', async () => {
      mockFileOps.readDirectorySafe.mockResolvedValue(['run-1']);
      mockFileOps.readJsonFile.mockResolvedValue({ id: 'step-1', status: 'running' } as any);

      const promises = [
        service.updateStep('step-1', { status: 'completed' }),
        service.updateStep('step-1', { outputs: { result: 'success' } }),
        service.updateStep('step-1', { ended_at: '2024-01-15T12:00:10.000Z' })
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles steps with same idempotency key in different runs', async () => {
      const idempotencyKey = 'shared-key';

      const step1 = await service.createStep('run-1', 'Step 1', 'tool', {}, idempotencyKey);
      const step2 = await service.createStep('run-2', 'Step 2', 'tool', {}, idempotencyKey);

      expect(step1?.run_id).toBe('run-1');
      expect(step2?.run_id).toBe('run-2');
    });

    it('handles very long step names', async () => {
      const longName = 'A'.repeat(1000);

      const result = await service.createStep('run-1', longName, 'tool');

      expect(result?.name).toBe(longName);
    });

    it('handles special characters in step data', async () => {
      const inputs = {
        command: 'echo "Hello, World!" | grep "World"',
        path: '/path/with/special-chars_123'
      };

      const result = await service.createStep('run-1', 'Special Step', 'tool', inputs);

      expect(result?.inputs).toEqual(inputs);
    });
  });
});
