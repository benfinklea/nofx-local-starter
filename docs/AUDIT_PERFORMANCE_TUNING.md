# Audit Logging Performance Tuning Guide

## Performance Targets

### Target Metrics
- **INSERT Performance**: < 10ms for batch inserts (1000 events)
- **Query Performance**: < 100ms for typical filtered queries (95th percentile)
- **Throughput**: Support 1M events/day without degradation
- **Storage**: Efficient compression and archival

## Benchmarking

### Load Testing Script

```typescript
// loadtest-audit.ts
import { recordAuditEvent } from '../lib/audit';
import { EventCategory, EventSeverity, EventOutcome } from '../audit/types';

async function generateTestEvents(count: number): Promise<void> {
  const start = Date.now();
  const batch = [];

  for (let i = 0; i < count; i++) {
    batch.push(recordAuditEvent({
      event_type: 'auth.login.success',
      category: EventCategory.AUTHENTICATION,
      severity: EventSeverity.INFO,
      outcome: EventOutcome.SUCCESS,
      actor: {
        user_id: `user_${i % 100}`, // 100 unique users
      },
      subject: {
        resource_type: 'user',
        resource_id: `user_${i % 100}`,
        organization_id: `org_${i % 10}`, // 10 organizations
      },
      context: {
        ip_address: `192.168.${i % 256}.${i % 256}`,
        request_id: `req_${i}`,
      },
      payload: {
        auth_method: 'password',
        mfa_used: i % 2 === 0,
      },
    }));

    // Batch commit every 100 events
    if (batch.length >= 100) {
      await Promise.all(batch);
      batch.length = 0;
    }
  }

  // Commit remaining
  if (batch.length > 0) {
    await Promise.all(batch);
  }

  const duration = Date.now() - start;
  const eventsPerSecond = (count / duration) * 1000;

  console.log(`
    Generated ${count} events in ${duration}ms
    Rate: ${eventsPerSecond.toFixed(2)} events/second
    Average: ${(duration / count).toFixed(2)}ms per event
  `);
}

// Run test
generateTestEvents(10000);
```

### Query Performance Test

```sql
-- Test 1: Time range query with organization filter
EXPLAIN ANALYZE
SELECT * FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
  AND timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC
LIMIT 100;

-- Expected: < 100ms, Index Scan on idx_audit_events_org_timestamp

-- Test 2: Category + severity filter
EXPLAIN ANALYZE
SELECT * FROM nofx.audit_events
WHERE category = 'security'
  AND severity = 'critical'
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Expected: < 50ms, Index Scan on idx_audit_events_category_severity_timestamp

-- Test 3: User activity query
EXPLAIN ANALYZE
SELECT * FROM nofx.audit_events
WHERE actor_user_id = 'user_123'::UUID
  AND timestamp >= NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC
LIMIT 50;

-- Expected: < 75ms, Index Scan on idx_audit_events_user_timestamp

-- Test 4: Full-text search on error messages
EXPLAIN ANALYZE
SELECT * FROM nofx.audit_events
WHERE to_tsvector('english', error_message) @@ to_tsquery('permission & denied')
  AND timestamp >= NOW() - INTERVAL '7 days'
LIMIT 100;

-- Expected: < 200ms, Bitmap Heap Scan with GIN index
```

## Index Optimization

### Monitoring Index Usage

```sql
-- Find most-used indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events%'
ORDER BY idx_scan DESC;

-- Find unused indexes (candidates for removal)
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events%'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%pkey';

-- Check index bloat
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS current_size,
  pg_size_pretty(
    pg_relation_size(indexrelid) *
    (1 - (COALESCE(nullfrac, 0) + (1 - COALESCE(nullfrac, 0)) * avg_width / 100))
  ) AS estimated_size
FROM pg_stat_user_indexes
JOIN pg_stats ON indexrelname = indexname
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events%';
```

### Index Maintenance

```sql
-- Rebuild bloated indexes
REINDEX INDEX CONCURRENTLY nofx.idx_audit_events_org_timestamp;
REINDEX INDEX CONCURRENTLY nofx.idx_audit_events_user_timestamp;

-- Rebuild all audit indexes (during maintenance window)
REINDEX TABLE CONCURRENTLY nofx.audit_events;

-- Analyze statistics after rebuild
ANALYZE nofx.audit_events;
```

### Conditional Indexes for Specific Workloads

