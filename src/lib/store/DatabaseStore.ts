/**
 * Database implementation of the store driver
 */

import { randomUUID } from 'node:crypto';
import { query as pgQuery } from '../db';
import type {
  JsonValue,
  RunRow,
  StepRow,
  EventRow,
  GateRow,
  ArtifactRow,
  OutboxRow,
  RunSummaryRow,
  ArtifactWithStepName,
  StoreDriver
} from './types';

export class DatabaseStore implements StoreDriver {
  async createRun(plan: JsonValue | null | undefined, projectId = 'default'): Promise<RunRow> {
    const result = await pgQuery<RunRow>(
      `insert into nofx.run (plan, status, project_id)
       values ($1, 'queued', $2)
       returning id, status, plan, created_at, started_at, ended_at, completed_at, project_id, metadata`,
      [plan ?? null, projectId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('failed to create run');
    return row;
  }

  async getRun(id: string): Promise<RunRow | undefined> {
    const result = await pgQuery<RunRow>(`select * from nofx.run where id = $1`, [id]);
    return result.rows[0];
  }

  async updateRun(id: string, patch: Partial<RunRow>): Promise<void> {
    const status = patch.status ?? null;
    const endedAt = patch.ended_at ?? null;
    const completedAt = patch.completed_at ?? patch.ended_at ?? null;
    try {
      await pgQuery(
        `update nofx.run set status=coalesce($2,status), ended_at=coalesce($3,ended_at) where id=$1`,
        [id, status, endedAt],
      );
    } catch {
      await pgQuery(
        `update nofx.run set status=coalesce($2,status), completed_at=coalesce($3,completed_at) where id=$1`,
        [id, status, completedAt],
      );
    }
  }

  async resetRun(id: string): Promise<void> {
    try {
      await pgQuery(`update nofx.run set status='queued', ended_at=null, completed_at=null where id=$1`, [id]);
    } catch {
      await pgQuery(`update nofx.run set status='queued', ended_at=null where id=$1`, [id]);
    }
  }

  async listRuns(limit = 100, projectId?: string): Promise<RunSummaryRow[]> {
    if (projectId) {
      const result = await pgQuery<RunSummaryRow>(
        `select id,status,created_at, coalesce(plan->>'goal','') as title
         from nofx.run
         where project_id = $1
         order by created_at desc
         limit ${limit}`,
        [projectId],
      );
      return result.rows;
    }
    const result = await pgQuery<RunSummaryRow>(
      `select id,status,created_at, coalesce(plan->>'goal','') as title
       from nofx.run
       order by created_at desc
       limit ${limit}`,
    );
    return result.rows;
  }

  async createStep(runId: string, name: string, tool: string, inputs?: JsonValue, idempotencyKey?: string): Promise<StepRow | undefined> {
    const result = await pgQuery<StepRow>(
      `insert into nofx.step (run_id, name, tool, inputs, status, idempotency_key)
       values ($1,$2,$3,$4,'queued',$5)
       on conflict (idempotency_key) do nothing
       returning id, run_id, name, tool, inputs, outputs, status, created_at, started_at, ended_at, completed_at, idempotency_key`,
      [runId, name, tool, inputs ?? {}, idempotencyKey ?? null],
    );
    const row = result.rows[0];
    if (row) return row;
    if (idempotencyKey) {
      const existing = await pgQuery<StepRow>(
        `select id, run_id, name, tool, inputs, outputs, status, created_at, started_at, ended_at, completed_at, idempotency_key
         from nofx.step where run_id=$1 and idempotency_key=$2 limit 1`,
        [runId, idempotencyKey],
      );
      return existing.rows[0];
    }
    return undefined;
  }

  async getStep(id: string): Promise<StepRow | undefined> {
    const result = await pgQuery<StepRow>(`select * from nofx.step where id = $1`, [id]);
    return result.rows[0];
  }

  async getStepByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined> {
    const result = await pgQuery<StepRow>(`select * from nofx.step where run_id=$1 and idempotency_key=$2`, [runId, key]);
    return result.rows[0];
  }

  async updateStep(id: string, patch: Partial<StepRow>): Promise<void> {
    const status = patch.status ?? null;
    const startedAt = patch.started_at ?? null;
    const endedAt = patch.ended_at ?? null;
    const completedAt = patch.completed_at ?? patch.ended_at ?? null;
    const outputs = patch.outputs ?? null;
    try {
      await pgQuery(
        `update nofx.step set status=coalesce($2,status), started_at=coalesce($3,started_at), ended_at=coalesce($4,ended_at), outputs=coalesce($5,outputs) where id=$1`,
        [id, status, startedAt, endedAt, outputs],
      );
    } catch {
      await pgQuery(
        `update nofx.step set status=coalesce($2,status), started_at=coalesce($3,started_at), completed_at=coalesce($4,completed_at), outputs=coalesce($5,outputs) where id=$1`,
        [id, status, startedAt, completedAt, outputs],
      );
    }
  }

  async resetStep(stepId: string): Promise<void> {
    try {
      await pgQuery(`update nofx.step set status='queued', started_at=null, ended_at=null, completed_at=null, outputs='{}'::jsonb where id=$1`, [stepId]);
    } catch {
      await pgQuery(`update nofx.step set status='queued', started_at=null, ended_at=null, outputs='{}'::jsonb where id=$1`, [stepId]);
    }
  }

  async listStepsByRun(runId: string): Promise<StepRow[]> {
    const result = await pgQuery<StepRow>(`select * from nofx.step where run_id = $1 order by created_at`, [runId]);
    return result.rows;
  }

  async countRemainingSteps(runId: string): Promise<number> {
    const result = await pgQuery<{ count: string }>(`select count(*)::int as count from nofx.step where run_id=$1 and status not in ('succeeded','cancelled')`, [runId]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async recordEvent(runId: string, type: string, payload: JsonValue = {}): Promise<void> {
    await pgQuery(`insert into nofx.event (run_id, type, payload) values ($1, $2, $3)`, [runId, type, payload]);
  }

  async listEvents(runId: string): Promise<EventRow[]> {
    const result = await pgQuery<EventRow>(`select * from nofx.event where run_id = $1 order by created_at asc`, [runId]);
    return result.rows;
  }

  async createOrGetGate(runId: string, stepId: string, gateType: string): Promise<GateRow | undefined> {
    const inserted = await pgQuery<GateRow>(
      `insert into nofx.gate (run_id, step_id, gate_type, status)
       values ($1,$2,$3,'pending')
       on conflict do nothing
       returning id, run_id, step_id, gate_type, status, created_at, approved_by, approved_at`,
      [runId, stepId, gateType],
    );
    if (inserted.rows[0]) return inserted.rows[0];
    const existing = await pgQuery<GateRow>(
      `select id, run_id, step_id, gate_type, status, created_at, approved_by, approved_at
       from nofx.gate
       where run_id=$1 and step_id=$2 and gate_type=$3
       order by created_at desc
       limit 1`,
      [runId, stepId, gateType],
    );
    return existing.rows[0];
  }

  async getLatestGate(runId: string, stepId: string): Promise<GateRow | undefined> {
    const result = await pgQuery<GateRow>(`select id, run_id, step_id, gate_type, status, created_at, approved_by, approved_at from nofx.gate where run_id=$1 and step_id=$2 order by created_at desc limit 1`, [runId, stepId]);
    return result.rows[0];
  }

  async updateGate(gateId: string, patch: Partial<GateRow> & { run_id: string }): Promise<void> {
    const status = patch.status ?? null;
    const approvedBy = patch.approved_by ?? null;
    await pgQuery(
      `update nofx.gate set status=$2, approved_by=coalesce($3, approved_by), approved_at=case when $3 is not null then now() else approved_at end where id=$1`,
      [gateId, status, approvedBy],
    );
  }

  async listGatesByRun(runId: string): Promise<GateRow[]> {
    const result = await pgQuery<GateRow>(`select * from nofx.gate where run_id=$1 order by created_at asc`, [runId]);
    return result.rows;
  }

  async addArtifact(stepId: string, type: string, path: string, metadata?: JsonValue): Promise<void> {
    await pgQuery(`insert into nofx.artifact (step_id, type, path, metadata) values ($1,$2,$3,$4)`, [stepId, type, path, metadata ?? {}]);
  }

  async listArtifactsByRun(runId: string): Promise<ArtifactWithStepName[]> {
    const result = await pgQuery<ArtifactWithStepName>(
      `select a.id, a.step_id, a.type, a.path, a.metadata, a.created_at, s.name as step_name
       from nofx.artifact a
       join nofx.step s on s.id = a.step_id
       where s.run_id = $1`,
      [runId],
    );
    return result.rows;
  }

  async inboxMarkIfNew(key: string): Promise<boolean> {
    const result = await pgQuery<{ id: string }>(
      `insert into nofx.inbox (key) values ($1) on conflict do nothing returning id`,
      [key],
    );
    return Boolean(result.rows[0]);
  }

  async inboxDelete(key: string): Promise<void> {
    await pgQuery(`delete from nofx.inbox where key=$1`, [key]);
  }

  async outboxAdd(topic: string, payload: JsonValue): Promise<void> {
    await pgQuery(`insert into nofx.outbox (topic, payload) values ($1,$2)`, [topic, payload]);
  }

  async outboxListUnsent(limit = 50): Promise<OutboxRow[]> {
    const result = await pgQuery<OutboxRow>(
      `select id, topic, payload, sent, created_at from nofx.outbox where sent=false order by created_at asc limit ${limit}`,
    );
    return result.rows;
  }

  async outboxMarkSent(id: string): Promise<void> {
    await pgQuery(`update nofx.outbox set sent=true, sent_at=now() where id=$1`, [id]);
  }

  async getUserRole(userId: string): Promise<string | null> {
    const result = await pgQuery<{ role: string }>(`select role from users where id=$1`, [userId]);
    return result.rows[0]?.role || null;
  }

  async listRunsByUser(userId: string, limit = 50, projectId?: string): Promise<RunRow[]> {
    const conds = ['user_id=$1'];
    const params: (string | number)[] = [userId];
    if (projectId) {
      conds.push(`project_id=$${params.length + 1}`);
      params.push(projectId);
    }
    const result = await pgQuery<RunRow>(
      `select * from nofx.run where ${conds.join(' and ')} order by created_at desc limit $${params.length + 1}`,
      [...params, limit]
    );
    return result.rows;
  }

  async createRunWithUser(plan: any, projectId: string, userId: string): Promise<RunRow> {
    const runId = randomUUID();
    const runData = {
      id: runId,
      plan,
      status: 'queued',
      project_id: projectId,
      user_id: userId,
      metadata: plan.metadata || {}
    };
    await pgQuery(
      `insert into nofx.run (id, plan, status, project_id, user_id, metadata) values ($1,$2,$3,$4,$5,$6)`,
      [runData.id, runData.plan, runData.status, runData.project_id, runData.user_id, runData.metadata]
    );
    const result = await pgQuery<RunRow>(`select * from nofx.run where id=$1`, [runId]);
    const row = result.rows[0];
    if (!row) throw new Error(`Failed to retrieve created run ${runId}`);
    return row;
  }
}