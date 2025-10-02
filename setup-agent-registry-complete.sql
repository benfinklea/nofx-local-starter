-- Complete Agent Registry Setup with Tenant Isolation
-- Run this in Supabase SQL Editor

-- Create nofx schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS nofx;

-- Create agent_registry table
CREATE TABLE IF NOT EXISTS nofx.agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  current_version text NOT NULL,
  tags text[] NOT NULL DEFAULT array[]::text[],
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_id text,
  tenant_id text NOT NULL DEFAULT 'local',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create agent_versions table
CREATE TABLE IF NOT EXISTS nofx.agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES nofx.agent_registry(id) ON DELETE CASCADE,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  manifest jsonb NOT NULL,
  checksum text,
  source_commit text,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS agent_registry_updated_at_idx ON nofx.agent_registry (updated_at DESC);
CREATE INDEX IF NOT EXISTS agent_registry_tags_idx ON nofx.agent_registry USING gin (tags);
CREATE INDEX IF NOT EXISTS agent_registry_tenant_idx ON nofx.agent_registry(tenant_id, status);
CREATE INDEX IF NOT EXISTS agent_versions_agent_id_idx ON nofx.agent_versions (agent_id);

-- Enable RLS
ALTER TABLE nofx.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.agent_versions ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS agent_registry_admin_full ON nofx.agent_registry;
DROP POLICY IF EXISTS agent_versions_admin_full ON nofx.agent_versions;
DROP POLICY IF EXISTS agent_registry_tenant_read ON nofx.agent_registry;
DROP POLICY IF EXISTS agent_registry_tenant_insert ON nofx.agent_registry;
DROP POLICY IF EXISTS agent_registry_tenant_update ON nofx.agent_registry;
DROP POLICY IF EXISTS agent_registry_tenant_delete ON nofx.agent_registry;
DROP POLICY IF EXISTS agent_versions_tenant_read ON nofx.agent_versions;
DROP POLICY IF EXISTS agent_versions_tenant_write ON nofx.agent_versions;

-- Create tenant isolation policies
CREATE POLICY agent_registry_tenant_read ON nofx.agent_registry
  FOR SELECT
  USING (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

CREATE POLICY agent_registry_tenant_insert ON nofx.agent_registry
  FOR INSERT
  WITH CHECK (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

CREATE POLICY agent_registry_tenant_update ON nofx.agent_registry
  FOR UPDATE
  USING (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

CREATE POLICY agent_registry_tenant_delete ON nofx.agent_registry
  FOR DELETE
  USING (
    tenant_id = coalesce(
      current_setting('app.tenant_id', true),
      'local'
    )
  );

CREATE POLICY agent_versions_tenant_read ON nofx.agent_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nofx.agent_registry ar
      WHERE ar.id = agent_versions.agent_id
      AND ar.tenant_id = coalesce(
        current_setting('app.tenant_id', true),
        'local'
      )
    )
  );

CREATE POLICY agent_versions_tenant_write ON nofx.agent_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM nofx.agent_registry ar
      WHERE ar.id = agent_versions.agent_id
      AND ar.tenant_id = coalesce(
        current_setting('app.tenant_id', true),
        'local'
      )
    )
  );

-- Verify tables were created
SELECT
  'Agent Registry Setup Complete!' as status,
  COUNT(*) as agent_count
FROM nofx.agent_registry;
