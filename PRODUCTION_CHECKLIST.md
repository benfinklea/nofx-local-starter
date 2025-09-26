# Production Deployment Checklist

## Pre-Deployment Verification

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation successful (`npm run typecheck`)
- [ ] Linting passed (`npm run lint`)
- [ ] Security audit clean (`npm audit`)
- [ ] No hardcoded secrets in code
- [ ] Environment-specific configs externalized

### Worker Specific
- [ ] Health check endpoint tested
- [ ] Queue error handling verified
- [ ] Retry logic tested
- [ ] DLQ processing confirmed
- [ ] Timeout handling verified
- [ ] Memory leak testing completed
- [ ] Graceful shutdown implemented

### Documentation
- [ ] README updated
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Runbook created
- [ ] Troubleshooting guide updated
- [ ] Architecture diagrams current

## Infrastructure Setup

### Redis (Upstash Recommended)
- [ ] Redis instance provisioned
- [ ] Connection string tested
- [ ] SSL/TLS configured
- [ ] Persistence enabled (AOF/RDB)
- [ ] Maxmemory policy set (`allkeys-lru` recommended)
- [ ] Memory limits configured
- [ ] Monitoring enabled
- [ ] Backup schedule configured

### Database (Supabase)
- [ ] Production database provisioned
- [ ] Connection pooling configured
- [ ] SSL required for connections
- [ ] Read replicas configured (if needed)
- [ ] Backup schedule verified
- [ ] Point-in-time recovery enabled

### Container Platform (Railway/Fly.io)
- [ ] Project created
- [ ] Dockerfile tested locally
- [ ] Resource limits defined
  - [ ] CPU: 0.5-1 vCPU per worker
  - [ ] Memory: 512MB-1GB per worker
  - [ ] Disk: 1GB minimum
- [ ] Auto-scaling configured (if applicable)
- [ ] Health checks configured
- [ ] Deployment regions selected

## Environment Configuration

### Required Environment Variables
```env
# ✅ Verify each is set correctly
- [ ] NODE_ENV=production
- [ ] QUEUE_DRIVER=redis
- [ ] REDIS_URL=<production-redis-url>
- [ ] DATABASE_URL=<production-postgres-url>
- [ ] SUPABASE_URL=<production-supabase-url>
- [ ] SUPABASE_SERVICE_ROLE_KEY=<service-key>
- [ ] WORKER_CONCURRENCY=<2-4>
- [ ] STEP_TIMEOUT_MS=30000
- [ ] LOG_LEVEL=info
- [ ] HEALTH_CHECK_ENABLED=true
- [ ] HEALTH_CHECK_PORT=3001
```

### Optional but Recommended
```env
- [ ] SENTRY_DSN=<error-tracking>
- [ ] DD_API_KEY=<datadog-monitoring>
- [ ] SLACK_WEBHOOK=<alerting>
- [ ] MAX_RETRY_ATTEMPTS=3
- [ ] RETRY_BACKOFF_MS=5000
```

### Secrets Management
- [ ] Secrets stored in platform vault
- [ ] No secrets in git history
- [ ] Rotation schedule defined
- [ ] Access controls configured

## Deployment Process

### Initial Deployment
- [ ] Create feature branch for deployment
- [ ] Update version in package.json
- [ ] Run full test suite
- [ ] Build Docker image locally
- [ ] Test with production-like data
- [ ] Deploy to staging environment
- [ ] Run smoke tests on staging
- [ ] Get approval for production
- [ ] Deploy to production (blue-green if possible)
- [ ] Verify health checks passing

### Deployment Validation
- [ ] Health endpoint responding (GET /health)
- [ ] Metrics endpoint working (GET /metrics)
- [ ] Queue processing verified
- [ ] Sample job processed successfully
- [ ] Error handling tested
- [ ] Logs aggregating properly

## Monitoring Setup

### Metrics
- [ ] Worker uptime tracking
- [ ] Queue depth monitoring
- [ ] Processing rate metrics
- [ ] Error rate tracking
- [ ] Memory usage monitoring
- [ ] CPU utilization tracking
- [ ] Response time distribution

