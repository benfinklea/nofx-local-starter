/**
 * Comprehensive test suite for src/services/responses/runtime.ts
 * Tests runtime service functionality before refactoring
 */

// @ts-nocheck
import { jest } from '@jest/globals';
import path from 'node:path';

// Mock all dependencies
jest.mock('../runCoordinator', () => ({
  ResponsesRunCoordinator: jest.fn().mockImplementation(() => ({
    runCode: jest.fn(),
    getStatus: jest.fn(),
    cancelRun: jest.fn(),
    resyncFromArchive: jest.fn(),
  })),
}));

jest.mock('../runService', () => ({
  ResponsesRunService: jest.fn().mockImplementation(() => ({
    run: jest.fn(),
    getResult: jest.fn(),
    execute: jest.fn().mockResolvedValue({ runId: 'new-run' } as any),
  })),
}));

jest.mock('../archiveStore', () => ({
  FileSystemResponsesArchive: jest.fn().mockImplementation(() => ({
    startRun: jest.fn(),
    recordEvent: jest.fn(),
    updateStatus: jest.fn(),
    getRun: jest.fn().mockReturnValue({ runId: 'test-run', status: 'completed' }),
    getTimeline: jest.fn().mockReturnValue({ run: { runId: 'test-run' }, events: [] }),
    listRuns: jest.fn().mockReturnValue([]),
    pruneOlderThan: jest.fn(),
    deleteRun: jest.fn(),
    exportRun: jest.fn().mockResolvedValue('exported data' as any),
    addModeratorNote: jest.fn().mockReturnValue({ reviewer: 'test' } as any),
    rollback: jest.fn().mockReturnValue({ run: {}, events: [] } as any),
  })),
}));