```sql
-- Index for failed events only (smaller, faster)
CREATE INDEX CONCURRENTLY idx_audit_events_failures
  ON nofx.audit_events (outcome, timestamp DESC)
  WHERE outcome IN ('failure', 'partial_success');

-- Index for security investigations
CREATE INDEX CONCURRENTLY idx_audit_events_security_by_ip
  ON nofx.audit_events (context_ip_address, timestamp DESC)
  WHERE category = 'security';

-- Index for user audit trails (exclude system events)
CREATE INDEX CONCURRENTLY idx_audit_events_user_actions
  ON nofx.audit_events (actor_user_id, timestamp DESC)
  WHERE actor_user_id IS NOT NULL;
```

## Partition Management

### Automated Partition Creation

```sql
-- Function to create next month's partition
CREATE OR REPLACE FUNCTION nofx.create_next_audit_partition()
RETURNS TEXT AS $$
DECLARE
  v_next_month DATE;
  v_month_after DATE;
  v_partition_name TEXT;
  v_year_month TEXT;
BEGIN
  -- Calculate next month
  v_next_month := date_trunc('month', NOW() + INTERVAL '1 month')::DATE;
  v_month_after := v_next_month + INTERVAL '1 month';
  v_year_month := to_char(v_next_month, 'YYYY_MM');
  v_partition_name := 'audit_events_' || v_year_month;

  -- Check if partition already exists
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = v_partition_name
      AND relnamespace = 'nofx'::regnamespace
  ) THEN
    RETURN 'Partition ' || v_partition_name || ' already exists';
  END IF;

  -- Create partition
  EXECUTE format(
    'CREATE TABLE nofx.%I PARTITION OF nofx.audit_events FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    v_next_month,
    v_month_after
  );

  RETURN 'Created partition ' || v_partition_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule with pg_cron (run on 1st of each month)
-- SELECT cron.schedule(
--   'create-audit-partition',
--   '0 0 1 * *',
--   'SELECT nofx.create_next_audit_partition()'
-- );
```

### Partition Archival Strategy

```sql
-- Function to archive old partition to S3/cold storage
CREATE OR REPLACE FUNCTION nofx.archive_audit_partition(
  p_partition_name TEXT
)
RETURNS TABLE (
  partition_name TEXT,
  rows_archived BIGINT,
  size_bytes BIGINT
) AS $$
DECLARE
  v_row_count BIGINT;
  v_size BIGINT;
BEGIN
  -- Get partition size and row count
  SELECT
    pg_total_relation_size('nofx.' || p_partition_name),
    (SELECT COUNT(*) FROM nofx.audit_events WHERE timestamp >= date_trunc('month', NOW() - INTERVAL '2 years'))
  INTO v_size, v_row_count;

  -- TODO: Export to S3 or cold storage
  -- This would typically use pg_dump or COPY TO with aws_s3 extension
  -- Example:
  -- SELECT aws_s3.query_export_to_s3(
  --   format('SELECT * FROM nofx.%I', p_partition_name),
  --   aws_commons.create_s3_uri(
  --     'audit-archive-bucket',
  --     'audit_events/' || p_partition_name || '.csv.gz',
  --     'us-east-1'
  --   )
  -- );

  -- After successful export, detach partition
  -- EXECUTE format('ALTER TABLE nofx.audit_events DETACH PARTITION nofx.%I', p_partition_name);

  RETURN QUERY SELECT p_partition_name, v_row_count, v_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Partition Pruning Verification

```sql
-- Verify partition pruning is working
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM nofx.audit_events
WHERE timestamp >= '2025-10-01'
  AND timestamp < '2025-11-01'
  AND subject_organization_id = 'org_456';

-- Look for: "Partitions scanned: 1 of N"
-- If seeing "Seq Scan" or multiple partitions, partition pruning is not working
```

## Storage Optimization

### JSONB Compression

```sql
-- Enable TOAST compression for JSONB columns
ALTER TABLE nofx.audit_events ALTER COLUMN payload SET STORAGE EXTERNAL;
ALTER TABLE nofx.audit_events ALTER COLUMN changes SET STORAGE EXTERNAL;
ALTER TABLE nofx.audit_events ALTER COLUMN metadata SET STORAGE EXTERNAL;

-- Check compression effectiveness
SELECT
  attname,
  pg_size_pretty(pg_total_relation_size('nofx.audit_events')) AS table_size,
  case when attcompression = 'p' then 'pglz'
       when attcompression = 'l' then 'lz4'
       else 'none'
  end as compression
FROM pg_attribute
WHERE attrelid = 'nofx.audit_events'::regclass
  AND attname IN ('payload', 'changes', 'metadata');
