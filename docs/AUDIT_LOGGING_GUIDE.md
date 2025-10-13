# NOFX Audit Logging System - Implementation Guide

## Overview

The NOFX Audit Logging System provides production-ready, compliance-focused audit logging for the NOFX Control Plane. It supports **SOC2**, **GDPR**, and **HIPAA** compliance requirements with immutable event storage, flexible retention policies, and comprehensive query capabilities.

## Key Features

### Compliance & Security
- **Immutable Audit Trail**: Events cannot be updated or deleted (enforced by database triggers)
- **Meta-Auditing**: Tracks who accesses audit logs (HIPAA requirement)
- **Organization Isolation**: RLS policies ensure users only see their organization's events
- **Encryption Ready**: Sensitive fields can be encrypted at rest
- **Retention Policies**: Flexible retention with legal hold support

### Performance & Scalability
- **Partitioned Storage**: Monthly partitions for PostgreSQL (handles 1M+ events/day)
- **Optimized Indexes**: 11 specialized indexes for common query patterns
- **Efficient Querying**: Sub-100ms queries with proper indexing
- **Batch Insert Support**: High-throughput event recording

### Developer Experience
- **Type-Safe Events**: 58 discriminated union event types in TypeScript
- **Helper Functions**: Easy-to-use database functions for recording/querying
- **Dual Database Support**: PostgreSQL (production) + SQLite (development)
- **Rich Metadata**: Flexible JSONB/JSON fields for event-specific data

## Architecture

### Database Schema

```
audit_events (partitioned by month)
├── Primary identification (id, timestamp)
├── Event classification (event_type, category, severity, outcome)
├── Actor information (who performed the action)
├── Subject information (what was acted upon)
├── Context (environmental data: IP, user agent, location)
├── Error details (for failures)
└── Event data (payload, changes, metadata)

audit_log_access (meta-auditing)
├── Tracks all audit log queries
└── Required for HIPAA compliance

audit_retention_policies
├── Defines retention rules per event type/category
└── Supports legal holds and compliance standards
```

### Event Types (58 Total)

```typescript
// Authentication (10 types)
- auth.login.success / failure
- auth.logout
- auth.token.created / revoked
- auth.mfa.enabled / disabled
- auth.password.changed / reset
- auth.session.expired

// Authorization (5 types)
- authz.permission.granted / denied
- authz.role.assigned / removed
- authz.access.denied

// Organization (5 types)
- org.created / updated / deleted
- org.settings.changed
- org.subscription.changed

// Member (5 types)
- member.invited / added / removed
- member.role.changed
- member.permissions.changed

// Project (5 types)
- project.created / updated / deleted
- project.cloned / initialized

// Run (5 types)
- run.created / started / completed / failed / cancelled

// Artifact (4 types)
- artifact.created / read / downloaded / deleted

// Workspace (4 types)
- workspace.created / accessed / modified / deleted

// Billing (3 types)
- billing.subscription.changed
- billing.payment.processed
- billing.quota.exceeded

// Security (5 types)
- security.suspicious_activity
- security.rate_limit.exceeded
- security.ip.blocked
- security.brute_force.detected
- security.unauthorized_access.attempted

// System (3 types)
- system.health_check
- system.migration
- system.config.changed

// Compliance (4 types)
- compliance.data_export.requested / completed
- compliance.retention.policy_applied
- compliance.audit_log.accessed
```

## Installation

### 1. Run PostgreSQL Migration (Production)

```bash
# Using Supabase CLI
supabase db reset  # Runs all migrations including audit logging

# Or manually via SQL Editor
# Copy contents of supabase/migrations/20251013000001_audit_logging_postgres.sql
# Paste into Supabase SQL Editor and run
```

### 2. Run SQLite Migration (Local Development)

```bash
# Using better-sqlite3
sqlite3 local_data/nofx.db < supabase/migrations/20251013000001_audit_logging_sqlite.sql

# Or via Node.js
node -e "
const Database = require('better-sqlite3');
const db = new Database('local_data/nofx.db');
const migration = fs.readFileSync('supabase/migrations/20251013000001_audit_logging_sqlite.sql', 'utf8');
db.exec(migration);
"
```

