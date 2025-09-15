---
name: deploy-prepare
description: Comprehensive pre-deployment validation and preparation
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL DEPLOYMENT VALIDATION**
Validating entire application, all services, and complete infrastructure for deployment...
{{else}}
**Mode: CHANGED COMPONENTS ONLY**
Focusing on recently modified components. I will:
1. Validate services with recent code changes
2. Check configurations for modified components
3. Test deployment readiness for updated features

To validate the entire deployment, use: `/deploy-prepare --all`
{{/if}}

Prepare application for production deployment with comprehensive validation and safety checks:

## Pre-Deployment Checklist

### 1. Code Validation
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code coverage meets threshold (>80%)
- [ ] No linting errors or warnings
- [ ] Type checking passes
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Bundle size within limits

### 2. Build Verification
```bash
# Production build validation
npm run build:prod
npm run test:build
npm run analyze:bundle

# Verify build outputs
- Check dist/ folder structure
- Validate minification
- Confirm source maps generation
- Verify asset optimization
- Check for build warnings
```

### 3. Configuration Validation
**Environment Variables:**
- Verify all required env vars set
- Confirm production values
- Check secrets are encrypted
- Validate API endpoints
- Confirm feature flags
- Test third-party integrations

### 4. Database Preparation
```sql
-- Migration status check
SELECT * FROM migrations ORDER BY executed_at DESC;

-- Backup verification
BACKUP DATABASE production TO 's3://backups/pre-deploy-backup';

-- Index optimization
ANALYZE TABLE users, orders, products;

-- Connection pool validation
SHOW PROCESSLIST;
```

### 5. Infrastructure Readiness
**Health Checks:**
- Load balancer configuration
- Auto-scaling policies
- SSL certificates valid
- DNS configuration correct
- CDN cache cleared
- Monitoring alerts configured

## Deployment Safety Measures

### Blue-Green Deployment Setup
```yaml
deployment:
  strategy: blue-green
  stages:
    - prepare_green:
        - deploy_to_green_environment
        - run_smoke_tests
        - warm_up_cache
    - switch_traffic:
        - health_check_green
        - switch_load_balancer
        - monitor_metrics
    - cleanup:
        - verify_green_stable
        - keep_blue_as_backup
        - schedule_blue_teardown
```

### Rollback Plan
```javascript
const rollbackPlan = {
  triggers: [
    'Error rate > 5%',
    'Response time > 2s',
    'Memory usage > 90%',
    'Health check failures'
  ],
  steps: [
    'Switch traffic to previous version',
    'Restore database if needed',
    'Clear CDN cache',
    'Notify team',
    'Create incident report'
  ],
  timeLimit: '5 minutes'
};
```

### Feature Flags Configuration
```json
{
  "features": {
    "newPaymentFlow": {
      "enabled": false,
      "rollout": 0,
      "targetGroups": ["beta_testers"]
    },
    "enhancedSearch": {
      "enabled": true,
      "rollout": 10,
      "targetGroups": ["all"]
    }
  }
}
```

## Performance Validation

### Load Testing
```javascript
// K6 load test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1']
  }
};
```

### Resource Requirements
```yaml
resources:
  production:
    replicas: 3
    cpu: 2000m
    memory: 4Gi
    storage: 20Gi
  database:
    connections: 100
    cpu: 4000m
    memory: 16Gi
    storage: 100Gi
```

## Security Validation

### Security Checklist
- [ ] Secrets rotated
- [ ] API keys updated
- [ ] HTTPS enforced
- [ ] CORS configured
- [ ] CSP headers set
- [ ] Rate limiting enabled
- [ ] WAF rules updated
- [ ] DDoS protection active

### Penetration Test Results
```
Last scan: 2024-01-15
Critical: 0
High: 0
Medium: 2 (addressed)
Low: 5 (accepted risk)
Next scan: Pre-production
```

## Monitoring Setup

### Alerts Configuration
```javascript
const alerts = [
  {
    name: 'High Error Rate',
    condition: 'error_rate > 1%',
    duration: '5m',
    severity: 'critical',
    notification: ['pagerduty', 'slack']
  },
  {
    name: 'Slow Response',
    condition: 'p95_latency > 1s',
    duration: '10m',
    severity: 'warning',
    notification: ['slack']
  }
];
```

### Dashboard Preparation
- Application metrics dashboard
- Infrastructure metrics
- Business KPIs
- Error tracking
- User analytics
- Cost monitoring

## Communication Plan

### Deployment Announcement
```markdown
## Deployment Notice

**Version**: 2.1.0
**Date**: 2024-01-20 02:00 UTC
**Duration**: ~30 minutes
**Impact**: No downtime expected

### Changes
- New payment processing system
- Performance improvements
- Bug fixes

### Rollback Window
4 hours post-deployment

### Contact
- Slack: #deployments
- On-call: +1-555-0123
```

### Stakeholder Notifications
- [ ] Engineering team notified
- [ ] Product team informed
- [ ] Customer support briefed
- [ ] Status page updated
- [ ] Customers notified (if needed)

## Final Validation

### Go/No-Go Decision
```
✅ All tests passing
✅ Performance validated
✅ Security cleared
✅ Infrastructure ready
✅ Rollback plan tested
✅ Team available
✅ Monitoring active

DECISION: GO FOR DEPLOYMENT
```

### Post-Deployment Tasks
1. Monitor metrics for 30 minutes
2. Run smoke tests
3. Verify critical user flows
4. Check error rates
5. Validate performance
6. Update documentation
7. Close deployment ticket
8. Schedule retrospective

Perform all pre-deployment checks now, validate readiness, and prepare for safe production deployment.

## Command Completion

✅ `/deploy-prepare $ARGUMENTS` command complete.

Summary: Completed pre-deployment validation with comprehensive checks, safety measures, and rollback plan preparation.