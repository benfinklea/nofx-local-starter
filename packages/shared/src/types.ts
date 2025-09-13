export type RunStatus = 'queued'|'running'|'blocked'|'succeeded'|'failed'|'cancelled';

export interface Run {
  id: string;
  status: RunStatus;
  plan: any;
  owner: string;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  metadata?: any;
}

export interface Step {
  id: string;
  run_id: string;
  name: string;
  status: RunStatus;
  inputs: any;
  outputs?: any;
  retries: number;
  agent_id?: string;
  tool?: string;
  idempotency_key?: string;
  started_at?: string | null;
  ended_at?: string | null;
}