### 3. Verify Installation

```sql
-- PostgreSQL
SELECT COUNT(*) FROM nofx.audit_events;
SELECT * FROM nofx.audit_retention_policies;

-- SQLite
SELECT COUNT(*) FROM audit_events;
SELECT * FROM audit_retention_policies;
```

## Usage

### Recording Audit Events

#### Using TypeScript (Recommended)

```typescript
import { recordAuditEvent } from '../lib/audit';
import { EventCategory, EventSeverity, EventOutcome } from '../audit/types';

// Example: Login success
await recordAuditEvent({
  event_type: 'auth.login.success',
  category: EventCategory.AUTHENTICATION,
  severity: EventSeverity.INFO,
  outcome: EventOutcome.SUCCESS,
  actor: {
    user_id: 'user_123',
    session_id: 'sess_xyz',
  },
  subject: {
    resource_type: 'user',
    resource_id: 'user_123',
  },
  context: {
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0...',
    request_id: 'req_abc',
  },
  payload: {
    auth_method: 'password',
    mfa_used: true,
  },
});

// Example: Organization deleted (critical event)
await recordAuditEvent({
  event_type: 'org.deleted',
  category: EventCategory.ORGANIZATION,
  severity: EventSeverity.CRITICAL,
  outcome: EventOutcome.SUCCESS,
  actor: {
    user_id: 'user_123',
  },
  subject: {
    resource_type: 'organization',
    resource_id: 'org_456',
    organization_id: 'org_456',
  },
  payload: {
    org_name: 'Acme Corp',
    org_slug: 'acme-corp',
    deletion_reason: 'User requested',
  },
});

// Example: Failed permission check
await recordAuditEvent({
  event_type: 'authz.permission.denied',
  category: EventCategory.AUTHORIZATION,
  severity: EventSeverity.WARNING,
  outcome: EventOutcome.FAILURE,
  actor: {
    user_id: 'user_789',
  },
  subject: {
    resource_type: 'project',
    resource_id: 'proj_123',
    organization_id: 'org_456',
  },
  error_details: {
    error_code: 'INSUFFICIENT_PERMISSIONS',
    error_message: 'User lacks required permission: project:delete',
  },
  payload: {
    required_permission: 'project:delete',
    user_role: 'member',
  },
});
```

#### Using SQL Function (Direct)

```sql
-- PostgreSQL
SELECT nofx.record_audit_event(
  p_event_type := 'auth.login.success',
  p_category := 'authentication',
  p_severity := 'info',
  p_outcome := 'success',
  p_actor := jsonb_build_object(
    'user_id', 'user_123',
    'session_id', 'sess_xyz'
  ),
  p_subject := jsonb_build_object(
    'resource_type', 'user',
    'resource_id', 'user_123'
  ),
  p_context := jsonb_build_object(
    'ip_address', '192.168.1.100',
    'request_id', 'req_abc'
  ),
  p_payload := jsonb_build_object(
    'auth_method', 'password',
    'mfa_used', true
  )
);
```

### Querying Audit Events

#### Using Helper Function

```sql
-- PostgreSQL: Query organization events for last 30 days
SELECT * FROM nofx.query_audit_events(
  p_organization_id := 'org_456',
  p_date_from := NOW() - INTERVAL '30 days',
  p_limit := 100
);

-- Filter by category and severity
SELECT * FROM nofx.query_audit_events(
  p_organization_id := 'org_456',
  p_category := 'security',
  p_severity := 'critical',
  p_date_from := NOW() - INTERVAL '7 days'
);
```

#### Direct SQL Queries