```

### Table-Level Storage Parameters

```sql
-- Optimize for append-only workload
ALTER TABLE nofx.audit_events SET (
  -- More aggressive autovacuum
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,

  -- Faster autovacuum triggers
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_threshold = 100,

  -- Fill factor for minimal updates (audit logs are immutable)
  fillfactor = 100
);

-- Check current settings
SELECT
  reloptions
FROM pg_class
WHERE relname = 'audit_events'
  AND relnamespace = 'nofx'::regnamespace;
```

### Vacuum Strategy

```sql
-- Manual vacuum for immediate cleanup
VACUUM (ANALYZE, VERBOSE) nofx.audit_events;

-- Aggressive vacuum for bloat reduction
VACUUM (FULL, ANALYZE, VERBOSE) nofx.audit_events_2024_01;

-- Monitor vacuum progress
SELECT
  schemaname,
  tablename,
  last_vacuum,
  last_autovacuum,
  n_dead_tup,
  n_live_tup,
  ROUND(100 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_tup_pct
FROM pg_stat_user_tables
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events%'
ORDER BY n_dead_tup DESC;
```

## Query Optimization

### Slow Query Identification

```sql
-- Enable query logging (postgresql.conf)
-- log_min_duration_statement = 100  # Log queries > 100ms
-- log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

-- Find slow audit queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE query LIKE '%audit_events%'
ORDER BY mean_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

### Query Rewrite Patterns

```sql
-- SLOW: No partition pruning
SELECT * FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
ORDER BY timestamp DESC
LIMIT 100;

-- FAST: Include timestamp for partition pruning
SELECT * FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
  AND timestamp >= NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC
LIMIT 100;

-- SLOW: Count(*) on large partition
SELECT COUNT(*) FROM nofx.audit_events
WHERE category = 'security';

-- FAST: Use approximate count for large tables
SELECT reltuples::BIGINT AS approx_count
FROM pg_class
WHERE oid = 'nofx.audit_events'::regclass;

-- SLOW: OR conditions prevent index usage
SELECT * FROM nofx.audit_events
WHERE actor_user_id = 'user_123'
   OR subject_organization_id = 'org_456';

-- FAST: Use UNION ALL for OR conditions
SELECT * FROM nofx.audit_events
WHERE actor_user_id = 'user_123'
UNION ALL
SELECT * FROM nofx.audit_events
WHERE subject_organization_id = 'org_456'
  AND actor_user_id != 'user_123';
```

### Materialized Views for Reports

```sql
-- Create materialized view for daily summaries
CREATE MATERIALIZED VIEW nofx.audit_daily_summary AS
SELECT
  date_trunc('day', timestamp) AS day,
  subject_organization_id,
  category,
  COUNT(*) AS event_count,
  COUNT(CASE WHEN outcome = 'failure' THEN 1 END) AS failure_count,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) AS critical_count
FROM nofx.audit_events
WHERE timestamp >= NOW() - INTERVAL '90 days'
GROUP BY day, subject_organization_id, category;

CREATE INDEX ON nofx.audit_daily_summary (subject_organization_id, day DESC);

-- Refresh daily (pg_cron)
-- SELECT cron.schedule(
--   'refresh-audit-summary',
--   '0 1 * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY nofx.audit_daily_summary'
-- );

-- Query summary instead of raw events
SELECT * FROM nofx.audit_daily_summary
WHERE subject_organization_id = 'org_456'
  AND day >= NOW() - INTERVAL '30 days'
ORDER BY day DESC;
```

## Connection Pooling

### PgBouncer Configuration

```ini
# pgbouncer.ini
[databases]
nofx_audit = host=localhost dbname=nofx port=5432

[pgbouncer]
# Pool settings for audit logging
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5
reserve_pool_timeout = 3

# Optimize for short-lived connections
server_lifetime = 3600
server_idle_timeout = 600
```

### Application-Level Connection Pooling

```typescript
// db-pool.ts
import { Pool } from 'pg';

const auditPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  min: 5, // Minimum idle connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // Optimize for audit logging
  statement_timeout: 5000, // 5 second query timeout
  query_timeout: 5000,
});

// Monitor pool health
auditPool.on('error', (err, client) => {
  console.error('Unexpected pool error', err);
});

auditPool.on('connect', () => {
  console.log('New connection to audit database');
});

// Export pool
export { auditPool };
```

## Caching Strategy

### Redis Cache for Frequent Queries

```typescript
// audit-cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache user audit summary
export async function getUserAuditSummary(userId: string): Promise<AuditSummary> {
  const cacheKey = `audit:summary:${userId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Query database
  const summary = await db.query(`
    SELECT
      category,
      COUNT(*) as count,
      MAX(timestamp) as last_event
    FROM nofx.audit_events
    WHERE actor_user_id = $1
      AND timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY category
  `, [userId]);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(summary));

  return summary;
}

