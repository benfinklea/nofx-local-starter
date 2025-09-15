---
name: tests-write-robustness
description: Write robustness tests for chaos engineering and failure recovery
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL CHAOS ENGINEERING SUITE**
Writing robustness tests for all services, dependencies, and failure scenarios...
{{else}}
**Mode: TARGETED RESILIENCE TESTING**
Focusing on robustness of recently modified components. I will:
1. Test failure handling in new or modified services
2. Validate error recovery in recent code changes
3. Focus on resilience of components you've recently worked on

To write robustness tests for the entire system, use: `/tests-write-robustness --all`
{{/if}}

Write comprehensive robustness tests to validate system resilience and failure recovery:

## Chaos Engineering Tests

### 1. Infrastructure Failures

**Server Failures**
- Test single server crashes
- Simulate rolling server restarts
- Test complete datacenter outage
- Validate failover mechanisms
- Test split-brain scenarios
- Verify leader election in clusters

**Network Chaos**
- Introduce packet loss (1%, 5%, 10%, 50%)
- Add network latency (100ms, 500ms, 2s)
- Test network partitions
- Simulate bandwidth throttling
- Test DNS failures
- Validate timeout handling

**Resource Exhaustion**
- Fill disk to capacity
- Exhaust memory (OOM killer)
- Max out CPU usage
- Exceed file descriptor limits
- Test thread pool exhaustion
- Validate connection pool limits

### 2. Dependency Failures

**Database Failures**
- Test primary database offline
- Simulate replica lag
- Test transaction deadlocks
- Corrupt database files
- Test backup/restore process
- Validate connection pool recovery

**Cache Failures**
- Test cache server offline
- Simulate cache poisoning
- Test cache stampede
- Validate cache invalidation
- Test cold cache performance
- Verify cache rebuild process

**External Service Failures**
- Test payment gateway timeout
- Simulate email service failure
- Test SMS provider outage
- Mock social auth failure
- Test CDN unavailability
- Validate webhook delivery retry

### 3. Data Corruption Tests

**Data Integrity**
- Introduce bit flips in memory
- Test corrupted file uploads
- Simulate truncated requests
- Test malformed JSON/XML
- Validate checksum verification
- Test encoding issues

**State Corruption**
- Test inconsistent distributed state
- Simulate partial transaction commits
- Test orphaned records
- Validate referential integrity
- Test cascade delete issues
- Verify state machine transitions

### 4. Time-Based Chaos

**Clock Issues**
- Test clock skew between servers
- Simulate daylight saving transitions
- Test leap seconds/years
- Validate timezone handling
- Test future/past date inputs
- Verify timestamp precision

**Timing Attacks**
- Test race conditions
- Validate TOCTOU vulnerabilities
- Test concurrent modifications
- Verify optimistic locking
- Test distributed locks
- Validate event ordering

## Resilience Patterns Testing

### 1. Circuit Breaker Tests
```javascript
// Test circuit breaker states
const circuitBreakerTests = {
  closed: { failures: 2, expectedState: 'closed' },
  open: { failures: 5, expectedState: 'open' },
  halfOpen: { waitTime: '30s', expectedState: 'half-open' },
  recovery: { successes: 3, expectedState: 'closed' }
};
```

### 2. Retry Logic Tests
- Test exponential backoff
- Validate max retry limits
- Test jittered retries
- Verify retry budget
- Test selective retry (only safe operations)
- Validate retry storms prevention

### 3. Bulkhead Tests
- Test thread pool isolation
- Validate semaphore bulkheads
- Test connection pool separation
- Verify resource compartmentalization
- Test cascade failure prevention
- Validate graceful degradation

### 4. Timeout Tests
- Test connection timeouts
- Validate read/write timeouts
- Test total operation timeouts
- Verify timeout propagation
- Test timeout coordination
- Validate timeout hierarchy

## Recovery Testing

### 1. Automatic Recovery
**Self-Healing Tests**
- Test automatic service restart
- Validate health check recovery
- Test connection reconnection
- Verify cache warming
- Test queue recovery
- Validate index rebuilding

**Failover Tests**
- Test primary to secondary failover
- Validate load balancer health checks
- Test geographic failover
- Verify data replication catch-up
- Test failback procedures
- Validate zero-downtime deployment

### 2. Manual Recovery
**Disaster Recovery**
- Test backup restoration
- Validate point-in-time recovery
- Test data migration rollback
- Verify configuration rollback
- Test emergency shutdown procedures
- Validate communication protocols

### 3. Gradual Degradation
**Feature Flags**
- Test feature disable under load
- Validate graceful feature degradation
- Test progressive enhancement
- Verify fallback UI
- Test read-only mode
- Validate maintenance mode

## Edge Cases and Boundary Tests

### 1. Extreme Inputs
- Test with maximum allowed values
- Submit minimum allowed values
- Test empty/null/undefined inputs
- Submit extremely long strings
- Test special characters (emoji, RTL text)
- Validate scientific notation numbers

### 2. Unusual Sequences
- Test operations in wrong order
- Submit duplicate requests rapidly
- Test canceled operations
- Validate interrupted workflows
- Test recursive operations
- Verify circular dependencies

### 3. Platform-Specific Issues
- Test different OS behaviors
- Validate filesystem limitations
- Test locale-specific issues
- Verify architecture differences (32/64-bit)
- Test container vs VM differences
- Validate cloud provider specifics

## Monitoring and Observability Tests

### 1. Alerting Validation
- Test alert threshold triggers
- Validate alert routing
- Test alert suppression
- Verify alert correlation
- Test on-call escalation
- Validate alert recovery

### 2. Logging Resilience
- Test log rotation under load
- Validate log shipping failures
- Test structured logging parsing
- Verify sensitive data masking
- Test log aggregation delays
- Validate audit trail integrity

### 3. Metrics Collection
- Test metrics under failure
- Validate metric accuracy
- Test high cardinality metrics
- Verify metric aggregation
- Test custom metric collection
- Validate dashboard accuracy

## Test Execution Strategy

### Chaos Test Schedule
- Daily: Random pod kills in staging
- Weekly: Network chaos testing
- Monthly: Full disaster recovery drill
- Quarterly: Multi-region failure simulation

### Game Days
- Planned chaos experiments
- Team training exercises
- Runbook validation
- Tool familiarization
- Process improvement identification

## Success Criteria
- System recovers from all single points of failure
- No data loss during failures
- Recovery time < defined RTO
- Graceful degradation implemented
- All alerts fire correctly
- Runbooks proven effective
- No cascading failures
- Customer impact minimized

Write and execute these robustness tests using chaos engineering tools, validate recovery procedures, and document failure modes.

## Command Completion

✅ `/tests-write-robustness $ARGUMENTS` command complete.

Summary: Written comprehensive robustness tests with chaos engineering scenarios, failure injection, and recovery validation.