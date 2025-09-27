/**
 * Type definitions for the store module
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type RunStatus = 'queued' | 'running' | 'blocked' | 'succeeded' | 'failed' | 'cancelled' | 'rolled_back';
export type StepStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'failed' | 'succeeded' | 'cancelled' | 'skipped';

export interface RunRow {
  id: string;
  status: RunStatus | string;
  plan?: JsonValue | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  completed_at?: string | null;
  project_id?: string | null;
  metadata?: JsonValue | null;
}

export interface StepRow {
  id: string;
  run_id: string;
  name: string;
  tool: string;
  inputs: JsonValue;
  outputs?: JsonValue | null;
  status: StepStatus | string;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  completed_at?: string | null;
  idempotency_key?: string | null;
}

export interface EventRow {
  id: string;
  run_id: string;
  step_id?: string | null;
  type: string;
  payload: JsonValue;
  created_at: string;
}

export interface GateRow {
  id: string;
  run_id: string;
  step_id: string;
  gate_type: string;
  status: GateStatus | string;
  created_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
}

export interface ArtifactRow {
  id: string;
  step_id: string;
  type: string;
  path: string;
  metadata?: JsonValue | null;
  created_at: string;
}

export interface OutboxRow {
  id: string;
  topic: string;
  payload: JsonValue;
  sent: boolean;
  created_at: string;
}

export interface RunSummaryRow {
  id: string;
  status: RunStatus | string;
  created_at: string;
  title: string;
}

export interface ArtifactWithStepName extends ArtifactRow {
  step_name?: string | null;
}

export interface StoreDriver {
  createRun(plan: JsonValue | null | undefined, projectId?: string): Promise<RunRow>;
  getRun(id: string): Promise<RunRow | undefined>;
  updateRun(id: string, patch: Partial<RunRow>): Promise<void>;
  resetRun(id: string): Promise<void>;
  listRuns(limit?: number, projectId?: string): Promise<RunSummaryRow[]>;

  createStep(runId: string, name: string, tool: string, inputs?: JsonValue, idempotencyKey?: string): Promise<StepRow | undefined>;
  getStep(id: string): Promise<StepRow | undefined>;
  getStepByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined>;
  updateStep(id: string, patch: Partial<StepRow>): Promise<void>;
  resetStep(stepId: string): Promise<void>;
  listStepsByRun(runId: string): Promise<StepRow[]>;
  countRemainingSteps(runId: string): Promise<number>;

  recordEvent(runId: string, type: string, payload?: JsonValue, stepId?: string): Promise<void>;
  listEvents(runId: string): Promise<EventRow[]>;

  createOrGetGate(runId: string, stepId: string, gateType: string): Promise<GateRow | undefined>;
  getLatestGate(runId: string, stepId: string): Promise<GateRow | undefined>;
  updateGate(gateId: string, patch: Partial<GateRow> & { run_id: string }): Promise<void>;
  listGatesByRun(runId: string): Promise<GateRow[]>;

  addArtifact(stepId: string, type: string, path: string, metadata?: JsonValue): Promise<ArtifactRow | void>;
  listArtifactsByRun(runId: string): Promise<ArtifactWithStepName[]>;

  inboxMarkIfNew(key: string): Promise<boolean>;
  inboxDelete(key: string): Promise<void>;

  outboxAdd(topic: string, payload: JsonValue): Promise<void>;
  outboxListUnsent(limit?: number): Promise<OutboxRow[]>;
  outboxMarkSent(id: string): Promise<void>;

  getUserRole?(userId: string): Promise<string | null>;
  listRunsByUser?(userId: string, limit?: number, projectId?: string): Promise<RunSummaryRow[] | RunRow[]>;
  createRunWithUser?(plan: any, projectId: string, userId: string): Promise<RunRow>;
}