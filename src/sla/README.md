```
# SLA Monitoring and Alerting System

Complete SLA monitoring, metrics collection, alerting, and health check system for Phase 3 Part 4 of the backplane implementation.

## Features

✅ **Real-time SLA Monitoring** - Track response times, error rates, uptime, and custom metrics
✅ **Automated Alerting** - Multi-channel notifications (Email, Slack, PagerDuty, Webhook)
✅ **Metrics Collection** - Automatic HTTP, database, queue, and system metrics
✅ **Health Checks** - Comprehensive component health monitoring
✅ **SLA Reports** - Generate compliance reports for any time period
✅ **Violation Tracking** - Detect and track SLA violations with severity levels
✅ **Anomaly Detection** - Real-time monitoring of critical metrics
✅ **Multi-Tenancy** - Organization-level SLA configurations

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [SLA Monitoring](#sla-monitoring)
- [Alerting System](#alerting-system)
- [Metrics Collection](#metrics-collection)
- [Health Checks](#health-checks)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Integration Guide](#integration-guide)
- [Best Practices](#best-practices)

## Quick Start

### Installation

The SLA system is built into the NOFX control plane. No additional installation required.

### Basic Setup

```typescript
import {
  createSLAMonitoringService,
  createAlertingService,
  createMetricsCollector,
  createHealthCheckService,
  InMemorySLAStorage,
  MetricType,
  AlertChannel,
  SLASeverity,
} from './sla';

// 1. Initialize storage (use database storage in production)
const storage = new InMemorySLAStorage();

// 2. Create SLA monitoring service
const slaService = createSLAMonitoringService({
  storage,
  onViolation: async (violation) => {
    await alertService.sendAlert(violation);
  },
});

// 3. Create alerting service
const alertService = createAlertingService({
  storage,
  defaultEmail: 'ops@company.com',
});

// 4. Create metrics collector
const metricsCollector = createMetricsCollector({
  slaService,
  collectSystemMetrics: true,
  systemMetricsInterval: 60, // seconds
});

// 5. Create health check service
const healthService = createHealthCheckService({
  slaService,
});

// 6. Initialize default SLA thresholds
await slaService.initializeDefaultThresholds();
```

### Express Integration

```typescript
import express from 'express';

const app = express();

// Automatic request metrics collection
app.use(metricsCollector.createRequestMetricsMiddleware());

// Health check endpoints
app.get('/health', healthService.createHealthEndpoint());
app.get('/health/ready', healthService.createReadinessEndpoint());
app.get('/health/live', healthService.createLivenessEndpoint());

// Manual metric recording
app.post('/some-operation', async (req, res) => {
  const startTime = Date.now();

  try {
    // Perform operation
    const result = await performOperation();

    // Record success
    await slaService.recordMetric({
      metric: MetricType.RESPONSE_TIME,
      value: Date.now() - startTime,
      timestamp: new Date(),
    });

    res.json({ success: true, result });
  } catch (error) {
    // Record error
    await slaService.recordMetric({
      metric: MetricType.ERROR_RATE,
      value: 1,
      timestamp: new Date(),
    });

    res.status(500).json({ error: 'Operation failed' });
  }
});
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   SLA Monitoring System                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  SLA Monitoring  │──────│  Alert Service   │        │
│  │     Service      │      │                  │        │
│  └────────┬─────────┘      └────────┬─────────┘        │
│           │                         │                   │
│           │  ┌──────────────────┐  │                   │
│           └──│  Metrics         │──┘                   │
│              │  Collector       │                      │
│              └────────┬─────────┘                      │
│                       │                                │
│              ┌────────▼─────────┐                      │
│              │  Health Check    │                      │
│              │     Service      │                      │
│              └──────────────────┘                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Metric Collection** - Metrics are collected from various sources
2. **Buffering** - Metrics are buffered for batch writing
3. **Threshold Evaluation** - Critical metrics checked in real-time
4. **Violation Detection** - Thresholds compared against targets
5. **Alert Triggering** - Violations trigger configured alerts
6. **Notification Delivery** - Alerts sent through channels
7. **Health Monitoring** - Continuous component health checks

## SLA Monitoring

### Default Thresholds

The system comes with production-grade default thresholds:

