create table if not exists nofx.gate (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'local',
  run_id uuid not null references nofx.run(id) on delete cascade,
  step_id uuid references nofx.step(id) on delete cascade,
  gate_type text not null,
  status text not null check (status in ('pending','passed','failed','waived')) default 'pending',
  evidence_uri text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gate_run_idx on nofx.gate(run_id);