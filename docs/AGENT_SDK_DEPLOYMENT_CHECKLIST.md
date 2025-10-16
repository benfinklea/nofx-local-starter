# Agent SDK Deployment Readiness Checklist

**Phase 3A: Testing & Deployment Readiness**
**Date**: October 12, 2025
**Status**: Pre-Production Validation

## Prerequisites

### Environment Configuration
- [ ] `ANTHROPIC_API_KEY` set in environment
- [ ] `USE_AGENT_SDK` feature flag configured (default: `false`)
- [ ] Cost thresholds configured:
  - [ ] `AGENT_SDK_COST_ALERT_THRESHOLD` (default: $10.00)
  - [ ] `AGENT_SDK_COST_DAILY_LIMIT` (default: $100.00)
- [ ] Model configuration validated
  - [ ] `AGENT_SDK_MODEL=claude-sonnet-4-5`
  - [ ] `AGENT_SDK_MAX_TOKENS=4096`
  - [ ] `AGENT_SDK_TEMPERATURE=0.7`

### Database
- [ ] Migration applied: `20250929000000_add_agent_sdk_support.sql`
- [ ] `nofx.run` table has `sdk_session_id` column
- [ ] `nofx.run` table has `sdk_metadata` column
- [ ] Views created: `sdk_usage_stats`, `sdk_cost_summary`
- [ ] Indexes created on `sdk_session_id`

### Code Deployment
- [ ] Phase 1 complete (adapter + handler + migration)
- [ ] Phase 2 complete (real SDK integration + robustness)
- [ ] Phase 3A complete (monitoring endpoints)
- [ ] All commits pushed to `main` branch
- [ ] No TypeScript errors
- [ ] No ESLint warnings

---

## Testing Phase

### Unit Tests
- [ ] Run: `npm test tests/unit`
- [ ] All existing tests pass
- [ ] No regressions introduced

### Integration Tests
- [ ] Run: `npm test tests/integration/agent-sdk.test.ts`
- [ ] **With ANTHROPIC_API_KEY set**:
  - [ ] Simple prompt execution works
  - [ ] Session persistence works across steps
  - [ ] Cost tracking is accurate
  - [ ] Error handling works (invalid model, etc.)
- [ ] **Without API key**:
  - [ ] Tests skip gracefully or show clear warnings

### API Endpoint Tests
- [ ] `GET /api/sdk/health` - Returns health status
- [ ] `GET /api/sdk/stats` - Returns usage statistics
- [ ] `GET /api/sdk/sessions` - Returns active sessions
- [ ] `GET /api/sdk/compare` - Compares SDK vs legacy

### Manual Testing
- [ ] Start services: `npm run dev`
- [ ] Test with `USE_AGENT_SDK=false` (legacy works)
- [ ] Test with `USE_AGENT_SDK=true` (SDK works)
- [ ] Verify monitoring endpoints return data
- [ ] Check logs for errors

---

## Feature Flag Validation

### Toggle OFF (Legacy Mode)
- [ ] Set `USE_AGENT_SDK=false`
- [ ] Restart services
- [ ] Create test run with `codegen` tool
- [ ] Verify legacy model router is used
- [ ] Check no SDK events in timeline
- [ ] Verify artifacts created correctly

### Toggle ON (SDK Mode)
- [ ] Set `USE_AGENT_SDK=true`
- [ ] Restart services
- [ ] Create test run with `codegen:v2` tool
- [ ] Verify SDK is used (check logs)
- [ ] Check SDK events in timeline
- [ ] Verify `sdk_session_id` recorded
- [ ] Verify cost tracking in step outputs

### Instant Rollback Test
- [ ] Start with SDK enabled
- [ ] Create a run
- [ ] Set `USE_AGENT_SDK=false` (mid-flight)
- [ ] Restart services
- [ ] Create another run
- [ ] Verify it uses legacy
- [ ] Verify no data loss

---

## Monitoring & Observability

### Health Checks
- [ ] `/api/sdk/health` shows SDK installed
- [ ] API key presence detected (masked)
- [ ] Configuration values correct
- [ ] Status shows "healthy"

### Usage Analytics
- [ ] `/api/sdk/stats?period=7d` returns summary
- [ ] Daily breakdown shows per-day data
- [ ] Token counts are reasonable
- [ ] Cost calculations match expectations
- [ ] Thresholds configured correctly

### Session Tracking
- [ ] `/api/sdk/sessions` lists active sessions
- [ ] Session IDs match `run.sdk_session_id`
- [ ] Step counts accurate
- [ ] Last activity timestamps correct

### Performance Comparison
- [ ] `/api/sdk/compare?period=7d` shows both methods
- [ ] Success rates calculated correctly
- [ ] Average duration per run shown
- [ ] Cost comparison displayed

---

## Performance Validation

### Response Time
- [ ] SDK runs complete in < 60s (timeout protection working)
- [ ] No indefinite hangs
- [ ] Timeout errors are clear and actionable

### Resource Usage
- [ ] No memory leaks during SDK calls
- [ ] Event recording doesn't block execution
- [ ] Database queries are efficient

### Cost Tracking
- [ ] Real costs match SDK reported costs
- [ ] Tokens used are accurate
- [ ] Cost per run is within budget
- [ ] Alert threshold triggers correctly

---

## Error Handling Validation

### Input Validation
- [ ] Empty prompt rejected with clear error
- [ ] Invalid model warned (falls back to default)
- [ ] Missing step ID rejected
- [ ] Missing runId rejected

