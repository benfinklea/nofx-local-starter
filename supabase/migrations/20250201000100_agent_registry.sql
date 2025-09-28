-- Agent registry schema for Phase 1
set search_path = public;

create schema if not exists nofx;

create table if not exists nofx.agent_registry (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  name text not null,
  description text,
  status text not null default 'active',
  current_version text not null,
  tags text[] not null default array[]::text[],
  capabilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  owner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nofx.agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references nofx.agent_registry(id) on delete cascade,
  version text not null,
  status text not null default 'active',
  manifest jsonb not null,
  checksum text,
  source_commit text,
  published_at timestamptz not null default now(),
  unique(agent_id, version)
);

create index if not exists agent_registry_updated_at_idx on nofx.agent_registry (updated_at desc);
create index if not exists agent_registry_tags_idx on nofx.agent_registry using gin (tags);
create index if not exists agent_versions_agent_id_idx on nofx.agent_versions (agent_id);

alter table nofx.agent_registry enable row level security;
alter table nofx.agent_versions enable row level security;

create policy agent_registry_admin_full on nofx.agent_registry
  for all using (true) with check (true);

create policy agent_versions_admin_full on nofx.agent_versions
  for all using (true) with check (true);
