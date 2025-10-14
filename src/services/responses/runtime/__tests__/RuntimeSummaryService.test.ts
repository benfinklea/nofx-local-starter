/**
 * RuntimeSummaryService Tests
 * Comprehensive test coverage for operations summary generation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RuntimeSummaryService } from '../RuntimeSummaryService';
import type { RuntimeBundle } from '../../runtime';
import type { RunRecord } from '../../../../shared/responses/archive';

describe('RuntimeSummaryService', () => {
  let service: RuntimeSummaryService;
  let mockRuntime: RuntimeBundle;
  let mockArchive: any;
  let mockIncidents: any;
  let mockTracker: any;

  beforeEach(() => {
    mockArchive = {
      listRuns: jest.fn(() => []),
    };

    mockIncidents = {
      listIncidents: jest.fn(() => []),
    };

    mockTracker = {
      getTenantSummaries: jest.fn(() => []),
      getLastSnapshot: jest.fn(() => null),
    };

    mockRuntime = {
      archive: mockArchive,
      incidents: mockIncidents,
      tracker: mockTracker,
    } as any;

    service = new RuntimeSummaryService(mockRuntime);
  });

  describe('generateOperationsSummary', () => {
    it('should generate summary with no runs', () => {
      mockArchive.listRuns.mockReturnValue([]);

      const summary = service.generateOperationsSummary();

      expect(summary.totalRuns).toBe(0);
      expect(summary.statusCounts).toEqual({});
      expect(summary.failuresLast24h).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.averageTokensPerRun).toBe(0);
      expect(summary.totalEstimatedCost).toBe(0);
      expect(summary.recentRuns).toEqual([]);
      expect(summary.totalRefusals).toBe(0);
      expect(summary.tenantRollup).toEqual([]);
      expect(summary.openIncidents).toBe(0);
    });

    it('should calculate status counts correctly', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-3',
          status: 'failed',
          request: { model: 'gpt-4' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.statusCounts).toEqual({
        completed: 2,
        failed: 1,
      });
    });

    it('should calculate failures in last 24 hours', () => {
      const now = Date.now();
      const recentFail = new Date(now - 12 * 60 * 60 * 1000); // 12 hours ago
      const oldFail = new Date(now - 48 * 60 * 60 * 1000); // 48 hours ago

      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'failed',
          request: { model: 'gpt-4' },
          createdAt: recentFail,
          updatedAt: recentFail,
        },
        {
          runId: 'run-2',
          status: 'failed',
          request: { model: 'gpt-4' },
          createdAt: oldFail,
          updatedAt: oldFail,
        },
        {
          runId: 'run-3',
          status: 'incomplete',
          request: { model: 'gpt-4' },
          createdAt: recentFail,
          updatedAt: recentFail,
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.failuresLast24h).toBe(2); // Both recent fail and incomplete
    });

    it('should calculate token metrics', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          result: {
            id: 'result-1',
            status: 'completed',
            usage: {
              total_tokens: 1000,
              input_tokens: 500,
              output_tokens: 500,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          result: {
            id: 'result-2',
            status: 'completed',
            usage: {
              total_tokens: 2000,
              input_tokens: 1000,
              output_tokens: 1000,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.totalTokens).toBe(3000);
      expect(summary.averageTokensPerRun).toBe(1500);
      expect(summary.totalEstimatedCost).toBeGreaterThan(0);
    });

    it('should calculate estimated cost based on environment variable', () => {
      const originalEnv = process.env.RESPONSES_COST_PER_1K_TOKENS;
      process.env.RESPONSES_COST_PER_1K_TOKENS = '0.001';

      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          result: {
            id: 'result-1',
            status: 'completed',
            usage: {
              total_tokens: 10000,
              input_tokens: 5000,
              output_tokens: 5000,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.totalEstimatedCost).toBe(0.01); // 10000 tokens * 0.001 / 1000

      process.env.RESPONSES_COST_PER_1K_TOKENS = originalEnv;
    });

    it('should count refusals', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          safety: {
            refusalCount: 2,
            moderatorNotes: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          safety: {
            refusalCount: 3,
            moderatorNotes: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.totalRefusals).toBe(5);
    });

    it('should generate tenant rollup', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-a' },
          result: {
            id: 'result-1',
            status: 'completed',
            usage: {
              total_tokens: 1000,
              input_tokens: 500,
              output_tokens: 500,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-a' },
          result: {
            id: 'result-2',
            status: 'completed',
            usage: {
              total_tokens: 2000,
              input_tokens: 1000,
              output_tokens: 1000,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-3',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-b' },
          result: {
            id: 'result-3',
            status: 'completed',
            usage: {
              total_tokens: 500,
              input_tokens: 250,
              output_tokens: 250,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.tenantRollup).toHaveLength(2);
      expect(summary.tenantRollup[0]!.tenantId).toBe('tenant-a');
      expect(summary.tenantRollup[0]!.runCount).toBe(2);
      expect(summary.tenantRollup[0]!.totalTokens).toBe(3000);
      expect(summary.tenantRollup[1]!.tenantId).toBe('tenant-b');
      expect(summary.tenantRollup[1]!.runCount).toBe(1);
      expect(summary.tenantRollup[1]!.totalTokens).toBe(500);
    });

    it('should sort tenant rollup by total tokens descending', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-small' },
          result: {
            id: 'result-1',
            status: 'completed',
            usage: { total_tokens: 100, input_tokens: 50, output_tokens: 50 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-large' },
          result: {
            id: 'result-2',
            status: 'completed',
            usage: { total_tokens: 10000, input_tokens: 5000, output_tokens: 5000 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.tenantRollup[0]!.tenantId).toBe('tenant-large');
      expect(summary.tenantRollup[1]!.tenantId).toBe('tenant-small');
    });

    it('should use default tenant when tenant_id is missing', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          result: {
            id: 'result-1',
            status: 'completed',
            usage: { total_tokens: 1000, input_tokens: 500, output_tokens: 500 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.tenantRollup).toHaveLength(1);
      expect(summary.tenantRollup[0]!.tenantId).toBe('default');
    });

    it('should include region information in tenant rollup', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-a', region: 'us-east-1' },
          result: {
            id: 'result-1',
            status: 'completed',
            usage: { total_tokens: 1000, input_tokens: 500, output_tokens: 500 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-a', region: 'eu-west-1' },
          result: {
            id: 'result-2',
            status: 'completed',
            usage: { total_tokens: 2000, input_tokens: 1000, output_tokens: 1000 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.tenantRollup[0]!.regions).toContain('us-east-1');
      expect(summary.tenantRollup[0]!.regions).toContain('eu-west-1');
      expect(summary.tenantRollup[0]!.regions).toHaveLength(2);
    });

    it('should generate recent runs list', () => {
      const mockRuns: RunRecord[] = Array.from({ length: 15 }, (_, i) => ({
        runId: `run-${i}`,
        status: 'completed' as const,
        request: { model: 'gpt-4' },
        createdAt: new Date(Date.now() - i * 60000),
        updatedAt: new Date(Date.now() - i * 60000),
      }));

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.recentRuns).toHaveLength(10); // Limited to 10
      expect(summary.recentRuns[0]!.runId).toBe('run-0');
    });

    it('should include all run metadata in recent runs', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          metadata: { tenant_id: 'tenant-a' },
          traceId: 'trace-123',
          safety: {
            refusalCount: 2,
            moderatorNotes: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.recentRuns[0]).toMatchObject({
        runId: 'run-1',
        status: 'completed',
        model: 'gpt-4',
        tenantId: 'tenant-a',
        traceId: 'trace-123',
        refusalCount: 2,
      });
    });

    it('should count open incidents', () => {
      mockArchive.listRuns.mockReturnValue([]);
      mockIncidents.listIncidents.mockReturnValue([
        {
          id: 'inc-1',
          runId: 'run-1',
          status: 'open',
          type: 'failed',
          sequence: 1,
          occurredAt: new Date(),
        },
        {
          id: 'inc-2',
          runId: 'run-2',
          status: 'open',
          type: 'incomplete',
          sequence: 1,
          occurredAt: new Date(),
        },
      ]);

      const summary = service.generateOperationsSummary();

      expect(summary.openIncidents).toBe(2);
      expect(summary.incidentDetails).toHaveLength(2);
    });

    it('should include rate limit data', () => {
      mockArchive.listRuns.mockReturnValue([]);

      const mockSnapshot = {
        observedAt: new Date(),
        requestsRemaining: 100,
        tokensRemaining: 50000,
      };

      mockTracker.getLastSnapshot.mockReturnValue(mockSnapshot);
      mockTracker.getTenantSummaries.mockReturnValue([
        {
          tenantId: 'tenant-a',
          latest: mockSnapshot,
          averageProcessingMs: 150,
          remainingRequestsPct: 50,
          remainingTokensPct: 75,
        },
      ]);

      const summary = service.generateOperationsSummary();

      expect(summary.lastRateLimits).toBeDefined();
      expect(summary.rateLimitTenants).toHaveLength(1);
      expect(summary.rateLimitTenants[0]!.tenantId).toBe('tenant-a');
    });

    it('should handle runs without usage data', () => {
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

      const summary = service.generateOperationsSummary();

      expect(summary.totalTokens).toBe(0);
      expect(summary.averageTokensPerRun).toBe(0);
    });

    it('should handle runs without safety data', () => {
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

      const summary = service.generateOperationsSummary();

      expect(summary.totalRefusals).toBe(0);
    });

    it('should set lastRunAt to most recent run', () => {
      const now = new Date();
      const earlier = new Date(Date.now() - 60000);

      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: earlier,
          updatedAt: earlier,
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.lastRunAt).toBe(now.toISOString());
    });

    it('should handle very large number of runs efficiently', () => {
      const mockRuns: RunRecord[] = Array.from({ length: 10000 }, (_, i) => ({
        runId: `run-${i}`,
        status: 'completed' as const,
        request: { model: 'gpt-4' },
        result: {
          id: `result-${i}`,
            status: 'completed',
          usage: { total_tokens: 100, input_tokens: 50, output_tokens: 50 },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const startTime = Date.now();
      const summary = service.generateOperationsSummary();
      const duration = Date.now() - startTime;

      expect(summary.totalRuns).toBe(10000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle mixed status types', () => {
      const mockRuns: RunRecord[] = [
        { runId: 'run-1', status: 'completed', request: { model: 'gpt-4' }, createdAt: new Date(), updatedAt: new Date() },
        { runId: 'run-2', status: 'failed', request: { model: 'gpt-4' }, createdAt: new Date(), updatedAt: new Date() },
        { runId: 'run-3', status: 'incomplete', request: { model: 'gpt-4' }, createdAt: new Date(), updatedAt: new Date() },
        { runId: 'run-4', status: 'queued', request: { model: 'gpt-4' }, createdAt: new Date(), updatedAt: new Date() },
        { runId: 'run-5', status: 'in_progress', request: { model: 'gpt-4' }, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.statusCounts).toEqual({
        completed: 1,
        failed: 1,
        incomplete: 1,
        queued: 1,
        in_progress: 1,
      });
    });

    it('should calculate average tokens per run correctly', () => {
      const mockRuns: RunRecord[] = [
        {
          runId: 'run-1',
          status: 'completed',
          request: { model: 'gpt-4' },
          result: {
            id: 'result-1',
            status: 'completed',
            usage: { total_tokens: 300, input_tokens: 150, output_tokens: 150 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-2',
          status: 'completed',
          request: { model: 'gpt-4' },
          result: {
            id: 'result-2',
            status: 'completed',
            usage: { total_tokens: 500, input_tokens: 250, output_tokens: 250 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          runId: 'run-3',
          status: 'completed',
          request: { model: 'gpt-4' },
          result: {
            id: 'result-3',
            status: 'completed',
            usage: { total_tokens: 200, input_tokens: 100, output_tokens: 100 },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockArchive.listRuns.mockReturnValue(mockRuns);

      const summary = service.generateOperationsSummary();

      expect(summary.totalTokens).toBe(1000);
      expect(summary.averageTokensPerRun).toBe(333.3333333333333);
    });
  });
});