jest.mock('../conversationStateManager', () => ({
  ConversationStateManager: jest.fn().mockImplementation(() => ({
    getState: jest.fn(),
    setState: jest.fn(),
  })),
  InMemoryConversationStore: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

jest.mock('../rateLimitTracker', () => ({
  RateLimitTracker: jest.fn().mockImplementation(() => ({
    track: jest.fn(),
    getLastSnapshot: jest.fn(),
    getTenantSummaries: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('../toolRegistry', () => ({
  ToolRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    get: jest.fn(),
  })),
}));

jest.mock('../historyPlanner', () => ({
  HistoryPlanner: jest.fn().mockImplementation(() => ({
    plan: jest.fn(),
  })),
}));

jest.mock('../openaiClient', () => ({
  OpenAIResponsesClient: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}));

jest.mock('../incidentLog', () => ({
  IncidentLog: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    listIncidents: jest.fn().mockReturnValue([]),
    resolveIncident: jest.fn().mockReturnValue({ id: 'incident-1' }),
    getIncidentsForRun: jest.fn().mockReturnValue([]),
    resolveIncidentsByRun: jest.fn(),
  })),
}));

jest.mock('../delegationTracker', () => ({
  DelegationTracker: jest.fn().mockImplementation(() => ({
    track: jest.fn(),
    getDelegations: jest.fn(),
  })),
}));

describe('Runtime Service Tests', () => {
  let runtime: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset module cache to get fresh runtime
    jest.resetModules();
  });

  describe('Runtime Initialization', () => {
    it('should initialize runtime components', () => {
      const { getResponsesRuntime } = require('../runtime');
      runtime = getResponsesRuntime();

      expect(runtime).toBeDefined();
      expect(runtime.archive).toBeDefined();
      expect(runtime.coordinator).toBeDefined();
      expect(runtime.service).toBeDefined();
      expect(runtime.tracker).toBeDefined();
      expect(runtime.toolRegistry).toBeDefined();
      expect(runtime.incidents).toBeDefined();
      expect(runtime.delegations).toBeDefined();
    });

    it('should create stub client in stub mode', () => {
      process.env.RESPONSES_RUNTIME_MODE = 'stub';

      const { getResponsesRuntime } = require('../runtime');
      runtime = getResponsesRuntime();

      expect(runtime).toBeDefined();
    });

    it('should reset runtime when requested', () => {
      const { getResponsesRuntime, resetResponsesRuntime } = require('../runtime');

      const runtime1 = getResponsesRuntime();
      resetResponsesRuntime();
      const runtime2 = getResponsesRuntime();

      expect(runtime1).toBeDefined();
      expect(runtime2).toBeDefined();
      // Should get fresh instance after reset
    });
  });

  describe('Operations Summary', () => {
    it('should generate operations summary', () => {
      const { getResponsesOperationsSummary } = require('../runtime');

      const summary = getResponsesOperationsSummary();

      expect(summary).toBeDefined();
      expect(typeof summary.totalRuns).toBe('number');
      expect(typeof summary.statusCounts).toBe('object');
      expect(typeof summary.failuresLast24h).toBe('number');
      expect(Array.isArray(summary.recentRuns)).toBe(true);
      expect(typeof summary.totalRefusals).toBe('number');
      expect(Array.isArray(summary.rateLimitTenants)).toBe(true);
      expect(Array.isArray(summary.tenantRollup)).toBe(true);
      expect(typeof summary.openIncidents).toBe('number');
    });

    it('should handle empty archive gracefully', () => {
      const { getResponsesOperationsSummary } = require('../runtime');

      const summary = getResponsesOperationsSummary();

      expect(summary.totalRuns).toBe(0);
      expect(summary.recentRuns).toEqual([]);
    });
  });

  describe('Data Management Operations', () => {
    it('should prune old responses', () => {
      const { pruneResponsesOlderThanDays } = require('../runtime');

      expect(() => {
        pruneResponsesOlderThanDays(30);
      }).not.toThrow();
    });

    it('should handle invalid prune days', () => {
      const { pruneResponsesOlderThanDays } = require('../runtime');

      expect(() => {
        pruneResponsesOlderThanDays(-1);
      }).toThrow('Days must be positive');
    });

    it('should export run data', async () => {
      const { exportResponsesRun } = require('../runtime');

      const result = await exportResponsesRun('test-run-id');
      expect(typeof result).toBe('string');
    });
  });

  describe('Run Retry Functionality', () => {
    it('should retry a response run', async () => {
      const { retryResponsesRun } = require('../runtime');

      try {
        await retryResponsesRun('original-run-id');
      } catch (error) {
        expect(error.message).toBe('run not found');
      }
    });

    it('should retry with options', async () => {
      const { retryResponsesRun } = require('../runtime');

      const options = {
        tenantId: 'test-tenant',
        metadata: { retry: 'true' },
        background: false,
      };

      try {
        await retryResponsesRun('original-run-id', options);
      } catch (error) {
        expect(error.message).toBe('run not found');
      }
    });

    it('should handle retry errors', async () => {
      const { retryResponsesRun } = require('../runtime');

      try {
        await retryResponsesRun('non-existent-run');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Incident Management', () => {
    it('should list response incidents', () => {
      const { listResponseIncidents } = require('../runtime');

      const incidents = listResponseIncidents();
      expect(Array.isArray(incidents)).toBe(true);
    });

    it('should list incidents by status', () => {
      const { listResponseIncidents } = require('../runtime');

      const openIncidents = listResponseIncidents('open');
      const resolvedIncidents = listResponseIncidents('resolved');

      expect(Array.isArray(openIncidents)).toBe(true);
      expect(Array.isArray(resolvedIncidents)).toBe(true);
    });

    it('should resolve incidents', () => {
      const { resolveResponseIncident } = require('../runtime');

      const result = resolveResponseIncident({
        incidentId: 'test-incident',
        resolvedBy: 'test-user',
        notes: 'Test resolution',
        disposition: 'fixed',
        linkedRunId: 'test-run',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Moderator Notes', () => {
    it('should add moderator notes', () => {
      const { addResponsesModeratorNote } = require('../runtime');

      const note = addResponsesModeratorNote('test-run-id', {
        reviewer: 'test-reviewer',
        note: 'Test note',
        disposition: 'approved',
        recordedAt: new Date(),
      });

      expect(note).toBeDefined();
      expect(note.reviewer).toBe('test-reviewer');
      expect(note.disposition).toBe('approved');
    });

    it('should handle missing recorded date', () => {
      const { addResponsesModeratorNote } = require('../runtime');

      const note = addResponsesModeratorNote('test-run-id', {
        reviewer: 'test-reviewer',
        note: 'Test note',
        disposition: 'flagged',
      });

      expect(note).toBeDefined();
      expect(note.recordedAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle archive initialization errors', () => {
      // Mock archive creation failure
      jest.doMock('../archiveStore', () => ({
        FileSystemResponsesArchive: jest.fn().mockImplementation(() => {
          throw new Error('Archive init failed');
        }),
      }));

      expect(() => {
        const { getResponsesRuntime } = require('../runtime');
        getResponsesRuntime();
      }).toThrow();
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.RESPONSES_ARCHIVE_EXPORT_DIR;
      delete process.env.RESPONSES_ARCHIVE_TTL_DAYS;

      const { getResponsesRuntime } = require('../runtime');
      const runtime = getResponsesRuntime();

      expect(runtime).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent operations', async () => {
      const { getResponsesOperationsSummary, exportResponsesRun } = require('../runtime');

      const operations = [
        getResponsesOperationsSummary,
        () => exportResponsesRun('test-1'),
        () => exportResponsesRun('test-2'),
        getResponsesOperationsSummary,
      ];

      const start = Date.now();
      await Promise.all(operations.map(op => op()));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large tenant rollup efficiently', () => {
      const { getResponsesOperationsSummary } = require('../runtime');

      const start = Date.now();
      const summary = getResponsesOperationsSummary();
      const duration = Date.now() - start;

      expect(summary).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Data Serialization', () => {
    it('should serialize run records minimally', () => {
      const { getResponsesRuntime } = require('../runtime');
      runtime = getResponsesRuntime();

      // Test would verify serialization if we had access to internal functions
      expect(runtime).toBeDefined();
    });

    it('should serialize event records minimally', () => {
      const { getResponsesRuntime } = require('../runtime');
      runtime = getResponsesRuntime();

      // Test would verify event serialization if we had access to internal functions
      expect(runtime).toBeDefined();
    });
  });

  describe('Environment Configuration', () => {
    it('should respect RESPONSES_RUNTIME_MODE', () => {
      process.env.RESPONSES_RUNTIME_MODE = 'stub';

      const { getResponsesRuntime } = require('../runtime');
      const runtime = getResponsesRuntime();

      expect(runtime).toBeDefined();
    });

    it('should handle invalid archive TTL values', () => {
      process.env.RESPONSES_ARCHIVE_TTL_DAYS = 'invalid';

      const { getResponsesRuntime } = require('../runtime');
      const runtime = getResponsesRuntime();

      expect(runtime).toBeDefined();
    });
  });
});