```sql
-- Recent failed login attempts from same IP
SELECT
  context_ip_address,
  COUNT(*) AS attempt_count,
  MAX(timestamp) AS last_attempt,
  ARRAY_AGG(DISTINCT actor_user_id) AS attempted_users
FROM nofx.audit_events
WHERE event_type = 'auth.login.failure'
  AND timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY context_ip_address
HAVING COUNT(*) >= 5
ORDER BY attempt_count DESC;

-- User activity timeline
SELECT
  timestamp,
  event_type,
  category,
  subject_resource_type,
  outcome,
  payload
FROM nofx.audit_events
WHERE actor_user_id = 'user_123'
  AND timestamp >= NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;

-- Organization compliance report
SELECT
  category,
  event_type,
  outcome,
  COUNT(*) AS event_count,
  COUNT(CASE WHEN outcome = 'failure' THEN 1 END) AS failure_count
FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
  AND timestamp >= NOW() - INTERVAL '1 year'
GROUP BY category, event_type, outcome
ORDER BY event_count DESC;

-- Security events requiring attention
SELECT
  id,
  timestamp,
  event_type,
  actor_user_id,
  context_ip_address,
  error_message,
  payload
FROM nofx.audit_events
WHERE category = 'security'
  AND severity = 'critical'
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

#### Using Views (SQLite Only)

```sql
-- Recent critical security events
SELECT * FROM v_audit_security_critical LIMIT 50;

-- Failed authentication attempts
SELECT * FROM v_audit_failed_auth WHERE timestamp >= datetime('now', '-1 day');

-- Data access events
SELECT * FROM v_audit_data_access WHERE actor_user_id = 'user_123';

-- Organization activity summary
SELECT * FROM v_audit_org_summary WHERE organization_id = 'org_456';
```

## Retention Policies

### Default Policies

```sql
-- View configured policies
SELECT * FROM nofx.audit_retention_policies ORDER BY retention_days DESC;

-- Results:
-- Security events: 10 years (3650 days)
-- Authentication: 10 years (3650 days)
-- Default events: 7 years (2555 days)
-- Data access: 90 days
-- Compliance exports: Indefinite (legal hold)
```

### Adding Custom Policies

```sql
-- Add custom retention for specific event type
INSERT INTO nofx.audit_retention_policies (
  event_category,
  event_type,
  retention_days,
  compliance_standard,
  description
) VALUES (
  'billing',
  'billing.payment.processed',
  2555, -- 7 years
  'SOC2',
  'Payment records: 7 years for financial compliance'
);

-- Add legal hold for investigation
INSERT INTO nofx.audit_retention_policies (
  event_category,
  event_type,
  retention_days,
  legal_hold,
  description
) VALUES (
  'security',
  'security.suspicious_activity',
  -1, -- Indefinite
  TRUE,
  'Security investigation: legal hold active'
);
```

### Applying Retention Policies

```sql
-- PostgreSQL: Run retention cleanup (scheduled via pg_cron)
SELECT * FROM nofx.apply_audit_retention_policies();

-- Results show:
-- policy_id | events_archived | events_deleted
-- uuid      | 1234           | 5678
```

## Performance Tuning

### Query Optimization

```sql
-- GOOD: Uses partition pruning and index
SELECT * FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
  AND timestamp >= '2025-10-01'
  AND timestamp < '2025-11-01'
  AND category = 'security';

-- BAD: Full table scan, no partition pruning
SELECT * FROM nofx.audit_events
WHERE subject_organization_id = 'org_456';
```

### Index Usage Analysis

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events%'
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE schemaname = 'nofx'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%pkey';
```

### Partition Management

```sql
-- Create next month's partition (automate with pg_cron)
CREATE TABLE IF NOT EXISTS nofx.audit_events_2026_02
PARTITION OF nofx.audit_events
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Check partition sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events_%'
ORDER BY tablename DESC;

-- Archive old partition (before dropping)
-- 1. Export to S3/cold storage
-- 2. Verify export
-- 3. Drop partition
DROP TABLE IF EXISTS nofx.audit_events_2024_01;
```

### Vacuum & Maintenance

```sql
-- Aggressive autovacuum for audit tables
ALTER TABLE nofx.audit_events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- Manual vacuum for immediate cleanup
VACUUM ANALYZE nofx.audit_events;

-- Check table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_table_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'nofx'
  AND tablename = 'audit_events';
```

## Security & Compliance

### Row Level Security (PostgreSQL)

