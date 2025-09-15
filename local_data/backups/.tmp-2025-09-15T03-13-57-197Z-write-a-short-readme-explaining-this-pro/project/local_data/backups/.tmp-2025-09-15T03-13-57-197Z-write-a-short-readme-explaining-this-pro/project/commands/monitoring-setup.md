---
name: monitoring-setup
description: Set up comprehensive observability with metrics, logging, tracing, and alerting
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL OBSERVABILITY STACK**
Setting up monitoring for all services, infrastructure, and business metrics...
{{else}}
**Mode: TARGETED MONITORING**
Focusing on recently added or modified components. I will:
1. Add monitoring to new services or features
2. Instrument recently modified code paths
3. Set up alerts for recent deployments

To set up monitoring for the entire system, use: `/monitoring-setup --all`
{{/if}}

Implement comprehensive monitoring and observability for production systems:

## Observability Pillars

### 1. Metrics Collection

**Application Metrics:**
```javascript
// Custom metrics implementation
const prometheus = require('prom-client');

// Request metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Business metrics
const orderCounter = new prometheus.Counter({
  name: 'orders_total',
  help: 'Total number of orders',
  labelNames: ['status', 'payment_method']
});

// Resource metrics
const memoryGauge = new prometheus.Gauge({
  name: 'app_memory_usage_bytes',
  help: 'Application memory usage'
});

// Error metrics
const errorCounter = new prometheus.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity', 'component']
});
```

**Infrastructure Metrics:**
- CPU utilization and load average
- Memory usage and swap
- Disk I/O and space
- Network throughput and errors
- Container metrics (if applicable)
- Database connection pools
- Cache hit rates

### 2. Structured Logging

**Log Format Standard:**
```javascript
class StructuredLogger {
  log(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: process.env.SERVICE_NAME,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
      requestId: context.requestId,
      userId: context.userId,
      correlationId: context.correlationId,
      ...context
    };
    
    console.log(JSON.stringify(entry));
  }
  
  error(message, error, context = {}) {
    this.log('error', message, {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    });
  }
}
```

**Log Aggregation Pipeline:**
```yaml
# Filebeat configuration
filebeat.inputs:
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'
    processors:
      - add_docker_metadata:
      - decode_json_fields:
          fields: ["message"]
    
output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "logs-%{+yyyy.MM.dd}"
```

### 3. Distributed Tracing

**OpenTelemetry Setup:**
```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

// Initialize tracing
const provider = new NodeTracerProvider({
  resource: {
    attributes: {
      'service.name': 'api-service',
      'service.version': '1.0.0',
      'deployment.environment': 'production'
    }
  }
});

// Configure exporter
const jaegerExporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces'
});

// Add spans for operations
function traceOperation(name, fn) {
  const span = tracer.startSpan(name);
  span.setAttributes({
    'operation.type': 'database',
    'db.system': 'postgresql'
  });
  
  try {
    const result = fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ 
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    throw error;
  } finally {
    span.end();
  }
}
```

### 4. Health Checks

**Comprehensive Health Endpoints:**
```javascript
const healthChecks = {
  '/health/live': async () => ({
    status: 'UP',
    timestamp: new Date().toISOString()
  }),
  
  '/health/ready': async () => {
    const checks = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkExternalAPIs()
    ]);
    
    return {
      status: checks.every(c => c.healthy) ? 'UP' : 'DOWN',
      checks: checks.map(c => ({
        name: c.name,
        status: c.healthy ? 'UP' : 'DOWN',
        responseTime: c.responseTime,
        message: c.message
      }))
    };
  },
  
  '/health/startup': async () => {
    // Check if app is fully initialized
    return {
      status: isInitialized ? 'UP' : 'DOWN',
      initialized: initChecks
    };
  }
};
```

## Alert Configuration

### Alert Rules
```yaml
# Prometheus alert rules
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"
      
      - alert: SlowResponse
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow API responses"
          description: "95th percentile latency is {{ $value }}s"
      
      - alert: MemoryLeak
        expr: rate(app_memory_usage_bytes[30m]) > 0
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Potential memory leak"
          description: "Memory growing at {{ $value }} bytes/sec"
```

