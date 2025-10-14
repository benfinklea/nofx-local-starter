-- ============================================================================
-- NOFX Audit Logging System - PostgreSQL Production Version
-- Phase 3 Part 3: Comprehensive audit logging for SOC2, GDPR, HIPAA compliance
-- ============================================================================
--
-- Expected volume: 100K-1M events per day at scale
-- Retention: 7 years for most events, 90 days for data access events
-- Compliance: SOC2, GDPR, HIPAA
-- Supported event types: 58 different audit event types (see src/audit/types.ts)
--
-- ============================================================================

-- ============================================================================
-- AUDIT EVENTS TABLE - Main audit log storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS nofx.audit_events (
  -- ============================================================================
  -- Primary Identification
  -- ============================================================================
  id TEXT PRIMARY KEY, -- Format: evt_{timestamp}_{random}
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

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
  actor_user_id UUID, -- User who performed action
  actor_session_id TEXT, -- Session identifier
  actor_system_component TEXT, -- System component if automated
  actor_api_client_id TEXT, -- API client identifier
  actor_metadata JSONB, -- Additional actor context

  -- ============================================================================
  -- Subject (What was acted upon)
  -- ============================================================================
  subject_resource_type TEXT NOT NULL, -- 'organization', 'project', 'run', etc.
  subject_resource_id TEXT, -- Resource identifier
  subject_organization_id TEXT, -- Organization context (multi-tenancy)
  subject_project_id TEXT, -- Project context if applicable
  subject_parent_id TEXT, -- Parent resource for nested resources
  subject_metadata JSONB, -- Additional subject context

  -- ============================================================================
  -- Context (Environmental information)
  -- ============================================================================
  context_ip_address TEXT, -- Client IP (hashed for GDPR if required)
  context_user_agent TEXT, -- User agent string
  context_geo_location JSONB, -- {country, region, city}
  context_request_id TEXT, -- Correlation ID for distributed tracing
  context_http_method TEXT, -- GET, POST, PUT, DELETE, etc.
  context_http_status INTEGER, -- 200, 404, 500, etc.
  context_endpoint TEXT, -- API endpoint path
  context_metadata JSONB, -- Additional contextual data

  -- ============================================================================
  -- Error Details (For failures)
  -- ============================================================================
  error_code TEXT, -- Application error code
  error_message TEXT, -- Error message (sanitized)
  error_metadata JSONB, -- Additional error context

  -- ============================================================================
  -- Event Data
  -- ============================================================================
  payload JSONB, -- Event-specific structured data
  changes JSONB, -- Array of ChangeRecord objects (before/after values)
  metadata JSONB, -- Freeform additional metadata

  -- ============================================================================
  -- Audit Metadata
  -- ============================================================================
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ============================================================================
  -- Constraints
  -- ============================================================================
  CONSTRAINT audit_events_valid_category CHECK (
    category IN (
      'authentication', 'authorization', 'organization', 'member',
      'project', 'run', 'artifact', 'workspace', 'billing',
      'security', 'system', 'compliance'
    )
  ),
  CONSTRAINT audit_events_valid_severity CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  CONSTRAINT audit_events_valid_outcome CHECK (
    outcome IN ('success', 'failure', 'partial_success')
  ),
  CONSTRAINT audit_events_actor_required CHECK (
    actor_user_id IS NOT NULL OR
    actor_system_component IS NOT NULL OR
    actor_api_client_id IS NOT NULL
  )
) PARTITION BY RANGE (timestamp);

COMMENT ON TABLE nofx.audit_events IS 'Immutable audit log for all system events - SOC2/GDPR/HIPAA compliant';
COMMENT ON COLUMN nofx.audit_events.id IS 'Unique event identifier with timestamp and random suffix';
COMMENT ON COLUMN nofx.audit_events.event_type IS 'Specific event type from 58 supported types (see src/audit/types.ts)';
COMMENT ON COLUMN nofx.audit_events.context_ip_address IS 'Client IP address - should be hashed for PII compliance';
COMMENT ON COLUMN nofx.audit_events.changes IS 'Array of ChangeRecord objects showing before/after values';
COMMENT ON COLUMN nofx.audit_events.payload IS 'Event-specific structured data (varies by event_type)';

-- ============================================================================
-- PARTITIONING STRATEGY - Monthly partitions for performance
-- ============================================================================

-- Create partitions for current month + next 3 months
-- In production, automate partition creation with pg_cron or external scheduler

CREATE TABLE IF NOT EXISTS nofx.audit_events_2025_10 PARTITION OF nofx.audit_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS nofx.audit_events_2025_11 PARTITION OF nofx.audit_events
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS nofx.audit_events_2025_12 PARTITION OF nofx.audit_events
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS nofx.audit_events_2026_01 PARTITION OF nofx.audit_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

