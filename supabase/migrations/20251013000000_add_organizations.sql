-- ============================================================================
-- NOFX Organization Multi-Tenancy System
-- Comprehensive organization-based multi-tenancy with quotas and isolation
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS nofx.organizations (
  -- Core fields
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  description TEXT,
  avatar_url TEXT,

  -- Configuration
  settings JSONB DEFAULT '{}' NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT organizations_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
  CONSTRAINT organizations_slug_format CHECK (
    slug ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$' AND
    char_length(slug) >= 1 AND
    char_length(slug) <= 63
  )
);

COMMENT ON TABLE nofx.organizations IS 'Core organization entities for multi-tenancy';
COMMENT ON COLUMN nofx.organizations.slug IS 'URL-safe unique identifier, lowercase alphanumeric with hyphens';
COMMENT ON COLUMN nofx.organizations.settings IS 'Organization settings including isolation_level, features, notifications, security';

-- ============================================================================
-- ORGANIZATION MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS nofx.organization_members (
  -- Core fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES nofx.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',

  -- Custom permissions (overrides role defaults)
  permissions JSONB DEFAULT '[]',
  permission_metadata JSONB DEFAULT '{}',

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(organization_id, user_id),
  CONSTRAINT organization_members_valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

COMMENT ON TABLE nofx.organization_members IS 'Links users to organizations with roles and permissions';
COMMENT ON COLUMN nofx.organization_members.role IS 'User role: owner, admin, member, or viewer';
COMMENT ON COLUMN nofx.organization_members.permissions IS 'Optional custom permissions array, overrides role defaults';

-- ============================================================================
-- ORGANIZATION INVITES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS nofx.organization_invites (
  -- Core fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES nofx.organizations(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',

  -- Security token
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
  accepted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT organization_invites_valid_role CHECK (role IN ('admin', 'member', 'viewer')),
  CONSTRAINT organization_invites_valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  CONSTRAINT organization_invites_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE nofx.organization_invites IS 'Pending invitations to join organizations';
COMMENT ON COLUMN nofx.organization_invites.token IS 'Secure random token for accepting invitation';

-- ============================================================================
-- ORGANIZATION QUOTAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS nofx.organization_quotas (
  -- Foreign key
  organization_id TEXT PRIMARY KEY REFERENCES nofx.organizations(id) ON DELETE CASCADE,

  -- Subscription plan
  plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'trialing',

  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  billing_email TEXT,

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  -- Payment method
  payment_method_last4 TEXT,
  payment_method_brand TEXT,
  next_invoice_amount INTEGER,

  -- Maximum limits
  max_projects INTEGER NOT NULL DEFAULT 3,
  max_concurrent_runs INTEGER NOT NULL DEFAULT 1,
  max_runs_per_month INTEGER NOT NULL DEFAULT 100,
  max_api_calls_per_month INTEGER NOT NULL DEFAULT 1000,
  max_storage_gb INTEGER NOT NULL DEFAULT 5,
  max_members INTEGER NOT NULL DEFAULT 1,
  max_artifacts_per_run INTEGER NOT NULL DEFAULT 10,
  max_compute_minutes_per_month INTEGER NOT NULL DEFAULT 60,
  max_artifact_retention_days INTEGER NOT NULL DEFAULT 7,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 10,

  -- Current usage
  current_projects INTEGER NOT NULL DEFAULT 0,
  current_concurrent_runs INTEGER NOT NULL DEFAULT 0,
  current_runs_this_month INTEGER NOT NULL DEFAULT 0,
  current_api_calls_this_month INTEGER NOT NULL DEFAULT 0,
  current_storage_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_members INTEGER NOT NULL DEFAULT 1,
  current_artifacts INTEGER NOT NULL DEFAULT 0,
  current_compute_minutes_this_month INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  billing_metadata JSONB DEFAULT '{}',
  usage_last_calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT organization_quotas_valid_plan CHECK (plan IN ('free', 'professional', 'team', 'enterprise')),
  CONSTRAINT organization_quotas_valid_status CHECK (
    subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')
  ),
  CONSTRAINT organization_quotas_positive_limits CHECK (
    max_projects >= -1 AND
    max_concurrent_runs >= -1 AND
    max_runs_per_month >= -1 AND
    max_api_calls_per_month >= -1 AND
    max_storage_gb >= -1 AND
    max_members >= -1 AND
    max_artifacts_per_run >= -1 AND
    max_compute_minutes_per_month >= -1 AND
    max_artifact_retention_days >= -1 AND
    rate_limit_per_minute >= -1
  ),
  CONSTRAINT organization_quotas_positive_usage CHECK (
    current_projects >= 0 AND
    current_concurrent_runs >= 0 AND
    current_runs_this_month >= 0 AND
    current_api_calls_this_month >= 0 AND
    current_storage_gb >= 0 AND
    current_members >= 0 AND
    current_artifacts >= 0 AND
    current_compute_minutes_this_month >= 0
  )
);

COMMENT ON TABLE nofx.organization_quotas IS 'Resource quotas, subscription plans, and usage tracking';
COMMENT ON COLUMN nofx.organization_quotas.plan IS 'Subscription plan: free, professional, team, or enterprise';
COMMENT ON COLUMN nofx.organization_quotas.subscription_status IS 'Stripe-compatible subscription status';

-- ============================================================================
-- ADD ORGANIZATION_ID TO EXISTING PROJECT TABLE
-- ============================================================================

-- Add organization_id column to projects
ALTER TABLE nofx.project
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Add foreign key constraint
ALTER TABLE nofx.project
  ADD CONSTRAINT project_organization_fk
  FOREIGN KEY (organization_id)
  REFERENCES nofx.organizations(id)
  ON DELETE CASCADE;

COMMENT ON COLUMN nofx.project.organization_id IS 'Organization that owns this project';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON nofx.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON nofx.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON nofx.organizations(created_at DESC);

-- Organization members indexes
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON nofx.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON nofx.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON nofx.organization_members(role);
CREATE INDEX IF NOT EXISTS idx_organization_members_joined_at ON nofx.organization_members(joined_at DESC);

-- Organization invites indexes
CREATE INDEX IF NOT EXISTS idx_organization_invites_organization_id ON nofx.organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON nofx.organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_organization_invites_token ON nofx.organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_organization_invites_status ON nofx.organization_invites(status);
CREATE INDEX IF NOT EXISTS idx_organization_invites_expires_at ON nofx.organization_invites(expires_at);

-- Organization quotas indexes
CREATE INDEX IF NOT EXISTS idx_organization_quotas_stripe_customer_id ON nofx.organization_quotas(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organization_quotas_plan ON nofx.organization_quotas(plan);
CREATE INDEX IF NOT EXISTS idx_organization_quotas_subscription_status ON nofx.organization_quotas(subscription_status);

-- Project organization index
CREATE INDEX IF NOT EXISTS idx_project_organization_id ON nofx.project(organization_id) WHERE organization_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamps
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON nofx.organizations
  FOR EACH ROW
  EXECUTE FUNCTION nofx.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON nofx.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION nofx.update_updated_at_column();

CREATE TRIGGER update_organization_invites_updated_at
  BEFORE UPDATE ON nofx.organization_invites
  FOR EACH ROW
  EXECUTE FUNCTION nofx.update_updated_at_column();

CREATE TRIGGER update_organization_quotas_updated_at
  BEFORE UPDATE ON nofx.organization_quotas
  FOR EACH ROW
  EXECUTE FUNCTION nofx.update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to create default organization for new users
CREATE OR REPLACE FUNCTION nofx.create_default_organization()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id TEXT;
  v_org_name TEXT;
  v_org_slug TEXT;
BEGIN
  -- Generate organization ID
  v_org_id := 'org_' || encode(gen_random_bytes(12), 'hex');

  -- Generate organization name from user email or metadata
  v_org_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  ) || '''s Organization';

  -- Generate slug from user ID (guaranteed unique)
  v_org_slug := 'user-' || replace(NEW.id::text, '-', '');

  -- Create organization
  INSERT INTO nofx.organizations (
    id,
    name,
    slug,
    owner_id,
    settings
  ) VALUES (
    v_org_id,
    v_org_name,
    v_org_slug,
    NEW.id,
    jsonb_build_object(
      'isolation_level', 'standard',
      'features', jsonb_build_object('git_integration', true)
    )
  );

  -- Add owner as organization member
  INSERT INTO nofx.organization_members (
    organization_id,
    user_id,
    role
  ) VALUES (
    v_org_id,
    NEW.id,
    'owner'
  );

  -- Create default quotas (free tier)
  INSERT INTO nofx.organization_quotas (
    organization_id,
    plan,
    subscription_status,
    billing_email,
    trial_ends_at,
    current_members
  ) VALUES (
    v_org_id,
    'free',
    'trialing',
    NEW.email,
    NOW() + INTERVAL '14 days',
    1
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION nofx.create_default_organization() IS 'Automatically creates a default organization for new users';

-- Function to accept organization invite
CREATE OR REPLACE FUNCTION nofx.accept_organization_invite(invite_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find valid invite
  SELECT * INTO v_invite
  FROM nofx.organization_invites
  WHERE token = invite_token
    AND status = 'pending'
    AND expires_at > NOW()
    AND email = (SELECT email FROM auth.users WHERE id = v_user_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Add user to organization
  INSERT INTO nofx.organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, v_user_id, v_invite.role)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = NOW();

  -- Update invite status
  UPDATE nofx.organization_invites
  SET
    status = 'accepted',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = v_invite.id;

  -- Update member count in quotas
  UPDATE nofx.organization_quotas
  SET
    current_members = (
      SELECT COUNT(*)
      FROM nofx.organization_members
      WHERE organization_id = v_invite.organization_id
    ),
    updated_at = NOW()
  WHERE organization_id = v_invite.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invite.organization_id,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION nofx.accept_organization_invite(TEXT) IS 'Accept an organization invitation using a secure token';

-- Function to update organization usage counters
CREATE OR REPLACE FUNCTION nofx.update_organization_usage(p_organization_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE nofx.organization_quotas
  SET
    current_projects = (
      SELECT COUNT(*)
      FROM nofx.project
      WHERE organization_id = p_organization_id
    ),
    current_members = (
      SELECT COUNT(*)
      FROM nofx.organization_members
      WHERE organization_id = p_organization_id
    ),
    usage_last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE organization_id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION nofx.update_organization_usage(TEXT) IS 'Recalculates and updates organization resource usage counters';

-- ============================================================================
-- ATTACH TRIGGER TO AUTH.USERS
-- ============================================================================

-- Auto-create default organization for new users
DROP TRIGGER IF EXISTS on_auth_user_created_organization ON auth.users;
CREATE TRIGGER on_auth_user_created_organization
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION nofx.create_default_organization();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE nofx.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.organization_quotas ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view organizations they belong to"
  ON nofx.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update their organizations"
  ON nofx.organizations
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can create organizations"
  ON nofx.organizations
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Organization owners can delete their organizations"
  ON nofx.organizations
  FOR DELETE
  USING (owner_id = auth.uid());

-- Organization members policies
CREATE POLICY "Organization members can view their organization's members"
  ON nofx.organization_members
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can manage members"
  ON nofx.organization_members
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Organization invites policies
CREATE POLICY "Organization members can view their organization's invites"
  ON nofx.organization_invites
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Organization admins can manage invites"
  ON nofx.organization_invites
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Organization quotas policies
CREATE POLICY "Organization members can view their organization's quotas"
  ON nofx.organization_quotas
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update their organization's quotas"
  ON nofx.organization_quotas
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON nofx.organizations TO authenticated;
GRANT UPDATE ON nofx.organizations TO authenticated;
GRANT DELETE ON nofx.organizations TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON nofx.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nofx.organization_invites TO authenticated;
GRANT SELECT ON nofx.organization_quotas TO authenticated;
GRANT UPDATE ON nofx.organization_quotas TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION nofx.accept_organization_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION nofx.update_organization_usage(TEXT) TO authenticated;

-- Service role needs full access
GRANT ALL ON nofx.organizations TO service_role;
GRANT ALL ON nofx.organization_members TO service_role;
GRANT ALL ON nofx.organization_invites TO service_role;
GRANT ALL ON nofx.organization_quotas TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