### Alerts
- [ ] Worker down alert (< 1 min)
- [ ] Queue depth > 1000 jobs
- [ ] Error rate > 5%
- [ ] Memory usage > 80%
- [ ] Database connection failures
- [ ] Redis connection failures
- [ ] Processing rate drop > 50%

### Logging
- [ ] Structured logging enabled
- [ ] Log aggregation configured
- [ ] Log retention policy set (30 days)
- [ ] Error tracking integration
- [ ] Correlation IDs implemented
- [ ] PII redaction verified

### Dashboards
- [ ] Grafana dashboard imported
- [ ] Custom metrics dashboard
- [ ] Business metrics tracking
- [ ] SLA compliance monitoring

## Security Checklist

### Access Control
- [ ] Service accounts created
- [ ] Least privilege principle applied
- [ ] API keys rotated
- [ ] Database users restricted
- [ ] Network policies configured

### Data Protection
- [ ] Encryption at rest enabled
- [ ] Encryption in transit (TLS)
- [ ] PII handling reviewed
- [ ] GDPR compliance verified
- [ ] Data retention policies set

### Security Scanning
- [ ] Dependency vulnerabilities scanned
- [ ] Docker image scanned
- [ ] SAST analysis completed
- [ ] Penetration testing (if required)

## Performance Validation

### Load Testing
- [ ] Baseline performance established
- [ ] Peak load tested (2x expected)
- [ ] Sustained load tested (24 hours)
- [ ] Memory leak testing (48 hours)
- [ ] Concurrent processing verified

### Performance Targets
- [ ] Job processing: < 100ms overhead
- [ ] Queue latency: < 500ms
- [ ] Error rate: < 1%
- [ ] Availability: > 99.9%
- [ ] Recovery time: < 5 minutes

## Rollback Plan

### Preparation
- [ ] Previous version tagged
- [ ] Database migration reversible
- [ ] Feature flags configured
- [ ] Rollback script tested
- [ ] Communication plan ready

### Rollback Triggers
- [ ] Error rate > 10%
- [ ] Critical functionality broken
- [ ] Performance degradation > 50%
- [ ] Security vulnerability discovered
- [ ] Data corruption detected

### Rollback Process
1. [ ] Notify team via Slack
2. [ ] Stop new deployments
3. [ ] Execute rollback script
4. [ ] Verify previous version running
5. [ ] Run smoke tests
6. [ ] Monitor for 30 minutes
7. [ ] Post-mortem scheduled

## Post-Deployment

### Immediate (First Hour)
- [ ] Monitor error rates
- [ ] Check queue processing
- [ ] Verify all health checks
- [ ] Review performance metrics
- [ ] Check customer reports
- [ ] Team standby confirmed

### First 24 Hours
- [ ] Performance baseline verified
- [ ] No memory leaks detected
- [ ] Error patterns analyzed
- [ ] Scaling behavior validated
- [ ] Cost projections confirmed

### First Week
- [ ] Weekly metrics reviewed
- [ ] Optimization opportunities identified
- [ ] Documentation gaps addressed
- [ ] Team feedback collected
- [ ] Runbook updated

## Sign-offs

### Technical
- [ ] Engineering Lead: _________________ Date: _______
- [ ] DevOps Lead: _____________________ Date: _______
- [ ] Security Team: ___________________ Date: _______

### Business
- [ ] Product Owner: ___________________ Date: _______
- [ ] Operations Manager: ______________ Date: _______

## Emergency Contacts

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| On-call Engineer | | | | |
| DevOps Lead | | | | |
| Product Owner | | | | |
| Database Admin | | | | |
| Security Team | | | | |

## Useful Commands

```bash
# Check worker health
curl https://worker.example.com/health

# View recent logs
railway logs --service worker --tail 100

# Scale workers
railway scale --service worker --replicas 3

# Emergency stop
railway stop --service worker

# Rollback
railway rollback --service worker

# Clear queue (emergency only)
redis-cli -u $REDIS_URL FLUSHDB

# Check queue depth
redis-cli -u $REDIS_URL LLEN step.ready
```

## Notes
_Add any deployment-specific notes here_

---

**Deployment Date**: _________________
**Version Deployed**: _________________
**Deployed By**: _____________________