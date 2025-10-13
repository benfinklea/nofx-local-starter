/**
 * RuntimeIncidentService Tests
 * Comprehensive test coverage for incident management operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RuntimeIncidentService } from '../RuntimeIncidentService';
import type { RuntimeBundle } from '../../runtime';
import type { IncidentRecord, IncidentStatus, IncidentDisposition } from '../../incidentLog';

describe('RuntimeIncidentService', () => {
  let service: RuntimeIncidentService;
  let mockRuntime: RuntimeBundle;
  let mockIncidents: any;

  beforeEach(() => {
    mockIncidents = {
      listIncidents: jest.fn(() => []),
      resolveIncident: jest.fn(),
      getIncidentsForRun: jest.fn(() => []),
    };

    mockRuntime = {
      incidents: mockIncidents,
    } as any;

    service = new RuntimeIncidentService(mockRuntime);
  });

  describe('listResponseIncidents', () => {
    it('should list open incidents by default', () => {
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-1',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date('2024-01-01T10:00:00Z'),
          tenantId: 'tenant-1',
          model: 'gpt-4',
          requestId: 'req-1',
          traceId: 'trace-1',
          reason: 'Rate limit exceeded',
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(mockIncidents.listIncidents).toHaveBeenCalledWith({ status: 'open' });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'incident-1',
        runId: 'run-1',
        status: 'open',
        type: 'failed',
        sequence: 1,
        occurredAt: '2024-01-01T10:00:00.000Z',
        tenantId: 'tenant-1',
        model: 'gpt-4',
        requestId: 'req-1',
        traceId: 'trace-1',
        reason: 'Rate limit exceeded',
        resolution: undefined,
      });
    });

    it('should list incidents with specific status', () => {
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-2',
          runId: 'run-2',
          status: 'resolved',
          type: 'incomplete',
          sequence: 1,
          occurredAt: new Date('2024-01-02T10:00:00Z'),
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents('resolved');

      expect(mockIncidents.listIncidents).toHaveBeenCalledWith({ status: 'resolved' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('resolved');
    });

    it('should return empty array when no incidents found', () => {
      mockIncidents.listIncidents.mockReturnValue([]);

      const result = service.listResponseIncidents();

      expect(result).toEqual([]);
    });

    it('should serialize all incident fields correctly', () => {
      const now = new Date();
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-3',
          runId: 'run-3',
          status: 'open',
          type: 'failed',
          sequence: 5,
          occurredAt: now,
          tenantId: 'tenant-2',
          model: 'gpt-3.5-turbo',
          requestId: 'req-2',
          traceId: 'trace-2',
          reason: 'Request timeout after 30s',
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result[0]).toEqual({
        id: 'incident-3',
        runId: 'run-3',
        status: 'open',
        type: 'failed',
        sequence: 5,
        occurredAt: now.toISOString(),
        tenantId: 'tenant-2',
        model: 'gpt-3.5-turbo',
        requestId: 'req-2',
        traceId: 'trace-2',
        reason: 'Request timeout after 30s',
        resolution: undefined,
      });
    });

    it('should handle incidents with optional fields missing', () => {
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-4',
          runId: 'run-4',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date(),
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result[0]).toMatchObject({
        id: 'incident-4',
        runId: 'run-4',
        status: 'open',
        type: 'failed',
        sequence: 1,
      });
      expect(result[0].tenantId).toBeUndefined();
      expect(result[0].model).toBeUndefined();
      expect(result[0].requestId).toBeUndefined();
      expect(result[0].traceId).toBeUndefined();
      expect(result[0].reason).toBeUndefined();
    });

    it('should handle large number of incidents', () => {
      const mockIncidentRecords: IncidentRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `incident-${i}`,
        runId: `run-${i}`,
        status: 'open' as IncidentStatus,
        type: 'failed' as const,
        sequence: 1,
        occurredAt: new Date(),
      }));

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result).toHaveLength(1000);
    });
  });

  describe('resolveResponseIncident', () => {
    it('should resolve incident with minimal input', () => {
      const resolvedAt = new Date('2024-01-03T12:00:00Z');
      const mockResolvedIncident: IncidentRecord = {
        id: 'incident-1',
        runId: 'run-1',
        status: 'resolved',
        type: 'failed',
        sequence: 1,
        occurredAt: new Date('2024-01-01T10:00:00Z'),
        resolution: {
          resolvedAt,
          resolvedBy: 'user-1',
          disposition: 'manual',
        },
      };

      mockIncidents.resolveIncident.mockReturnValue(mockResolvedIncident);

      const result = service.resolveResponseIncident({
        incidentId: 'incident-1',
        resolvedBy: 'user-1',
      });

      expect(mockIncidents.resolveIncident).toHaveBeenCalledWith({
        incidentId: 'incident-1',
        resolvedBy: 'user-1',
        notes: undefined,
        disposition: 'manual',
        linkedRunId: undefined,
      });
      expect(result).toEqual({
        id: 'incident-1',
        runId: 'run-1',
        status: 'resolved',
        type: 'failed',
        sequence: 1,
        occurredAt: '2024-01-01T10:00:00.000Z',
        tenantId: undefined,
        model: undefined,
        requestId: undefined,
        traceId: undefined,
        reason: undefined,
        resolution: {
          resolvedAt: resolvedAt.toISOString(),
          resolvedBy: 'user-1',
          notes: undefined,
          disposition: 'manual',
          linkedRunId: undefined,
        },
      });
    });

    it('should resolve incident with all optional fields', () => {
      const resolvedAt = new Date('2024-01-03T12:00:00Z');
      const mockResolvedIncident: IncidentRecord = {
        id: 'incident-2',
        runId: 'run-2',
        status: 'resolved',
        type: 'incomplete',
        sequence: 2,
        occurredAt: new Date('2024-01-02T10:00:00Z'),
        resolution: {
          resolvedAt,
          resolvedBy: 'system',
          notes: 'Fixed by retry',
          disposition: 'retry',
          linkedRunId: 'run-3',
        },
      };

      mockIncidents.resolveIncident.mockReturnValue(mockResolvedIncident);

      const result = service.resolveResponseIncident({
        incidentId: 'incident-2',
        resolvedBy: 'system',
        notes: 'Fixed by retry',
        disposition: 'retry',
        linkedRunId: 'run-3',
      });

      expect(mockIncidents.resolveIncident).toHaveBeenCalledWith({
        incidentId: 'incident-2',
        resolvedBy: 'system',
        notes: 'Fixed by retry',
        disposition: 'retry',
        linkedRunId: 'run-3',
      });
      expect(result.resolution).toEqual({
        resolvedAt: resolvedAt.toISOString(),
        resolvedBy: 'system',
        notes: 'Fixed by retry',
        disposition: 'retry',
        linkedRunId: 'run-3',
      });
    });

    it('should default disposition to manual when not provided', () => {
      const mockResolvedIncident: IncidentRecord = {
        id: 'incident-3',
        runId: 'run-3',
        status: 'resolved',
        type: 'failed',
        sequence: 1,
        occurredAt: new Date(),
        resolution: {
          resolvedAt: new Date(),
          resolvedBy: 'user-2',
          disposition: 'manual',
        },
      };

      mockIncidents.resolveIncident.mockReturnValue(mockResolvedIncident);

      service.resolveResponseIncident({
        incidentId: 'incident-3',
        resolvedBy: 'user-2',
      });

      expect(mockIncidents.resolveIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          disposition: 'manual',
        })
      );
    });

    it('should handle various disposition types', () => {
      const dispositions: IncidentDisposition[] = ['manual', 'retry', 'dismissed', 'escalated'];

      for (const disposition of dispositions) {
        const mockResolvedIncident: IncidentRecord = {
          id: `incident-${disposition}`,
          runId: `run-${disposition}`,
          status: 'resolved',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date(),
          resolution: {
            resolvedAt: new Date(),
            resolvedBy: 'system',
            disposition,
          },
        };

        mockIncidents.resolveIncident.mockReturnValue(mockResolvedIncident);

        const result = service.resolveResponseIncident({
          incidentId: `incident-${disposition}`,
          resolvedBy: 'system',
          disposition,
        });

        expect(result.resolution?.disposition).toBe(disposition);
      }
    });

    it('should preserve all incident metadata during resolution', () => {
      const occurredAt = new Date('2024-01-01T10:00:00Z');
      const resolvedAt = new Date('2024-01-03T12:00:00Z');
      const mockResolvedIncident: IncidentRecord = {
        id: 'incident-full',
        runId: 'run-full',
        status: 'resolved',
        type: 'failed',
        sequence: 10,
        occurredAt,
        tenantId: 'tenant-full',
        model: 'gpt-4',
        requestId: 'req-full',
        traceId: 'trace-full',
        reason: 'Rate limit exceeded',
        resolution: {
          resolvedAt,
          resolvedBy: 'admin',
          notes: 'Manual intervention',
          disposition: 'manual',
          linkedRunId: 'run-new',
        },
      };

      mockIncidents.resolveIncident.mockReturnValue(mockResolvedIncident);

      const result = service.resolveResponseIncident({
        incidentId: 'incident-full',
        resolvedBy: 'admin',
        notes: 'Manual intervention',
        disposition: 'manual',
        linkedRunId: 'run-new',
      });

      expect(result).toEqual({
        id: 'incident-full',
        runId: 'run-full',
        status: 'resolved',
        type: 'failed',
        sequence: 10,
        occurredAt: occurredAt.toISOString(),
        tenantId: 'tenant-full',
        model: 'gpt-4',
        requestId: 'req-full',
        traceId: 'trace-full',
        reason: 'Rate limit exceeded',
        resolution: {
          resolvedAt: resolvedAt.toISOString(),
          resolvedBy: 'admin',
          notes: 'Manual intervention',
          disposition: 'manual',
          linkedRunId: 'run-new',
        },
      });
    });
  });

  describe('getRunIncidents', () => {
    it('should get all incidents for a specific run', () => {
      const runId = 'run-1';
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-1',
          runId,
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'incident-2',
          runId,
          status: 'resolved',
          type: 'incomplete',
          sequence: 2,
          occurredAt: new Date('2024-01-01T11:00:00Z'),
          resolution: {
            resolvedAt: new Date('2024-01-01T12:00:00Z'),
            resolvedBy: 'system',
            disposition: 'retry',
          },
        },
      ];

      mockIncidents.getIncidentsForRun.mockReturnValue(mockIncidentRecords);

      const result = service.getRunIncidents(runId);

      expect(mockIncidents.getIncidentsForRun).toHaveBeenCalledWith(runId);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('incident-1');
      expect(result[1].id).toBe('incident-2');
    });

    it('should return empty array for run with no incidents', () => {
      mockIncidents.getIncidentsForRun.mockReturnValue([]);

      const result = service.getRunIncidents('run-no-incidents');

      expect(result).toEqual([]);
    });

    it('should serialize incidents with resolution data', () => {
      const resolvedAt = new Date('2024-01-02T12:00:00Z');
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-resolved',
          runId: 'run-1',
          status: 'resolved',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date('2024-01-01T10:00:00Z'),
          resolution: {
            resolvedAt,
            resolvedBy: 'admin',
            notes: 'Fixed manually',
            disposition: 'manual',
            linkedRunId: 'run-2',
          },
        },
      ];

      mockIncidents.getIncidentsForRun.mockReturnValue(mockIncidentRecords);

      const result = service.getRunIncidents('run-1');

      expect(result[0].resolution).toEqual({
        resolvedAt: resolvedAt.toISOString(),
        resolvedBy: 'admin',
        notes: 'Fixed manually',
        disposition: 'manual',
        linkedRunId: 'run-2',
      });
    });

    it('should handle incidents without resolution', () => {
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-open',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date(),
        },
      ];

      mockIncidents.getIncidentsForRun.mockReturnValue(mockIncidentRecords);

      const result = service.getRunIncidents('run-1');

      expect(result[0].resolution).toBeUndefined();
    });

    it('should handle multiple incidents with mixed statuses', () => {
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-1',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date(),
        },
        {
          id: 'incident-2',
          runId: 'run-1',
          status: 'resolved',
          type: 'incomplete',
          sequence: 2,
          occurredAt: new Date(),
          resolution: {
            resolvedAt: new Date(),
            resolvedBy: 'system',
            disposition: 'retry',
          },
        },
        {
          id: 'incident-3',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: 3,
          occurredAt: new Date(),
        },
      ];

      mockIncidents.getIncidentsForRun.mockReturnValue(mockIncidentRecords);

      const result = service.getRunIncidents('run-1');

      expect(result).toHaveLength(3);
      expect(result.filter((inc) => inc.status === 'open')).toHaveLength(2);
      expect(result.filter((inc) => inc.status === 'resolved')).toHaveLength(1);
    });
  });

  describe('date serialization', () => {
    it('should convert occurredAt to ISO string', () => {
      const occurredAt = new Date('2024-01-01T10:00:00.123Z');
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-1',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt,
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result[0].occurredAt).toBe('2024-01-01T10:00:00.123Z');
    });

    it('should convert resolvedAt to ISO string', () => {
      const resolvedAt = new Date('2024-01-02T15:30:45.678Z');
      const mockResolvedIncident: IncidentRecord = {
        id: 'incident-1',
        runId: 'run-1',
        status: 'resolved',
        type: 'failed',
        sequence: 1,
        occurredAt: new Date(),
        resolution: {
          resolvedAt,
          resolvedBy: 'system',
          disposition: 'manual',
        },
      };

      mockIncidents.resolveIncident.mockReturnValue(mockResolvedIncident);

      const result = service.resolveResponseIncident({
        incidentId: 'incident-1',
        resolvedBy: 'system',
      });

      expect(result.resolution?.resolvedAt).toBe('2024-01-02T15:30:45.678Z');
    });

    it('should maintain timezone information in serialization', () => {
      const date = new Date('2024-06-15T14:30:00.000Z');
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-1',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: date,
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result[0].occurredAt).toContain('Z');
      expect(new Date(result[0].occurredAt).getTime()).toBe(date.getTime());
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle incident with very long sequence number', () => {
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-1',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: Number.MAX_SAFE_INTEGER,
          occurredAt: new Date(),
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result[0].sequence).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle very long notes in resolution', () => {
      const longNotes = 'a'.repeat(10000);
      const mockResolvedIncident: IncidentRecord = {
        id: 'incident-1',
        runId: 'run-1',
        status: 'resolved',
        type: 'failed',
        sequence: 1,
        occurredAt: new Date(),
        resolution: {
          resolvedAt: new Date(),
          resolvedBy: 'system',
          notes: longNotes,
          disposition: 'manual',
        },
      };

      mockIncidents.resolveIncident.mockReturnValue(mockResolvedIncident);

      const result = service.resolveResponseIncident({
        incidentId: 'incident-1',
        resolvedBy: 'system',
        notes: longNotes,
      });

      expect(result.resolution?.notes).toBe(longNotes);
    });

    it('should handle special characters in incident fields', () => {
      const specialChars = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-special',
          runId: 'run-special',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date(),
          reason: specialChars,
          tenantId: specialChars,
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result[0].reason).toBe(specialChars);
      expect(result[0].tenantId).toBe(specialChars);
    });

    it('should handle Unicode characters in incident data', () => {
      const unicode = '你好世界 🌍 مرحبا';
      const mockIncidentRecords: IncidentRecord[] = [
        {
          id: 'incident-unicode',
          runId: 'run-unicode',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date(),
          reason: unicode,
        },
      ];

      mockIncidents.listIncidents.mockReturnValue(mockIncidentRecords);

      const result = service.listResponseIncidents();

      expect(result[0].reason).toBe(unicode);
    });
  });
});
