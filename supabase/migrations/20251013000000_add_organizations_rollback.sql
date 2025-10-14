-- ============================================================================
-- ROLLBACK: NOFX Organization Multi-Tenancy System
-- Safely removes all organization-related tables, functions, and constraints
-- ============================================================================

-- ============================================================================
-- DROP TRIGGERS
-- ============================================================================

-- Drop trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_organization ON auth.users;

-- Drop update triggers
DROP TRIGGER IF EXISTS update_organizations_updated_at ON nofx.organizations;
DROP TRIGGER IF EXISTS update_organization_members_updated_at ON nofx.organization_members;
DROP TRIGGER IF EXISTS update_organization_invites_updated_at ON nofx.organization_invites;
DROP TRIGGER IF EXISTS update_organization_quotas_updated_at ON nofx.organization_quotas;

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS nofx.create_default_organization();
DROP FUNCTION IF EXISTS nofx.accept_organization_invite(TEXT);
DROP FUNCTION IF EXISTS nofx.update_organization_usage(TEXT);

-- ============================================================================
-- REVOKE GRANTS
-- ============================================================================

-- Revoke from authenticated users
REVOKE ALL ON nofx.organizations FROM authenticated;
REVOKE ALL ON nofx.organization_members FROM authenticated;
REVOKE ALL ON nofx.organization_invites FROM authenticated;
REVOKE ALL ON nofx.organization_quotas FROM authenticated;

-- Revoke from service role
REVOKE ALL ON nofx.organizations FROM service_role;
REVOKE ALL ON nofx.organization_members FROM service_role;
REVOKE ALL ON nofx.organization_invites FROM service_role;
REVOKE ALL ON nofx.organization_quotas FROM service_role;

-- ============================================================================
-- DROP ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Organizations policies
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON nofx.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organizations" ON nofx.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON nofx.organizations;
DROP POLICY IF EXISTS "Organization owners can delete their organizations" ON nofx.organizations;

-- Organization members policies
DROP POLICY IF EXISTS "Organization members can view their organization's members" ON nofx.organization_members;
DROP POLICY IF EXISTS "Organization admins can manage members" ON nofx.organization_members;

-- Organization invites policies
DROP POLICY IF EXISTS "Organization members can view their organization's invites" ON nofx.organization_invites;
DROP POLICY IF EXISTS "Organization admins can manage invites" ON nofx.organization_invites;

-- Organization quotas policies
DROP POLICY IF EXISTS "Organization members can view their organization's quotas" ON nofx.organization_quotas;
DROP POLICY IF EXISTS "Organization owners can update their organization's quotas" ON nofx.organization_quotas;

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

-- Organizations indexes
DROP INDEX IF EXISTS nofx.idx_organizations_owner_id;
DROP INDEX IF EXISTS nofx.idx_organizations_slug;
DROP INDEX IF EXISTS nofx.idx_organizations_created_at;

-- Organization members indexes
DROP INDEX IF EXISTS nofx.idx_organization_members_organization_id;
DROP INDEX IF EXISTS nofx.idx_organization_members_user_id;
DROP INDEX IF EXISTS nofx.idx_organization_members_role;
DROP INDEX IF EXISTS nofx.idx_organization_members_joined_at;

-- Organization invites indexes
DROP INDEX IF EXISTS nofx.idx_organization_invites_organization_id;
DROP INDEX IF EXISTS nofx.idx_organization_invites_email;
DROP INDEX IF EXISTS nofx.idx_organization_invites_token;
DROP INDEX IF EXISTS nofx.idx_organization_invites_status;
DROP INDEX IF EXISTS nofx.idx_organization_invites_expires_at;

-- Organization quotas indexes
DROP INDEX IF EXISTS nofx.idx_organization_quotas_stripe_customer_id;
DROP INDEX IF EXISTS nofx.idx_organization_quotas_plan;
DROP INDEX IF EXISTS nofx.idx_organization_quotas_subscription_status;

-- Project organization index
DROP INDEX IF EXISTS nofx.idx_project_organization_id;

-- ============================================================================
-- REMOVE ORGANIZATION_ID FROM PROJECT TABLE
-- ============================================================================

-- Drop foreign key constraint
ALTER TABLE nofx.project
  DROP CONSTRAINT IF EXISTS project_organization_fk;

-- Drop organization_id column
ALTER TABLE nofx.project
  DROP COLUMN IF EXISTS organization_id;

-- ============================================================================
-- DROP TABLES (in reverse dependency order)
-- ============================================================================

-- Drop organization quotas table (depends on organizations)
DROP TABLE IF EXISTS nofx.organization_quotas CASCADE;

-- Drop organization invites table (depends on organizations)
DROP TABLE IF EXISTS nofx.organization_invites CASCADE;

-- Drop organization members table (depends on organizations)
DROP TABLE IF EXISTS nofx.organization_members CASCADE;

-- Drop organizations table
DROP TABLE IF EXISTS nofx.organizations CASCADE;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

-- Note: This rollback script will remove all organization data.
-- Ensure you have a backup if you need to preserve any data before running this script.
