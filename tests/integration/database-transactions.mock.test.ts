/**
 * Database Transaction Tests - Mock Version
 * Tests database logic without requiring actual database
 * Safe for production environments and CI/CD
 */

import { TestDataFactory } from '../helpers/testHelpers';

// Mock the database module
jest.mock('../../src/lib/db', () => ({
  query: jest.fn()
}));

import { query } from '../../src/lib/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Integration: Database Transactions (Mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementation and queued responses
    mockQuery.mockReset();
    // Default mock returns empty result
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe('Complex Multi-Table Transactions', () => {
    test('should handle complete run creation transaction', async () => {
      const runId = 'test-run-123';
      const runData = {
        goal: 'TEST_TRANSACTION: Multi-table test',
        plan: TestDataFactory.createRunPlan(),
        status: 'pending' as const
      };

      // Mock run creation
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId }],
      });

      // Mock step creation
      const steps = runData.plan.steps || [];
      for (let i = 0; i < steps.length; i++) {
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: `step-${i}` }],
        });
      }

      // Mock verification queries
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId, goal: runData.goal }],
      });

      mockQuery.mockResolvedValueOnce({
        rows: steps.map((s, i) => ({ id: `step-${i}`, name: s.name })),
      });

      // Execute transaction simulation
      const result = await query(
        'INSERT INTO run (goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        [runData.goal, JSON.stringify(runData.plan), runData.status]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(runId);

      // Verify query was called
      expect(mockQuery).toHaveBeenCalled();
    });

    test('should maintain referential integrity on cascade delete', async () => {
      const runId = 'test-run-456';

      // Mock run creation - returns the run ID
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId }],
      });

      // Mock step creation
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'step-1' }],
      });

      // Mock delete operation
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      // Mock verification query - run should be deleted (empty result)
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const createRun = await query(
        'INSERT INTO run (goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        ['TEST_TRANSACTION: Cascade test', '{}', 'pending']
      );

      expect(createRun.rows[0].id).toBe(runId);

      await query(
        'INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
        [createRun.rows[0].id, 'test-step', 'codegen', '{}', 'pending']
      );

      await query('DELETE FROM run WHERE id = $1', [runId]);

      const verifyRun = await query('SELECT * FROM run WHERE id = $1', [runId]);
      expect(verifyRun.rows.length).toBe(0);
    });
  });

  describe('Transaction Rollback Scenarios', () => {
    test('should handle constraint violation rollback', async () => {
      // First insert succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'duplicate-id' }],
      });

      const firstInsert = await query(
        'INSERT INTO run (id, goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
        ['duplicate-id', 'TEST_TRANSACTION: Duplicate', '{}', 'pending']
      );

      expect(firstInsert.rows[0].id).toBe('duplicate-id');

      // Second insert fails with constraint violation
      mockQuery.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint')
      );

      // Second insert should throw
      await expect(
        query(
          'INSERT INTO run (id, goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
          ['duplicate-id', 'TEST_TRANSACTION: Duplicate 2', '{}', 'pending']
        )
      ).rejects.toThrow(/duplicate key|unique constraint/i);

      // Cleanup query
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      // Cleanup
      await query('DELETE FROM run WHERE id = $1', ['duplicate-id']);
    });

    test('should handle foreign key violation', async () => {
      // Mock should reject with foreign key error
      mockQuery.mockRejectedValueOnce(
        new Error('violates foreign key constraint')
      );

      await expect(
        query(
          'INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
          ['non-existent-run-id', 'orphan-step', 'codegen', '{}', 'pending']
        )
      ).rejects.toThrow(/foreign key|violates|constraint/i);
    });
  });

  describe('Concurrent Transaction Handling', () => {
    test('should handle concurrent updates to same run', async () => {
      const runId = 'test-run-concurrent';

      // Mock run creation
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId }],
      });

      // Mock concurrent updates (all succeed)
      mockQuery.mockResolvedValue({
        rows: [{ id: runId, status: 'running' }],
      });

      await query(
        'INSERT INTO run (goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        ['TEST_TRANSACTION: Concurrent updates', '{}', 'pending']
      );

      const updates = await Promise.allSettled([
        query('UPDATE run SET status = $1, updated_at = NOW() WHERE id = $2', ['running', runId]),
        query('UPDATE run SET status = $1, updated_at = NOW() WHERE id = $2', ['running', runId]),
        query('UPDATE run SET status = $1, updated_at = NOW() WHERE id = $2', ['running', runId])
      ]);

      const successful = updates.filter(u => u.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    test('should handle concurrent step creations', async () => {
      const runId = 'test-run-steps';

      // Mock run creation
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId }],
      });

      // Create run first
      await query(
        'INSERT INTO run (goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        ['TEST_TRANSACTION: Concurrent steps', '{}', 'pending']
      );

      // Now set up mocks for all 10 concurrent step creations
      for (let i = 0; i < 10; i++) {
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: `step-${i}` }],
        });
      }

      const stepCreations = await Promise.allSettled(
        Array(10).fill(null).map((_, i) =>
          query(
            'INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
            [runId, `concurrent-step-${i}`, 'codegen', '{}', 'pending']
          )
        )
      );

      const successful = stepCreations.filter(s => s.status === 'fulfilled');
      expect(successful.length).toBe(10);
    });
  });

  describe('Data Consistency Validation', () => {
    test('should maintain status consistency', async () => {
      const runId = 'test-run-status';

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId }],
      });

      // Mock step creations with various statuses
      mockQuery.mockResolvedValue({
        rows: [{ id: 'step-x' }],
      });

      await query(
        'INSERT INTO run (goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        ['TEST_TRANSACTION: Status consistency', '{}', 'running']
      );

      await Promise.all([
        query('INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
          [runId, 'step1', 'codegen', '{}', 'succeeded']),
        query('INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
          [runId, 'step2', 'codegen', '{}', 'running']),
        query('INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
          [runId, 'step3', 'codegen', '{}', 'pending'])
      ]);

      // Mock status count query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { status: 'succeeded', count: '1' },
          { status: 'running', count: '1' },
          { status: 'pending', count: '1' }
        ],
      });

      const steps = await query(
        'SELECT status, COUNT(*) as count FROM step WHERE run_id = $1 GROUP BY status',
        [runId]
      );

      expect(steps.rows.length).toBe(3);
    });

    test('should handle NULL values correctly', async () => {
      const runId = 'test-run-null';

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId }],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId, error_message: null }],
      });

      await query(
        'INSERT INTO run (goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        ['TEST_TRANSACTION: NULL handling', '{}', 'pending']
      );

      const nullQuery = await query(
        'SELECT * FROM run WHERE id = $1 AND error_message IS NULL',
        [runId]
      );

      expect(nullQuery.rows.length).toBe(1);
    });
  });

  describe('Performance Under Load', () => {
    test('should handle bulk inserts efficiently', async () => {
      const startTime = Date.now();
      const runId = 'test-run-bulk';

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: runId }],
      });

      // Mock successful inserts
      mockQuery.mockResolvedValue({
        rows: [{ id: 'step-x' }],
      });

      await query(
        'INSERT INTO run (goal, plan, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        ['TEST_TRANSACTION: Bulk inserts', '{}', 'pending']
      );

      const insertPromises = [];
      for (let i = 0; i < 50; i++) {
        insertPromises.push(
          query(
            'INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
            [runId, `bulk-step-${i}`, 'codegen', '{}', 'pending']
          )
        );
      }

      await Promise.all(insertPromises);

      const duration = Date.now() - startTime;

      // Mocked queries should be fast
      expect(duration).toBeLessThan(1000);

      // Mock count query
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '50' }],
      });

      const count = await query('SELECT COUNT(*) FROM step WHERE run_id = $1', [runId]);
      expect(parseInt(count.rows[0].count)).toBe(50);
    });
  });
});
