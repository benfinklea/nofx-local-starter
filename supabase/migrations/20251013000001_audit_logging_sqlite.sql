-- ============================================================================
-- NOFX Audit Logging System - SQLite Development Version
-- Phase 3 Part 3: Comprehensive audit logging for SOC2, GDPR, HIPAA compliance
-- ============================================================================
--
-- Note: This is the SQLite version for local development and testing.
-- For production, use the PostgreSQL version (20251013000001_audit_logging_postgres.sql)
--
-- Differences from PostgreSQL version:
-- - No table partitioning (not supported in SQLite)
-- - No Row Level Security (not supported in SQLite)
-- - Simplified indexes (no partial indexes)
-- - TEXT instead of UUID type
-- - Simpler constraints
--
-- ============================================================================

-- ============================================================================
-- AUDIT EVENTS TABLE - Main audit log storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  -- ============================================================================
  -- Primary Identification
  -- ============================================================================
  id TEXT PRIMARY KEY, -- Format: evt_{timestamp}_{random}
  timestamp TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601 format

  -- ============================================================================
  -- Event Classification
  -- ============================================================================
  event_type TEXT NOT NULL, -- Specific event: 'auth.login.success', 'org.deleted', etc.
  category TEXT NOT NULL, -- High-level category: 'authentication', 'security', etc.
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  outcome TEXT NOT NULL, -- 'success', 'failure', 'partial_success'

  -- ============================================================================
  -- Actor (Who performed the action)
  -- ============================================================================
  actor_user_id TEXT, -- User who performed action
  actor_session_id TEXT, -- Session identifier
  actor_system_component TEXT, -- System component if automated
  actor_api_client_id TEXT, -- API client identifier
  actor_metadata TEXT, -- JSON: Additional actor context

  -- ============================================================================
  -- Subject (What was acted upon)
  -- ============================================================================
  subject_resource_type TEXT NOT NULL, -- 'organization', 'project', 'run', etc.
  subject_resource_id TEXT, -- Resource identifier
  subject_organization_id TEXT, -- Organization context (multi-tenancy)
  subject_project_id TEXT, -- Project context if applicable
  subject_parent_id TEXT, -- Parent resource for nested resources
  subject_metadata TEXT, -- JSON: Additional subject context

  -- ============================================================================
  -- Context (Environmental information)
  -- ============================================================================
  context_ip_address TEXT, -- Client IP (hashed for GDPR if required)
  context_user_agent TEXT, -- User agent string
  context_geo_location TEXT, -- JSON: {country, region, city}
  context_request_id TEXT, -- Correlation ID for distributed tracing
  context_http_method TEXT, -- GET, POST, PUT, DELETE, etc.
  context_http_status INTEGER, -- 200, 404, 500, etc.
  context_endpoint TEXT, -- API endpoint path
  context_metadata TEXT, -- JSON: Additional contextual data

  -- ============================================================================
  -- Error Details (For failures)
  -- ============================================================================
  error_code TEXT, -- Application error code
  error_message TEXT, -- Error message (sanitized)
  error_metadata TEXT, -- JSON: Additional error context

  -- ============================================================================
  -- Event Data
  -- ============================================================================
  payload TEXT, -- JSON: Event-specific structured data
  changes TEXT, -- JSON: Array of ChangeRecord objects (before/after values)
  metadata TEXT, -- JSON: Freeform additional metadata

  -- ============================================================================
  -- Audit Metadata
  -- ============================================================================
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- ============================================================================
  -- Constraints
  -- ============================================================================
  CHECK (category IN (
    'authentication', 'authorization', 'organization', 'member',
    'project', 'run', 'artifact', 'workspace', 'billing',
    'security', 'system', 'compliance'
  )),
  CHECK (severity IN ('info', 'warning', 'critical')),
  CHECK (outcome IN ('success', 'failure', 'partial_success')),
  CHECK (
    actor_user_id IS NOT NULL OR
    actor_system_component IS NOT NULL OR
    actor_api_client_id IS NOT NULL
  )
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- 1. Time-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp_desc
  ON audit_events (timestamp DESC);

