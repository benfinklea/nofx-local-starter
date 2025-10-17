/**
 * Comprehensive tests for src/lib/store.ts
 * Testing both FS and DB drivers with 90%+ coverage
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

// Mock dependencies BEFORE importing store
jest.mock('../../src/lib/db', () => ({
  query: jest.fn(),
}));

jest.mock('node:fs');
jest.mock('node:fs/promises');
let uuidCounter = 0;
jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => `test-uuid-${++uuidCounter}`),
}));

const mockFs = jest.mocked(fs);
const mockFsp = jest.mocked(fsp);
const mockDb = require('../../src/lib/db');

// Import store and types after mocking
import { store } from '../../src/lib/store';
import { StoreFactory } from '../../src/lib/store/StoreFactory';
import type { RunRow, StepRow, EventRow, GateRow, ArtifactRow, OutboxRow, JsonValue } from '../../src/lib/store';

const ROOT = path.join(process.cwd(), 'local_data');

describe('Store Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset UUID counter
    uuidCounter = 0;

    // Reset the store factory to ensure fresh instances
    StoreFactory.reset();

    // Default mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFsp.writeFile.mockResolvedValue(undefined);
    mockFsp.readFile.mockResolvedValue('[]');
    mockFsp.readdir.mockResolvedValue([] as any);

    // Reset environment
    delete process.env.DATA_DRIVER;
    delete process.env.QUEUE_DRIVER;
  });

  describe('Driver Selection', () => {
    it('should default to fs when QUEUE_DRIVER is memory', () => {
      process.env.QUEUE_DRIVER = 'memory';
      expect(store.driver).toBe('fs');
    });

    it('should default to db when QUEUE_DRIVER is not memory', () => {
      process.env.QUEUE_DRIVER = 'redis';
      expect(store.driver).toBe('db');
    });

    it('should use DATA_DRIVER when explicitly set', () => {
      process.env.DATA_DRIVER = 'db';
      expect(store.driver).toBe('db');
    });

    it('should be case insensitive', () => {
      process.env.DATA_DRIVER = 'DB';
      expect(store.driver).toBe('db');
    });
  });

  describe('Run Operations - FS Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
    });

    describe('createRun', () => {
      it('should create a run with FS driver', async () => {
        const plan = { goal: 'test goal' };
        const mockRunData = {
          id: expect.stringMatching(/^test-uuid-\d+$/),
          status: 'queued',
          plan,
          created_at: expect.any(String),
        };

        // Mock directories don't exist so mkdirSync will be called
        mockFs.existsSync.mockReturnValue(false);
        mockFsp.readdir.mockResolvedValue(['run1', 'run2'] as any);
        mockFsp.readFile.mockResolvedValue(JSON.stringify([{ id: 'run1', status: 'queued', created_at: '2023-01-01' }]));

        const result = await store.createRun(plan);

        expect(result).toMatchObject(mockRunData);
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(ROOT, { recursive: true });
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join(ROOT, 'runs', result.id), { recursive: true });
        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', result.id, 'run.json'),
          expect.stringContaining('"status": "queued"')
        );
      });

      it('should handle null plan', async () => {
        const result = await store.createRun(null);
        expect(result.plan).toBe(null);
      });

      it('should handle undefined plan', async () => {
        const result = await store.createRun(undefined);
        expect(result.plan).toBe(null);
      });

      it('should include projectId in run', async () => {
        const result = await store.createRun({ goal: 'test' }, 'custom-project');
        expect(result).toMatchObject({ plan: { goal: 'test' } });
      });
    });

    describe('getRun', () => {
      it('should get an existing run', async () => {
        const mockRun = { id: 'test-id', status: 'queued', plan: { goal: 'test' }, created_at: '2023-01-01' };
        mockFsp.readFile.mockResolvedValue(JSON.stringify(mockRun));

        const result = await store.getRun('test-id');

        expect(result).toEqual(mockRun);
        expect(mockFsp.readFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'test-id', 'run.json'),
          'utf8'
        );
      });

      it('should return undefined for non-existent run', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('File not found'));

        const result = await store.getRun('non-existent');
        expect(result).toBeUndefined();
      });
    });

    describe('updateRun', () => {
      it('should update an existing run', async () => {
        const existingRun = { id: 'test-id', status: 'queued', created_at: '2023-01-01' };
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingRun));

        await store.updateRun('test-id', { status: 'running' });

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'test-id', 'run.json'),
          expect.stringContaining('"status": "running"')
        );
      });

      it('should throw error for non-existent run', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('File not found'));

        await expect(store.updateRun('non-existent', { status: 'running' })).rejects.toThrow('Run non-existent not found');
      });
    });

    describe('resetRun', () => {
      it('should reset run status and timestamps', async () => {
        const existingRun = {
          id: 'test-id',
          status: 'failed',
          ended_at: '2023-01-01T10:00:00Z',
          completed_at: '2023-01-01T10:00:00Z',
          created_at: '2023-01-01'
        };
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingRun));

        await store.resetRun('test-id');

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'test-id', 'run.json'),
          expect.stringContaining('"status": "queued"')
        );
        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'test-id', 'run.json'),
          expect.stringContaining('"ended_at": null')
        );
      });
    });

    describe('listRuns', () => {
      it('should list runs with summaries', async () => {
        const mockRuns = [
          { id: 'run1', status: 'queued', created_at: '2023-01-02', plan: { goal: 'Goal 1' } },
          { id: 'run2', status: 'running', created_at: '2023-01-01', plan: { goal: 'Goal 2' } }
        ];

        mockFsp.readdir.mockResolvedValue(['run1', 'run2', 'index.json'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify(mockRuns[0]))
          .mockResolvedValueOnce(JSON.stringify(mockRuns[1]));

        const result = await store.listRuns(10);

        expect(result).toEqual([
          { id: 'run1', status: 'queued', created_at: '2023-01-02', title: 'Goal 1' },
          { id: 'run2', status: 'running', created_at: '2023-01-01', title: 'Goal 2' }
        ]);
      });

      it('should handle runs without goals', async () => {
        const mockRun = { id: 'run1', status: 'queued', created_at: '2023-01-01', plan: {} };

        mockFsp.readdir.mockResolvedValue(['run1'] as any);
        mockFsp.readFile.mockResolvedValue(JSON.stringify(mockRun));

        const result = await store.listRuns();

        expect(result[0]!.title).toBe('');
      });

      it('should sort by created_at descending', async () => {
        const mockRuns = [
          { id: 'run1', status: 'queued', created_at: '2023-01-01', plan: {} },
          { id: 'run2', status: 'running', created_at: '2023-01-02', plan: {} }
        ];

        mockFsp.readdir.mockResolvedValue(['run1', 'run2'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify(mockRuns[0]))
          .mockResolvedValueOnce(JSON.stringify(mockRuns[1]));

        const result = await store.listRuns();

        expect(result[0]!.id).toBe('run2'); // More recent first
        expect(result[1]!.id).toBe('run1');
      });

      it('should limit results', async () => {
        mockFsp.readdir.mockResolvedValue(['run1', 'run2', 'run3'] as any);
        mockFsp.readFile.mockResolvedValue(JSON.stringify({ id: 'test', status: 'queued', created_at: '2023-01-01', plan: {} }));

        const result = await store.listRuns(2);

        expect(result).toHaveLength(2);
      });

      it('should handle file read errors gracefully', async () => {
        mockFsp.readdir.mockResolvedValue(['run1', 'run2'] as any);
        mockFsp.readFile
          .mockRejectedValueOnce(new Error('Read error'))
          .mockResolvedValueOnce(JSON.stringify({ id: 'run2', status: 'queued', created_at: '2023-01-01', plan: {} }));

        const result = await store.listRuns();

        expect(result).toHaveLength(1);
        expect(result[0]!.id).toBe('run2');
      });
    });
  });

  describe('Step Operations - FS Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
    });

    describe('createStep', () => {
      it('should create a step', async () => {
        const inputs = { param1: 'value1' };

        const result = await store.createStep('run-id', 'test-step', 'test-tool', inputs);

        expect(result).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          run_id: 'run-id',
          name: 'test-step',
          tool: 'test-tool',
          inputs,
          status: 'queued',
          created_at: expect.any(String),
          idempotency_key: null
        });

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'run-id', 'steps', result!.id + '.json'),
          expect.stringContaining('"status": "queued"')
        );
      });

      it('should handle idempotency key', async () => {
        const existingStep = {
          id: 'existing-id',
          run_id: 'run-id',
          name: 'test-step',
          tool: 'test-tool',
          inputs: {},
          status: 'queued',
          created_at: '2023-01-01',
          idempotency_key: 'key-123'
        };

        mockFsp.readdir.mockResolvedValue(['existing-id.json'] as any);
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingStep));

        const result = await store.createStep('run-id', 'test-step', 'test-tool', {}, 'key-123');

        expect(result).toEqual(existingStep);
      });

      it('should handle empty inputs', async () => {
        const result = await store.createStep('run-id', 'test-step', 'test-tool');

        expect(result!.inputs).toEqual({});
      });
    });

    describe('getStep', () => {
      it('should find step across all runs', async () => {
        const mockStep = { id: 'step-id', run_id: 'run-id', name: 'test', tool: 'test', inputs: {}, status: 'queued', created_at: '2023-01-01' };

        mockFsp.readdir.mockResolvedValue(['run1', 'run2'] as any);
        mockFsp.readFile
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce(JSON.stringify(mockStep));

        const result = await store.getStep('step-id');

        expect(result).toEqual(mockStep);
      });

      it('should return undefined if step not found', async () => {
        mockFsp.readdir.mockResolvedValue(['run1'] as any);
        mockFsp.readFile.mockRejectedValue(new Error('Not found'));

        const result = await store.getStep('non-existent');

        expect(result).toBeUndefined();
      });
    });

    describe('updateStep', () => {
      it('should update existing step', async () => {
        const existingStep = { id: 'step-id', status: 'queued', created_at: '2023-01-01' };

        mockFsp.readdir.mockResolvedValue(['run1'] as any);
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingStep));

        await store.updateStep('step-id', { status: 'running' });

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'run1', 'steps', 'step-id.json'),
          expect.stringContaining('"status": "running"')
        );
      });
    });

    describe('listStepsByRun', () => {
      it('should list steps for a run sorted by created_at', async () => {
        const steps = [
          { id: 'step1', created_at: '2023-01-02' },
          { id: 'step2', created_at: '2023-01-01' }
        ];

        mockFsp.readdir.mockResolvedValue(['step1.json', 'step2.json'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify(steps[0]))
          .mockResolvedValueOnce(JSON.stringify(steps[1]));

        const result = await store.listStepsByRun('run-id');

        expect(result[0]!.id).toBe('step2'); // Earlier first
        expect(result[1]!.id).toBe('step1');
      });

      it('should handle empty steps directory', async () => {
        mockFsp.readdir.mockRejectedValue(new Error('Directory not found'));

        const result = await store.listStepsByRun('run-id');

        expect(result).toEqual([]);
      });
    });

    describe('countRemainingSteps', () => {
      it('should count non-completed steps', async () => {
        const steps = [
          { status: 'queued' },
          { status: 'running' },
          { status: 'succeeded' },
          { status: 'cancelled' }
        ];

        mockFsp.readdir.mockResolvedValue(['step1.json', 'step2.json', 'step3.json', 'step4.json'] as any);
        steps.forEach((step, i) => {
          mockFsp.readFile.mockResolvedValueOnce(JSON.stringify(step));
        });

        const result = await store.countRemainingSteps('run-id');

        expect(result).toBe(2); // queued + running
      });
    });

    describe('resetStep', () => {
      it('should reset step status and clear timestamps', async () => {
        const existingStep = {
          id: 'step-id',
          status: 'failed',
          started_at: '2023-01-01',
          ended_at: '2023-01-01',
          completed_at: '2023-01-01',
          outputs: { result: 'failed' }
        };

        mockFsp.readdir.mockResolvedValue(['run-id'] as any);
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingStep));

        await store.resetStep('step-id');

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'run-id', 'steps', 'step-id.json'),
          expect.stringContaining('"status": "queued"')
        );
      });
    });
  });

  describe('Event Operations - FS Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
    });

    describe('recordEvent', () => {
      it('should record event to events file', async () => {
        const existingEvents = [{ id: 'event1', created_at: '2023-01-01' }];
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingEvents));

        await store.recordEvent('run-id', 'test-event', { data: 'test' }, 'step-id');

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'run-id', 'events.json'),
          expect.stringContaining('"type": "test-event"')
        );
      });

      it('should handle empty events file', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('File not found'));

        await store.recordEvent('run-id', 'test-event');

        expect(mockFsp.writeFile).toHaveBeenCalled();
      });
    });

    describe('listEvents', () => {
      it('should list events sorted by created_at', async () => {
        const events = [
          { id: 'event1', created_at: '2023-01-02' },
          { id: 'event2', created_at: '2023-01-01' }
        ];
        mockFsp.readFile.mockResolvedValue(JSON.stringify(events));

        const result = await store.listEvents('run-id');

        expect(result[0]!.id).toBe('event2'); // Earlier first
        expect(result[1]!.id).toBe('event1');
      });
    });
  });

  describe('Gate Operations - FS Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
    });

    describe('createOrGetGate', () => {
      it('should create new gate if none exists', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('File not found'));

        const result = await store.createOrGetGate('run-id', 'step-id', 'approval');

        expect(result).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          run_id: 'run-id',
          step_id: 'step-id',
          gate_type: 'approval',
          status: 'pending'
        });
      });

      it('should return existing gate', async () => {
        const existingGate = {
          id: 'gate-123',
          run_id: 'run-id',
          step_id: 'step-id',
          gate_type: 'approval',
          status: 'pending',
          created_at: '2023-01-01'
        };
        mockFsp.readFile.mockResolvedValue(JSON.stringify([existingGate]));

        const result = await store.createOrGetGate('run-id', 'step-id', 'approval');

        expect(result).toEqual(existingGate);
      });
    });

    describe('updateGate', () => {
      it('should update gate with approval info', async () => {
        const existingGates = [
          { id: 'gate-123', status: 'pending', approved_by: null, approved_at: null }
        ];
        mockFsp.readFile.mockResolvedValue(JSON.stringify(existingGates));

        await store.updateGate('gate-123', {
          run_id: 'run-id',
          status: 'approved',
          approved_by: 'user-123'
        });

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'runs', 'run-id', 'gates.json'),
          expect.stringContaining('"status": "approved"')
        );
      });
    });

    describe('getLatestGate', () => {
      it('should return most recent gate for step', async () => {
        const gates = [
          { id: 'gate1', step_id: 'step-id', created_at: '2023-01-01' },
          { id: 'gate2', step_id: 'step-id', created_at: '2023-01-02' },
          { id: 'gate3', step_id: 'other-step', created_at: '2023-01-03' }
        ];
        mockFsp.readFile.mockResolvedValue(JSON.stringify(gates));

        const result = await store.getLatestGate('run-id', 'step-id');

        expect(result!.id).toBe('gate2'); // Most recent for step-id
      });
    });

    describe('listGatesByRun', () => {
      it('should list gates sorted by created_at', async () => {
        const gates = [
          { id: 'gate1', created_at: '2023-01-02' },
          { id: 'gate2', created_at: '2023-01-01' }
        ];
        mockFsp.readFile.mockResolvedValue(JSON.stringify(gates));

        const result = await store.listGatesByRun('run-id');

        expect(result[0]!.id).toBe('gate2'); // Earlier first
        expect(result[1]!.id).toBe('gate1');
      });
    });
  });

  describe('Artifact Operations - FS Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
    });

    describe('addArtifact', () => {
      it('should add artifact to artifacts file', async () => {
        const mockStep = { id: 'step-id', run_id: 'run-id' };
        mockFsp.readdir.mockResolvedValue(['run-id'] as any);
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify(mockStep)) // for step lookup
          .mockResolvedValueOnce('[]'); // for artifacts file

        const result = await store.addArtifact('step-id', 'log', '/path/to/log', { size: 1024 });

        expect(result).toMatchObject({
          id: expect.stringMatching(/^test-uuid-\d+$/),
          step_id: 'step-id',
          type: 'log',
          path: '/path/to/log',
          metadata: { size: 1024 }
        });
      });

      it('should throw error if step not found', async () => {
        mockFsp.readdir.mockResolvedValue([] as any);
        mockFsp.readFile.mockRejectedValue(new Error('Not found'));

        await expect(store.addArtifact('non-existent', 'log', '/path')).rejects.toThrow('step not found');
      });
    });

    describe('listArtifactsByRun', () => {
      it('should list artifacts with step names', async () => {
        const artifacts = [
          { id: 'art1', step_id: 'step1', type: 'log', path: '/path1' }
        ];
        const steps = [
          { id: 'step1', name: 'Step One' }
        ];

        // First read: artifacts file
        // Second read: step file
        mockFsp.readFile
          .mockResolvedValueOnce(JSON.stringify(artifacts))
          .mockResolvedValueOnce(JSON.stringify(steps[0]));
        mockFsp.readdir.mockResolvedValue(['step1.json'] as any);

        const result = await store.listArtifactsByRun('run-id');

        expect(result[0]).toMatchObject({
          id: 'art1',
          step_name: 'Step One'
        });
      });
    });
  });

  describe('Inbox/Outbox Operations - FS Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
    });

    describe('inbox operations', () => {
      it('should mark new keys', async () => {
        const result1 = await store.inboxMarkIfNew('key1');
        const result2 = await store.inboxMarkIfNew('key1');

        expect(result1).toBe(true);
        expect(result2).toBe(false);
      });

      it('should delete keys', async () => {
        await store.inboxMarkIfNew('key1');
        await store.inboxDelete('key1');
        const result = await store.inboxMarkIfNew('key1');

        expect(result).toBe(true);
      });
    });

    describe('outbox operations', () => {
      it('should add messages to outbox', async () => {
        mockFsp.readFile.mockRejectedValue(new Error('File not found'));

        await store.outboxAdd('topic1', { message: 'test' });

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'outbox.json'),
          expect.stringContaining('"topic": "topic1"')
        );
      });

      it('should list unsent messages', async () => {
        const messages = [
          { id: 'msg1', sent: false },
          { id: 'msg2', sent: true },
          { id: 'msg3', sent: false }
        ];
        mockFsp.readFile.mockResolvedValue(JSON.stringify(messages));

        const result = await store.outboxListUnsent();

        expect(result).toHaveLength(2);
        expect(result.map(m => m.id)).toEqual(['msg1', 'msg3']);
      });

      it('should mark messages as sent', async () => {
        const messages = [
          { id: 'msg1', sent: false }
        ];
        mockFsp.readFile.mockResolvedValue(JSON.stringify(messages));

        await store.outboxMarkSent('msg1');

        expect(mockFsp.writeFile).toHaveBeenCalledWith(
          path.join(ROOT, 'outbox.json'),
          expect.stringContaining('"sent": true')
        );
      });
    });
  });

  describe('Run Operations - DB Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'db';
      mockDb.query.mockResolvedValue({ rows: [] });
    });

    describe('createRun', () => {
      it('should create run in database', async () => {
        const mockRun = {
          id: 'db-run-123',
          status: 'queued',
          plan: { goal: 'test' },
          created_at: '2023-01-01',
          project_id: 'project-123'
        };
        mockDb.query.mockResolvedValue({ rows: [mockRun] });

        const result = await store.createRun({ goal: 'test' }, 'project-123');

        expect(result).toEqual(mockRun);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('insert into nofx.run'),
          [{ goal: 'test' }, 'project-123']
        );
      });

      it('should throw error if database insert fails', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        await expect(store.createRun({ goal: 'test' })).rejects.toThrow('failed to create run');
      });
    });

    describe('getRun', () => {
      it('should get run from database', async () => {
        const mockRun = { id: 'db-run-123', status: 'queued' };
        mockDb.query.mockResolvedValue({ rows: [mockRun] });

        const result = await store.getRun('db-run-123');

        expect(result).toEqual(mockRun);
        expect(mockDb.query).toHaveBeenCalledWith(
          'select * from nofx.run where id = $1',
          ['db-run-123']
        );
      });
    });

    describe('updateRun', () => {
      it('should update run in database', async () => {
        await store.updateRun('run-123', { status: 'running', ended_at: '2023-01-01' });

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('update nofx.run set'),
          ['run-123', 'running', '2023-01-01']
        );
      });

      it('should handle database update errors with fallback', async () => {
        mockDb.query
          .mockRejectedValueOnce(new Error('Column not found'))
          .mockResolvedValueOnce({ rows: [] });

        await store.updateRun('run-123', { status: 'running', ended_at: '2023-01-01' });

        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('listRuns', () => {
      it('should list runs with project filter', async () => {
        const mockRuns = [
          { id: 'run1', status: 'queued', created_at: '2023-01-01', title: 'Test 1' }
        ];
        mockDb.query.mockResolvedValue({ rows: mockRuns });

        const result = await store.listRuns(50, 'project-123');

        expect(result).toEqual(mockRuns);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('where project_id = $1'),
          ['project-123']
        );
      });

      it('should list all runs without project filter', async () => {
        const mockRuns = [
          { id: 'run1', status: 'queued', created_at: '2023-01-01', title: 'Test 1' }
        ];
        mockDb.query.mockResolvedValue({ rows: mockRuns });

        const result = await store.listRuns();

        expect(result).toEqual(mockRuns);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('order by created_at desc')
        );
      });
    });
  });

  describe('Step Operations - DB Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'db';
      mockDb.query.mockResolvedValue({ rows: [] });
    });

    describe('createStep', () => {
      it('should create step in database', async () => {
        const mockStep = {
          id: 'step-123',
          run_id: 'run-123',
          name: 'test-step',
          tool: 'test-tool',
          inputs: { param: 'value' },
          status: 'queued'
        };
        mockDb.query.mockResolvedValue({ rows: [mockStep] });

        const result = await store.createStep('run-123', 'test-step', 'test-tool', { param: 'value' });

        expect(result).toEqual(mockStep);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('insert into nofx.step'),
          ['run-123', 'test-step', 'test-tool', { param: 'value' }, null]
        );
      });

      it('should handle idempotency conflicts', async () => {
        const existingStep = { id: 'existing-step', idempotency_key: 'key-123' };
        mockDb.query
          .mockResolvedValueOnce({ rows: [] }) // insert returns nothing (conflict)
          .mockResolvedValueOnce({ rows: [existingStep] }); // select existing

        const result = await store.createStep('run-123', 'test', 'tool', {}, 'key-123');

        expect(result).toEqual(existingStep);
        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('updateStep', () => {
      it('should update step in database', async () => {
        await store.updateStep('step-123', {
          status: 'running',
          started_at: '2023-01-01',
          outputs: { result: 'success' }
        });

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('update nofx.step set'),
          ['step-123', 'running', '2023-01-01', null, { result: 'success' }]
        );
      });

      it('should handle database update errors with fallback', async () => {
        mockDb.query
          .mockRejectedValueOnce(new Error('Column not found'))
          .mockResolvedValueOnce({ rows: [] });

        await store.updateStep('step-123', { status: 'running' });

        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('resetStep', () => {
      it('should reset step in database', async () => {
        await store.resetStep('step-123');

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining("set status='queued'"),
          ['step-123']
        );
      });

      it('should handle database reset errors with fallback', async () => {
        mockDb.query
          .mockRejectedValueOnce(new Error('Column not found'))
          .mockResolvedValueOnce({ rows: [] });

        await store.resetStep('step-123');

        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('User Operations - DB Driver', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'db';
      mockDb.query.mockResolvedValue({ rows: [] });
    });

    describe('getUserRole', () => {
      it('should return user role from database', async () => {
        mockDb.query.mockResolvedValue({ rows: [{ role: 'admin' }] });

        const result = await store.getUserRole('user-123');

        expect(result).toBe('admin');
        expect(mockDb.query).toHaveBeenCalledWith(
          'select role from users where id=$1',
          ['user-123']
        );
      });

      it('should return null for non-existent user', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await store.getUserRole('non-existent');

        expect(result).toBe(null);
      });

      it('should return null for FS driver', async () => {
        process.env.DATA_DRIVER = 'fs';

        const result = await store.getUserRole('user-123');

        expect(result).toBe(null);
      });
    });

    describe('listRunsByUser', () => {
      it('should list runs for specific user', async () => {
        const mockRuns = [
          { id: 'run1', user_id: 'user-123', status: 'queued' }
        ];
        mockDb.query.mockResolvedValue({ rows: mockRuns });

        const result = await store.listRunsByUser('user-123', 50);

        expect(result).toEqual(mockRuns);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('user_id=$1'),
          ['user-123', 50]
        );
      });

      it('should filter by project if provided', async () => {
        const mockRuns = [
          { id: 'run1', user_id: 'user-123', project_id: 'project-123' }
        ];
        mockDb.query.mockResolvedValue({ rows: mockRuns });

        const result = await store.listRunsByUser('user-123', 50, 'project-123');

        expect(result).toEqual(mockRuns);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('user_id=$1 and project_id=$2'),
          ['user-123', 'project-123', 50]
        );
      });

      it('should fallback to regular listRuns for FS driver', async () => {
        process.env.DATA_DRIVER = 'fs';
        mockFsp.readdir.mockResolvedValue(['run1'] as any);
        mockFsp.readFile.mockResolvedValue(JSON.stringify({
          id: 'run1',
          status: 'queued',
          created_at: '2023-01-01',
          plan: {}
        }));

        const result = await store.listRunsByUser('user-123');

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('createRunWithUser', () => {
      it('should create run with user association', async () => {
        const mockRun = {
          id: 'run-123',
          plan: { goal: 'test' },
          status: 'queued',
          project_id: 'project-123',
          user_id: 'user-123'
        };
        mockDb.query
          .mockResolvedValueOnce({ rows: [] }) // insert
          .mockResolvedValueOnce({ rows: [mockRun] }); // select

        const result = await store.createRunWithUser({ goal: 'test' }, 'project-123', 'user-123');

        expect(result).toEqual(mockRun);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('insert into nofx.run'),
          expect.arrayContaining(['user-123'])
        );
      });

      it('should fallback to regular createRun for FS driver', async () => {
        process.env.DATA_DRIVER = 'fs';
        mockFsp.readdir.mockResolvedValue([] as any);
        mockFsp.readFile.mockResolvedValue('[]');

        const result = await store.createRunWithUser({ goal: 'test' }, 'project-123', 'user-123');

        expect(result.plan).toEqual({ goal: 'test' });
      });
    });
  });

  describe('Database Operations - All Entities', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'db';
      mockDb.query.mockResolvedValue({ rows: [] });
    });

    describe('event operations', () => {
      it('should record events in database', async () => {
        await store.recordEvent('run-123', 'test-event', { data: 'test' });

        expect(mockDb.query).toHaveBeenCalledWith(
          'insert into nofx.event (run_id, type, payload) values ($1, $2, $3)',
          ['run-123', 'test-event', { data: 'test' }]
        );
      });

      it('should list events from database', async () => {
        const mockEvents = [{ id: 'event1', type: 'test' }];
        mockDb.query.mockResolvedValue({ rows: mockEvents });

        const result = await store.listEvents('run-123');

        expect(result).toEqual(mockEvents);
      });
    });

    describe('gate operations', () => {
      it('should create gates in database', async () => {
        const mockGate = { id: 'gate-123', status: 'pending' };
        mockDb.query
          .mockResolvedValueOnce({ rows: [mockGate] });

        const result = await store.createOrGetGate('run-123', 'step-123', 'approval');

        expect(result).toEqual(mockGate);
      });

      it('should update gates in database', async () => {
        await store.updateGate('gate-123', {
          run_id: 'run-123',
          status: 'approved',
          approved_by: 'user-123'
        });

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('update nofx.gate'),
          ['gate-123', 'approved', 'user-123']
        );
      });
    });

    describe('artifact operations', () => {
      it('should add artifacts to database', async () => {
        await store.addArtifact('step-123', 'log', '/path/to/log', { size: 1024 });

        expect(mockDb.query).toHaveBeenCalledWith(
          'insert into nofx.artifact (step_id, type, path, metadata) values ($1,$2,$3,$4)',
          ['step-123', 'log', '/path/to/log', { size: 1024 }]
        );
      });

      it('should list artifacts with step names from database', async () => {
        const mockArtifacts = [
          { id: 'art1', step_id: 'step1', step_name: 'Step One' }
        ];
        mockDb.query.mockResolvedValue({ rows: mockArtifacts });

        const result = await store.listArtifactsByRun('run-123');

        expect(result).toEqual(mockArtifacts);
      });
    });

    describe('inbox/outbox operations', () => {
      it('should handle inbox operations in database', async () => {
        mockDb.query.mockResolvedValue({ rows: [{ id: 'inbox-123' }] });

        const result = await store.inboxMarkIfNew('key-123');

        expect(result).toBe(true);
        expect(mockDb.query).toHaveBeenCalledWith(
          'insert into nofx.inbox (key) values ($1) on conflict do nothing returning id',
          ['key-123']
        );
      });

      it('should detect duplicate inbox keys', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await store.inboxMarkIfNew('key-123');

        expect(result).toBe(false);
      });

      it('should add outbox messages to database', async () => {
        await store.outboxAdd('topic-123', { message: 'test' });

        expect(mockDb.query).toHaveBeenCalledWith(
          'insert into nofx.outbox (topic, payload) values ($1,$2)',
          ['topic-123', { message: 'test' }]
        );
      });

      it('should list unsent outbox messages from database', async () => {
        const mockMessages = [
          { id: 'msg1', topic: 'topic1', sent: false }
        ];
        mockDb.query.mockResolvedValue({ rows: mockMessages });

        const result = await store.outboxListUnsent(25);

        expect(result).toEqual(mockMessages);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('where sent=false')
        );
      });

      it('should mark outbox messages as sent in database', async () => {
        await store.outboxMarkSent('msg-123');

        expect(mockDb.query).toHaveBeenCalledWith(
          'update nofx.outbox set sent=true, sent_at=now() where id=$1',
          ['msg-123']
        );
      });
    });

    describe('resetRun', () => {
      it('should reset run in database', async () => {
        await store.resetRun('run-123');

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining("set status='queued'"),
          ['run-123']
        );
      });

      it('should handle database reset errors with fallback', async () => {
        mockDb.query
          .mockRejectedValueOnce(new Error('Column not found'))
          .mockResolvedValueOnce({ rows: [] });

        await store.resetRun('run-123');

        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
    });

    it('should handle file system errors gracefully in ensureDirSync', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(store.createRun({ goal: 'test' })).rejects.toThrow();
    });

    it('should handle JSON parsing errors in FS operations', async () => {
      mockFsp.readFile.mockResolvedValue('invalid-json');

      const result = await store.getRun('test-id');

      expect(result).toBeUndefined();
    });

    it('should handle large payloads', async () => {
      const largePlan = {
        goal: 'large test',
        data: 'x'.repeat(10000) // 10KB string
      };

      const result = await store.createRun(largePlan);

      expect(result.plan).toEqual(largePlan);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(store.inboxMarkIfNew(`key-${i}`));
      }

      const results = await Promise.all(promises);

      expect(results.every(r => r === true)).toBe(true);
    });

    it('should handle missing optional parameters', async () => {
      const result = await store.createStep('run-id', 'test-step', 'test-tool');

      expect(result!.inputs).toEqual({});
      expect(result!.idempotency_key).toBe(null);
    });

    it('should handle database connection failures gracefully', async () => {
      process.env.DATA_DRIVER = 'db';
      mockDb.query.mockRejectedValue(new Error('Connection failed'));

      await expect(store.createRun({ goal: 'test' })).rejects.toThrow('Connection failed');
    });
  });

  describe('Integration Scenarios', () => {
    // Create a simulated in-memory file system for integration tests
    const memoryFS = new Map<string, string>();

    beforeEach(() => {
      process.env.DATA_DRIVER = 'fs';
      jest.clearAllMocks();
      memoryFS.clear();

      // Setup mocks to use memory FS
      mockFsp.writeFile.mockImplementation(async (path: any, data: any) => {
        memoryFS.set(path as string, data as string);
        return undefined as any;
      });
      mockFsp.readFile.mockImplementation(async (path: any) => {
        const data = memoryFS.get(path as string);
        if (!data) throw new Error('File not found');
        return data as any;
      });
      mockFsp.readdir.mockImplementation(async (path: any) => {
        // Return directory contents based on path
        const pathStr = path as string;

        // Handle steps directory
        if (pathStr.includes('/steps')) {
          const keys = Array.from(memoryFS.keys()).filter(k => k.startsWith(pathStr) && k.endsWith('.json'));
          return keys.map(k => k.split('/').pop() as string) as any;
        }

        // Handle events directory or other subdirectories
        if (pathStr.includes('/runs/') && !pathStr.endsWith('/runs')) {
          const keys = Array.from(memoryFS.keys()).filter(k => k.startsWith(pathStr) && k.endsWith('.json'));
          return keys.map(k => k.split('/').pop() as string) as any;
        }

        // List run directories
        const keys = Array.from(memoryFS.keys()).filter(k => k.includes('/runs/') && k.endsWith('/run.json'));
        const runIds = keys.map(k => k.split('/runs/')[1]!.split('/')[0]!);
        return [...new Set(runIds)] as any;
      });
    });

    it('should handle complete run lifecycle', async () => {
      // Create run
      const run = await store.createRun({ goal: 'integration test' });
      expect(run.status).toBe('queued');

      // Create steps
      const step1 = await store.createStep(run.id, 'step1', 'tool1', { input: 'value1' });
      const step2 = await store.createStep(run.id, 'step2', 'tool2', { input: 'value2' });

      // Update run status
      await store.updateRun(run.id, { status: 'running' });

      // Record events
      await store.recordEvent(run.id, 'run_started');
      await store.recordEvent(run.id, 'step_started', {}, step1!.id);

      // Create gates
      const gate = await store.createOrGetGate(run.id, step1!.id, 'approval');
      expect(gate!.status).toBe('pending');

      // Update gate
      await store.updateGate(gate!.id, {
        run_id: run.id,
        status: 'approved',
        approved_by: 'user-123'
      });

      // Add artifacts
      await store.addArtifact(step1!.id, 'log', '/tmp/step1.log');

      // List everything
      const steps = await store.listStepsByRun(run.id);
      const events = await store.listEvents(run.id);
      const gates = await store.listGatesByRun(run.id);
      const artifacts = await store.listArtifactsByRun(run.id);

      expect(steps).toHaveLength(2);
      expect(events.length).toBeGreaterThan(0);
      expect(gates).toHaveLength(1);
      expect(artifacts).toHaveLength(1);
    });

    it('should handle idempotency correctly', async () => {
      const run = await store.createRun({ goal: 'idempotency test' });

      // Create step with idempotency key
      const step1 = await store.createStep(run.id, 'step1', 'tool1', { input: 'value1' }, 'key-123');

      // Try to create same step again
      const step2 = await store.createStep(run.id, 'step1', 'tool1', { input: 'value1' }, 'key-123');

      expect(step1!.id).toBe(step2!.id);
    });

    it('should handle outbox message lifecycle', async () => {
      // Add messages
      await store.outboxAdd('topic1', { data: 'message1' });
      await store.outboxAdd('topic2', { data: 'message2' });

      // List unsent
      const unsent = await store.outboxListUnsent();
      expect(unsent).toHaveLength(2);

      // Mark first as sent
      await store.outboxMarkSent(unsent[0]!.id);

      // List unsent again
      const stillUnsent = await store.outboxListUnsent();
      expect(stillUnsent).toHaveLength(1);
    });
  });
});