### Notification Channels
```javascript
const notificationChannels = {
  slack: {
    webhook: process.env.SLACK_WEBHOOK,
    channel: '#alerts',
    username: 'Monitoring Bot',
    priorities: ['critical', 'warning']
  },
  pagerduty: {
    apiKey: process.env.PAGERDUTY_KEY,
    serviceId: process.env.PAGERDUTY_SERVICE,
    priorities: ['critical']
  },
  email: {
    smtp: process.env.SMTP_SERVER,
    recipients: ['oncall@example.com'],
    priorities: ['critical']
  }
};
```

## Dashboard Configuration

### Grafana Dashboards
```json
{
  "dashboard": {
    "title": "Application Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [{
          "expr": "rate(http_requests_total[5m])"
        }]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [{
          "expr": "rate(errors_total[5m])"
        }]
      },
      {
        "title": "Response Time (p50, p95, p99)",
        "type": "graph",
        "targets": [
          {"expr": "histogram_quantile(0.5, http_request_duration_seconds)"},
          {"expr": "histogram_quantile(0.95, http_request_duration_seconds)"},
          {"expr": "histogram_quantile(0.99, http_request_duration_seconds)"}
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [{
          "expr": "active_users"
        }]
      }
    ]
  }
}
```

### Real User Monitoring (RUM)
```javascript
// Browser monitoring
window.addEventListener('load', () => {
  const perfData = {
    navigation: performance.getEntriesByType('navigation')[0],
    paint: performance.getEntriesByType('paint'),
    resources: performance.getEntriesByType('resource')
  };
  
  // Send to monitoring service
  sendMetrics({
    pageLoad: perfData.navigation.loadEventEnd - perfData.navigation.fetchStart,
    ttfb: perfData.navigation.responseStart - perfData.navigation.fetchStart,
    fcp: perfData.paint.find(p => p.name === 'first-contentful-paint')?.startTime,
    resources: perfData.resources.length,
    userAgent: navigator.userAgent,
    url: window.location.href
  });
});
```

## SLI/SLO Definition

### Service Level Indicators
```yaml
slis:
  availability:
    metric: "sum(up) / count(up)"
    threshold: 0.999
  
  latency:
    metric: "histogram_quantile(0.95, http_request_duration_seconds)"
    threshold: 0.5
  
  error_rate:
    metric: "rate(errors_total[5m])"
    threshold: 0.001
  
  throughput:
    metric: "rate(http_requests_total[1m])"
    threshold: 1000
```

### Error Budget Tracking
```javascript
const errorBudget = {
  monthly_budget: 43.2, // minutes (99.9% SLO)
  consumed: 12.3,
  remaining: 30.9,
  burn_rate: 0.28,
  forecast: "Within budget",
  alerts: {
    "50%_consumed": false,
    "75%_consumed": false,
    "90%_consumed": false
  }
};
```

## Incident Response

### Runbook Integration
```markdown
## Alert: HighErrorRate

### Dashboard
[Link to Grafana Dashboard]

### Query to Investigate
```sql
SELECT error_type, COUNT(*), 
       MAX(created_at) as last_seen
FROM errors
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_type
ORDER BY COUNT(*) DESC;
```

### Common Causes
1. Database connection issues
2. External API timeout
3. Memory exhaustion
4. Deployment issues

### Resolution Steps
1. Check recent deployments
2. Verify database connectivity
3. Check external service status
4. Review error logs
5. Scale if needed
6. Rollback if necessary
```

## Cost Optimization

### Monitoring Cost Management
- Set retention policies for metrics/logs
- Use sampling for high-volume data
- Aggregate before storage
- Use appropriate storage tiers
- Monitor monitoring costs

Implement comprehensive monitoring now with metrics, logging, tracing, and alerting for complete observability.

## Command Completion

✅ `/monitoring-setup $ARGUMENTS` command complete.

Summary: Implemented comprehensive observability stack with metrics collection, structured logging, distributed tracing, and intelligent alerting.