### API Errors
- [ ] Rate limit (429) - User-friendly message shown
- [ ] Auth failure (401) - Directs to check ANTHROPIC_API_KEY
- [ ] Model not found (404) - Shows which model failed
- [ ] Timeout - Shows model + prompt length context

### Graceful Degradation
- [ ] Event recording failures don't crash execution
- [ ] Hook failures are logged but don't block
- [ ] Stream event failures are handled gracefully

---

## Security Validation

### API Key Protection
- [ ] API key never logged in plain text
- [ ] `/api/sdk/health` masks API key (shows `sk-ant-***`)
- [ ] Error messages don't expose credentials

### Input Sanitization
- [ ] Prompts are validated before SDK call
- [ ] Step inputs are type-checked
- [ ] No SQL injection in analytics queries

---

## Documentation

### Technical Docs
- [ ] `docs/Migrate to Agent SDK, Sept 29, 2025.md` up to date
- [ ] `docs/AGENT_SDK_PHASE1_COMPLETE.md` exists
- [ ] `docs/AGENT_SDK_PHASE2_COMPLETE.md` exists
- [ ] `docs/AGENT_SDK_DEPLOYMENT_CHECKLIST.md` (this file) complete

### Usage Documentation
- [ ] `.bwc-usage.md` documents Build with Claude workflow
- [ ] README mentions Agent SDK integration
- [ ] API documentation includes `/api/sdk/*` endpoints

### Runbooks
- [ ] Rollback procedure documented
- [ ] Troubleshooting guide created
- [ ] Cost alert response procedure

---

## Production Readiness Criteria

### Must Have (Blocking)
- [x] Phase 1 & 2 complete and pushed to GitHub
- [x] Real SDK integration working
- [x] Monitoring endpoints functional
- [ ] Integration tests pass with real API
- [ ] Feature flag tested (ON/OFF/Rollback)
- [ ] Cost tracking validated
- [ ] Error handling validated
- [x] Documentation complete

### Should Have (Recommended)
- [ ] 100+ successful test runs with real SDK
- [ ] Cost per run < $0.10 on average
- [ ] Error rate < 1% in testing
- [ ] Session persistence > 95% success
- [ ] Response time < 5s average

### Nice to Have (Future)
- [ ] Grafana dashboards for metrics
- [ ] Slack alerts for cost thresholds
- [ ] Automated canary deployment
- [ ] A/B testing framework

---

## Rollout Strategy

### Stage 1: Internal Testing (Week 1)
- [ ] Set `USE_AGENT_SDK=true` in dev environment
- [ ] Team runs manual tests
- [ ] Monitor for 48 hours
- [ ] Collect feedback on UX
- [ ] Fix any bugs discovered

### Stage 2: Canary Deployment (Week 2)
- [ ] Deploy to 10% of production traffic
- [ ] Monitor metrics:
  - [ ] Cost per run
  - [ ] Error rate
  - [ ] Response time
  - [ ] Session success rate
- [ ] Compare SDK vs Legacy performance
- [ ] If metrics good, proceed. If not, rollback.

### Stage 3: Progressive Rollout (Week 3)
- [ ] Increase to 50% of traffic
- [ ] Continue monitoring
- [ ] Validate no degradation
- [ ] If metrics stable, proceed to 100%

### Stage 4: Full Rollout (Week 4)
- [ ] Enable SDK for 100% of traffic
- [ ] Monitor for 1 week
- [ ] Validate success metrics

### Stage 5: Legacy Deprecation (Week 5)
- [ ] Announce legacy model router deprecation
- [ ] Set sunset date (30 days notice)
- [ ] Remove legacy code after sunset

---

## Rollback Procedures

### Immediate Rollback (If Critical Issue)
```bash
# 1. Set feature flag OFF
USE_AGENT_SDK=false

# 2. Restart services
# Vercel: redeploy with new env var
# Docker: docker-compose restart worker api

# 3. Verify legacy is working
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{"plan": {"goal": "Test", "steps": [{"name": "test", "tool": "codegen", "inputs": {"prompt": "Hello"}}]}}'

# 4. Monitor for 15 minutes
# Check error logs, ensure runs complete
```

### Partial Rollback (If Specific Issues)
- Disable SDK for specific handlers
- Reduce traffic percentage
- Keep monitoring enabled

### Code Revert (If Bugs Require Code Changes)
```bash
git revert [commit-hash] --no-edit
git push origin main
# Redeploy
```

---

## Success Metrics

### Phase 3A Complete When:
- [x] Monitoring endpoints deployed
- [x] Integration tests enhanced
- [ ] All checklist items validated
- [ ] Team trained on monitoring
- [ ] Runbooks created

### Production Ready When:
- [ ] 1000+ successful runs with SDK
- [ ] Cost per run within budget
- [ ] Error rate < 1%
- [ ] Session persistence > 99%
- [ ] Rollback tested successfully
- [ ] Team confident in system

---

## Sign-Off

**Technical Lead**: _________________ Date: _______

**DevOps Lead**: _________________ Date: _______

**Product Owner**: _________________ Date: _______

---

**Status**: 📋 Checklist Created - Ready for Validation

**Next Steps**:
1. Set `ANTHROPIC_API_KEY` in environment
2. Run integration tests
3. Test monitoring endpoints
4. Validate feature flag toggle
5. Complete all checklist items
6. Get team sign-off

**Support**: See `docs/AGENT_SDK_PHASE2_COMPLETE.md` for implementation details