```sql
-- Users can only see events for their organizations
CREATE POLICY "audit_events_organization_isolation"
  ON nofx.audit_events FOR SELECT
  USING (
    subject_organization_id IN (
      SELECT organization_id
      FROM nofx.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Events are immutable (no updates/deletes)
CREATE POLICY "audit_events_immutable"
  ON nofx.audit_events FOR UPDATE
  USING (FALSE);
```

### PII Protection

```sql
-- Hash IP addresses before storing (GDPR)
CREATE OR REPLACE FUNCTION nofx.hash_ip_address(ip TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(ip || current_setting('app.ip_salt'), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage in application
SELECT nofx.hash_ip_address('192.168.1.100');
```

### Compliance Reports

```sql
-- SOC2 Report: All access to sensitive resources
SELECT
  timestamp,
  actor_user_id,
  event_type,
  subject_resource_type,
  subject_resource_id,
  outcome
FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
  AND category IN ('authorization', 'security')
  AND timestamp >= NOW() - INTERVAL '1 year'
ORDER BY timestamp DESC;

-- GDPR Report: All data access by user
SELECT
  timestamp,
  event_type,
  subject_resource_type,
  subject_resource_id,
  payload
FROM nofx.audit_events
WHERE event_type IN ('artifact.read', 'artifact.downloaded')
  AND actor_user_id = 'user_123'
  AND timestamp >= NOW() - INTERVAL '90 days'
ORDER BY timestamp DESC;

-- HIPAA Report: Audit log access trail
SELECT
  timestamp,
  accessor_user_id,
  access_reason,
  date_range_start,
  date_range_end,
  records_accessed
FROM nofx.audit_log_access
WHERE timestamp >= NOW() - INTERVAL '1 year'
ORDER BY timestamp DESC;
```

## Monitoring & Alerting

### Key Metrics to Monitor

```sql
-- Event ingestion rate (events per minute)
SELECT
  date_trunc('minute', timestamp) AS minute,
  COUNT(*) AS events_per_minute
FROM nofx.audit_events
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC;

-- Failed event rate (should be < 5%)
SELECT
  date_trunc('hour', timestamp) AS hour,
  COUNT(*) AS total_events,
  COUNT(CASE WHEN outcome = 'failure' THEN 1 END) AS failed_events,
  ROUND(100.0 * COUNT(CASE WHEN outcome = 'failure' THEN 1 END) / COUNT(*), 2) AS failure_rate
FROM nofx.audit_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Critical security events (alert immediately)
SELECT
  COUNT(*) AS critical_security_events
FROM nofx.audit_events
WHERE category = 'security'
  AND severity = 'critical'
  AND timestamp >= NOW() - INTERVAL '5 minutes';

-- Partition growth rate
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('nofx.'||tablename)) AS size,
  (SELECT COUNT(*) FROM nofx.audit_events WHERE timestamp >= NOW() - INTERVAL '30 days') AS recent_count
FROM pg_tables
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events_%'
ORDER BY tablename DESC
LIMIT 3;
```

### Alerting Rules

```javascript
// Example: Alert on suspicious activity
const criticalSecurityEvents = await db.query(`
  SELECT COUNT(*) as count
  FROM nofx.audit_events
  WHERE category = 'security'
    AND severity = 'critical'
    AND timestamp >= NOW() - INTERVAL '5 minutes'
`);

if (criticalSecurityEvents[0].count > 0) {
  await sendAlert('SECURITY_CRITICAL', {
    count: criticalSecurityEvents[0].count,
    message: 'Critical security events detected in last 5 minutes',
  });
}

// Alert on failed login attempts
const failedLogins = await db.query(`
  SELECT
    context_ip_address,
    COUNT(*) as attempts
  FROM nofx.audit_events
  WHERE event_type = 'auth.login.failure'
    AND timestamp >= NOW() - INTERVAL '10 minutes'
  GROUP BY context_ip_address
  HAVING COUNT(*) >= 5
`);

if (failedLogins.length > 0) {
  await sendAlert('BRUTE_FORCE_DETECTED', {
    ips: failedLogins.map(row => row.context_ip_address),
  });
}
```

