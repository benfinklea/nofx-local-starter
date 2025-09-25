import { callHandler, resetMocks } from './utils/testHelpers';
import { z } from 'zod';

// Clear any existing module mocks
jest.unmock('../../src/lib/auth');
jest.unmock('../../src/services/responses/runtime');

// Mock dependencies
const mockIsAdmin = jest.fn();
const mockGetResponsesOperationsSummary = jest.fn();
const mockListResponseIncidents = jest.fn();
const mockResolveIncident = jest.fn();
const mockPruneResponsesOlderThanDays = jest.fn();
const mockRetryResponsesRun = jest.fn();
const mockRollbackResponsesRun = jest.fn();
const mockExportResponsesRun = jest.fn();

jest.mock('../../src/lib/auth', () => ({
  isAdmin: mockIsAdmin,
}));

jest.mock('../../src/services/responses/runtime', () => ({
  getResponsesOperationsSummary: mockGetResponsesOperationsSummary,
  listResponseIncidents: mockListResponseIncidents,
  resolveResponseIncident: mockResolveIncident,
  pruneResponsesOlderThanDays: mockPruneResponsesOlderThanDays,
  retryResponsesRun: mockRetryResponsesRun,
  rollbackResponsesRun: mockRollbackResponsesRun,
  exportResponsesRun: mockExportResponsesRun,
}));

// Import handlers after mocks
import summaryHandler from '../../api/responses/ops/summary';
import incidentsHandler from '../../api/responses/ops/incidents';
import resolveHandler from '../../api/responses/ops/incidents/[id]/resolve';
import pruneHandler from '../../api/responses/ops/prune';
import retryHandler from '../../api/responses/runs/[id]/retry';
import rollbackHandler from '../../api/responses/runs/[id]/rollback';
import exportHandler from '../../api/responses/runs/[id]/export';

