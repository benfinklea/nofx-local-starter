-- Complete Template Registry Setup
-- Run this in Supabase SQL Editor

-- Create nofx schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS nofx;

-- Create template_registry table
CREATE TABLE IF NOT EXISTS nofx.template_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'published',
  current_version text NOT NULL,
  tags text[] NOT NULL DEFAULT array[]::text[],
  category text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create template_versions table
CREATE TABLE IF NOT EXISTS nofx.template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES nofx.template_registry(id) ON DELETE CASCADE,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'published',
  content jsonb NOT NULL,
  checksum text,
  change_summary text,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version)
);

-- Create template_usage_daily table
CREATE TABLE IF NOT EXISTS nofx.template_usage_daily (
  template_id uuid NOT NULL REFERENCES nofx.template_registry(id) ON DELETE CASCADE,
  day date NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  total_duration_ms bigint NOT NULL DEFAULT 0,
  total_token_usage bigint NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_usage_daily_pk PRIMARY KEY (template_id, day)
);

-- Create template_feedback table
CREATE TABLE IF NOT EXISTS nofx.template_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES nofx.template_registry(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  submitted_by text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS template_registry_updated_at_idx ON nofx.template_registry (updated_at DESC);
CREATE INDEX IF NOT EXISTS template_registry_tags_idx ON nofx.template_registry USING gin (tags);
CREATE INDEX IF NOT EXISTS template_registry_category_idx ON nofx.template_registry (category);
CREATE INDEX IF NOT EXISTS template_versions_template_id_idx ON nofx.template_versions (template_id);
CREATE INDEX IF NOT EXISTS template_usage_daily_day_idx ON nofx.template_usage_daily (day);
CREATE INDEX IF NOT EXISTS template_usage_daily_template_idx ON nofx.template_usage_daily (template_id);
CREATE INDEX IF NOT EXISTS template_feedback_template_idx ON nofx.template_feedback (template_id);
CREATE INDEX IF NOT EXISTS template_feedback_rating_idx ON nofx.template_feedback (rating);

-- Enable RLS
ALTER TABLE nofx.template_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.template_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.template_feedback ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS template_registry_admin_full ON nofx.template_registry;
DROP POLICY IF EXISTS template_versions_admin_full ON nofx.template_versions;
DROP POLICY IF EXISTS template_usage_daily_admin_full ON nofx.template_usage_daily;
DROP POLICY IF EXISTS template_feedback_admin_full ON nofx.template_feedback;

-- Create admin policies (allow all for now)
CREATE POLICY template_registry_admin_full ON nofx.template_registry
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY template_versions_admin_full ON nofx.template_versions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY template_usage_daily_admin_full ON nofx.template_usage_daily
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY template_feedback_admin_full ON nofx.template_feedback
  FOR ALL USING (true) WITH CHECK (true);

-- Verify tables were created
SELECT
  'Template Registry Setup Complete!' as status,
  COUNT(*) as template_count
FROM nofx.template_registry;
