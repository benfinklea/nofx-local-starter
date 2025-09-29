-- ============================================================================
-- NOFX Team Management System
-- Based on BoardShape implementation with enhancements for NOFX
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TEAMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  slug varchar(255) UNIQUE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  billing_email varchar(255),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  subscription_status text DEFAULT 'trialing',

  -- Team settings
  settings jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',

  -- Usage tracking
  monthly_api_calls integer DEFAULT 0,
  monthly_runs integer DEFAULT 0,
  storage_used_bytes bigint DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),

  CONSTRAINT teams_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 255)
);

-- Create indexes
CREATE INDEX idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX idx_teams_stripe_customer_id ON public.teams(stripe_customer_id);
CREATE INDEX idx_teams_created_at ON public.teams(created_at DESC);

-- ============================================================================
-- TEAM MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'member',

  -- Permissions
  permissions jsonb DEFAULT '["read"]',

  -- Timestamps
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure unique membership
  UNIQUE(team_id, user_id),

  -- Valid roles
  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

-- Create indexes
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_role ON public.team_members(role);

-- ============================================================================
-- TEAM INVITES TABLE (Based on BoardShape)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Invite details
  email varchar(255) NOT NULL,
  role varchar(50) DEFAULT 'member',

  -- Token for accepting invite
  token varchar(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Status tracking
  status varchar(50) DEFAULT 'pending',
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),

  -- User info for personalization
  invitee_name varchar(255),
  message text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_invite_role CHECK (role IN ('admin', 'member', 'viewer')),
  CONSTRAINT valid_invite_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Create indexes
CREATE INDEX idx_team_invites_team_id ON public.team_invites(team_id);
CREATE INDEX idx_team_invites_email ON public.team_invites(email);
CREATE INDEX idx_team_invites_token ON public.team_invites(token);
CREATE INDEX idx_team_invites_status ON public.team_invites(status);
CREATE INDEX idx_team_invites_expires_at ON public.team_invites(expires_at);

-- ============================================================================
-- TEAM ACTIVITY LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  resource_type varchar(50),
  resource_id text,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_team_activity_logs_team_id ON public.team_activity_logs(team_id);
CREATE INDEX idx_team_activity_logs_user_id ON public.team_activity_logs(user_id);
CREATE INDEX idx_team_activity_logs_action ON public.team_activity_logs(action);
CREATE INDEX idx_team_activity_logs_created_at ON public.team_activity_logs(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activity_logs ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view teams they belong to"
  ON public.teams
  FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can update their teams"
  ON public.teams
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can create teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Team owners can delete their teams"
  ON public.teams
  FOR DELETE
  USING (owner_id = auth.uid());

-- Team members policies
CREATE POLICY "Team members can view their team's members"
  ON public.team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage members"
  ON public.team_members
  FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Team invites policies
CREATE POLICY "Team members can view their team's invites"
  ON public.team_invites
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Team admins can manage invites"
  ON public.team_invites
  FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Team activity logs policies
CREATE POLICY "Team members can view their team's activity"
  ON public.team_activity_logs
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert activity logs"
  ON public.team_activity_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to create a personal team for new users
CREATE OR REPLACE FUNCTION public.create_personal_team()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.teams (
    name,
    slug,
    owner_id,
    billing_email,
    settings
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Team',
    NEW.id::text,
    NEW.id,
    NEW.email,
    jsonb_build_object('is_personal', true)
  );

  -- Add owner as team member
  INSERT INTO public.team_members (
    team_id,
    user_id,
    role,
    permissions
  ) VALUES (
    (SELECT id FROM public.teams WHERE owner_id = NEW.id LIMIT 1),
    NEW.id,
    'owner',
    '["read", "write", "delete", "admin"]'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept team invite
CREATE OR REPLACE FUNCTION public.accept_team_invite(invite_token text)
RETURNS jsonb AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find valid invite
  SELECT * INTO v_invite
  FROM public.team_invites
  WHERE token = invite_token
    AND status = 'pending'
    AND expires_at > now()
    AND email = (SELECT email FROM auth.users WHERE id = v_user_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Add user to team
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_invite.team_id, v_user_id, v_invite.role)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  -- Update invite status
  UPDATE public.team_invites
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  -- Log activity
  INSERT INTO public.team_activity_logs (
    team_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    v_invite.team_id,
    v_user_id,
    'team.member_joined',
    'invite',
    v_invite.id::text,
    jsonb_build_object('role', v_invite.role, 'invited_by', v_invite.inviter_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'team_id', v_invite.team_id,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave team
CREATE OR REPLACE FUNCTION public.leave_team(p_team_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_member record;
  v_team record;
BEGIN
  v_user_id := auth.uid();

  -- Get member details
  SELECT * INTO v_member
  FROM public.team_members
  WHERE team_id = p_team_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a member of this team');
  END IF;

  -- Get team details
  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id;

  -- Prevent owner from leaving their own team
  IF v_team.owner_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team owner cannot leave. Transfer ownership first.');
  END IF;

  -- Remove member
  DELETE FROM public.team_members
  WHERE team_id = p_team_id AND user_id = v_user_id;

  -- Log activity
  INSERT INTO public.team_activity_logs (
    team_id,
    user_id,
    action,
    resource_type,
    metadata
  ) VALUES (
    p_team_id,
    v_user_id,
    'team.member_left',
    'member',
    jsonb_build_object('role', v_member.role)
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to transfer team ownership
CREATE OR REPLACE FUNCTION public.transfer_team_ownership(p_team_id uuid, p_new_owner_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_current_owner_id uuid;
  v_team record;
BEGIN
  v_current_owner_id := auth.uid();

  -- Verify current user is owner
  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id AND owner_id = v_current_owner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to transfer ownership');
  END IF;

  -- Verify new owner is team member
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_new_owner_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'New owner must be a team member');
  END IF;

  -- Update team owner
  UPDATE public.teams
  SET owner_id = p_new_owner_id, updated_at = now()
  WHERE id = p_team_id;

  -- Update member roles
  UPDATE public.team_members
  SET role = 'owner',
      permissions = '["read", "write", "delete", "admin"]'::jsonb,
      updated_at = now()
  WHERE team_id = p_team_id AND user_id = p_new_owner_id;

  UPDATE public.team_members
  SET role = 'admin',
      updated_at = now()
  WHERE team_id = p_team_id AND user_id = v_current_owner_id;

  -- Log activity
  INSERT INTO public.team_activity_logs (
    team_id,
    user_id,
    action,
    resource_type,
    metadata
  ) VALUES (
    p_team_id,
    v_current_owner_id,
    'team.ownership_transferred',
    'team',
    jsonb_build_object('new_owner_id', p_new_owner_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create personal team for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_personal_team();

-- Update timestamps
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_invites_updated_at
  BEFORE UPDATE ON public.team_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SEED DATA (for development)
-- ============================================================================

-- Note: Personal teams are created automatically via trigger
-- This section would contain test data if needed

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT SELECT, INSERT ON public.team_activity_logs TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership(uuid, uuid) TO authenticated;

-- Service role needs full access
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.team_invites TO service_role;
GRANT ALL ON public.team_activity_logs TO service_role;