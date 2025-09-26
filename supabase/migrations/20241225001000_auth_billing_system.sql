-- NOFX SaaS Authentication & Billing System
-- Adapted from next-supabase-stripe-starter for NOFX Control Plane
-- This migration adds user management, Stripe billing, and secures existing tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

/**
* USERS
* Core user table linked to Supabase Auth
* Users can only view and update their own data via RLS
*/
CREATE TABLE IF NOT EXISTS users (
  -- UUID from auth.users
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  -- Organization/company name for business accounts
  company_name TEXT,
  -- The customer's billing address, stored in JSON format
  billing_address JSONB,
  -- Stores customer's payment instruments
  payment_method JSONB,
  -- Usage limits and quotas
  monthly_run_limit INTEGER DEFAULT 10,
  monthly_api_calls_limit INTEGER DEFAULT 100,
  -- Metadata for additional user settings
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own user data." ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Can update own user data." ON users FOR UPDATE USING (auth.uid() = id);

/**
* Auto-create user entry when new user signs up
*/
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- STRIPE INTEGRATION
-- ============================================================================

/**
* CUSTOMERS
* Private table mapping users to Stripe customers
* No RLS policies - accessed only via service role
*/
CREATE TABLE IF NOT EXISTS customers (
  -- UUID from auth.users
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  -- The user's customer ID in Stripe
  stripe_customer_id TEXT UNIQUE
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- No policies - private table accessed only by backend

/**
* PRODUCTS
* Synced from Stripe via webhooks
* Public read access for pricing display
*/
CREATE TABLE IF NOT EXISTS products (
  -- Product ID from Stripe, e.g. prod_1234
  id TEXT PRIMARY KEY,
  active BOOLEAN,
  name TEXT,
  description TEXT,
  image TEXT,
  metadata JSONB
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON products FOR SELECT USING (true);

/**
* PRICES
* Synced from Stripe via webhooks
* Public read access for pricing display
*/
CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
CREATE TYPE pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');

CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products,
  active BOOLEAN,
  description TEXT,
  unit_amount BIGINT,
  currency TEXT CHECK (char_length(currency) = 3),
  type pricing_type,
  interval pricing_plan_interval,
  interval_count INTEGER,
  trial_period_days INTEGER,
  metadata JSONB
);
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access." ON prices FOR SELECT USING (true);

/**
* SUBSCRIPTIONS
* User subscriptions synced from Stripe
* Users can only view their own subscriptions
*/
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  status subscription_status,
  metadata JSONB,
  price_id TEXT REFERENCES prices,
  quantity INTEGER,
  cancel_at_period_end BOOLEAN,
  created TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can only view own subs data." ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- API KEYS & ACCESS CONTROL
-- ============================================================================

/**
* API_KEYS
* For programmatic access to the NOFX API
* Users can manage their own API keys
*/
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification (nofx_live_abcd...)
  scopes TEXT[] DEFAULT ARRAY['read', 'write'],
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can manage own API keys." ON api_keys FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- USAGE TRACKING & BILLING
-- ============================================================================

/**
* USAGE_RECORDS
* Track usage for billing and rate limiting
*/
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  run_id TEXT,
  metric_name TEXT NOT NULL, -- 'runs', 'api_calls', 'compute_minutes', etc.
  quantity DECIMAL(10, 4) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can view own usage." ON usage_records FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- AUDIT & SECURITY
-- ============================================================================

/**
* AUDIT_LOGS
* Security audit trail for all actions
*/
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Audit logs are write-only from application, read via admin panel
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- UPDATE EXISTING TABLES
-- ============================================================================

-- Add user_id to existing run table for ownership
ALTER TABLE run ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users;
ALTER TABLE run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own runs" ON run FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own runs" ON run FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON run FOR UPDATE USING (auth.uid() = user_id);

-- Add user_id to existing project table
ALTER TABLE project ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users;
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON project FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own projects" ON project FOR ALL USING (auth.uid() = user_id);

-- Add user_id to existing step table for access control
ALTER TABLE step ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users;
ALTER TABLE step ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own steps" ON step
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM run WHERE run.id = step.run_id AND run.user_id = auth.uid()
    )
  );

-- Add user_id to events for audit trail
ALTER TABLE event ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users;
ALTER TABLE event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON event
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM run WHERE run.id = event.run_id AND run.user_id = auth.uid()
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_stripe_id ON customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_usage_records_user_period ON usage_records(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_run_user_id ON run(user_id);
CREATE INDEX IF NOT EXISTS idx_project_user_id ON project(user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = user_uuid
    AND status = 'active'
    AND (current_period_end > NOW() OR cancel_at_period_end = FALSE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current usage
CREATE OR REPLACE FUNCTION get_user_usage(user_uuid UUID, metric TEXT, period_start TIMESTAMP)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO total
  FROM usage_records
  WHERE user_id = user_uuid
  AND metric_name = metric
  AND created_at >= period_start;
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Only allow realtime on public tables
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE products, prices;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- Restricted permissions for anon and authenticated roles
GRANT SELECT ON products, prices TO anon, authenticated;
GRANT ALL ON users, subscriptions, api_keys, usage_records TO authenticated;

COMMENT ON SCHEMA public IS 'NOFX Control Plane with SaaS authentication and billing';