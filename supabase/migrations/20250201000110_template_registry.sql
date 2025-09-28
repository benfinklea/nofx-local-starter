-- Template registry schema for Phase 1
set search_path = public;

create schema if not exists nofx;

create table if not exists nofx.template_registry (
  id uuid primary key default gen_random_uuid(),
  template_id text not null unique,
  name text not null,
  description text,
  status text not null default 'published',
  current_version text not null,
  tags text[] not null default array[]::text[],
  category text,
  metadata jsonb not null default '{}'::jsonb,
  owner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nofx.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references nofx.template_registry(id) on delete cascade,
  version text not null,
  status text not null default 'published',
  content jsonb not null,
  checksum text,
  change_summary text,
  published_at timestamptz not null default now(),
  unique(template_id, version)
);

create index if not exists template_registry_updated_at_idx on nofx.template_registry (updated_at desc);
create index if not exists template_registry_tags_idx on nofx.template_registry using gin (tags);
create index if not exists template_registry_category_idx on nofx.template_registry (category);
create index if not exists template_versions_template_id_idx on nofx.template_versions (template_id);

alter table nofx.template_registry enable row level security;
alter table nofx.template_versions enable row level security;

create policy template_registry_admin_full on nofx.template_registry
  for all using (true) with check (true);

create policy template_versions_admin_full on nofx.template_versions
  for all using (true) with check (true);
