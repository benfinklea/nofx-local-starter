create table if not exists nofx.db_write_rule (
  id uuid primary key default uuid_generate_v4(),
  tenant_id text not null default 'local',
  table_name text not null,
  allowed_ops text[] not null,
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists db_write_rule_unique on nofx.db_write_rule(tenant_id, table_name);