| Metric | Target | Warning | Critical | Window |
|--------|--------|---------|----------|--------|
| Response Time | 200ms | 500ms | 1000ms | 5 min |
| Success Rate | 99.9% | 99% | 95% | 5 min |
| Error Rate | 0.1% | 1% | 5% | 5 min |
| Uptime | 99.99% | 99.9% | 99% | 1 hour |
| DB Query Time | 50ms | 100ms | 500ms | 5 min |
| Queue Time | 1s | 5s | 30s | 5 min |

### Recording Metrics

```typescript
// Simple metric recording
await slaService.recordMetric({
  metric: MetricType.RESPONSE_TIME,
  value: 145,
  timestamp: new Date(),
  organization_id: 'org_123', // Optional
  labels: {
    endpoint: '/api/users',
    method: 'GET',
  },
});

// Batch recording
await slaService.recordMetricsBatch([
  { metric: MetricType.RESPONSE_TIME, value: 100, timestamp: new Date() },
  { metric: MetricType.SUCCESS_RATE, value: 1, timestamp: new Date() },
  { metric: MetricType.DB_QUERY_TIME, value: 25, timestamp: new Date() },
]);
```

### Custom Thresholds

```typescript
// Add custom threshold
await slaService.storage.saveThreshold({
  metric: MetricType.RESPONSE_TIME,
  target: 100,
  warning_threshold: 250,
  critical_threshold: 500,
  window_seconds: 300,
  organization_id: 'org_123',
  enabled: true,
});
```

### SLA Reports

```typescript
// Generate compliance report
const report = await slaService.generateReport(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
  'org_123' // Optional
);

console.log(`Overall Compliance: ${(report.compliance_rate * 100).toFixed(2)}%`);
console.log(`Total Violations: ${report.total_violations}`);
console.log('Metric Details:', report.metrics);
```

## Alerting System

### Creating Alerts

```typescript
// Email alert
await alertService.createAlert({
  name: 'Critical Response Time Alert',
  description: 'Notifies when API response time exceeds critical threshold',
  metric: MetricType.RESPONSE_TIME,
  severities: [SLASeverity.CRITICAL, SLASeverity.EMERGENCY],
  channels: [AlertChannel.EMAIL],
  channel_config: {
    email: {
      to: ['oncall@company.com', 'cto@company.com'],
      cc: ['team@company.com'],
    },
  },
  enabled: true,
  cooldown_seconds: 300, // 5 minutes between alerts
});

// Slack alert
await alertService.createAlert({
  name: 'High Error Rate Warning',
  metric: MetricType.ERROR_RATE,
  severities: [SLASeverity.WARNING, SLASeverity.CRITICAL],
  channels: [AlertChannel.SLACK],
  channel_config: {
    slack: {
      webhook_url: process.env.SLACK_WEBHOOK_URL!,
      channel: '#alerts',
      mentions: ['@oncall', '@devops'],
    },
  },
  enabled: true,
});

// Multi-channel alert
await alertService.createAlert({
  name: 'System Down Alert',
  metric: MetricType.UPTIME,
  severities: [SLASeverity.CRITICAL, SLASeverity.EMERGENCY],
  channels: [AlertChannel.EMAIL, AlertChannel.SLACK, AlertChannel.PAGERDUTY],
  channel_config: {
    email: { to: ['oncall@company.com'] },
    slack: { webhook_url: process.env.SLACK_WEBHOOK_URL! },
    pagerduty: { service_key: process.env.PAGERDUTY_KEY! },
  },
  enabled: true,
});
```

### Alert Channels

#### Email
```typescript
channel_config: {
  email: {
    to: ['ops@company.com'],
    cc: ['team@company.com'],
    template: 'custom_template', // Optional
  },
}
```

#### Slack
```typescript
channel_config: {
  slack: {
    webhook_url: 'https://hooks.slack.com/services/...',
    channel: '#alerts',
    mentions: ['@oncall', '@team'],
  },
}
```

#### Webhook
```typescript
channel_config: {
  webhook: {
    url: 'https://api.example.com/alerts',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer token',
      'Content-Type': 'application/json',
    },
  },
}
```

#### PagerDuty
```typescript
channel_config: {
  pagerduty: {
    service_key: 'your-service-key',
    escalation_policy: 'P123ABC',
  },
}
```

### Testing Alerts

```typescript
// Test alert configuration
await alertService.testAlert('alert_id_123');
```

## Metrics Collection

