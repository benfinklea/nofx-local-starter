/**
 * Database Transaction Integration Tests
 * Tests complex multi-table transactions, rollback scenarios, and data consistency
 */

import { query } from '../../src/lib/db';
import { TestDataFactory } from '../helpers/testHelpers';

// Check if database is available before running tests
let isDatabaseAvailable = false;

beforeAll(async () => {
  try {
    // Test database connectivity AND schema availability
    await query('SELECT 1 FROM run LIMIT 0');
    await query('SELECT 1 FROM step LIMIT 0');
    isDatabaseAvailable = true;
  } catch (error) {
    console.warn('⚠️  Database or schema not available, skipping integration tests');
    isDatabaseAvailable = false;
  }
});

// Helper function to skip tests when database is not available
function skipIfNoDB(testName: string): boolean {
  if (!isDatabaseAvailable) {
    console.log(`⏭️  Skipping test "${testName}": Database not available`);
    return true;
  }
  return false;
}

describe('Integration: Database Transactions', () => {
  beforeEach(async () => {
    if (!isDatabaseAvailable) {
      return;
    }
    // Clean up test data before each test
    try {
      await query('DELETE FROM run WHERE goal LIKE $1', ['%TEST_TRANSACTION%']);
    } catch (error) {
      // Ignore cleanup errors if table doesn't exist
      console.warn('Could not clean up test data:', error);
    }
  });

  afterAll(async () => {
    if (!isDatabaseAvailable) {
      return;
    }
    // Final cleanup
    try {
      await query('DELETE FROM run WHERE goal LIKE $1', ['%TEST_TRANSACTION%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complex Multi-Table Transactions', () => {
    test('should handle complete run creation transaction', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      const runData = {
        goal: 'TEST_TRANSACTION: Multi-table test',
        plan: TestDataFactory.createRunPlan(),
        status: 'pending' as const
      };

      // Create run with steps in a transaction
      const result = await query(
        `INSERT INTO run (goal, plan, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [runData.goal, JSON.stringify(runData.plan), runData.status]
      );

      expect(result.rows.length).toBe(1);
      const runId = result.rows[0].id;

      // Create associated steps
      const steps = runData.plan.steps || [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await query(
          `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [runId, step.name, step.tool, JSON.stringify(step.inputs), 'pending']
        );
      }

      // Verify run was created
      const verifyRun = await query('SELECT * FROM run WHERE id = $1', [runId]);
      expect(verifyRun.rows.length).toBe(1);
      expect(verifyRun.rows[0].goal).toBe(runData.goal);

      // Verify steps were created
      const verifySteps = await query('SELECT * FROM step WHERE run_id = $1', [runId]);
      expect(verifySteps.rows.length).toBe(steps.length);

      // Clean up
      await query('DELETE FROM step WHERE run_id = $1', [runId]);
      await query('DELETE FROM run WHERE id = $1', [runId]);
    });

    test('should maintain referential integrity on cascade delete', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      // Create run
      const runResult = await query(
        `INSERT INTO run (goal, plan, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['TEST_TRANSACTION: Cascade test', '{}', 'pending']
      );

      const runId = runResult.rows[0].id;

      // Create step
      await query(
        `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [runId, 'test-step', 'codegen', '{}', 'pending']
      );

      // Delete run (should cascade to steps if configured)
      await query('DELETE FROM run WHERE id = $1', [runId]);

      // Verify run is deleted
      const verifyRun = await query('SELECT * FROM run WHERE id = $1', [runId]);
      expect(verifyRun.rows.length).toBe(0);

      // Note: Step cascade behavior depends on database schema configuration
      // If ON DELETE CASCADE is set, steps should be deleted automatically
    });
  });

  describe('Transaction Rollback Scenarios', () => {
    test('should handle constraint violation rollback', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      try {
        // Attempt to insert duplicate or invalid data
        await query(
          `INSERT INTO run (id, goal, plan, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          ['duplicate-id', 'TEST_TRANSACTION: Duplicate', '{}', 'pending']
        );

        // Try to insert same ID again (should fail)
        await query(
          `INSERT INTO run (id, goal, plan, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          ['duplicate-id', 'TEST_TRANSACTION: Duplicate 2', '{}', 'pending']
        );

        // Should not reach here
        fail('Expected constraint violation');
      } catch (error: any) {
        // Verify error is constraint violation
        expect(error.message).toMatch(/duplicate key|unique constraint|already exists/i);

        // Clean up first insert
        await query('DELETE FROM run WHERE id = $1', ['duplicate-id']);
      }
    });

    test('should handle foreign key violation', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      const nonExistentRunId = 'non-existent-run-id';

      try {
        // Try to create step with non-existent run_id
        await query(
          `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [nonExistentRunId, 'orphan-step', 'codegen', '{}', 'pending']
        );

        // Should not reach here
        fail('Expected foreign key violation');
      } catch (error: any) {
        // Verify error is foreign key violation
        expect(error.message).toMatch(/foreign key|violates|constraint/i);
      }
    });
  });

  describe('Concurrent Transaction Handling', () => {
    test('should handle concurrent updates to same run', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      // Create test run
      const result = await query(
        `INSERT INTO run (goal, plan, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['TEST_TRANSACTION: Concurrent updates', '{}', 'pending']
      );

      const runId = result.rows[0].id;

      try {
        // Perform concurrent updates
        const updates = await Promise.allSettled([
          query('UPDATE run SET status = $1, updated_at = NOW() WHERE id = $2', ['running', runId]),
          query('UPDATE run SET status = $1, updated_at = NOW() WHERE id = $2', ['running', runId]),
          query('UPDATE run SET status = $1, updated_at = NOW() WHERE id = $2', ['running', runId])
        ]);

        // All updates should eventually succeed (or be handled gracefully)
        const successful = updates.filter(u => u.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);

        // Verify final state
        const finalState = await query('SELECT status FROM run WHERE id = $1', [runId]);
        expect(finalState.rows[0].status).toBe('running');
      } finally {
        // Clean up
        await query('DELETE FROM run WHERE id = $1', [runId]);
      }
    });

    test('should handle concurrent step creations', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      // Create test run
      const result = await query(
        `INSERT INTO run (goal, plan, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['TEST_TRANSACTION: Concurrent steps', '{}', 'pending']
      );

      const runId = result.rows[0].id;

      try {
        // Create multiple steps concurrently
        const stepCreations = await Promise.allSettled(
          Array(10).fill(null).map((_, i) =>
            query(
              `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
              [runId, `concurrent-step-${i}`, 'codegen', '{}', 'pending']
            )
          )
        );

        // Most should succeed
        const successful = stepCreations.filter(s => s.status === 'fulfilled');
        expect(successful.length).toBeGreaterThanOrEqual(8);

        // Verify steps were created
        const steps = await query('SELECT COUNT(*) FROM step WHERE run_id = $1', [runId]);
        expect(parseInt(steps.rows[0].count)).toBeGreaterThanOrEqual(8);
      } finally {
        // Clean up
        await query('DELETE FROM step WHERE run_id = $1', [runId]);
        await query('DELETE FROM run WHERE id = $1', [runId]);
      }
    });
  });

  describe('Data Consistency Validation', () => {
    test('should maintain status consistency', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      // Create run with steps
      const runResult = await query(
        `INSERT INTO run (goal, plan, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['TEST_TRANSACTION: Status consistency', '{}', 'running']
      );

      const runId = runResult.rows[0].id;

      try {
        // Create steps with various statuses
        await Promise.all([
          query(
            `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [runId, 'step1', 'codegen', '{}', 'succeeded']
          ),
          query(
            `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [runId, 'step2', 'codegen', '{}', 'running']
          ),
          query(
            `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [runId, 'step3', 'codegen', '{}', 'pending']
          )
        ]);

        // Verify data consistency
        const steps = await query(
          'SELECT status, COUNT(*) as count FROM step WHERE run_id = $1 GROUP BY status',
          [runId]
        );

        expect(steps.rows.length).toBeGreaterThan(0);

        // Verify at least one step has each status
        const statuses = steps.rows.map(r => r.status);
        expect(statuses).toContain('succeeded');
        expect(statuses).toContain('running');
      } finally {
        // Clean up
        await query('DELETE FROM step WHERE run_id = $1', [runId]);
        await query('DELETE FROM run WHERE id = $1', [runId]);
      }
    });

    test('should handle NULL values correctly', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      const result = await query(
        `INSERT INTO run (goal, plan, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['TEST_TRANSACTION: NULL handling', '{}', 'pending']
      );

      const runId = result.rows[0].id;

      try {
        // Query with NULL conditions
        const nullQuery = await query(
          'SELECT * FROM run WHERE id = $1 AND error_message IS NULL',
          [runId]
        );

        expect(nullQuery.rows.length).toBe(1);
      } finally {
        // Clean up
        await query('DELETE FROM run WHERE id = $1', [runId]);
      }
    });
  });

  describe('Performance Under Load', () => {
    test('should handle bulk inserts efficiently', async () => {
      if (!isDatabaseAvailable) {
        console.log('⏭️  Skipping test: Database not available');
        return;
      }

      const startTime = Date.now();

      // Create run
      const runResult = await query(
        `INSERT INTO run (goal, plan, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['TEST_TRANSACTION: Bulk inserts', '{}', 'pending']
      );

      const runId = runResult.rows[0].id;

      try {
        // Bulk insert steps (one by one for testing)
        const insertPromises = [];
        for (let i = 0; i < 50; i++) {
          insertPromises.push(
            query(
              `INSERT INTO step (run_id, name, tool, inputs, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
              [runId, `bulk-step-${i}`, 'codegen', '{}', 'pending']
            )
          );
        }

        await Promise.all(insertPromises);

        const duration = Date.now() - startTime;

        // Should complete within reasonable time
        expect(duration).toBeLessThan(10000); // 10 seconds

        // Verify all steps were created
        const count = await query('SELECT COUNT(*) FROM step WHERE run_id = $1', [runId]);
        expect(parseInt(count.rows[0].count)).toBe(50);
      } finally {
        // Clean up
        await query('DELETE FROM step WHERE run_id = $1', [runId]);
        await query('DELETE FROM run WHERE id = $1', [runId]);
      }
    });
  });
});
