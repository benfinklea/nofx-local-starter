/**
 * Shared types for all repositories
 */

// JSON types with proper TypeScript safety
type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

// Status types
export type RunStatus = 'queued' | 'running' | 'blocked' | 'succeeded' | 'failed' | 'cancelled';
export type StepStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'failed' | 'succeeded' | 'cancelled' | 'skipped';

// Entity interfaces with strict typing
export interface RunRow {
  id: string;
  status: RunStatus;
  plan?: JsonValue;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  completed_at?: string;
  project_id?: string;
  metadata?: JsonValue;
  user_id?: string;
}

export interface StepRow {
  id: string;
  run_id: string;
  name: string;
  tool: string;
  inputs: JsonValue;
  outputs?: JsonValue;
  status: StepStatus;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  completed_at?: string;
  idempotency_key?: string;
}

export interface EventRow {
  id: string;
  run_id: string;
  step_id?: string;
  type: string;
  payload: JsonValue;
  created_at: string;
}

export interface GateRow {
  id: string;
  run_id: string;
  step_id: string;
  gate_type: string;
  status: GateStatus;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export interface ArtifactRow {
  id: string;
  step_id: string;
  type: string;
  path: string;
  metadata?: JsonValue;
  created_at: string;
}

export interface ArtifactWithStepName extends ArtifactRow {
  step_name: string;
}

export interface InboxRow {
  id: string;
  key: string;
  created_at: string;
}

export interface OutboxRow {
  id: string;
  topic: string;
  payload: JsonValue;
  sent: boolean;
  created_at: string;
  sent_at?: string;
}

export interface RunSummaryRow {
  id: string;
  status: RunStatus;
  created_at: string;
  title: string;
}

// Repository interfaces for dependency injection
export interface IRunRepository {
  create(plan: JsonValue, projectId: string, userId?: string): Promise<RunRow>;
  get(id: string): Promise<RunRow | undefined>;
  update(id: string, patch: Partial<RunRow>): Promise<void>;
  list(limit?: number, projectId?: string): Promise<RunSummaryRow[]>;
  listByUser(userId: string, limit?: number, projectId?: string): Promise<RunRow[]>;
  reset(runId: string): Promise<void>;
}

export interface IStepRepository {
  create(runId: string, name: string, tool: string, inputs?: JsonValue, idempotencyKey?: string): Promise<StepRow | undefined>;
  get(id: string): Promise<StepRow | undefined>;
  getByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined>;
  update(id: string, patch: Partial<StepRow>): Promise<void>;
  listByRun(runId: string): Promise<StepRow[]>;
  countRemaining(runId: string): Promise<number>;
  reset(stepId: string): Promise<void>;
}

export interface IEventRepository {
  record(runId: string, type: string, payload: JsonValue, stepId?: string): Promise<void>;
  list(runId: string): Promise<EventRow[]>;
}

export interface IGateRepository {
  createOrGet(runId: string, stepId: string, gateType: string): Promise<GateRow | undefined>;
  getLatest(runId: string, stepId: string): Promise<GateRow | undefined>;
  update(gateId: string, patch: Partial<GateRow> & { run_id: string }): Promise<void>;
  listByRun(runId: string): Promise<GateRow[]>;
}

export interface IArtifactRepository {
  add(stepId: string, type: string, path: string, metadata?: JsonValue): Promise<void>;
  listByRun(runId: string): Promise<ArtifactWithStepName[]>;
}

export interface IInboxRepository {
  markIfNew(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export interface IOutboxRepository {
  add(topic: string, payload: JsonValue): Promise<void>;
  listUnsent(limit?: number): Promise<OutboxRow[]>;
  markSent(id: string): Promise<void>;
}