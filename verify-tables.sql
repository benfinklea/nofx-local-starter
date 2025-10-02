-- Verify agent registry tables exist
-- Run this in Supabase SQL Editor to confirm setup

-- Check if nofx schema exists
SELECT
  'nofx schema' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'nofx'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check if agent_registry table exists
SELECT
  'agent_registry table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'nofx' AND table_name = 'agent_registry'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check if agent_versions table exists
SELECT
  'agent_versions table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'nofx' AND table_name = 'agent_versions'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check if template_registry table exists
SELECT
  'template_registry table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'nofx' AND table_name = 'template_registry'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- List all columns in agent_registry
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'nofx' AND table_name = 'agent_registry'
ORDER BY ordinal_position;
