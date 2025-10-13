/**
 * Comprehensive unit tests for EventManagementService
 * Target Coverage: 90%
 *
 * Tests cover:
 * - Event recording with various payloads
 * - Event listing and ordering
 * - Optional step ID handling
 * - Chronological ordering
 * - Concurrent event recording
 * - Edge cases
 */

import { EventManagementService } from '../EventManagementService';
import { FileOperationService } from '../FileOperationService';
import type { EventRow } from '../../types';

// Mock crypto module
jest.mock('node:crypto', () => ({
  randomUUID: jest.fn()
}));

// Mock path module
jest.mock('node:path', () => ({
  join: jest.fn((...segments) => segments.join('/')),
}));

describe('EventManagementService', () => {
  let service: EventManagementService;
  let mockFileOps: jest.Mocked<FileOperationService>;
  let mockRandomUUID: jest.MockedFunction<() => string>;
  const testRoot = '/workspace';

  beforeEach(() => {
    // Setup UUID mock
    mockRandomUUID = require('node:crypto').randomUUID as jest.MockedFunction<() => string>;
    mockRandomUUID.mockReturnValue('event-uuid-123');

    // Create mock FileOperationService
    mockFileOps = {
      ensureDirSync: jest.fn(),
      writeJsonFile: jest.fn().mockResolvedValue(undefined),
      readJsonFile: jest.fn().mockResolvedValue(null), // Return null for non-existent events.json
      readDirectorySafe: jest.fn().mockResolvedValue([]),
      fileExists: jest.fn().mockReturnValue(true),
      getEventPath: jest.fn((runId, eventId) =>
        `/workspace/runs/${runId}/events/${eventId}.json`
      ),
      getEventsDirectory: jest.fn((runId) =>
        `/workspace/runs/${runId}/events`
      ),
      getStepPath: jest.fn(),
      getStepsDirectory: jest.fn(),
      getArtifactPath: jest.fn(),
      getRunPath: jest.fn(),
      getRunDirectory: jest.fn(),
      getRunsIndexPath: jest.fn(),
    } as any;

    service = new EventManagementService(mockFileOps, testRoot);

    // Mock Date for consistent timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('recordEvent', () => {
    it('records event with all required fields', async () => {
      const runId = 'run-123';
      const type = 'step.started';
      const payload = { stepName: 'Execute Test', tool: 'test_runner' };

      await service.recordEvent(runId, type, payload);

      // Implementation writes to events.json with an array of events
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/events.json',
        [{
          id: 'event-uuid-123',
          run_id: runId,
          type,
          payload,
          created_at: '2024-01-15T12:00:00.000Z'
        }]
      );
    });

    it('records event with step ID', async () => {
      const stepId = 'step-456';

      await service.recordEvent('run-123', 'step.completed', { result: 'success' }, stepId);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            step_id: stepId
          })
        ])
      );
    });

    it('records event without step ID', async () => {
      await service.recordEvent('run-123', 'run.started', {});

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/events.json',
        expect.arrayContaining([
          expect.not.objectContaining({
            
            step_id: expect.anything()
          })
        ])
      );
    });

    it('ensures run directory exists', async () => {
      await service.recordEvent('run-789', 'test.event', {});

      // Implementation ensures the run directory exists, not events subdirectory
      expect(mockFileOps.ensureDirSync).toHaveBeenCalledWith('/workspace/runs/run-789');
    });

    it('handles default empty payload', async () => {
      await service.recordEvent('run-123', 'simple.event');

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            payload: {}
          })
        ])
      );
    });

    it('handles null payload', async () => {
      await service.recordEvent('run-123', 'null.event', null);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            payload: null
          })
        ])
      );
    });

    it('handles complex nested payloads', async () => {
      const complexPayload = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, 3],
              boolean: true,
              nested: { deep: 'value' }
            }
          }
        },
        metadata: {
          user: 'test-user',
          timestamp: Date.now()
        }
      };

      await service.recordEvent('run-123', 'complex.event', complexPayload);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            payload: complexPayload
          })
        ])
      );
    });

    it('handles array payloads', async () => {
      const arrayPayload = [1, 2, 3, { key: 'value' }];

      await service.recordEvent('run-123', 'array.event', arrayPayload);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-123/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            payload: arrayPayload
          })
        ])
      );
    });

    it('generates unique IDs for multiple events', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      // First event - writes array with one event
      await service.recordEvent('run-1', 'event.1', {});
      // Second event - reads existing array and appends
      mockFileOps.readJsonFile.mockResolvedValueOnce([{ id: 'uuid-1' }] as any);
      await service.recordEvent('run-1', 'event.2', {});
      // Third event - reads existing array and appends
      mockFileOps.readJsonFile.mockResolvedValueOnce([{ id: 'uuid-1' }, { id: 'uuid-2' }] as any);
      await service.recordEvent('run-1', 'event.3', {});

      const calls = mockFileOps.writeJsonFile.mock.calls;
      expect(calls[0][1]).toEqual([expect.objectContaining({ id: 'uuid-1' })]);
      expect(calls[1][1]).toEqual([
        expect.objectContaining({ id: 'uuid-1' }),
        expect.objectContaining({ id: 'uuid-2' })
      ]);
      expect(calls[2][1]).toEqual([
        expect.objectContaining({ id: 'uuid-1' }),
        expect.objectContaining({ id: 'uuid-2' }),
        expect.objectContaining({ id: 'uuid-3' })
      ]);
    });

    it('records events with different types', async () => {
      const eventTypes = [
        'run.started',
        'run.completed',
        'step.started',
        'step.completed',
        'error.occurred',
        'warning.issued'
      ];

      for (const type of eventTypes) {
        await service.recordEvent('run-1', type, {});
      }

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledTimes(eventTypes.length);
    });

    it('propagates write errors', async () => {
      mockFileOps.writeJsonFile.mockRejectedValue(new Error('ENOSPC: no space left'));

      await expect(
        service.recordEvent('run-1', 'test.event', {})
      ).rejects.toThrow('ENOSPC');
    });

    it('handles very large payloads', async () => {
      const largePayload = {
        data: new Array(10000).fill(null).map((_, i) => ({ id: i, value: `item-${i}` }))
      };

      await service.recordEvent('run-1', 'large.event', largePayload);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-1/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            payload: largePayload
          })
        ])
      );
    });

    it('handles special characters in event type', async () => {
      await service.recordEvent('run-1', 'event.type-with_special.chars', {});

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-1/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'event.type-with_special.chars'
          })
        ])
      );
    });

    it('generates consistent timestamps', async () => {
      await service.recordEvent('run-1', 'event.1', {});

      jest.advanceTimersByTime(1000);
      jest.setSystemTime(new Date('2024-01-15T12:00:01.000Z'));

      await service.recordEvent('run-1', 'event.2', {});

      const calls = mockFileOps.writeJsonFile.mock.calls;
      expect(calls[0][1]).toEqual(expect.arrayContaining([
        expect.objectContaining({ created_at: '2024-01-15T12:00:00.000Z' })
      ]));
      expect(calls[1][1]).toEqual(expect.arrayContaining([
        expect.objectContaining({ created_at: '2024-01-15T12:00:01.000Z' })
      ]));
    });
  });

  describe('listEvents', () => {
    it('returns empty array when no events exist', async () => {
      mockFileOps.readJsonFile.mockResolvedValue(null);

      const result = await service.listEvents('run-123');

      expect(result).toEqual([]);
    });

    it('lists all events in a run', async () => {
      const events = [
        { id: 'event-1', type: 'run.started', created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'event-2', type: 'step.started', created_at: '2024-01-15T12:01:00.000Z' },
        { id: 'event-3', type: 'step.completed', created_at: '2024-01-15T12:02:00.000Z' }
      ];

      // Mock reading from events.json with array of events
      mockFileOps.readJsonFile.mockResolvedValue(events as any);

      const result = await service.listEvents('run-123');

      expect(result).toHaveLength(3);
      expect(result.map(e => e.id)).toEqual(['event-1', 'event-2', 'event-3']);
    });

    it('sorts events by created_at in ascending order (chronological)', async () => {
      // Events in unsorted order
      const events = [
        { id: 'event-3', created_at: '2024-01-15T12:02:00.000Z' },
        { id: 'event-1', created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'event-2', created_at: '2024-01-15T12:01:00.000Z' }
      ];

      mockFileOps.readJsonFile.mockResolvedValue(events as any);

      const result = await service.listEvents('run-123');

      // Should be sorted chronologically
      expect(result.map(e => e.id)).toEqual(['event-1', 'event-2', 'event-3']);
    });

    it('handles empty events array', async () => {
      mockFileOps.readJsonFile.mockResolvedValue([]);

      const result = await service.listEvents('run-123');

      expect(result).toEqual([]);
    });

    it('handles non-array data gracefully', async () => {
      mockFileOps.readJsonFile.mockResolvedValue({ not: 'an array' } as any);

      const result = await service.listEvents('run-123');

      expect(result).toEqual([]);
    });

    it('handles events with same timestamp', async () => {
      const timestamp = '2024-01-15T12:00:00.000Z';
      const events = [
        { id: 'event-1', created_at: timestamp },
        { id: 'event-2', created_at: timestamp },
        { id: 'event-3', created_at: timestamp }
      ];

      mockFileOps.readJsonFile.mockResolvedValue(events as any);

      const result = await service.listEvents('run-123');

      expect(result).toHaveLength(3);
      // Order should be stable even with same timestamps
    });

    it('handles large number of events efficiently', async () => {
      const events = new Array(1000).fill(null).map((_, i) => ({
        id: `event-${i}`,
        created_at: new Date(2024, 0, 15, 12, 0, i).toISOString()
      }));

      mockFileOps.readJsonFile.mockResolvedValue(events as any);

      const result = await service.listEvents('run-123');

      expect(result).toHaveLength(1000);
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent event recording', async () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      const promises = [
        service.recordEvent('run-1', 'event.1', { data: 1 }),
        service.recordEvent('run-1', 'event.2', { data: 2 }),
        service.recordEvent('run-1', 'event.3', { data: 3 })
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
      expect(mockFileOps.writeJsonFile).toHaveBeenCalledTimes(3);
    });

    it('handles concurrent event listing', async () => {
      mockFileOps.readJsonFile.mockResolvedValue([{ id: 'event-1' }] as any);

      const promises = [
        service.listEvents('run-1'),
        service.listEvents('run-2'),
        service.listEvents('run-3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toHaveLength(1));
    });

    it('handles concurrent recording and listing', async () => {
      mockRandomUUID.mockReturnValue('new-event-uuid');
      mockFileOps.readJsonFile.mockResolvedValue([{ id: 'existing' }] as any);

      const promises = [
        service.recordEvent('run-1', 'new.event', {}),
        service.listEvents('run-1')
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Event Types and Patterns', () => {
    it('handles run lifecycle events', async () => {
      const lifecycleEvents = [
        'run.created',
        'run.started',
        'run.paused',
        'run.resumed',
        'run.completed',
        'run.failed'
      ];

      for (const type of lifecycleEvents) {
        await service.recordEvent('run-1', type, {});
      }

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledTimes(lifecycleEvents.length);
    });

    it('handles step lifecycle events', async () => {
      const stepEvents = [
        'step.queued',
        'step.started',
        'step.completed',
        'step.failed',
        'step.skipped'
      ];

      for (const type of stepEvents) {
        await service.recordEvent('run-1', type, {}, 'step-123');
      }

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledTimes(stepEvents.length);
    });

    it('handles error and warning events', async () => {
      await service.recordEvent('run-1', 'error.occurred', {
        message: 'Test error',
        stack: 'Error stack trace'
      });

      await service.recordEvent('run-1', 'warning.issued', {
        message: 'Test warning'
      });

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty event type', async () => {
      await service.recordEvent('run-1', '', {});

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-1/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            type: ''
          })
        ])
      );
    });

    it('handles extremely long event types', async () => {
      const longType = 'event.' + 'a'.repeat(1000);

      await service.recordEvent('run-1', longType, {});

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-1/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            type: longType
          })
        ])
      );
    });

    it('handles payload with circular references gracefully', async () => {
      // The service should write the payload as-is without validating
      const payload: any = { name: 'test' };
      payload.circular = payload;

      // This will throw during JSON.stringify in writeJsonFile, which is expected behavior
      mockFileOps.writeJsonFile.mockRejectedValue(new Error('Converting circular structure to JSON'));

      await expect(
        service.recordEvent('run-1', 'circular.event', payload)
      ).rejects.toThrow('Converting circular structure to JSON');
    });

    it('handles events with undefined step_id', async () => {
      await service.recordEvent('run-1', 'test.event', {}, undefined);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-1/events.json',
        expect.arrayContaining([
          expect.not.objectContaining({
            step_id: expect.anything()
          })
        ])
      );
    });
  });

  describe('Data Integrity', () => {
    it('preserves payload structure exactly', async () => {
      const payload = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { deep: { value: 'test' } }
      };

      await service.recordEvent('run-1', 'test.event', payload);

      expect(mockFileOps.writeJsonFile).toHaveBeenCalledWith(
        '/workspace/runs/run-1/events.json',
        expect.arrayContaining([
          expect.objectContaining({
            payload
          })
        ])
      );
    });

    it('maintains event ordering by timestamp', async () => {
      // Events stored in unsorted order in events.json
      const events = [
        { id: 'e3', created_at: '2024-01-15T12:00:02.000Z' },
        { id: 'e1', created_at: '2024-01-15T12:00:00.000Z' },
        { id: 'e4', created_at: '2024-01-15T12:00:03.000Z' },
        { id: 'e2', created_at: '2024-01-15T12:00:01.000Z' }
      ];

      mockFileOps.readJsonFile.mockResolvedValue(events as any);

      const result = await service.listEvents('run-1');

      // Should be sorted chronologically
      expect(result.map(e => e.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
    });
  });
});
