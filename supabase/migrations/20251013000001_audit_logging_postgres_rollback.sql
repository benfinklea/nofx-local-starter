-- ============================================================================
-- ROLLBACK: NOFX Audit Logging System - PostgreSQL
-- ============================================================================
--
-- WARNING: This will permanently delete all audit logs!
-- Only use this for development/testing or after proper archival.
--
-- ============================================================================

-- Drop helper functions
DROP FUNCTION IF EXISTS nofx.apply_audit_retention_policies() CASCADE;
DROP FUNCTION IF EXISTS nofx.query_audit_events(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS nofx.record_audit_event(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) CASCADE;

-- Drop tables (will cascade to partitions)
DROP TABLE IF EXISTS nofx.audit_retention_policies CASCADE;
DROP TABLE IF EXISTS nofx.audit_log_access CASCADE;
DROP TABLE IF EXISTS nofx.audit_events CASCADE;

-- Drop partition tables explicitly (in case CASCADE doesn't work)
DROP TABLE IF EXISTS nofx.audit_events_2026_01 CASCADE;
DROP TABLE IF EXISTS nofx.audit_events_2025_12 CASCADE;
DROP TABLE IF EXISTS nofx.audit_events_2025_11 CASCADE;
DROP TABLE IF EXISTS nofx.audit_events_2025_10 CASCADE;

-- Revoke grants
REVOKE ALL ON nofx.audit_events FROM authenticated;
REVOKE ALL ON nofx.audit_log_access FROM authenticated;
REVOKE ALL ON nofx.audit_retention_policies FROM authenticated;
REVOKE ALL ON nofx.audit_events FROM service_role;
REVOKE ALL ON nofx.audit_log_access FROM service_role;
REVOKE ALL ON nofx.audit_retention_policies FROM service_role;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

COMMENT ON SCHEMA nofx IS 'NOFX Control Plane - Audit Logging Removed';
