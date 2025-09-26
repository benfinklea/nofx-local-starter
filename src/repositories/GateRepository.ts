/**
 * Repository for Gate entity operations
 */
import { query as pgQuery } from '../lib/db';
import { GateRow, IGateRepository } from './types';
import {
  fsCreateOrGetGate,
  fsGetLatestGate,
  fsUpdateGate,
  fsListGatesByRun
} from '../adapters/FilesystemAdapter';
import { dataDriver } from '../lib/config';

export class GateRepository implements IGateRepository {
  async createOrGet(
    runId: string,
    stepId: string,
    gateType: string
  ): Promise<GateRow | undefined> {
    if (dataDriver() === 'db') {
      const inserted = await pgQuery<GateRow>(
        `INSERT INTO nofx.gate (run_id, step_id, gate_type, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (run_id, step_id, gate_type) DO NOTHING
         RETURNING *`,
        [runId, stepId, gateType]
      );

      if (inserted.rows[0]) return inserted.rows[0];

      const existing = await pgQuery<GateRow>(
        `SELECT id, run_id, step_id, gate_type, status,
                created_at, approved_by, approved_at
         FROM nofx.gate
         WHERE run_id = $1 AND step_id = $2 AND gate_type = $3
         LIMIT 1`,
        [runId, stepId, gateType]
      );
      return existing.rows[0];
    }
    return fsCreateOrGetGate(runId, stepId, gateType);
  }

  async getLatest(runId: string, stepId: string): Promise<GateRow | undefined> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<GateRow>(
        `SELECT id, run_id, step_id, gate_type, status,
                created_at, approved_by, approved_at
         FROM nofx.gate
         WHERE run_id = $1 AND step_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [runId, stepId]
      );
      return result.rows[0];
    }
    return fsGetLatestGate(runId, stepId);
  }

  async update(gateId: string, patch: Partial<GateRow> & { run_id: string }): Promise<void> {
    if (dataDriver() === 'db') {
      const status = patch.status || null;
      const approvedBy = patch.approved_by || null;

      await pgQuery(
        `UPDATE nofx.gate
         SET status = $2,
             approved_by = COALESCE($3, approved_by),
             approved_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE approved_at END
         WHERE id = $1`,
        [gateId, status, approvedBy]
      );
    } else {
      await fsUpdateGate(patch.run_id, gateId, patch);
    }
  }

  async listByRun(runId: string): Promise<GateRow[]> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<GateRow>(
        `SELECT * FROM nofx.gate
         WHERE run_id = $1
         ORDER BY created_at ASC`,
        [runId]
      );
      return result.rows;
    }
    return fsListGatesByRun(runId);
  }
}