-- 2. Organization isolation (critical for multi-tenancy)
CREATE INDEX IF NOT EXISTS idx_audit_events_org_timestamp
  ON audit_events (subject_organization_id, timestamp DESC);

-- 3. User activity queries
CREATE INDEX IF NOT EXISTS idx_audit_events_user_timestamp
  ON audit_events (actor_user_id, timestamp DESC);

-- 4. Event type filtering
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type_timestamp
  ON audit_events (event_type, timestamp DESC);

-- 5. Category + severity (security monitoring)
CREATE INDEX IF NOT EXISTS idx_audit_events_category_severity_timestamp
  ON audit_events (category, severity, timestamp DESC);

-- 6. Outcome filtering (failure analysis)
CREATE INDEX IF NOT EXISTS idx_audit_events_outcome_timestamp
  ON audit_events (outcome, timestamp DESC);

-- 7. Resource tracking
CREATE INDEX IF NOT EXISTS idx_audit_events_resource_timestamp
  ON audit_events (subject_resource_type, subject_resource_id, timestamp DESC);

-- 8. Request correlation (distributed tracing)
CREATE INDEX IF NOT EXISTS idx_audit_events_request_id
  ON audit_events (context_request_id);

-- ============================================================================
-- AUDIT LOG ACCESS TRACKING (Meta-auditing for HIPAA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log_access (
  -- Primary identification
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  -- Who accessed the audit logs
  accessor_user_id TEXT NOT NULL,
  accessor_role TEXT NOT NULL,
  access_reason TEXT NOT NULL, -- Required justification

  -- What was accessed
  query_filter TEXT NOT NULL, -- JSON: Filter criteria used
  date_range_start TEXT,
  date_range_end TEXT,
  records_accessed INTEGER NOT NULL DEFAULT 0,
  export_requested INTEGER NOT NULL DEFAULT 0, -- 0=false, 1=true

  -- Context
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,

  -- Audit metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_access_timestamp
  ON audit_log_access (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_access_user
  ON audit_log_access (accessor_user_id, timestamp DESC);

-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_retention_policies (
  -- Primary identification
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Policy definition
  event_category TEXT, -- NULL = default policy
  event_type TEXT, -- NULL = applies to all types in category
  retention_days INTEGER NOT NULL,
  archive_after_days INTEGER, -- Move to cold storage before deletion

  -- Compliance requirements
  compliance_standard TEXT, -- 'SOC2', 'GDPR', 'HIPAA', etc.
  legal_hold INTEGER NOT NULL DEFAULT 0, -- 0=false, 1=true

  -- Metadata
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Constraints
  CHECK (retention_days >= 0),
  CHECK (archive_after_days IS NULL OR archive_after_days < retention_days),
  UNIQUE (event_category, event_type)
);

-- Insert default retention policies
INSERT OR IGNORE INTO audit_retention_policies (event_category, event_type, retention_days, compliance_standard, description)
VALUES
  -- Default policy: 7 years for most events (SOC2 requirement)
  (NULL, NULL, 2555, 'SOC2', 'Default retention: 7 years for compliance'),

  -- Data access events: 90 days (GDPR requirement)
  ('artifact', 'artifact.read', 90, 'GDPR', 'Data access logs: 90 days per GDPR'),
  ('artifact', 'artifact.downloaded', 90, 'GDPR', 'Data download logs: 90 days per GDPR'),
  ('compliance', 'compliance.audit_log.accessed', 90, 'HIPAA', 'Audit access logs: 90 days per HIPAA'),

  -- Security events: 10 years (extended retention)
  ('security', NULL, 3650, 'SOC2', 'Security events: 10 years extended retention'),
  ('authentication', NULL, 3650, 'SOC2', 'Authentication logs: 10 years for security analysis'),

  -- Compliance events: Indefinite (legal hold)
  ('compliance', 'compliance.data_export.requested', -1, 'GDPR', 'Data export requests: indefinite retention');

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Recent critical security events
CREATE VIEW IF NOT EXISTS v_audit_security_critical AS
SELECT
  id,
  timestamp,
  event_type,
  actor_user_id,
  subject_organization_id,
  context_ip_address,
  error_message,
  payload
FROM audit_events
WHERE category = 'security'
  AND severity = 'critical'
ORDER BY timestamp DESC
LIMIT 1000;

-- View: Failed authentication attempts
CREATE VIEW IF NOT EXISTS v_audit_failed_auth AS
SELECT
  id,
  timestamp,
  event_type,
  actor_user_id,
  context_ip_address,
  context_user_agent,
  error_code,
  error_message,
  payload
FROM audit_events
WHERE category = 'authentication'
  AND outcome = 'failure'
ORDER BY timestamp DESC
LIMIT 1000;

-- View: Data access events
CREATE VIEW IF NOT EXISTS v_audit_data_access AS
SELECT
  id,
  timestamp,
  event_type,
  actor_user_id,
  subject_resource_type,
  subject_resource_id,
  subject_organization_id,
  payload
FROM audit_events
WHERE event_type IN ('artifact.read', 'artifact.downloaded', 'compliance.audit_log.accessed')
ORDER BY timestamp DESC
LIMIT 1000;

-- View: Organization activity summary
CREATE VIEW IF NOT EXISTS v_audit_org_summary AS
SELECT
  subject_organization_id AS organization_id,
  category,
  COUNT(*) AS event_count,
  COUNT(CASE WHEN outcome = 'failure' THEN 1 END) AS failure_count,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) AS critical_count,
  MAX(timestamp) AS last_event_at
FROM audit_events
WHERE subject_organization_id IS NOT NULL
GROUP BY subject_organization_id, category
ORDER BY last_event_at DESC;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at on retention policies
CREATE TRIGGER IF NOT EXISTS update_audit_retention_policies_updated_at
AFTER UPDATE ON audit_retention_policies
FOR EACH ROW
BEGIN
  UPDATE audit_retention_policies
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

-- Trigger: Prevent updates to audit events (immutability)
CREATE TRIGGER IF NOT EXISTS prevent_audit_events_update
BEFORE UPDATE ON audit_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Audit events are immutable and cannot be updated');
END;

-- Trigger: Prevent deletion of audit events (immutability)
CREATE TRIGGER IF NOT EXISTS prevent_audit_events_delete
BEFORE DELETE ON audit_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Audit events are immutable and cannot be deleted');
END;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Query 1: Recent security events for an organization
-- SELECT * FROM audit_events
-- WHERE subject_organization_id = 'org_123'
--   AND category = 'security'
--   AND timestamp >= datetime('now', '-7 days')
-- ORDER BY timestamp DESC;

-- Query 2: Failed login attempts from same IP
-- SELECT
--   context_ip_address,
--   COUNT(*) AS attempt_count,
--   MAX(timestamp) AS last_attempt
-- FROM audit_events
-- WHERE event_type = 'auth.login.failure'
--   AND timestamp >= datetime('now', '-1 hour')
-- GROUP BY context_ip_address
-- HAVING COUNT(*) >= 5
-- ORDER BY attempt_count DESC;

-- Query 3: User activity timeline
-- SELECT
--   timestamp,
--   event_type,
--   category,
--   subject_resource_type,
--   outcome
-- FROM audit_events
-- WHERE actor_user_id = 'user_123'
--   AND timestamp >= datetime('now', '-30 days')
-- ORDER BY timestamp DESC;

-- Query 4: Organization compliance report
-- SELECT
--   category,
--   event_type,
--   outcome,
--   COUNT(*) AS event_count
-- FROM audit_events
-- WHERE subject_organization_id = 'org_123'
--   AND timestamp >= datetime('now', '-1 year')
-- GROUP BY category, event_type, outcome
-- ORDER BY event_count DESC;

-- ============================================================================
-- MAINTENANCE NOTES
-- ============================================================================

-- 1. Vacuum regularly to reclaim space:
--    VACUUM audit_events;

-- 2. Analyze indexes for query optimization:
--    ANALYZE audit_events;

-- 3. Check database size:
--    SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();

-- 4. Export old events for archival:
--    .mode csv
--    .output audit_archive_2024.csv
--    SELECT * FROM audit_events WHERE timestamp < '2024-01-01';

-- 5. Test query performance:
--    EXPLAIN QUERY PLAN SELECT * FROM audit_events WHERE subject_organization_id = 'org_123';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
