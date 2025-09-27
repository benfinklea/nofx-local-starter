/**
 * Tests for db_write handler
 * Provides coverage for database write operations with approval gates
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../../src/policy/dbWritePolicy', () => ({
  isAllowed: jest.fn()
}));

jest.mock('../../../src/lib/settings', () => ({
  getSettings: jest.fn()
}));

jest.mock('../../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  STEP_READY_TOPIC: 'step-ready'
}));

import dbWriteHandler from '../../../src/worker/handlers/db_write';
import { query } from '../../../src/lib/db';
import { recordEvent } from '../../../src/lib/events';
import { isAllowed } from '../../../src/policy/dbWritePolicy';
import { getSettings } from '../../../src/lib/settings';
import { enqueue } from '../../../src/lib/queue';

const mockQuery = jest.mocked(query);
const mockRecordEvent = jest.mocked(recordEvent);
const mockIsAllowed = jest.mocked(isAllowed);
const mockGetSettings = jest.mocked(getSettings);
const mockEnqueue = jest.mocked(enqueue);

describe('db_write handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordEvent.mockResolvedValue(undefined);
    mockGetSettings.mockResolvedValue({
      approvals: { dbWrites: 'none' }
    } as any);
    mockIsAllowed.mockResolvedValue({ ok: true, reason: '' });
    mockEnqueue.mockResolvedValue(undefined);
  });

  describe('match', () => {
    it('should match db_write tool', () => {
      expect(dbWriteHandler.match('db_write')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(dbWriteHandler.match('db_read')).toBe(false);
      expect(dbWriteHandler.match('database')).toBe(false);
      expect(dbWriteHandler.match('write')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'write-data',
      tool: 'db_write',
      inputs: {
        table: 'users',
        op: 'insert' as const,
        values: { name: 'John', email: 'john@example.com' }
      }
    };

    beforeEach(() => {
      // Mock successful step status updates
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('update nofx.step')) {
          return { rows: [], rowCount: 1 } as any;
        }
        if (sql.includes('select * from nofx.gate')) {
          return { rows: [] } as any;
        }
        // Default insert result
        return {
          rows: [{ id: 1, name: 'John', email: 'john@example.com' }],
          rowCount: 1
        } as any;
      });
    });

    it('should execute insert operation successfully', async () => {
      await dbWriteHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should update step to running
      expect(mockQuery).toHaveBeenCalledWith(
        'update nofx.step set status=\'running\', started_at=now() where id=$1',
        ['step-123']
      );

      // Should record start event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.started',
        { name: 'write-data', tool: 'db_write' },
        'step-123'
      );

      // Should execute insert SQL
      expect(mockQuery).toHaveBeenCalledWith(
        'insert into users (name,email) values ($1,$2) returning *',
        ['John', 'john@example.com']
      );

      // Should update step to succeeded
      expect(mockQuery).toHaveBeenCalledWith(
        'update nofx.step set status=\'succeeded\', outputs=$2, ended_at=now() where id=$1',
        [
          'step-123',
          JSON.stringify({
            table: 'users',
            op: 'insert',
            result: { rowCount: 1, rows: [{ id: 1, name: 'John', email: 'john@example.com' }] }
          })
        ]
      );

      // Should record success event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'db.write.succeeded',
        { table: 'users', op: 'insert', rowCount: 1 },
        'step-123'
      );
    });

    it('should execute update operation with where clause', async () => {
      const updateStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'update' as const,
          values: { email: 'newemail@example.com' },
          where: 'id = $1',
          whereParams: [1]
        }
      };

      await dbWriteHandler.run({
        runId: 'run-123',
        step: updateStep as any
      });

      // Should execute update SQL with remapped placeholders
      expect(mockQuery).toHaveBeenCalledWith(
        'update users set email = $1 where id = $2 returning *',
        ['newemail@example.com', 1]
      );
    });

    it('should execute delete operation with where clause', async () => {
      const deleteStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'delete' as const,
          where: 'id = $1',
          whereParams: [1]
        }
      };

      await dbWriteHandler.run({
        runId: 'run-123',
        step: deleteStep as any
      });

      // Should execute delete SQL
      expect(mockQuery).toHaveBeenCalledWith(
        'delete from users where id = $1 returning *',
        [1]
      );
    });

    it('should require approval for dangerous operations when configured', async () => {
      mockGetSettings.mockResolvedValue({
        approvals: { dbWrites: 'dangerous' }
      } as any);

      const updateStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'update' as const,
          values: { status: 'deleted' },
          where: 'id = $1',
          whereParams: [1]
        }
      };

      await dbWriteHandler.run({
        runId: 'run-123',
        step: updateStep as any
      });

      // Should check for existing gate
      expect(mockQuery).toHaveBeenCalledWith(
        'select * from nofx.gate where run_id=$1 and step_id=$2 and gate_type=\'manual:db\' order by created_at desc limit 1',
        ['run-123', 'step-123']
      );

      // Should create new gate when none exists
      expect(mockQuery).toHaveBeenCalledWith(
        'insert into nofx.gate (run_id, step_id, gate_type, status) values ($1,$2,\'manual:db\',\'pending\')',
        ['run-123', 'step-123']
      );

      // Should enqueue retry
      expect(mockEnqueue).toHaveBeenCalledWith(
        'step-ready',
        { runId: 'run-123', stepId: 'step-123' },
        { delay: 5000 }
      );
    });

    it('should proceed when gate is approved', async () => {
      mockGetSettings.mockResolvedValue({
        approvals: { dbWrites: 'all' }
      } as any);

      // Mock existing approved gate
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('select * from nofx.gate')) {
          return { rows: [{ id: 'gate-1', status: 'passed' }] } as any;
        }
        if (sql.includes('update nofx.step')) {
          return { rows: [], rowCount: 1 } as any;
        }
        return { rows: [{ id: 1 }], rowCount: 1 } as any;
      });

      await dbWriteHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should proceed with operation when gate is approved
      expect(mockQuery).toHaveBeenCalledWith(
        'insert into users (name,email) values ($1,$2) returning *',
        ['John', 'john@example.com']
      );
    });

    it('should fail when gate is rejected', async () => {
      mockGetSettings.mockResolvedValue({
        approvals: { dbWrites: 'all' }
      } as any);

      // Mock existing rejected gate
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('select * from nofx.gate')) {
          return { rows: [{ id: 'gate-1', status: 'failed' }] } as any;
        }
        if (sql.includes('update nofx.step')) {
          return { rows: [], rowCount: 1 } as any;
        }
        return { rows: [], rowCount: 0 } as any;
      });

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('db write not approved');

      // Should mark step as failed
      expect(mockQuery).toHaveBeenCalledWith(
        'update nofx.step set status=\'failed\', ended_at=now(), error=$2 where id=$1',
        ['step-123', 'db write not approved']
      );
    });

    it('should validate required inputs', async () => {
      const invalidStep = {
        ...baseStep,
        inputs: {} // No table or op
      };

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: invalidStep as any
      })).rejects.toThrow('db_write requires table and op');
    });

    it('should validate table name safety', async () => {
      const unsafeStep = {
        ...baseStep,
        inputs: {
          table: 'users; DROP TABLE users;--',
          op: 'insert' as const,
          values: { name: 'test' }
        }
      };

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: unsafeStep as any
      })).rejects.toThrow('unsafe table name');
    });

    it('should validate column name safety', async () => {
      const unsafeStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'insert' as const,
          values: { 'name; DROP TABLE users;--': 'test' }
        }
      };

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: unsafeStep as any
      })).rejects.toThrow('unsafe column');
    });

    it('should enforce policy restrictions', async () => {
      mockIsAllowed.mockResolvedValue({
        ok: false,
        reason: 'Table not in allowlist'
      });

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('db_write not allowed');

      // Should record denial event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'db.write.denied',
        { table: 'users', op: 'insert', reason: 'Table not in allowlist' },
        'step-123'
      );
    });

    it('should require values for insert operation', async () => {
      const invalidStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'insert' as const,
          values: {}
        }
      };

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: invalidStep as any
      })).rejects.toThrow('insert requires values');
    });

    it('should require where clause for update operation', async () => {
      const invalidStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'update' as const,
          values: { name: 'New Name' }
          // Missing where clause
        }
      };

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: invalidStep as any
      })).rejects.toThrow('update requires where');
    });

    it('should require where clause for delete operation', async () => {
      const invalidStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'delete' as const
          // Missing where clause
        }
      };

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: invalidStep as any
      })).rejects.toThrow('delete requires where');
    });

    it('should handle unknown operations', async () => {
      const invalidStep = {
        ...baseStep,
        inputs: {
          table: 'users',
          op: 'truncate' as any
        }
      };

      await expect(dbWriteHandler.run({
        runId: 'run-123',
        step: invalidStep as any
      })).rejects.toThrow('unknown op');
    });

    it('should handle fallback step update on error', async () => {
      // Mock first update to fail, second to succeed
      mockQuery
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await dbWriteHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should try both ended_at and completed_at columns
      expect(mockQuery).toHaveBeenCalledWith(
        'update nofx.step set status=\'running\', started_at=now() where id=$1',
        ['step-123']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        'update nofx.step set status=\'running\' where id=$1',
        ['step-123']
      );
    });
  });
});