// Invalidate cache on new events
export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  await db.query(/* insert event */);

  // Invalidate user's cached summary
  if (event.actor.user_id) {
    await redis.del(`audit:summary:${event.actor.user_id}`);
  }
}
```

## Monitoring Dashboards

### Grafana Metrics

```sql
-- Metrics to track in Grafana/Prometheus

-- 1. Event ingestion rate
SELECT
  date_trunc('minute', timestamp) AS time,
  COUNT(*) AS events_per_minute
FROM nofx.audit_events
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY time
ORDER BY time;

-- 2. Query performance (p95, p99)
SELECT
  percentile_cont(0.95) WITHIN GROUP (ORDER BY mean_time) AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY mean_time) AS p99_ms
FROM pg_stat_statements
WHERE query LIKE '%audit_events%';

-- 3. Partition sizes
SELECT
  tablename,
  pg_total_relation_size('nofx.' || tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events_%'
ORDER BY tablename DESC;

-- 4. Index hit ratio (should be > 99%)
SELECT
  schemaname,
  sum(idx_blks_hit) AS index_hits,
  sum(idx_blks_read) AS index_reads,
  ROUND(
    100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0),
    2
  ) AS hit_ratio
FROM pg_statio_user_indexes
WHERE schemaname = 'nofx'
GROUP BY schemaname;

-- 5. Failed event rate
SELECT
  date_trunc('hour', timestamp) AS hour,
  COUNT(*) AS total,
  COUNT(CASE WHEN outcome = 'failure' THEN 1 END) AS failures,
  ROUND(100.0 * COUNT(CASE WHEN outcome = 'failure' THEN 1 END) / COUNT(*), 2) AS failure_pct
FROM nofx.audit_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

## Production Readiness Checklist

### Performance
- [ ] Partition strategy implemented (monthly)
- [ ] All indexes created and analyzed
- [ ] Query performance < 100ms (p95)
- [ ] Insert performance < 10ms (batch)
- [ ] Connection pooling configured
- [ ] Vacuum strategy implemented

### Scalability
- [ ] Automated partition creation (pg_cron)
- [ ] Partition archival strategy defined
- [ ] Materialized views for reports
- [ ] Caching layer implemented
- [ ] Load testing completed (1M events/day)

### Monitoring
- [ ] Grafana dashboards configured
- [ ] Alerting rules defined
- [ ] Query performance tracking
- [ ] Storage growth monitoring
- [ ] Index usage tracking

### Maintenance
- [ ] Backup strategy verified
- [ ] Restore procedures tested
- [ ] Retention policies documented
- [ ] Archive/purge procedures automated
- [ ] Runbooks created

## Troubleshooting

### Issue: High Query Latency

```sql
-- Diagnose
SELECT query, mean_time, calls
FROM pg_stat_statements
WHERE query LIKE '%audit_events%'
ORDER BY mean_time DESC;

-- Solutions
1. Add missing timestamp filter
2. Check partition pruning with EXPLAIN
3. Rebuild bloated indexes: REINDEX CONCURRENTLY
4. Increase work_mem: SET work_mem = '256MB'
```

### Issue: High Insert Latency

```sql
-- Diagnose
SELECT wait_event_type, wait_event, state, query
FROM pg_stat_activity
WHERE query LIKE '%audit_events%';

-- Solutions
1. Batch inserts (100-1000 events)
2. Use COPY instead of INSERT for bulk loads
3. Disable synchronous_commit for audit logs: SET synchronous_commit = OFF
4. Check for lock contention: SELECT * FROM pg_locks WHERE relation = 'audit_events'::regclass
```

### Issue: Partition Bloat

```sql
-- Diagnose
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('nofx.' || tablename)) AS total_size,
  (SELECT COUNT(*) FROM nofx.audit_events WHERE /* partition filter */) AS row_count
FROM pg_tables
WHERE schemaname = 'nofx'
  AND tablename LIKE 'audit_events_%';

-- Solutions
1. VACUUM FULL on old partitions (maintenance window)
2. Enable autovacuum: ALTER TABLE SET (autovacuum_enabled = on)
3. Archive and drop old partitions
```

## References

- PostgreSQL Partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- Index Usage: https://www.postgresql.org/docs/current/indexes.html
- Query Performance: https://www.postgresql.org/docs/current/performance-tips.html
- TOAST Storage: https://www.postgresql.org/docs/current/storage-toast.html
