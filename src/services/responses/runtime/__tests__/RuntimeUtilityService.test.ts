/**
 * RuntimeUtilityService Tests
 * Comprehensive test coverage for utility operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RuntimeUtilityService } from '../RuntimeUtilityService';
import type { RuntimeBundle } from '../../runtime';
import type { RunRecord, EventRecord } from '../../../../shared/responses/archive';

describe('RuntimeUtilityService', () => {
  let service: RuntimeUtilityService;
  let mockRuntime: RuntimeBundle;
  let mockArchive: any;
  let mockCoordinator: any;

  beforeEach(() => {
    mockArchive = {
      addModeratorNote: jest.fn(),
      exportRun: jest.fn(),
      rollback: jest.fn(),
    };

    mockCoordinator = {
      resyncFromArchive: jest.fn(),
    };

    mockRuntime = {
      archive: mockArchive,
      coordinator: mockCoordinator,
    } as any;

    service = new RuntimeUtilityService(mockRuntime);
  });

  describe('addResponsesModeratorNote', () => {
    it('should add moderator note successfully', () => {
      const mockNote = {
        reviewer: 'admin',
        note: 'Approved after review',
        disposition: 'approved' as 'approved',
        recordedAt: new Date('2024-01-01'),
      };

      mockArchive.addModeratorNote.mockReturnValue(mockNote);

      const result = service.addResponsesModeratorNote('run-123', {
        reviewer: 'admin',
        note: 'Approved after review',
        disposition: 'approved',
      });

      expect(mockArchive.addModeratorNote).toHaveBeenCalledWith('run-123', {
        reviewer: 'admin',
        note: 'Approved after review',
        disposition: 'approved',
      });
      expect(result).toEqual(mockNote);
    });

    it('should add moderator note with recordedAt', () => {
      const recordedAt = new Date('2024-01-01T10:00:00Z');
      const mockNote = {
        reviewer: 'admin',
        note: 'Test note',
        disposition: 'blocked' as 'blocked',
        recordedAt,
      };

      mockArchive.addModeratorNote.mockReturnValue(mockNote);

      const result = service.addResponsesModeratorNote('run-123', {
        reviewer: 'admin',
        note: 'Test note',
        disposition: 'blocked',
        recordedAt,
      });

      expect(result.recordedAt).toEqual(recordedAt);
    });

    it('should throw error when archive does not support moderator notes', () => {
      mockArchive.addModeratorNote = undefined;

      expect(() => {
        service.addResponsesModeratorNote('run-123', {
          reviewer: 'admin',
          note: 'Test note',
          disposition: 'approved',
        });
      }).toThrow('archive does not support moderator notes');
    });

    it('should handle different disposition types', () => {
      const dispositions = ['approved', 'escalated', 'blocked', 'info'] as const;

      for (const disposition of dispositions) {
        const mockNote = {
          reviewer: 'admin',
          note: `Note for ${disposition}`,
          disposition,
          recordedAt: new Date(),
        };

        mockArchive.addModeratorNote.mockReturnValue(mockNote);

        const result = service.addResponsesModeratorNote('run-123', {
          reviewer: 'admin',
          note: `Note for ${disposition}`,
          disposition,
        });

        expect(result.disposition).toBe(disposition);
      }
    });

    it('should handle very long notes', () => {
      const longNote = 'a'.repeat(10000);
      const mockNote = {
        reviewer: 'admin',
        note: longNote,
        disposition: 'approved' as 'approved',
        recordedAt: new Date(),
      };

      mockArchive.addModeratorNote.mockReturnValue(mockNote);

      const result = service.addResponsesModeratorNote('run-123', {
        reviewer: 'admin',
        note: longNote,
        disposition: 'approved',
      });

      expect(result.note).toBe(longNote);
    });
  });

  describe('exportResponsesRun', () => {
    it('should export run successfully', async () => {
      const exportData = '{"run": "data"}';
      mockArchive.exportRun.mockResolvedValue(exportData);

      const result = await service.exportResponsesRun('run-123');

      expect(mockArchive.exportRun).toHaveBeenCalledWith('run-123');
      expect(result).toBe(exportData);
    });

    it('should throw error when archive does not support export', async () => {
      mockArchive.exportRun = undefined;

      await expect(service.exportResponsesRun('run-123')).rejects.toThrow(
        'archive export not supported'
      );
    });

    it('should handle export errors gracefully', async () => {
      mockArchive.exportRun.mockRejectedValue(new Error('Export failed'));

      await expect(service.exportResponsesRun('run-123')).rejects.toThrow('Export failed');
    });
  });

  describe('rollbackResponsesRun', () => {
    it('should rollback run successfully', async () => {
      const mockRun: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const mockEvents: EventRecord[] = [
        {
          runId: 'run-123',
          sequence: 1,
          type: 'test',
          payload: {},
          occurredAt: new Date(),
        },
      ];

      const mockSnapshot = {
        run: mockRun,
        events: mockEvents,
      };

      mockArchive.rollback.mockReturnValue(mockSnapshot);
      mockCoordinator.resyncFromArchive.mockReturnValue(undefined);

      const result = await service.rollbackResponsesRun('run-123', { sequence: 5 });

      expect(mockArchive.rollback).toHaveBeenCalledWith('run-123', { sequence: 5 });
      expect(mockCoordinator.resyncFromArchive).toHaveBeenCalledWith('run-123');
      expect(result.run).toMatchObject({
        runId: 'run-123',
        status: 'completed',
      });
      expect(result.events).toHaveLength(1);
    });

    it('should handle async resync from coordinator', async () => {
      const mockRun: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.rollback.mockReturnValue({ run: mockRun, events: [] });
      mockCoordinator.resyncFromArchive.mockResolvedValue(undefined);

      await service.rollbackResponsesRun('run-123', { sequence: 1 });

      expect(mockCoordinator.resyncFromArchive).toHaveBeenCalledWith('run-123');
    });

    it('should throw error when archive does not support rollback', async () => {
      mockArchive.rollback = undefined;

      await expect(service.rollbackResponsesRun('run-123', { sequence: 1 })).rejects.toThrow(
        'archive does not support rollback operations'
      );
    });

    it('should handle rollback by tool call ID', async () => {
      const mockRun: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.rollback.mockReturnValue({ run: mockRun, events: [] });
      mockCoordinator.resyncFromArchive.mockReturnValue(undefined);

      await service.rollbackResponsesRun('run-123', { toolCallId: 'call-456' });

      expect(mockArchive.rollback).toHaveBeenCalledWith('run-123', { toolCallId: 'call-456' });
    });

    it('should include rollback metadata in response', async () => {
      const mockRun: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        metadata: { tenant_id: 'tenant-1' },
        traceId: 'trace-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.rollback.mockReturnValue({ run: mockRun, events: [] });
      mockCoordinator.resyncFromArchive.mockReturnValue(undefined);

      const result = await service.rollbackResponsesRun('run-123', { sequence: 1 });

      expect(result.run.metadata).toEqual({ tenant_id: 'tenant-1' });
      expect(result.run.traceId).toBe('trace-456');
    });
  });

  describe('serializeRunRecordMinimal', () => {
    it('should serialize run record with all fields', () => {
      const run: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        metadata: { tenant_id: 'tenant-1', custom: 'value' },
        traceId: 'trace-456',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T12:00:00Z'),
      };

      const serialized = service.serializeRunRecordMinimal(run);

      expect(serialized).toEqual({
        runId: 'run-123',
        status: 'completed',
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-02T12:00:00.000Z',
        model: 'gpt-4',
        metadata: { tenant_id: 'tenant-1', custom: 'value' },
        traceId: 'trace-456',
      });
    });

    it('should handle run without optional fields', () => {
      const run: RunRecord = {
        runId: 'run-123',
        status: 'queued',
        request: { model: 'gpt-4' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const serialized = service.serializeRunRecordMinimal(run);

      expect(serialized).toMatchObject({
        runId: 'run-123',
        status: 'queued',
        model: 'gpt-4',
        metadata: {},
      });
      expect(serialized.traceId).toBeUndefined();
    });

    it('should convert dates to ISO strings', () => {
      const createdAt = new Date('2024-06-15T14:30:00.000Z');
      const updatedAt = new Date('2024-06-15T15:45:00.000Z');

      const run: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt,
        updatedAt,
      };

      const serialized = service.serializeRunRecordMinimal(run);

      expect(serialized.createdAt).toBe('2024-06-15T14:30:00.000Z');
      expect(serialized.updatedAt).toBe('2024-06-15T15:45:00.000Z');
    });
  });

  describe('serializeEventRecordMinimal', () => {
    it('should serialize event record with all fields', () => {
      const event: EventRecord = {
        runId: 'run-123',
        sequence: 5,
        type: 'test_event',
        payload: { data: 'test', nested: { value: 123 } },
        occurredAt: new Date('2024-01-01T10:00:00Z'),
      };

      const serialized = service.serializeEventRecordMinimal(event);

      expect(serialized).toEqual({
        sequence: 5,
        type: 'test_event',
        payload: { data: 'test', nested: { value: 123 } },
        occurredAt: '2024-01-01T10:00:00.000Z',
      });
    });

    it('should handle event with null payload', () => {
      const event: EventRecord = {
        runId: 'run-123',
        sequence: 1,
        type: 'test',
        payload: null,
        occurredAt: new Date(),
      };

      const serialized = service.serializeEventRecordMinimal(event);

      expect(serialized.payload).toBeNull();
    });

    it('should handle event with complex payload', () => {
      const complexPayload = {
        array: [1, 2, 3],
        nested: {
          deep: {
            value: 'test',
          },
        },
        boolean: true,
        number: 42,
      };

      const event: EventRecord = {
        runId: 'run-123',
        sequence: 1,
        type: 'complex',
        payload: complexPayload,
        occurredAt: new Date(),
      };

      const serialized = service.serializeEventRecordMinimal(event);

      expect(serialized.payload).toEqual(complexPayload);
    });

    it('should convert date to ISO string', () => {
      const occurredAt = new Date('2024-06-15T14:30:00.000Z');

      const event: EventRecord = {
        runId: 'run-123',
        sequence: 1,
        type: 'test',
        payload: {},
        occurredAt,
      };

      const serialized = service.serializeEventRecordMinimal(event);

      expect(serialized.occurredAt).toBe('2024-06-15T14:30:00.000Z');
    });
  });

  describe('edge cases', () => {
    it('should handle rollback with both sequence and toolCallId', async () => {
      const mockRun: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.rollback.mockReturnValue({ run: mockRun, events: [] });
      mockCoordinator.resyncFromArchive.mockReturnValue(undefined);

      await service.rollbackResponsesRun('run-123', {
        sequence: 5,
        toolCallId: 'call-456',
      });

      expect(mockArchive.rollback).toHaveBeenCalledWith('run-123', {
        sequence: 5,
        toolCallId: 'call-456',
      });
    });

    it('should handle empty metadata object', () => {
      const run: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: { model: 'gpt-4' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const serialized = service.serializeRunRecordMinimal(run);

      expect(serialized.metadata).toEqual({});
    });

    it('should handle event with empty payload', () => {
      const event: EventRecord = {
        runId: 'run-123',
        sequence: 1,
        type: 'empty',
        payload: {},
        occurredAt: new Date(),
      };

      const serialized = service.serializeEventRecordMinimal(event);

      expect(serialized.payload).toEqual({});
    });

    it('should handle special characters in moderator notes', () => {
      const specialChars = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      const mockNote = {
        reviewer: 'admin',
        note: specialChars,
        disposition: 'approved' as 'approved',
        recordedAt: new Date(),
      };

      mockArchive.addModeratorNote.mockReturnValue(mockNote);

      const result = service.addResponsesModeratorNote('run-123', {
        reviewer: 'admin',
        note: specialChars,
        disposition: 'approved',
      });

      expect(result.note).toBe(specialChars);
    });

    it('should handle Unicode in moderator notes', () => {
      const unicode = '你好世界 🌍 مرحبا';
      const mockNote = {
        reviewer: 'admin',
        note: unicode,
        disposition: 'approved' as 'approved',
        recordedAt: new Date(),
      };

      mockArchive.addModeratorNote.mockReturnValue(mockNote);

      const result = service.addResponsesModeratorNote('run-123', {
        reviewer: 'admin',
        note: unicode,
        disposition: 'approved',
      });

      expect(result.note).toBe(unicode);
    });
  });
});