### Automatic Collection

```typescript
// HTTP request metrics (automatic)
app.use(metricsCollector.createRequestMetricsMiddleware());

// System metrics (automatic every 60 seconds)
const collector = createMetricsCollector({
  slaService,
  collectSystemMetrics: true,
  systemMetricsInterval: 60,
});
```

### Manual Collection

```typescript
// Database query timing
await metricsCollector.recordQueryTime(
  42, // duration in ms
  'SELECT', // query type
  'org_123' // organization ID
);

// Queue processing time
await metricsCollector.recordQueueTime(
  'codegen', // job type
  1234, // duration in ms
  'org_123'
);

// Handler execution time
await metricsCollector.recordHandlerTime(
  'workspace:write', // handler name
  567, // duration in ms
  'org_123'
);

// Git operation time
await metricsCollector.recordGitTime(
  'clone', // operation
  3456, // duration in ms
  'org_123'
);
```

### Timing Wrapper

```typescript
// Wrap function with automatic timing
const result = await metricsCollector.withTiming(
  MetricType.HANDLER_TIME,
  async () => {
    return await performExpensiveOperation();
  },
  { handler: 'expensive_operation' },
  'org_123'
);
```

### Decorator Pattern

```typescript
import { Timed } from './sla';

class MyService {
  metricsCollector: MetricsCollector;

  @Timed(MetricType.HANDLER_TIME)
  async processData(data: any) {
    // Method execution time automatically tracked
    return processedData;
  }
}
```

## Health Checks

### Component Registration

```typescript
import {
  DatabaseHealthChecker,
  RedisHealthChecker,
  StorageHealthChecker,
} from './sla';

// Register built-in checkers
healthService.registerChecker(
  new DatabaseHealthChecker(async () => {
    await db.query('SELECT 1');
  })
);

healthService.registerChecker(
  new RedisHealthChecker(async () => {
    return await redis.ping();
  })
);

// Custom health checker
healthService.registerChecker({
  name: 'ai_provider',
  async check() {
    try {
      await openai.models.list();
      return { status: 'healthy', last_check: new Date() };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        last_check: new Date(),
      };
    }
  },
});
```

### Performing Checks

```typescript
// Full health check
const status = await healthService.check();

// Quick check (cached)
const cached = healthService.getCachedStatus();

// Check specific component
const dbHealth = await healthService.checkComponent('database');
```

### Express Endpoints

```typescript
// GET /health
// Returns comprehensive health status
app.get('/health', healthService.createHealthEndpoint());

// GET /health/ready
// Kubernetes readiness probe
app.get('/health/ready', healthService.createReadinessEndpoint());

// GET /health/live
// Kubernetes liveness probe
app.get('/health/live', healthService.createLivenessEndpoint());
```

### Health Status Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "components": {
    "database": {
      "status": "healthy",
      "response_time_ms": 12,
      "last_check": "2025-01-15T10:30:00Z"
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 3,
      "last_check": "2025-01-15T10:30:00Z"
    },
    "storage": {
      "status": "healthy",
      "response_time_ms": 8,
      "last_check": "2025-01-15T10:30:00Z"
    }
  },
  "sla_status": "ok",
  "active_violations": 0,
  "uptime_seconds": 3600,
  "version": "1.0.0"
}
```

## Configuration

### Default Configuration

```typescript
const config = {
  // SLA thresholds
  default_thresholds: [...], // See DEFAULT_THRESHOLDS

  // Data retention
  retention_days: 90,

  // Collection settings
  collection_interval_seconds: 60,

  // Health checks
  enable_health_checks: true,
  health_check_interval_seconds: 30,
};
```

### Environment Variables

```bash
# Alert channels
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_SERVICE_KEY=your-key
ALERT_EMAIL_TO=ops@company.com

# Thresholds
SLA_RESPONSE_TIME_TARGET=200
SLA_RESPONSE_TIME_WARNING=500
SLA_RESPONSE_TIME_CRITICAL=1000

# Collection
SLA_COLLECTION_INTERVAL=60
SLA_RETENTION_DAYS=90
```

## Integration Guide

### Complete Express Example

```typescript
import express from 'express';
import { initializeSLASystem } from './sla-setup';

const app = express();

// Initialize SLA system
const { slaService, alertService, metricsCollector, healthService } =
  await initializeSLASystem();