describe('Responses API Endpoints', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    mockIsAdmin.mockReset();
    mockIsAdmin.mockReturnValue(true);
  });

  describe('GET /api/responses/ops/summary', () => {
    it('should get responses summary', async () => {
      const mockSummary = {
        total: 100,
        success: 85,
        failed: 15,
        pending: 0,
      };
      mockGetResponsesOperationsSummary.mockReturnValue(mockSummary);

      const response = await callHandler(summaryHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(mockSummary);
      expect(mockGetResponsesOperationsSummary).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockGetResponsesOperationsSummary.mockImplementation(() => { throw new Error('Summary failed'); });

      const response = await callHandler(summaryHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Summary failed' });
    });

    it('should handle non-Error exceptions', async () => {
      mockGetResponsesOperationsSummary.mockImplementation(() => { throw 'String error'; });

      const response = await callHandler(summaryHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'failed to build summary' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(summaryHandler, {
        method: 'GET',
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'admin required' });
    });
  });

  describe('GET /api/responses/ops/incidents', () => {
    it('should list incidents', async () => {
      const mockIncidents = [
        { id: 'incident-1', severity: 'high', timestamp: new Date().toISOString() },
        { id: 'incident-2', severity: 'medium', timestamp: new Date().toISOString() },
      ];
      mockListResponseIncidents.mockReturnValue(mockIncidents);

      const response = await callHandler(incidentsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ incidents: mockIncidents });
      expect(mockListResponseIncidents).toHaveBeenCalledWith('open');
    });

    it('should handle errors', async () => {
      mockListResponseIncidents.mockImplementation(() => { throw new Error('Failed to get incidents'); });

      const response = await callHandler(incidentsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to get incidents' });
    });

    it('should handle non-Error exceptions', async () => {
      mockListResponseIncidents.mockImplementation(() => { throw 'String error'; });

      const response = await callHandler(incidentsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'failed to list incidents' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(incidentsHandler, {
        method: 'GET',
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'admin required' });
    });
  });

  describe('POST /api/responses/ops/incidents/[id]/resolve', () => {
    it('should resolve an incident', async () => {
      mockResolveIncident.mockReturnValue({ success: true });

      const response = await callHandler(resolveHandler, {
        method: 'POST',
        query: { id: 'incident-123' },
        body: {
          resolvedBy: 'user-123',
          notes: 'Applied patch',
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ incident: { success: true } });
      expect(mockResolveIncident).toHaveBeenCalledWith({
        incidentId: 'incident-123',
        resolvedBy: 'user-123',
        notes: 'Applied patch',
      });
    });

    it('should handle empty body', async () => {
      // Empty body should fail validation since resolvedBy is required
      const response = await callHandler(resolveHandler, {
        method: 'POST',
        query: { id: 'incident-123' },
        body: {},
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should handle validation errors', async () => {
      const response = await callHandler(resolveHandler, {
        method: 'POST',
        query: { id: 'incident-123' },
        body: {
          resolvedBy: 123, // Should be string
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should handle resolution errors', async () => {
      mockResolveIncident.mockImplementation(() => {
        throw new Error('Resolution failed');
      });

      const response = await callHandler(resolveHandler, {
        method: 'POST',
        query: { id: 'incident-123' },
        body: { resolvedBy: 'user-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Resolution failed' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(resolveHandler, {
        method: 'POST',
        query: { id: 'incident-123' },
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'admin required' });
    });
  });

  describe('POST /api/responses/ops/prune', () => {
    it('should prune responses', async () => {
      mockGetResponsesOperationsSummary.mockReturnValue({ pruned: 50, remaining: 100 });
      mockPruneResponsesOlderThanDays.mockReturnValue(undefined);

      const response = await callHandler(pruneHandler, {
        method: 'POST',
        body: {
          days: 30,
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ ok: true, summary: { pruned: 50, remaining: 100 } });
      expect(mockPruneResponsesOlderThanDays).toHaveBeenCalledWith(30);
    });

    it('should handle empty body', async () => {
      // Empty body should fail validation since days must be positive
      const response = await callHandler(pruneHandler, {
        method: 'POST',
        body: {},
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should handle validation errors', async () => {
      const response = await callHandler(pruneHandler, {
        method: 'POST',
        body: {
          days: 'not-a-number',
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should handle prune errors', async () => {
      mockPruneResponsesOlderThanDays.mockImplementation(() => { throw new Error('Prune failed'); });

      const response = await callHandler(pruneHandler, {
        method: 'POST',
        body: { days: 7 },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Prune failed' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(pruneHandler, {
        method: 'POST',
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'admin required' });
    });
  });

  describe('POST /api/responses/runs/[id]/retry', () => {
    it('should retry a response run', async () => {
      mockRetryResponsesRun.mockResolvedValue({ runId: 'new-run-123' });

      const response = await callHandler(retryHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {
          tenantId: 'tenant-1',
          metadata: { key: 'value' },
          background: true,
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ runId: 'new-run-123' });
      expect(mockRetryResponsesRun).toHaveBeenCalledWith('run-123', {
        tenantId: 'tenant-1',
        metadata: { key: 'value' },
        background: true,
      });
    });

    it('should handle empty body', async () => {
      mockRetryResponsesRun.mockResolvedValue({ runId: 'new-run-123' });

      const response = await callHandler(retryHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {},
      });

      expect(response.status).toBe(200);
      expect(mockRetryResponsesRun).toHaveBeenCalledWith('run-123', {
        tenantId: undefined,
        metadata: undefined,
        background: undefined,
      });
    });

    it('should handle validation errors', async () => {
      const response = await callHandler(retryHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {
          background: 'not-a-boolean',
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should handle retry errors', async () => {
      mockRetryResponsesRun.mockRejectedValue(new Error('Retry failed'));

      const response = await callHandler(retryHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {},
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Retry failed' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(retryHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {},
        authenticated: false,
      });

      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'admin required' });
    });
  });

  describe('POST /api/responses/runs/[id]/rollback', () => {
    it('should rollback a response run', async () => {
      mockRollbackResponsesRun.mockResolvedValue({ success: true });

      const response = await callHandler(rollbackHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {
          sequence: 5,
          toolCallId: 'tool-123',
          operator: 'user-1',
          reason: 'Incorrect output',
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ success: true });
      expect(mockRollbackResponsesRun).toHaveBeenCalledWith('run-123', {
        sequence: 5,
        toolCallId: 'tool-123',
        operator: 'user-1',
        reason: 'Incorrect output',
      });
    });

    it('should handle empty body', async () => {
      mockRollbackResponsesRun.mockResolvedValue({ success: true });

      const response = await callHandler(rollbackHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {},
      });

      expect(response.status).toBe(200);
      expect(mockRollbackResponsesRun).toHaveBeenCalledWith('run-123', {
        sequence: undefined,
        toolCallId: undefined,
        operator: undefined,
        reason: undefined,
      });
    });

    it('should handle validation errors', async () => {
      const response = await callHandler(rollbackHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {
          sequence: 'not-a-number',
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should handle rollback errors', async () => {
      mockRollbackResponsesRun.mockRejectedValue(new Error('Rollback failed'));

      const response = await callHandler(rollbackHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {},
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Rollback failed' });
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(rollbackHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        body: {},
        authenticated: false,
      });

      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'admin required' });
    });
  });

  describe('POST /api/responses/runs/[id]/export', () => {
    it('should export a response run', async () => {
      const exportData = 'exported data content';
      mockExportResponsesRun.mockResolvedValue(exportData);

      const response = await callHandler(exportHandler, {
        method: 'POST',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ data: exportData });
      expect(mockExportResponsesRun).toHaveBeenCalledWith('run-123');
    });

    it('should handle export errors', async () => {
      mockExportResponsesRun.mockRejectedValue(new Error('Export failed'));

      const response = await callHandler(exportHandler, {
        method: 'POST',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Export failed' });
    });

    it('should handle validation errors', async () => {
      // Mock a ZodError
      const zodError = new z.ZodError([]);
      mockExportResponsesRun.mockRejectedValue(zodError);

      const response = await callHandler(exportHandler, {
        method: 'POST',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(400);
      expect(response.json).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      mockIsAdmin.mockReturnValue(false);

      const response = await callHandler(exportHandler, {
        method: 'POST',
        query: { id: 'run-123' },
        authenticated: false,
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'admin required' });
    });
  });

  describe('Method validation', () => {
    it('should reject POST to summary endpoint', async () => {
      const response = await callHandler(summaryHandler, {
        method: 'POST',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject POST to incidents endpoint', async () => {
      const response = await callHandler(incidentsHandler, {
        method: 'POST',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject GET to resolve endpoint', async () => {
      const response = await callHandler(resolveHandler, {
        method: 'GET',
        query: { id: 'incident-123' },
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });

    it('should reject GET to prune endpoint', async () => {
      const response = await callHandler(pruneHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(405);
      expect(response.json).toEqual({ error: 'Method not allowed' });
    });
  });
});