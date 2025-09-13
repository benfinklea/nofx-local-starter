create table if not exists nofx.settings (
  id text primary key default 'default',
  tenant_id text not null default 'local',
  approvals jsonb not null default '{}'::jsonb,
  gates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- seed a default row if none exists
insert into nofx.settings (id, approvals, gates)
  values ('default', '{"dbWrites":"dangerous","allowWaive":true}'::jsonb, '{"typecheck":true,"lint":true,"unit":true,"coverageThreshold":0.9}'::jsonb)
on conflict (id) do nothing;
