/**
 * Repository for Step entity operations
 */
import { randomUUID } from 'node:crypto';
import { query as pgQuery } from '../lib/db';
import {
  StepRow,
  JsonValue,
  StepStatus,
  IStepRepository
} from './types';
import {
  fsGetStep,
  fsFindStepByIdempotencyKey,
  fsUpdateStep,
  fsListStepsByRun,
  fsCountRemainingSteps,
  fsResetStep
} from '../adapters/FilesystemAdapter';
import { dataDriver } from '../lib/config';

export class StepRepository implements IStepRepository {
  async create(
    runId: string,
    name: string,
    tool: string,
    inputs?: JsonValue,
    idempotencyKey?: string
  ): Promise<StepRow | undefined> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<StepRow>(
        `INSERT INTO nofx.step (run_id, name, tool, inputs, status, idempotency_key)
         VALUES ($1, $2, $3, $4, 'queued', $5)
         ON CONFLICT (run_id, idempotency_key) DO NOTHING
         RETURNING *`,
        [runId, name, tool, inputs || {}, idempotencyKey || null]
      );

      const row = result.rows[0];
      if (row) return row;

      // Check if already exists with idempotency key
      if (idempotencyKey) {
        const existing = await pgQuery<StepRow>(
          `SELECT id, run_id, name, tool, inputs, outputs, status,
                  created_at, started_at, ended_at, completed_at, idempotency_key
           FROM nofx.step
           WHERE run_id = $1 AND idempotency_key = $2
           LIMIT 1`,
          [runId, idempotencyKey]
        );
        return existing.rows[0];
      }
      return undefined;
    }

    // Filesystem fallback
    if (idempotencyKey) {
      const existing = await fsFindStepByIdempotencyKey(runId, idempotencyKey);
      if (existing) return existing;
    }

    const stepId = randomUUID();
    const step: StepRow = {
      id: stepId,
      run_id: runId,
      name,
      tool,
      inputs: inputs || {},
      status: 'queued',
      created_at: new Date().toISOString(),
      idempotency_key: idempotencyKey
    };
    await fsUpdateStep(step);
    return step;
  }

  async get(id: string): Promise<StepRow | undefined> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<StepRow>(
        `SELECT * FROM nofx.step WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    }
    return fsGetStep(id);
  }

  async getByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<StepRow>(
        `SELECT * FROM nofx.step
         WHERE run_id = $1 AND idempotency_key = $2`,
        [runId, key]
      );
      return result.rows[0];
    }
    return fsFindStepByIdempotencyKey(runId, key);
  }

  async update(id: string, patch: Partial<StepRow>): Promise<void> {
    if (dataDriver() === 'db') {
      const status = patch.status || null;
      const startedAt = patch.started_at || null;
      const endedAt = patch.ended_at || patch.completed_at || null;
      const completedAt = patch.completed_at || patch.ended_at || null;
      const outputs = patch.outputs ?? null;

      try {
        await pgQuery(
          `UPDATE nofx.step
           SET status = COALESCE($2, status),
               started_at = COALESCE($3, started_at),
               ended_at = COALESCE($4, ended_at),
               outputs = COALESCE($5, outputs)
           WHERE id = $1`,
          [id, status, startedAt, endedAt, outputs]
        );
      } catch {
        // Fallback for schema differences
        await pgQuery(
          `UPDATE nofx.step
           SET status = COALESCE($2, status),
               started_at = COALESCE($3, started_at),
               completed_at = COALESCE($4, completed_at),
               outputs = COALESCE($5, outputs)
           WHERE id = $1`,
          [id, status, startedAt, completedAt, outputs]
        );
      }
    } else {
      const existing = await fsGetStep(id);
      if (existing) {
        await fsUpdateStep({ ...existing, ...patch });
      }
    }
  }

  async listByRun(runId: string): Promise<StepRow[]> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<StepRow>(
        `SELECT * FROM nofx.step
         WHERE run_id = $1
         ORDER BY created_at`,
        [runId]
      );
      return result.rows;
    }
    return fsListStepsByRun(runId);
  }

  async countRemaining(runId: string): Promise<number> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<{ count: string }>(
        `SELECT COUNT(*)::int AS count
         FROM nofx.step
         WHERE run_id = $1
           AND status NOT IN ('succeeded', 'cancelled')`,
        [runId]
      );
      return Number(result.rows[0].count);
    }
    return fsCountRemainingSteps(runId);
  }

  async reset(stepId: string): Promise<void> {
    if (dataDriver() === 'db') {
      try {
        await pgQuery(
          `UPDATE nofx.step
           SET status = 'queued',
               started_at = NULL,
               ended_at = NULL,
               completed_at = NULL,
               outputs = '{}'::jsonb
           WHERE id = $1`,
          [stepId]
        );
      } catch {
        await pgQuery(
          `UPDATE nofx.step
           SET status = 'queued',
               started_at = NULL,
               ended_at = NULL,
               outputs = '{}'::jsonb
           WHERE id = $1`,
          [stepId]
        );
      }
    } else {
      await fsResetStep(stepId);
    }
  }
}