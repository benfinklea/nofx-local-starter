-- ============================================================================
-- FIX CRITICAL SECURITY ISSUE: Row Level Security Policies
-- ============================================================================
-- This migration fixes the critical security vulnerability where RLS policies
-- allow anonymous access to all data. All policies now require authentication.

-- First, ensure RLS is enabled on all tables
ALTER TABLE IF EXISTS nofx.run ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nofx.step ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nofx.artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nofx.event ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nofx.gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nofx.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nofx.outbox ENABLE ROW LEVEL SECURITY;

-- Drop all existing insecure policies
DROP POLICY IF EXISTS "Allow anonymous read" ON nofx.run;
DROP POLICY IF EXISTS "Allow anonymous insert" ON nofx.run;
DROP POLICY IF EXISTS "Allow anonymous update" ON nofx.run;
DROP POLICY IF EXISTS "Allow anonymous delete" ON nofx.run;

DROP POLICY IF EXISTS "Allow anonymous read" ON nofx.step;
DROP POLICY IF EXISTS "Allow anonymous insert" ON nofx.step;
DROP POLICY IF EXISTS "Allow anonymous update" ON nofx.step;
DROP POLICY IF EXISTS "Allow anonymous delete" ON nofx.step;

DROP POLICY IF EXISTS "Allow anonymous read" ON nofx.artifact;
DROP POLICY IF EXISTS "Allow anonymous insert" ON nofx.artifact;
DROP POLICY IF EXISTS "Allow anonymous update" ON nofx.artifact;
DROP POLICY IF EXISTS "Allow anonymous delete" ON nofx.artifact;

DROP POLICY IF EXISTS "Allow anonymous read" ON nofx.event;
DROP POLICY IF EXISTS "Allow anonymous insert" ON nofx.event;
DROP POLICY IF EXISTS "Allow anonymous update" ON nofx.event;
DROP POLICY IF EXISTS "Allow anonymous delete" ON nofx.event;

DROP POLICY IF EXISTS "Allow anonymous read" ON nofx.gate;
DROP POLICY IF EXISTS "Allow anonymous insert" ON nofx.gate;
DROP POLICY IF EXISTS "Allow anonymous update" ON nofx.gate;
DROP POLICY IF EXISTS "Allow anonymous delete" ON nofx.gate;

-- Add user_id columns if they don't exist
ALTER TABLE nofx.run ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users;
ALTER TABLE nofx.step ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE nofx.artifact ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE nofx.event ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE nofx.gate ADD COLUMN IF NOT EXISTS user_id UUID;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_run_user_id ON nofx.run(user_id);
CREATE INDEX IF NOT EXISTS idx_step_user_id ON nofx.step(user_id);
CREATE INDEX IF NOT EXISTS idx_artifact_user_id ON nofx.artifact(user_id);
CREATE INDEX IF NOT EXISTS idx_event_user_id ON nofx.event(user_id);
CREATE INDEX IF NOT EXISTS idx_gate_user_id ON nofx.gate(user_id);

-- ============================================================================
-- SECURE RLS POLICIES
-- ============================================================================

-- RUN table policies
CREATE POLICY "Users can view own runs"
  ON nofx.run FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own runs"
  ON nofx.run FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own runs"
  ON nofx.run FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users cannot delete runs"
  ON nofx.run FOR DELETE
  USING (false);

-- Admin policies for runs
CREATE POLICY "Admins can view all runs"
  ON nofx.run FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all runs"
  ON nofx.run FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- STEP table policies (inherit user_id from parent run)
CREATE POLICY "Users can view own steps"
  ON nofx.step FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = step.run_id
      AND run.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own steps"
  ON nofx.step FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = run_id
      AND run.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own steps"
  ON nofx.step FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = step.run_id
      AND run.user_id = auth.uid()
    )
  );

-- EVENT table policies
CREATE POLICY "Users can view own events"
  ON nofx.event FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = event.run_id
      AND run.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own events"
  ON nofx.event FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = run_id
      AND run.user_id = auth.uid()
    )
  );

-- ARTIFACT table policies
CREATE POLICY "Users can view own artifacts"
  ON nofx.artifact FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nofx.step
      JOIN nofx.run ON run.id = step.run_id
      WHERE step.id = artifact.step_id
      AND run.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own artifacts"
  ON nofx.artifact FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nofx.step
      JOIN nofx.run ON run.id = step.run_id
      WHERE step.id = step_id
      AND run.user_id = auth.uid()
    )
  );

-- GATE table policies
CREATE POLICY "Users can view own gates"
  ON nofx.gate FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = gate.run_id
      AND run.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own gates"
  ON nofx.gate FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = run_id
      AND run.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own gates"
  ON nofx.gate FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nofx.run
      WHERE run.id = gate.run_id
      AND run.user_id = auth.uid()
    )
  );

-- Service role bypass for backend operations
-- The backend uses service role key which bypasses RLS

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's tier
CREATE OR REPLACE FUNCTION get_user_tier()
RETURNS TEXT AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT
    COALESCE(s.price_tier, 'free') INTO user_tier
  FROM users u
  LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
  WHERE u.id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(user_tier, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT LOG POLICIES
-- ============================================================================

-- Audit logs are write-only from application
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

-- ============================================================================
-- BILLING TABLE POLICIES
-- ============================================================================

-- Users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = 'user'); -- Prevent self-promotion to admin

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can manage all users"
  ON users FOR ALL
  USING (is_admin());

-- Subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions"
  ON subscriptions FOR ALL
  USING (false) -- Only service role can modify
  WITH CHECK (false);

-- Usage tracking table
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages usage"
  ON usage_tracking FOR ALL
  USING (false) -- Only service role can modify
  WITH CHECK (false);

-- API keys table
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own API keys"
  ON api_keys FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- MIGRATION VALIDATION
-- ============================================================================

-- Verify that RLS is enabled on all critical tables
DO $$
DECLARE
  table_record RECORD;
  missing_rls TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('nofx', 'public')
    AND tablename IN ('run', 'step', 'artifact', 'event', 'gate', 'users', 'subscriptions', 'api_keys', 'usage_tracking', 'audit_logs')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = table_record.tablename
      AND relrowsecurity = true
    ) THEN
      missing_rls := array_append(missing_rls, table_record.schemaname || '.' || table_record.tablename);
    END IF;
  END LOOP;

  IF array_length(missing_rls, 1) > 0 THEN
    RAISE EXCEPTION 'RLS not enabled on tables: %', array_to_string(missing_rls, ', ');
  END IF;
END $$;

-- Log migration completion
INSERT INTO audit_logs (action, resource_type, metadata)
VALUES ('migration.completed', 'security', jsonb_build_object(
  'migration_name', '20250926001_fix_rls_policies.sql',
  'description', 'Fixed critical RLS security vulnerabilities',
  'timestamp', now()
));