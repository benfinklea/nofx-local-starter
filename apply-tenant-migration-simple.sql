-- Simplified Tenant Isolation Migration
-- Copy and paste this into Supabase SQL Editor

-- Add tenant_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='nofx' AND table_name='agent_registry' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE nofx.agent_registry ADD COLUMN tenant_id text NOT NULL DEFAULT 'local';
    CREATE INDEX agent_registry_tenant_idx ON nofx.agent_registry(tenant_id, status);
    RAISE NOTICE 'Tenant column added successfully!';
  ELSE
    RAISE NOTICE 'Tenant column already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='nofx' AND table_name='agent_registry' AND column_name='tenant_id';
