-- Tenant Isolation Migration for Agent Registry
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Add tenant_id column to agent_registry
alter table nofx.agent_registry
  add column if not exists tenant_id text not null default 'local';

-- Create index for tenant queries
create index if not exists agent_registry_tenant_idx
  on nofx.agent_registry(tenant_id, status);

-- Enable RLS on both tables
alter table nofx.agent_registry enable row level security;
alter table nofx.agent_versions enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists agent_registry_tenant_read on nofx.agent_registry;
drop policy if exists agent_registry_tenant_insert on nofx.agent_registry;
drop policy if exists agent_registry_tenant_update on nofx.agent_registry;
drop policy if exists agent_registry_tenant_delete on nofx.agent_registry;
drop policy if exists agent_versions_tenant_read on nofx.agent_versions;
drop policy if exists agent_versions_tenant_write on nofx.agent_versions;

-- Policy: Users can view agents in their tenant
create policy agent_registry_tenant_read on nofx.agent_registry
  for select
  using (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

-- Policy: Authenticated users can insert agents for their tenant
create policy agent_registry_tenant_insert on nofx.agent_registry
  for insert
  with check (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

-- Policy: Users can update their own tenant's agents
create policy agent_registry_tenant_update on nofx.agent_registry
  for update
  using (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

-- Policy: Users can delete their own tenant's agents
create policy agent_registry_tenant_delete on nofx.agent_registry
  for delete
  using (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

-- Versions inherit tenant isolation from parent agent
create policy agent_versions_tenant_read on nofx.agent_versions
  for select
  using (
    exists (
      select 1 from nofx.agent_registry ar
      where ar.id = agent_versions.agent_id
      and ar.tenant_id = coalesce(
        current_setting('app.tenant_id', true),
        'local'
      )
    )
  );

create policy agent_versions_tenant_write on nofx.agent_versions
  for all
  using (
    exists (
      select 1 from nofx.agent_registry ar
      where ar.id = agent_versions.agent_id
      and ar.tenant_id = coalesce(
        current_setting('app.tenant_id', true),
        'local'
      )
    )
  );

-- Add documentation
comment on column nofx.agent_registry.tenant_id is
  'Tenant ID for multi-tenancy. Each tenant can only see/manage their own agents. Defaults to "local" for development.';

-- Verify migration
select 'Migration complete! tenant_id column added and RLS policies created.' as status;
