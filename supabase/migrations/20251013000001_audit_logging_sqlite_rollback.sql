-- ============================================================================
-- ROLLBACK: NOFX Audit Logging System - SQLite
-- ============================================================================
--
-- WARNING: This will permanently delete all audit logs!
-- Only use this for development/testing or after proper archival.
--
-- ============================================================================

-- Drop views
DROP VIEW IF EXISTS v_audit_org_summary;
DROP VIEW IF EXISTS v_audit_data_access;
DROP VIEW IF EXISTS v_audit_failed_auth;
DROP VIEW IF EXISTS v_audit_security_critical;

-- Drop tables
DROP TABLE IF EXISTS audit_retention_policies;
DROP TABLE IF EXISTS audit_log_access;
DROP TABLE IF EXISTS audit_events;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
