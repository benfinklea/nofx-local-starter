/**
 * RuntimeDataService Tests
 * Comprehensive test coverage for data management operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RuntimeDataService } from '../RuntimeDataService';
import type { RuntimeBundle } from '../../runtime';
import type { RunRecord } from '../../../../shared/responses/archive';

describe('RuntimeDataService', () => {
  let service: RuntimeDataService;
  let mockRuntime: RuntimeBundle;
  let mockArchive: any;

  beforeEach(() => {
    // Create mock archive with all necessary methods
    mockArchive = {
      pruneOlderThan: jest.fn(),
      deleteRun: jest.fn(),
      exportRun: jest.fn(),
      getRun: jest.fn(),
      getTimeline: jest.fn(),
      listRuns: jest.fn(() => []),
    };

    mockRuntime = {
      archive: mockArchive,
    } as any;

    service = new RuntimeDataService(mockRuntime);
  });

  describe('pruneOlderThanDays', () => {
    it('should prune data older than specified days', () => {
      const days = 30;
      const beforeCall = Date.now();

      service.pruneOlderThanDays(days);

      expect(mockArchive.pruneOlderThan).toHaveBeenCalledTimes(1);
      const callArg = mockArchive.pruneOlderThan.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Date);

      const expectedCutoff = beforeCall - days * 24 * 60 * 60 * 1000;
      const actualCutoff = callArg.getTime();
      expect(Math.abs(actualCutoff - expectedCutoff)).toBeLessThan(100);
    });

    it('should throw error for zero days', () => {
      expect(() => service.pruneOlderThanDays(0)).toThrow('Days must be positive');
    });

    it('should throw error for negative days', () => {
      expect(() => service.pruneOlderThanDays(-5)).toThrow('Days must be positive');
    });

    it('should handle archive without pruneOlderThan method gracefully', () => {
      const archiveWithoutPrune = { ...mockArchive };
      delete archiveWithoutPrune.pruneOlderThan;
      mockRuntime.archive = archiveWithoutPrune;
      service = new RuntimeDataService(mockRuntime);

      expect(() => service.pruneOlderThanDays(7)).not.toThrow();
    });

    it('should check for deleteRun method during pruning', () => {
      const archiveWithDeleteRun = {
        ...mockArchive,
        deleteRun: jest.fn(),
      };
      mockRuntime.archive = archiveWithDeleteRun;
      service = new RuntimeDataService(mockRuntime);

      service.pruneOlderThanDays(7);

      expect(mockArchive.pruneOlderThan).toHaveBeenCalled();
      // deleteRun check is performed but no additional logic yet
    });

    it('should prune data for 1 day correctly', () => {
      service.pruneOlderThanDays(1);

      expect(mockArchive.pruneOlderThan).toHaveBeenCalledTimes(1);
      const callArg = mockArchive.pruneOlderThan.mock.calls[0][0];
      const expectedCutoff = Date.now() - 24 * 60 * 60 * 1000;
      const actualCutoff = callArg.getTime();
      expect(Math.abs(actualCutoff - expectedCutoff)).toBeLessThan(100);
    });

    it('should prune data for 365 days correctly', () => {
      const days = 365;
      service.pruneOlderThanDays(days);

      expect(mockArchive.pruneOlderThan).toHaveBeenCalledTimes(1);
      const callArg = mockArchive.pruneOlderThan.mock.calls[0][0];
      const expectedCutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const actualCutoff = callArg.getTime();
      expect(Math.abs(actualCutoff - expectedCutoff)).toBeLessThan(100);
    });
  });

  describe('exportRun', () => {
    it('should export run using archive method if available', async () => {
      const runId = 'test-run-123';
      const exportData = '{"run": "data"}';
      mockArchive.exportRun.mockResolvedValue(exportData);

      const result = await service.exportRun(runId);

      expect(result).toBe(exportData);
      expect(mockArchive.exportRun).toHaveBeenCalledWith(runId);
    });

    it('should use fallback JSON export when archive method not available', async () => {
      const runId = 'test-run-123';
      const mockRun: RunRecord = {
        runId,
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      const mockEvents = [
        { sequence: 1, type: 'test', payload: {}, occurredAt: new Date() },
      ];

      delete mockArchive.exportRun;
      mockArchive.getRun.mockReturnValue(mockRun);
      mockArchive.getTimeline.mockReturnValue({ events: mockEvents });

      const result = await service.exportRun(runId);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('run');
      expect(parsed).toHaveProperty('events');
      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed.run.runId).toBe(runId);
      expect(parsed.events).toHaveLength(1);
    });

    it('should throw error when run not found', async () => {
      const runId = 'nonexistent-run';
      delete mockArchive.exportRun;
      mockArchive.getRun.mockReturnValue(null);

      await expect(service.exportRun(runId)).rejects.toThrow(`Run ${runId} not found`);
    });

    it('should handle run with no events', async () => {
      const runId = 'test-run-123';
      const mockRun: RunRecord = {
        runId,
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      delete mockArchive.exportRun;
      mockArchive.getRun.mockReturnValue(mockRun);
      mockArchive.getTimeline.mockReturnValue(undefined);

      const result = await service.exportRun(runId);
      const parsed = JSON.parse(result);

      expect(parsed.events).toEqual([]);
    });

    it('should include all run metadata in export', async () => {
      const runId = 'test-run-123';
      const mockRun: RunRecord = {
        runId,
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        metadata: { tenant_id: 'tenant-1', custom: 'value' },
        traceId: 'trace-123',
      };

      delete mockArchive.exportRun;
      mockArchive.getRun.mockReturnValue(mockRun);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const result = await service.exportRun(runId);
      const parsed = JSON.parse(result);

      expect(parsed.run.metadata).toEqual({ tenant_id: 'tenant-1', custom: 'value' });
      expect(parsed.run.traceId).toBe('trace-123');
    });
  });

  describe('exportAllRuns', () => {
    it('should export all runs with events', async () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          runId: 'run-2',
          status: 'failed',
          request: { model: 'gpt-3.5-turbo' },
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockImplementation((runId: string) => ({
        events: [{ sequence: 1, type: 'test', payload: {}, occurredAt: new Date() }],
      }));

      const result = await service.exportAllRuns();
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('runs');
      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed).toHaveProperty('totalRuns');
      expect(parsed.runs).toHaveLength(2);
      expect(parsed.totalRuns).toBe(2);
      expect(parsed.runs[0].runId).toBe('run-1');
      expect(parsed.runs[1].runId).toBe('run-2');
    });

    it('should handle empty run list', async () => {
      mockArchive.listRuns.mockReturnValue([]);

      const result = await service.exportAllRuns();
      const parsed = JSON.parse(result);

      expect(parsed.runs).toEqual([]);
      expect(parsed.totalRuns).toBe(0);
    });

    it('should handle runs with no events', async () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue(undefined);

      const result = await service.exportAllRuns();
      const parsed = JSON.parse(result);

      expect(parsed.runs[0].events).toEqual([]);
    });

    it('should export large number of runs efficiently', async () => {
      const mockRuns: RunRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        runId: `run-${i}`,
        status: 'completed' as const,
        request: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const startTime = Date.now();
      const result = await service.exportAllRuns();
      const duration = Date.now() - startTime;

      const parsed = JSON.parse(result);
      expect(parsed.runs).toHaveLength(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('getStorageStats', () => {
    it('should calculate storage statistics', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: lastWeek,
          updatedAt: lastWeek,
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: yesterday,
          updatedAt: yesterday,
        },
        {
          runId: 'run-3',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const stats = service.getStorageStats();

      expect(stats.totalRuns).toBe(3);
      expect(stats).toHaveProperty('estimatedSizeBytes');
      expect(stats).toHaveProperty('estimatedSizeMB');
      expect(stats).toHaveProperty('oldestRun');
      expect(stats).toHaveProperty('newestRun');
      expect(stats).toHaveProperty('timeSpanDays');
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);
    });

    it('should handle empty archive', () => {
      mockArchive.listRuns.mockReturnValue([]);

      const stats = service.getStorageStats();

      expect(stats.totalRuns).toBe(0);
      expect(stats.estimatedSizeBytes).toBe(0);
      expect(stats.estimatedSizeMB).toBe('0.00');
      expect(stats.oldestRun).toBeUndefined();
      expect(stats.newestRun).toBeUndefined();
      expect(stats.timeSpanDays).toBe(0);
    });

    it('should calculate size including events', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const largeEvents = Array.from({ length: 100 }, (_, i) => ({
        sequence: i + 1,
        type: 'test',
        payload: { data: 'x'.repeat(1000) },
        occurredAt: new Date(),
      }));

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: largeEvents });

      const stats = service.getStorageStats();

      expect(stats.estimatedSizeBytes).toBeGreaterThan(100000);
    });

    it('should handle timeline without events array', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({}); // No events property

      const stats = service.getStorageStats();

      expect(stats.totalRuns).toBe(1);
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);
    });

    it('should calculate time span correctly', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-01-31');

      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: oldDate,
          updatedAt: oldDate,
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: newDate,
          updatedAt: newDate,
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const stats = service.getStorageStats();

      expect(stats.timeSpanDays).toBe(30);
      expect(stats.oldestRun).toBe(oldDate.toISOString());
      expect(stats.newestRun).toBe(newDate.toISOString());
    });

    it('should handle single run', () => {
      const now = new Date();
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const stats = service.getStorageStats();

      expect(stats.totalRuns).toBe(1);
      expect(stats.timeSpanDays).toBe(0);
    });

    it('should format size in MB correctly', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const stats = service.getStorageStats();

      expect(stats.estimatedSizeMB).toMatch(/^\d+\.\d{2}$/);
      expect(parseFloat(stats.estimatedSizeMB)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined timeline gracefully', async () => {
      const runId = 'test-run';
      const mockRun: RunRecord = {
        runId,
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      delete mockArchive.exportRun;
      mockArchive.getRun.mockReturnValue(mockRun);
      mockArchive.getTimeline.mockReturnValue(undefined);

      const result = await service.exportRun(runId);
      const parsed = JSON.parse(result);

      expect(parsed.events).toEqual([]);
    });

    it('should handle timeline with null events', async () => {
      const runId = 'test-run';
      const mockRun: RunRecord = {
        runId,
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      delete mockArchive.exportRun;
      mockArchive.getRun.mockReturnValue(mockRun);
      mockArchive.getTimeline.mockReturnValue({ events: null });

      const result = await service.exportRun(runId);
      const parsed = JSON.parse(result);

      expect(parsed.events).toEqual([]);
    });

    it('should handle very large datasets', () => {
      const mockRuns: RunRecord[] = Array.from({ length: 10000 }, (_, i) => ({
        runId: `run-${i}`,
        status: 'completed' as const,
        request: { model: 'gpt-4' },
        createdAt: new Date(Date.now() - i * 60000),
        updatedAt: new Date(Date.now() - i * 60000),
      }));

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const stats = service.getStorageStats();

      expect(stats.totalRuns).toBe(10000);
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);
    });

    it('should handle fractional days correctly', () => {
      const days = 7.5;
      service.pruneOlderThanDays(days);

      expect(mockArchive.pruneOlderThan).toHaveBeenCalledTimes(1);
      const callArg = mockArchive.pruneOlderThan.mock.calls[0][0];
      const expectedCutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const actualCutoff = callArg.getTime();
      expect(Math.abs(actualCutoff - expectedCutoff)).toBeLessThan(100);
    });
  });

  describe('data validation', () => {
    it('should ensure exported JSON is valid', async () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const result = await service.exportAllRuns();

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should ensure exported data has proper structure', async () => {
      const runId = 'test-run';
      const mockRun: RunRecord = {
        runId,
        status: 'completed',
        request: { model: 'gpt-4' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      delete mockArchive.exportRun;
      mockArchive.getRun.mockReturnValue(mockRun);
      mockArchive.getTimeline.mockReturnValue({ events: [] });

      const result = await service.exportRun(runId);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        run: expect.any(Object),
        events: expect.any(Array),
        exportedAt: expect.any(String),
      });
    });
  });
});
