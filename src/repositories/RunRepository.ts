/**
 * Repository for Run entity operations
 */
import { randomUUID } from 'node:crypto';
import { query as pgQuery } from '../lib/db';
import {
  RunRow,
  RunSummaryRow,
  JsonValue,
  RunStatus,
  IRunRepository
} from './types';
import { fsGetRun, fsListRuns, fsUpdateRun, fsResetRun } from '../adapters/FilesystemAdapter';
import { dataDriver } from '../lib/config';

export class RunRepository implements IRunRepository {
  async create(plan: JsonValue, projectId: string = 'default', userId?: string): Promise<RunRow> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<RunRow>(
        `INSERT INTO nofx.run (plan, status, project_id, user_id)
         VALUES ($1, 'queued', $2, $3)
         RETURNING *`,
        [plan, projectId, userId || null]
      );
      return result.rows[0];
    }

    // Filesystem fallback
    const runId = randomUUID();
    const run: RunRow = {
      id: runId,
      status: 'queued',
      plan: plan || null,
      created_at: new Date().toISOString(),
      project_id: projectId,
      user_id: userId
    };
    await fsUpdateRun(run);
    return run;
  }

  async get(id: string): Promise<RunRow | undefined> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<RunRow>(
        `SELECT * FROM nofx.run WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    }
    return fsGetRun(id);
  }

  async update(id: string, patch: Partial<RunRow>): Promise<void> {
    if (dataDriver() === 'db') {
      const status = patch.status || null;
      const endedAt = patch.ended_at || patch.completed_at || null;
      const completedAt = patch.completed_at || patch.ended_at || null;

      try {
        await pgQuery(
          `UPDATE nofx.run
           SET status = COALESCE($2, status),
               ended_at = COALESCE($3, ended_at)
           WHERE id = $1`,
          [id, status, endedAt]
        );
      } catch {
        // Fallback for schema differences
        await pgQuery(
          `UPDATE nofx.run
           SET status = COALESCE($2, status),
               completed_at = COALESCE($3, completed_at)
           WHERE id = $1`,
          [id, status, completedAt]
        );
      }
    } else {
      const existing = await fsGetRun(id);
      if (existing) {
        await fsUpdateRun({ ...existing, ...patch });
      }
    }
  }

  async list(limit: number = 50, projectId?: string): Promise<RunSummaryRow[]> {
    if (dataDriver() === 'db') {
      if (projectId) {
        const result = await pgQuery<RunSummaryRow>(
          `SELECT id, status, created_at, COALESCE(plan->>'goal', '') AS title
           FROM nofx.run
           WHERE project_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [projectId, limit]
        );
        return result.rows;
      }

      const result = await pgQuery<RunSummaryRow>(
        `SELECT id, status, created_at, COALESCE(plan->>'goal', '') AS title
         FROM nofx.run
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    }
    return fsListRuns(limit, projectId);
  }

  async listByUser(userId: string, limit: number = 50, projectId?: string): Promise<RunRow[]> {
    if (dataDriver() !== 'db') {
      return this.list(limit, projectId) as Promise<RunRow[]>;
    }

    const conditions: string[] = ['user_id = $1'];
    const params: (string | number)[] = [userId];

    if (projectId) {
      conditions.push(`project_id = $${params.length + 1}`);
      params.push(projectId);
    }

    const result = await pgQuery<RunRow>(
      `SELECT * FROM nofx.run
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    return result.rows;
  }

  async reset(runId: string): Promise<void> {
    if (dataDriver() === 'db') {
      try {
        await pgQuery(
          `UPDATE nofx.run
           SET status = 'queued', ended_at = NULL, completed_at = NULL
           WHERE id = $1`,
          [runId]
        );
      } catch {
        await pgQuery(
          `UPDATE nofx.run
           SET status = 'queued', ended_at = NULL
           WHERE id = $1`,
          [runId]
        );
      }
    } else {
      await fsResetRun(runId);
    }
  }

  async getUserRole(userId: string): Promise<string | null> {
    if (dataDriver() !== 'db') return null;

    const result = await pgQuery<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.role || null;
  }
}