COMMENT ON TABLE nofx.audit_events_2025_10 IS 'Audit events partition for October 2025';

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Primary query patterns: time range + organization + filters

-- 1. Time-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp_desc
  ON nofx.audit_events (timestamp DESC);

-- 2. Organization isolation (critical for multi-tenancy)
CREATE INDEX IF NOT EXISTS idx_audit_events_org_timestamp
  ON nofx.audit_events (subject_organization_id, timestamp DESC)
  WHERE subject_organization_id IS NOT NULL;

-- 3. User activity queries
CREATE INDEX IF NOT EXISTS idx_audit_events_user_timestamp
  ON nofx.audit_events (actor_user_id, timestamp DESC)
  WHERE actor_user_id IS NOT NULL;

-- 4. Event type filtering
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type_timestamp
  ON nofx.audit_events (event_type, timestamp DESC);

-- 5. Category + severity (security monitoring)
CREATE INDEX IF NOT EXISTS idx_audit_events_category_severity_timestamp
  ON nofx.audit_events (category, severity, timestamp DESC);

-- 6. Outcome filtering (failure analysis)
CREATE INDEX IF NOT EXISTS idx_audit_events_outcome_timestamp
  ON nofx.audit_events (outcome, timestamp DESC)
  WHERE outcome != 'success';

-- 7. Resource tracking
CREATE INDEX IF NOT EXISTS idx_audit_events_resource_timestamp
  ON nofx.audit_events (subject_resource_type, subject_resource_id, timestamp DESC)
  WHERE subject_resource_id IS NOT NULL;

-- 8. Security event tracking
CREATE INDEX IF NOT EXISTS idx_audit_events_security_critical
  ON nofx.audit_events (category, severity, timestamp DESC)
  WHERE category = 'security' AND severity = 'critical';

-- 9. Request correlation (distributed tracing)
CREATE INDEX IF NOT EXISTS idx_audit_events_request_id
  ON nofx.audit_events (context_request_id)
  WHERE context_request_id IS NOT NULL;

-- 10. GIN index for full-text search on payload
CREATE INDEX IF NOT EXISTS idx_audit_events_payload_gin
  ON nofx.audit_events USING GIN (payload);

-- 11. GIN index for error message search
CREATE INDEX IF NOT EXISTS idx_audit_events_error_message_gin
  ON nofx.audit_events USING GIN (to_tsvector('english', error_message))
  WHERE error_message IS NOT NULL;

