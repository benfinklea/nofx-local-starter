-- Quick setup: Create minimal tables to get started
-- Run this in Supabase SQL Editor

-- Create schema
CREATE SCHEMA IF NOT EXISTS nofx;

-- Create main runs table
CREATE TABLE IF NOT EXISTS nofx.run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT DEFAULT 'local',
  plan JSONB,
  status TEXT DEFAULT 'pending',
  project_id TEXT,
  metadata JSONB,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create public view for easy access
CREATE OR REPLACE VIEW public.runs AS
SELECT * FROM nofx.run;

-- Enable access
GRANT ALL ON SCHEMA nofx TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA nofx TO anon;
GRANT ALL ON public.runs TO anon;

-- Test the setup
SELECT COUNT(*) as table_count FROM public.runs;