## Troubleshooting

### Common Issues

#### 1. Slow Queries

```sql
-- Enable query logging
SET log_statement = 'all';
SET log_duration = 'on';
SET log_min_duration_statement = 100; -- Log queries > 100ms

-- Analyze query plan
EXPLAIN ANALYZE
SELECT * FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
  AND timestamp >= '2025-10-01';

-- Solution: Ensure timestamp filter for partition pruning
```

#### 2. Partition Not Found

```sql
-- Error: no partition of relation "audit_events" found for row
-- Solution: Create missing partition

CREATE TABLE IF NOT EXISTS nofx.audit_events_2026_03
PARTITION OF nofx.audit_events
FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

#### 3. RLS Preventing Access

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'nofx' AND tablename = 'audit_events';

-- Test as specific user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user_123';
SELECT COUNT(*) FROM nofx.audit_events;
RESET ROLE;
```

#### 4. High Storage Usage

```sql
-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('nofx.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events%'
ORDER BY pg_total_relation_size('nofx.'||tablename) DESC;

-- Archive old partitions
-- 1. Export to S3
-- 2. Drop old partition
DROP TABLE nofx.audit_events_2024_01;
```

## Best Practices

### 1. Always Include Timestamps in Queries
```sql
-- GOOD: Enables partition pruning
WHERE timestamp >= '2025-10-01' AND timestamp < '2025-11-01'

-- BAD: Full table scan across all partitions
WHERE actor_user_id = 'user_123'
```

### 2. Use Specific Event Types
```typescript
// GOOD: Type-safe with autocomplete
recordAuditEvent({ event_type: 'auth.login.success', ... });

// BAD: String literals, typo-prone
recordAuditEvent({ event_type: 'auth.login.sucess', ... }); // typo!
```

### 3. Include Request IDs for Correlation
```typescript
await recordAuditEvent({
  context: {
    request_id: req.id, // Enables distributed tracing
  },
});
```

### 4. Sanitize Error Messages
```typescript
// GOOD: Safe for storage
error_message: 'Authentication failed: invalid credentials'

// BAD: Contains sensitive data
error_message: `Authentication failed: password ${password} is incorrect`
```

### 5. Use Appropriate Severity
```typescript
// INFO: Normal operations
severity: EventSeverity.INFO // login, logout, resource creation

// WARNING: Noteworthy but not critical
severity: EventSeverity.WARNING // permission denied, rate limit

// CRITICAL: Requires immediate attention
severity: EventSeverity.CRITICAL // security breach, data deletion
```

## Migration Notes

### Migrating from Existing Audit System

```typescript
// Map old events to new schema
async function migrateEvent(oldEvent: OldAuditEvent): Promise<void> {
  await recordAuditEvent({
    event_type: mapEventType(oldEvent.type),
    category: mapCategory(oldEvent.type),
    severity: mapSeverity(oldEvent.level),
    outcome: oldEvent.success ? EventOutcome.SUCCESS : EventOutcome.FAILURE,
    actor: {
      user_id: oldEvent.userId,
    },
    subject: {
      resource_type: oldEvent.resourceType,
      resource_id: oldEvent.resourceId,
    },
    payload: oldEvent.metadata,
    timestamp: oldEvent.createdAt,
  });
}
```

### Zero-Downtime Deployment

1. **Phase 1**: Deploy new schema alongside old system
2. **Phase 2**: Dual-write to both systems
3. **Phase 3**: Backfill historical events
4. **Phase 4**: Switch reads to new system
5. **Phase 5**: Remove old system

## Support & Resources

- **Type Definitions**: `/Volumes/Development/nofx-local-starter/worktrees/backplane-implementation/src/audit/types.ts`
- **Migration Files**: `/Volumes/Development/nofx-local-starter/worktrees/backplane-implementation/supabase/migrations/20251013000001_audit_logging_*`
- **Example Queries**: See "Sample Queries" section in migration files

## License

Copyright (c) 2025 NOFX Control Plane