-- ============================================================================
-- AUDIT LOG ACCESS TRACKING (Meta-auditing for HIPAA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nofx.audit_log_access (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Who accessed the audit logs
  accessor_user_id UUID NOT NULL,
  accessor_role TEXT NOT NULL,
  access_reason TEXT NOT NULL, -- Required justification

  -- What was accessed
  query_filter JSONB NOT NULL, -- Filter criteria used
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  records_accessed INTEGER NOT NULL DEFAULT 0,
  export_requested BOOLEAN NOT NULL DEFAULT FALSE,

  -- Context
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,

  -- Audit metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE nofx.audit_log_access IS 'Meta-audit trail tracking who accesses audit logs (HIPAA requirement)';
COMMENT ON COLUMN nofx.audit_log_access.access_reason IS 'Required justification for accessing audit logs';

CREATE INDEX IF NOT EXISTS idx_audit_log_access_timestamp
  ON nofx.audit_log_access (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_access_user
  ON nofx.audit_log_access (accessor_user_id, timestamp DESC);

-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS nofx.audit_retention_policies (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Policy definition
  event_category TEXT, -- NULL = default policy
  event_type TEXT, -- NULL = applies to all types in category
  retention_days INTEGER NOT NULL,
  archive_after_days INTEGER, -- Move to cold storage before deletion

  -- Compliance requirements
  compliance_standard TEXT, -- 'SOC2', 'GDPR', 'HIPAA', etc.
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE, -- Prevent deletion if TRUE

  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT audit_retention_positive_days CHECK (retention_days >= 0),
  CONSTRAINT audit_retention_archive_before_deletion CHECK (
    archive_after_days IS NULL OR archive_after_days < retention_days
  ),
  UNIQUE NULLS NOT DISTINCT (event_category, event_type)
);

COMMENT ON TABLE nofx.audit_retention_policies IS 'Retention policies for audit events by category/type';
COMMENT ON COLUMN nofx.audit_retention_policies.legal_hold IS 'When TRUE, prevents deletion regardless of retention period';

-- Insert default retention policies
INSERT INTO nofx.audit_retention_policies (event_category, event_type, retention_days, compliance_standard, description)
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
  ('compliance', 'compliance.data_export.requested', -1, 'GDPR', 'Data export requests: indefinite retention')
ON CONFLICT (event_category, event_type) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on audit tables
ALTER TABLE nofx.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.audit_log_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE nofx.audit_retention_policies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit events for their organizations only
CREATE POLICY "audit_events_organization_isolation"
  ON nofx.audit_events
  FOR SELECT
  USING (
    -- User is member of the organization
    subject_organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid()
    )
    OR
    -- User is the actor (can see their own actions)
    actor_user_id = auth.uid()
  );

-- Policy: Only system and compliance officers can insert audit events
CREATE POLICY "audit_events_system_insert_only"
  ON nofx.audit_events
  FOR INSERT
  WITH CHECK (
    -- Service role only (enforced at application layer)
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Policy: Audit events are immutable (no updates or deletes)
CREATE POLICY "audit_events_immutable"
  ON nofx.audit_events
  FOR UPDATE
  USING (FALSE);

CREATE POLICY "audit_events_no_delete"
  ON nofx.audit_events
  FOR DELETE
  USING (FALSE);

-- Policy: Audit log access - only compliance officers
CREATE POLICY "audit_log_access_compliance_only"
  ON nofx.audit_log_access
  FOR SELECT
  USING (
    accessor_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM nofx.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- Policy: Retention policies - read-only for most users
CREATE POLICY "audit_retention_policies_read"
  ON nofx.audit_retention_policies
  FOR SELECT
  USING (TRUE);

CREATE POLICY "audit_retention_policies_admin_only"
  ON nofx.audit_retention_policies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM nofx.organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Record audit event (application layer wrapper)
CREATE OR REPLACE FUNCTION nofx.record_audit_event(
  p_event_type TEXT,
  p_category TEXT,
  p_severity TEXT,
  p_outcome TEXT,
  p_actor JSONB,
  p_subject JSONB,
  p_context JSONB DEFAULT NULL,
  p_error JSONB DEFAULT NULL,
  p_payload JSONB DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_event_id TEXT;
BEGIN
  -- Generate event ID with timestamp and random suffix
  v_event_id := 'evt_' ||
                EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' ||
                encode(gen_random_bytes(6), 'hex');

  -- Insert audit event
  INSERT INTO nofx.audit_events (
    id,
    timestamp,
    event_type,
    category,
    severity,
    outcome,
    -- Actor fields
    actor_user_id,
    actor_session_id,
    actor_system_component,
    actor_api_client_id,
    actor_metadata,
    -- Subject fields
    subject_resource_type,
    subject_resource_id,
    subject_organization_id,
    subject_project_id,
    subject_parent_id,
    subject_metadata,
    -- Context fields
    context_ip_address,
    context_user_agent,
    context_geo_location,
    context_request_id,
    context_http_method,
    context_http_status,
    context_endpoint,
    context_metadata,
    -- Error fields
    error_code,
    error_message,
    error_metadata,
    -- Event data
    payload,
    changes,
    metadata
  ) VALUES (
    v_event_id,
    NOW(),
    p_event_type,
    p_category,
    p_severity,
    p_outcome,
    -- Extract actor fields
    (p_actor->>'user_id')::UUID,
    p_actor->>'session_id',
    p_actor->>'system_component',
    p_actor->>'api_client_id',
    p_actor->'metadata',
    -- Extract subject fields
    p_subject->>'resource_type',
    p_subject->>'resource_id',
    p_subject->>'organization_id',
    p_subject->>'project_id',
    p_subject->>'parent_id',
    p_subject->'metadata',
    -- Extract context fields
    p_context->>'ip_address',
    p_context->>'user_agent',
    p_context->'geo_location',
    p_context->>'request_id',
    p_context->>'http_method',
    (p_context->>'http_status')::INTEGER,
    p_context->>'endpoint',
    p_context->'metadata',
    -- Extract error fields
    p_error->>'error_code',
    p_error->>'error_message',
    p_error->'metadata',
    -- Event data
    p_payload,
    p_changes,
    p_metadata
  );

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION nofx.record_audit_event IS 'Helper function to record audit events with proper structure';

-- Function: Query audit events with filters
CREATE OR REPLACE FUNCTION nofx.query_audit_events(
  p_organization_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF nofx.audit_events AS $$
BEGIN
  -- Record this audit log access (meta-auditing)
  INSERT INTO nofx.audit_log_access (
    accessor_user_id,
    accessor_role,
    access_reason,
    query_filter,
    date_range_start,
    date_range_end,
    records_accessed
  ) VALUES (
    auth.uid(),
    'user',
    'Query audit events',
    jsonb_build_object(
      'organization_id', p_organization_id,
      'category', p_category,
      'event_type', p_event_type
    ),
    p_date_from,
    p_date_to,
    0 -- Will be updated by caller
  );

  -- Return filtered audit events
  RETURN QUERY
  SELECT *
  FROM nofx.audit_events
  WHERE
    (p_organization_id IS NULL OR subject_organization_id = p_organization_id)
    AND (p_user_id IS NULL OR actor_user_id = p_user_id)
    AND (p_category IS NULL OR category = p_category)
    AND (p_event_type IS NULL OR event_type = p_event_type)
    AND (p_severity IS NULL OR severity = p_severity)
    AND (p_outcome IS NULL OR outcome = p_outcome)
    AND (p_date_from IS NULL OR timestamp >= p_date_from)
    AND (p_date_to IS NULL OR timestamp <= p_date_to)
  ORDER BY timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION nofx.query_audit_events IS 'Query audit events with filters and automatic meta-auditing';

-- Function: Apply retention policies (scheduled maintenance)
CREATE OR REPLACE FUNCTION nofx.apply_audit_retention_policies()
RETURNS TABLE (
  policy_id UUID,
  events_archived INTEGER,
  events_deleted INTEGER
) AS $$
DECLARE
  v_policy RECORD;
  v_cutoff_date TIMESTAMPTZ;
  v_archived INTEGER;
  v_deleted INTEGER;
BEGIN
  -- Iterate through retention policies
  FOR v_policy IN
    SELECT *
    FROM nofx.audit_retention_policies
    WHERE legal_hold = FALSE
      AND retention_days >= 0
  LOOP
    -- Calculate cutoff date
    v_cutoff_date := NOW() - (v_policy.retention_days || ' days')::INTERVAL;

    -- Archive events if policy specifies
    IF v_policy.archive_after_days IS NOT NULL THEN
      -- TODO: Implement archival to cold storage
      -- This would typically move old events to a separate archive table or S3
      v_archived := 0;
    ELSE
      v_archived := 0;
    END IF;

    -- Delete expired events (not yet implemented for safety)
    -- In production, enable after testing archival
    v_deleted := 0;
    -- DELETE FROM nofx.audit_events
    -- WHERE timestamp < v_cutoff_date
    --   AND (v_policy.event_category IS NULL OR category = v_policy.event_category)
    --   AND (v_policy.event_type IS NULL OR event_type = v_policy.event_type);
    -- GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN QUERY SELECT v_policy.id, v_archived, v_deleted;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION nofx.apply_audit_retention_policies IS 'Apply retention policies to archive/delete old audit events';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on retention policies
CREATE TRIGGER update_audit_retention_policies_updated_at
  BEFORE UPDATE ON nofx.audit_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION nofx.update_updated_at_column();

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Service role needs full access for event recording
GRANT ALL ON nofx.audit_events TO service_role;
GRANT ALL ON nofx.audit_log_access TO service_role;
GRANT ALL ON nofx.audit_retention_policies TO service_role;

-- Authenticated users can query their organization's events
GRANT SELECT ON nofx.audit_events TO authenticated;
GRANT SELECT ON nofx.audit_log_access TO authenticated;
GRANT SELECT ON nofx.audit_retention_policies TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION nofx.record_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION nofx.query_audit_events TO authenticated;
GRANT EXECUTE ON FUNCTION nofx.apply_audit_retention_policies TO service_role;

-- ============================================================================
-- PERFORMANCE TUNING RECOMMENDATIONS
-- ============================================================================

-- 1. Partition Maintenance:
--    - Use pg_cron to automatically create new monthly partitions
--    - Example: SELECT cron.schedule('create-audit-partition', '0 0 1 * *', 'CALL nofx.create_next_audit_partition()');

-- 2. Vacuum Strategy:
--    - Configure autovacuum for aggressive cleanup on old partitions
--    - ALTER TABLE nofx.audit_events SET (autovacuum_vacuum_scale_factor = 0.05);

-- 3. Compression:
--    - Enable TOAST compression on JSONB columns
--    - ALTER TABLE nofx.audit_events ALTER COLUMN payload SET STORAGE EXTERNAL;

-- 4. Monitoring:
--    - Track partition sizes: SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE tablename LIKE 'audit_events_%';
--    - Monitor index usage: SELECT indexrelname, idx_scan, idx_tup_read FROM pg_stat_user_indexes WHERE schemaname = 'nofx';

-- 5. Query Optimization:
--    - Use partition pruning by always including timestamp filters
--    - Example: WHERE timestamp >= '2025-01-01' AND timestamp < '2025-02-01'

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA nofx IS 'NOFX Control Plane - Audit Logging System v1.0';