// Apply metrics middleware globally
app.use(metricsCollector.createRequestMetricsMiddleware());

// Health check endpoints
app.get('/health', healthService.createHealthEndpoint());
app.get('/health/ready', healthService.createReadinessEndpoint());
app.get('/health/live', healthService.createLivenessEndpoint());

// Your API endpoints
app.post('/api/runs', async (req, res) => {
  const startTime = Date.now();

  try {
    const run = await runManager.createRun(req.body);

    // Record handler time
    await metricsCollector.recordHandlerTime(
      'create_run',
      Date.now() - startTime,
      req.organizationId
    );

    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const server = app.listen(3000, () => {
  console.log('Server started on port 3000');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await slaService.shutdown();
  metricsCollector.shutdown();
  server.close();
});
```

### Database Integration

```typescript
// Wrap database queries with timing
const originalQuery = db.query.bind(db);
db.query = async (sql: string, params?: any[]) => {
  const startTime = Date.now();

  try {
    const result = await originalQuery(sql, params);

    await metricsCollector.recordQueryTime(
      Date.now() - startTime,
      sql.split(' ')[0] // Query type: SELECT, INSERT, etc.
    );

    return result;
  } catch (error) {
    await metricsCollector.recordQueryTime(
      Date.now() - startTime,
      'ERROR'
    );
    throw error;
  }
};
```

## Best Practices

### 1. Use Appropriate Metric Types

```typescript
// ✅ Good - specific metric types
await slaService.recordMetric({
  metric: MetricType.DB_QUERY_TIME,
  value: duration,
});

// ❌ Bad - using generic metric for everything
await slaService.recordMetric({
  metric: MetricType.RESPONSE_TIME,
  value: duration, // This was a DB query!
});
```

### 2. Add Meaningful Labels

```typescript
// ✅ Good - labels provide context
await slaService.recordMetric({
  metric: MetricType.HANDLER_TIME,
  value: duration,
  labels: {
    handler: 'codegen',
    model: 'gpt-4',
    project_id: 'p_123',
  },
});

// ❌ Bad - no context
await slaService.recordMetric({
  metric: MetricType.HANDLER_TIME,
  value: duration,
});
```

### 3. Set Appropriate Cooldowns

```typescript
// ✅ Good - cooldown prevents alert spam
cooldown_seconds: 300, // 5 minutes

// ❌ Bad - no cooldown, alerts flood
cooldown_seconds: 0,
```

### 4. Use Multiple Channels for Critical Alerts

```typescript
// ✅ Good - redundant notification
channels: [
  AlertChannel.EMAIL,
  AlertChannel.SLACK,
  AlertChannel.PAGERDUTY
],

// ❌ Bad - single point of failure
channels: [AlertChannel.EMAIL],
```

### 5. Monitor All Key Components

```typescript
// ✅ Good - comprehensive monitoring
healthService.registerChecker(new DatabaseHealthChecker(...));
healthService.registerChecker(new RedisHealthChecker(...));
healthService.registerChecker(new StorageHealthChecker(...));
healthService.registerChecker(new AIProviderChecker(...));

// ❌ Bad - incomplete monitoring
healthService.registerChecker(new DatabaseHealthChecker(...));
// Missing other critical components
```

## Troubleshooting

### High Memory Usage

If you notice high memory usage from metrics:

1. Reduce retention period
2. Increase flush interval
3. Use database storage instead of in-memory
4. Add sampling for high-frequency metrics

### Missing Metrics

If metrics aren't being recorded:

1. Check that middleware is applied
2. Verify slaService.flush() is called
3. Check for errors in logs
4. Ensure storage is configured correctly

### Alerts Not Sending

If alerts aren't being delivered:

1. Verify alert configuration is enabled
2. Check cooldown period
3. Test channel configuration
4. Review notification history for errors

## Next Steps

- [Database Storage Adapter Guide](./storage/README.md)
- [Custom Alert Channels](./AlertingService.ts)
- [Advanced Metrics](./MetricsCollector.ts)
- [Compliance Reporting](./SLAMonitoringService.ts)

## Support

For issues or questions:
- Check the [NOFX Documentation](https://docs.nofx.com)
- Review [Troubleshooting Guide](#troubleshooting)
- Contact the development team

---

**Phase 3 Part 4: SLA Monitoring and Alerting** - Complete ✅
```
