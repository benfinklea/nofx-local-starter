/**
 * Unit tests for RunCoordinator validation logic
 *
 * Tests the new run creation validation features:
 * - Run object validation
 * - Persistence verification
 * - Error handling for storage configuration issues
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RunCoordinator } from '../../../../../src/api/server/handlers/runs/RunCoordinator';
import type { StoreDriver, RunRow } from '../../../../../src/lib/store/types';

// Mock dependencies
const mockStore: jest.Mocked<StoreDriver> = {
  createRun: jest.fn(),
  getRun: jest.fn(),
  updateRun: jest.fn(),
  resetRun: jest.fn(),
  listRuns: jest.fn(),
  createStep: jest.fn(),
  getStep: jest.fn(),
  getStepByIdempotencyKey: jest.fn(),
  updateStep: jest.fn(),
  resetStep: jest.fn(),
  listStepsByRun: jest.fn(),
  countRemainingSteps: jest.fn(),
  recordEvent: jest.fn(),
  listEvents: jest.fn(),
  createOrGetGate: jest.fn(),
  getLatestGate: jest.fn(),
  updateGate: jest.fn(),
  listGatesByRun: jest.fn(),
  addArtifact: jest.fn(),
  listArtifactsByRun: jest.fn(),
  inboxMarkIfNew: jest.fn(),
  inboxDelete: jest.fn(),
  outboxAdd: jest.fn(),
  outboxListUnsent: jest.fn(),
  outboxMarkSent: jest.fn()
} as any;

describe('RunCoordinator - Run Creation Validation', () => {
  let coordinator: RunCoordinator;

  beforeEach(() => {
    jest.clearAllMocks();
    coordinator = new RunCoordinator(mockStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Run Creation', () => {
    test('creates run and validates persistence', async () => {
      const mockRun: RunRow = {
        id: 'run-123',
        status: 'queued',
        plan: { goal: 'test', steps: [] },
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'default',
        metadata: null
      };

      mockStore.createRun.mockResolvedValue(mockRun);
      mockStore.getRun.mockResolvedValue(mockRun);

      const result = await coordinator.createRun({
        plan: { goal: 'test', steps: [] },
        projectId: 'default',
        userId: 'user-123',
        userTier: 'free'
      });

      expect(result).toEqual(mockRun);
      expect(mockStore.createRun).toHaveBeenCalledTimes(1);
      expect(mockStore.getRun).toHaveBeenCalledWith('run-123');
    });

    test('includes user context in run data', async () => {
      const mockRun: RunRow = {
        id: 'run-456',
        status: 'queued',
        plan: { goal: 'test', steps: [] },
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'project-1',
        metadata: null
      };

      mockStore.createRun.mockResolvedValue(mockRun);
      mockStore.getRun.mockResolvedValue(mockRun);

      await coordinator.createRun({
        plan: { goal: 'test', steps: [] },
        projectId: 'project-1',
        userId: 'user-456',
        userTier: 'pro'
      });

      expect(mockStore.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          goal: 'test',
          user_id: 'user-456',
          metadata: {
            created_by: 'user-456',
            tier: 'pro'
          }
        }),
        'project-1'
      );
    });
  });

  describe('Validation Error Cases', () => {
    test('throws error when run object is invalid (no ID)', async () => {
      const invalidRun = {
        id: null, // Invalid: no ID
        status: 'queued',
        plan: null,
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'default',
        metadata: null
      } as any;

      mockStore.createRun.mockResolvedValue(invalidRun);

      await expect(
        coordinator.createRun({
          plan: { goal: 'test', steps: [] },
          projectId: 'default',
          userId: 'user-123',
          userTier: 'free'
        })
      ).rejects.toThrow('Run creation failed: store returned invalid run object');

      // Should not try to verify if validation fails
      expect(mockStore.getRun).not.toHaveBeenCalled();
    });

    test('throws error when run is not found after creation (ephemeral storage)', async () => {
      const mockRun: RunRow = {
        id: 'run-789',
        status: 'queued',
        plan: { goal: 'test', steps: [] },
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'default',
        metadata: null
      };

      mockStore.createRun.mockResolvedValue(mockRun);
      mockStore.getRun.mockResolvedValue(undefined); // Run not found!

      await expect(
        coordinator.createRun({
          plan: { goal: 'test', steps: [] },
          projectId: 'default',
          userId: 'user-123',
          userTier: 'free'
        })
      ).rejects.toThrow('storage may be ephemeral or misconfigured');
    });

    test('logs warning but continues when verification throws error', async () => {
      const mockRun: RunRow = {
        id: 'run-999',
        status: 'queued',
        plan: { goal: 'test', steps: [] },
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'default',
        metadata: null
      };

      mockStore.createRun.mockResolvedValue(mockRun);
      mockStore.getRun.mockRejectedValue(new Error('Database connection lost'));

      // Should NOT throw - verification errors are logged but don't fail creation
      const result = await coordinator.createRun({
        plan: { goal: 'test', steps: [] },
        projectId: 'default',
        userId: 'user-123',
        userTier: 'free'
      });

      expect(result).toEqual(mockRun);
      expect(mockStore.createRun).toHaveBeenCalled();
      expect(mockStore.getRun).toHaveBeenCalled();
    });
  });

  describe('Database Connection Issues', () => {
    test('throws error when createRun fails due to database error', async () => {
      mockStore.createRun.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        coordinator.createRun({
          plan: { goal: 'test', steps: [] },
          projectId: 'default',
          userId: 'user-123',
          userTier: 'free'
        })
      ).rejects.toThrow('ECONNREFUSED');

      expect(mockStore.createRun).toHaveBeenCalled();
      expect(mockStore.getRun).not.toHaveBeenCalled();
    });

    test('handles timeout errors gracefully', async () => {
      mockStore.createRun.mockRejectedValue(new Error('Query timeout'));

      await expect(
        coordinator.createRun({
          plan: { goal: 'test', steps: [] },
          projectId: 'default',
          userId: 'user-123',
          userTier: 'free'
        })
      ).rejects.toThrow('Query timeout');
    });
  });

  describe('Edge Cases', () => {
    test('handles run with empty plan', async () => {
      const mockRun: RunRow = {
        id: 'run-empty',
        status: 'queued',
        plan: { goal: '', steps: [] },
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'default',
        metadata: null
      };

      mockStore.createRun.mockResolvedValue(mockRun);
      mockStore.getRun.mockResolvedValue(mockRun);

      const result = await coordinator.createRun({
        plan: { goal: '', steps: [] },
        projectId: 'default',
        userId: '',
        userTier: 'free'
      });

      expect(result).toEqual(mockRun);
    });

    test('handles run with no user context', async () => {
      const mockRun: RunRow = {
        id: 'run-no-user',
        status: 'queued',
        plan: { goal: 'test', steps: [] },
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'default',
        metadata: null
      };

      mockStore.createRun.mockResolvedValue(mockRun);
      mockStore.getRun.mockResolvedValue(mockRun);

      await coordinator.createRun({
        plan: { goal: 'test', steps: [] },
        projectId: 'default',
        userId: '',
        userTier: 'free'
      });

      expect(mockStore.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: '',
          metadata: {
            created_by: '',
            tier: 'free'
          }
        }),
        'default'
      );
    });
  });

  describe('Observability and Tracing', () => {
    test('records run.created event after successful creation', async () => {
      const mockRun: RunRow = {
        id: 'run-trace',
        status: 'queued',
        plan: { goal: 'test', steps: [] },
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        completed_at: null,
        project_id: 'default',
        metadata: null
      };

      mockStore.createRun.mockResolvedValue(mockRun);
      mockStore.getRun.mockResolvedValue(mockRun);
      mockStore.recordEvent.mockResolvedValue();

      await coordinator.createRun({
        plan: { goal: 'test', steps: [] },
        projectId: 'default',
        userId: 'user-123',
        userTier: 'free'
      });

      expect(mockStore.recordEvent).toHaveBeenCalledWith(
        'run-trace',
        'run.created',
        expect.objectContaining({
          plan: expect.any(Object)
        })
      );
    });
  });
});
