# Audit System Quick Start Guide

Complete guide to implementing and using the NOFX Control Plane audit logging system.

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [Express Integration](#express-integration)
4. [RBAC Integration](#rbac-integration)
5. [Querying Audit Logs](#querying-audit-logs)
6. [Retention Policies](#retention-policies)
7. [Compliance Reporting](#compliance-reporting)
8. [Best Practices](#best-practices)

## Installation

The audit system is built-in to the NOFX Control Plane. No additional installation required.

### Database Setup

Run the migrations to create audit tables:

```bash
# PostgreSQL (Production)
supabase db reset

# SQLite (Development)
sqlite3 local_data/nofx.db < supabase/migrations/20251013000001_audit_logging_sqlite.sql
```

## Basic Setup

### 1. Create Storage Adapter

```typescript
import { createDatabaseAuditStorage } from './src/audit';

// PostgreSQL (Production)
const storage = createDatabaseAuditStorage({
  type: 'postgresql',
  connectionString: process.env.DATABASE_URL!,
  schema: 'nofx',
});

// SQLite (Development)
const storage = createDatabaseAuditStorage({
  type: 'sqlite',
  connectionString: './local_data/audit.db',
});
```

### 2. Create Audit Service

```typescript
import { createAuditService } from './src/audit';

const auditService = createAuditService({
  storage,
  bufferSize: 100, // Batch size for performance
  flushIntervalMs: 5000, // Auto-flush every 5 seconds
  sanitizeData: true, // Remove sensitive fields
});
```

### 3. Log Your First Event

```typescript
import { EventCategory, EventSeverity, EventOutcome } from './src/audit';

await auditService.log({
  event_type: 'auth.login.success',
  category: EventCategory.AUTHENTICATION,
  severity: EventSeverity.INFO,
  actor: {
    user_id: 'user_123',
    session_id: 'sess_abc',
  },
  subject: {
    resource_type: 'user',
    resource_id: 'user_123',
  },
  outcome: EventOutcome.SUCCESS,
  payload: {
    auth_method: 'password',
    mfa_used: true,
  },
});
```

## Express Integration

### Complete Server Setup

```typescript
import express from 'express';
import { BackplaneStore } from './src/storage/backplane/store';
import { RBACService } from './src/rbac/RBACService';
import { AuthenticationService } from './src/auth/middleware/AuthenticationService';
import { AuthorizationService } from './src/auth/middleware/AuthorizationService';
import {
  createDatabaseAuditStorage,
  createAuditService,
  createAuditIntegration,
} from './src/audit';

const app = express();

// Initialize services
const store = new BackplaneStore();
const rbacService = new RBACService({ store });
const authService = new AuthenticationService();
const authzService = new AuthorizationService({ rbacService });

// Initialize audit system
const auditStorage = createDatabaseAuditStorage({
  type: 'postgresql',
  connectionString: process.env.DATABASE_URL!,
});

const auditService = createAuditService({
  storage: auditStorage,
  bufferSize: 100,
  flushIntervalMs: 5000,
});

const auditIntegration = createAuditIntegration({
  auditService,
  rbacService,
});

// Apply audit middleware (BEFORE routes)
app.use(auditIntegration.createRequestLoggingMiddleware());

// Authentication routes with audit logging
app.post(
  '/auth/login',
  auditIntegration.createAuthLoggingMiddleware('login'),
  async (req, res) => {
    // Login logic here
    res.json({ success: true });
  }
);

app.post(
  '/auth/logout',
  auditIntegration.createAuthLoggingMiddleware('logout'),
  async (req, res) => {
    // Logout logic here
    res.json({ success: true });
  }
);

// Protected routes with RBAC audit
app.get(
  '/orgs/:orgId/projects',
  authService.requireAuth.bind(authService),
  authzService.requireOrganizationMembership(),
  auditIntegration.createRBACLoggingMiddleware(),
  async (req, res) => {
    // Get projects
    res.json({ projects: [] });
  }
);

app.listen(3000, () => {
  console.log('Server started with audit logging enabled');
});
```

### Manual Event Logging in Routes

```typescript
app.post('/orgs/:orgId/projects', async (req, res) => {
  const { name, description } = req.body;

  // Create project
  const project = await createProject({ name, description });

  // Log creation event
  await auditIntegration.logOrganization({
    type: 'updated',
    userId: req.userId!,
    organizationId: req.params.orgId,
    changes: {
      projects: { added: [project.id] },
    },
    req,
  });

  res.json({ project });
});
```

## RBAC Integration

### Automatic Permission Logging

```typescript
import { OrganizationPermission } from './src/lib/organizations.types';

app.delete(
  '/orgs/:orgId/members/:memberId',
  authService.requireAuth.bind(authService),
  authzService.requireOrganizationPermission(
    OrganizationPermission.MEMBERS_DELETE
  ),
  async (req, res) => {
    // Permission check is automatically logged
    // Delete member
    await deleteMember(req.params.memberId);

    // Log specific member event
    await auditIntegration.logMember({
      type: 'removed',
      userId: req.userId!,
      targetUserId: req.params.memberId,
      organizationId: req.params.orgId,
      req,
    });

    res.json({ success: true });
  }
);
```

### Manual Permission Checks with Logging

```typescript
async function updateProjectSettings(
  userId: string,
  organizationId: string,
  projectId: string,
  settings: any,
  req: Request
) {
  // Check permission
  const hasPermission = await rbacService.checkPermission(
    userId,
    organizationId,
    OrganizationPermission.PROJECTS_WRITE
  );

  if (!hasPermission) {
    // Log denial
    await auditIntegration.logAuthorization({
      type: 'permission_denied',
      userId,
      organizationId,
      permission: OrganizationPermission.PROJECTS_WRITE,
      resourceType: 'project',
      resourceId: projectId,
      reason: 'User lacks PROJECTS_WRITE permission',
      req,
    });

    throw new Error('Permission denied');
  }

  // Log grant
  await auditIntegration.logAuthorization({
    type: 'permission_granted',
    userId,
    organizationId,
    permission: OrganizationPermission.PROJECTS_WRITE,
    resourceType: 'project',
    resourceId: projectId,
    req,
  });

  // Update settings
  // ...
}
```

## Querying Audit Logs

### Basic Queries

```typescript
import { createAuditQueryAPI, EventCategory } from './src/audit';

const queryAPI = createAuditQueryAPI(auditStorage);

// Query recent events for organization
const result = await queryAPI.query(
  {
    organization_id: 'org_123',
    date_from: '2025-10-01T00:00:00Z',
  },
  page: 1,
  pageSize: 50
);

console.log(`Found ${result.total} events`);
console.log(`Page ${result.page} of ${Math.ceil(result.total / result.page_size)}`);
result.events.forEach(event => {
  console.log(`${event.timestamp}: ${event.event_type}`);
});
```

### Advanced Queries with Aggregations

```typescript
const advancedResult = await queryAPI.queryAdvanced({
  organization_id: 'org_123',
  categories: [EventCategory.SECURITY, EventCategory.AUTHENTICATION],
  severity: EventSeverity.WARNING,
  date_from: '2025-10-01T00:00:00Z',
  search: 'failed login',
  include_aggregations: true,
});

if (advancedResult.aggregations) {
  console.log('Event breakdown by category:');
  Object.entries(advancedResult.aggregations.by_category).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log(`Error rate: ${(advancedResult.aggregations.error_rate * 100).toFixed(2)}%`);
}
```

### Time-Series Analysis

```typescript
const timeSeries = await queryAPI.getTimeSeries(
  {
    organization_id: 'org_123',
    categories: [EventCategory.AUTHENTICATION],
    date_from: '2025-10-01T00:00:00Z',
  },
  'day'
);

console.log('Daily authentication events:');
timeSeries.forEach(point => {
  console.log(`${point.timestamp}: ${point.count} events`);
});
```

### Security Anomaly Detection

```typescript
const anomalies = await queryAPI.detectSecurityAnomalies(
  'org_123',
  lookbackHours: 24
);

if (anomalies.length > 0) {
  console.log(`⚠️  Detected ${anomalies.length} security anomalies:`);
  anomalies.forEach(anomaly => {
    console.log(`  ${anomaly.type} (${anomaly.severity}): ${anomaly.description}`);
    console.log(`    ${anomaly.event_count} events from ${anomaly.first_seen} to ${anomaly.last_seen}`);
  });
}
```

## Retention Policies

### Initialize Default Policies

```typescript
import { createRetentionPolicyService, DEFAULT_RETENTION_POLICIES } from './src/audit';

const retentionService = createRetentionPolicyService({
  type: 'postgresql',
  connectionString: process.env.DATABASE_URL!,
});

// SOC2 compliance (7 years)
await retentionService.initializeDefaultPolicies('org_123', 'soc2');

// GDPR compliance (90 days auth, 3 years other)
await retentionService.initializeDefaultPolicies('org_456', 'gdpr');

// HIPAA compliance (6 years)
await retentionService.initializeDefaultPolicies('org_789', 'hipaa');
```

### Create Custom Policies

```typescript
import { EventCategory } from './src/audit';

// Short retention for authentication logs
await retentionService.createPolicy({
  organization_id: 'org_123',
  category: EventCategory.AUTHENTICATION,
  retention_days: 90,
  enabled: true,
  legal_hold: false,
  description: 'GDPR compliance - 90 day auth log retention',
});

// Long retention for compliance events
await retentionService.createPolicy({
  organization_id: 'org_123',
  category: EventCategory.COMPLIANCE,
  retention_days: 2555, // 7 years
  enabled: true,
  legal_hold: false,
  description: 'SOC2 compliance - 7 year retention',
});
```

### Execute Retention Policies

```typescript
// Dry run to see what would be deleted
const dryRun = await retentionService.executeRetentionPolicies(true);
console.log(`Would delete ${dryRun.deleted_count} events`);

// Execute for real
const result = await retentionService.executeRetentionPolicies(false);
console.log(`Deleted ${result.deleted_count} events`);
console.log(`Archived ${result.archived_count} events`);
console.log(`Protected ${result.protected_count} events (legal hold)`);

if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}
```

### Legal Hold

```typescript
// Enable legal hold (prevents all deletion)
await retentionService.setLegalHold('org_123', true);

// Execute policies (nothing will be deleted)
const result = await retentionService.executeRetentionPolicies(false);
console.log(`Protected ${result.protected_count} events under legal hold`);

// Disable legal hold
await retentionService.setLegalHold('org_123', false);
```

### Automated Execution

```typescript
import { CronJob } from 'cron';

// Run daily at 2 AM
const job = new CronJob('0 2 * * *', async () => {
  const result = await retentionService.executeRetentionPolicies(false);
  console.log('Retention policies executed:', result);
});

job.start();
```

## Compliance Reporting

### Generate SOC2 Report

```typescript
const report = await queryAPI.generateComplianceReport({
  type: 'soc2',
  organization_id: 'org_123',
  date_from: '2024-01-01T00:00:00Z',
  date_to: '2024-12-31T23:59:59Z',
  include_events: false, // Summary only
});

console.log('SOC2 Compliance Report');
console.log(`Period: ${report.period.from} to ${report.period.to}`);
console.log(`Total Events: ${report.summary.total_events}`);
console.log(`Error Rate: ${(report.summary.error_rate * 100).toFixed(2)}%`);
```

### Generate GDPR Data Export

```typescript
const gdprReport = await queryAPI.generateComplianceReport({
  type: 'gdpr',
  organization_id: 'org_123',
  date_from: '2025-01-01T00:00:00Z',
  date_to: '2025-12-31T23:59:59Z',
  categories: [EventCategory.AUTHENTICATION, EventCategory.COMPLIANCE],
  include_events: true, // Include full event details
  format: 'json',
});

// Save to file for data subject request
fs.writeFileSync('gdpr-export.json', JSON.stringify(gdprReport, null, 2));
```

## Best Practices

### 1. Always Log Critical Events

```typescript
// Authentication
await auditIntegration.logAuthentication({ type: 'login_success', ... });
await auditIntegration.logAuthentication({ type: 'login_failure', ... });

// Authorization
await auditIntegration.logAuthorization({ type: 'permission_denied', ... });

// Security
await auditIntegration.logSecurity({ type: 'brute_force', ... });
```

### 2. Use Middleware for Automatic Logging

```typescript
// Better than manual logging in every route
app.use(auditIntegration.createRequestLoggingMiddleware());
app.post('/auth/login', auditIntegration.createAuthLoggingMiddleware('login'));
```

### 3. Include Request Context

```typescript
await auditService.log(
  { ...eventData },
  { request: req } // Automatically extracts IP, user agent, etc.
);
```

### 4. Use Type-Safe Event Types

```typescript
import type { AuthLoginSuccessEvent } from './src/audit';

const event: AuthLoginSuccessEvent = {
  event_type: 'auth.login.success', // TypeScript validates this
  category: EventCategory.AUTHENTICATION,
  // ... TypeScript ensures all required fields
};
```

### 5. Handle Errors Gracefully

```typescript
try {
  await auditService.log({ ...eventData });
} catch (error) {
  // Audit logging should NEVER block the main operation
  console.error('Audit logging failed:', error);
  // Continue with the operation
}
```

### 6. Monitor Audit System Health

```typescript
const stats = auditService.getStats();

console.log('Audit System Health:');
console.log(`  Events logged: ${stats.eventsLogged}`);
console.log(`  Events flushed: ${stats.eventsFlushed}`);
console.log(`  Flush failures: ${stats.flushFailures}`);
console.log(`  Buffer size: ${stats.bufferSize} / ${stats.bufferCapacity}`);

// Alert if buffer is consistently full
if (stats.bufferSize > stats.bufferCapacity * 0.8) {
  console.warn('⚠️  Audit buffer is > 80% full, consider tuning');
}
```

### 7. Regular Retention Policy Execution

```typescript
// Schedule daily execution
const job = new CronJob('0 2 * * *', async () => {
  await retentionService.executeRetentionPolicies(false);
});
job.start();
```

### 8. Security Anomaly Monitoring

```typescript
// Check for anomalies every hour
const monitoringJob = new CronJob('0 * * * *', async () => {
  const anomalies = await queryAPI.detectSecurityAnomalies('org_123', 24);

  if (anomalies.length > 0) {
    // Alert security team
    await sendSecurityAlert(anomalies);
  }
});
monitoringJob.start();
```

## Performance Tips

1. **Use Buffering**: Set appropriate `bufferSize` (default: 100)
2. **Async Logging**: Never block main operation for audit logging
3. **Selective Categories**: Disable noisy categories if not needed
4. **Cache Query Results**: Use built-in caching for repeated queries
5. **Partition Tables**: PostgreSQL partitioning enabled by default
6. **Index Usage**: 13 indexes optimized for common query patterns

## Troubleshooting

### Slow Audit Writes

```typescript
// Increase buffer size
const auditService = createAuditService({
  storage,
  bufferSize: 200, // Larger batches
  flushIntervalMs: 10000, // Less frequent flushes
});
```

### Missing Events

```typescript
// Ensure graceful shutdown
process.on('SIGTERM', async () => {
  await auditService.flush(); // Flush buffer before exit
  await auditService.shutdown();
  process.exit(0);
});
```

### Query Performance

```typescript
// Always include timestamp filter for partition pruning
const result = await queryAPI.query({
  organization_id: 'org_123',
  date_from: '2025-10-01T00:00:00Z', // ← Required for good performance
});
```

## Next Steps

- **Integration Testing**: Test audit logging in your specific routes
- **Compliance Review**: Verify all required events are logged
- **Performance Tuning**: Adjust buffer sizes and flush intervals
- **Monitoring**: Set up alerts for audit system health
- **Documentation**: Document your organization's audit policies

## Support

- Documentation: `/docs/AUDIT_LOGGING_GUIDE.md`
- Performance Tuning: `/docs/AUDIT_PERFORMANCE_TUNING.md`
- Implementation Details: `/docs/AUDIT_IMPLEMENTATION_SUMMARY.md`
- Migration Guide: `/supabase/migrations/AUDIT_README.md`
