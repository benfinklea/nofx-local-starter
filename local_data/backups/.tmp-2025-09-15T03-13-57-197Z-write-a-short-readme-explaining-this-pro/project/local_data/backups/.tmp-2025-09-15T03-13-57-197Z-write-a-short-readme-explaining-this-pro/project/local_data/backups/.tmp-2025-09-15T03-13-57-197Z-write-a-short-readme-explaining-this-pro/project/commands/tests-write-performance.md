---
name: tests-write-performance
description: Write performance tests to validate speed, scalability, and resource usage
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL SYSTEM PERFORMANCE TESTING**
Writing performance tests for all endpoints, operations, and workflows...
{{else}}
**Mode: RECENT CODE PERFORMANCE**
Focusing on performance of recently modified code. I will:
1. Test performance of new or modified endpoints
2. Benchmark recently optimized functions
3. Focus on performance-critical code you've recently worked on

To write performance tests for the entire system, use: `/tests-write-performance --all`
{{/if}}

Write comprehensive performance tests to ensure the application meets speed, scalability, and efficiency requirements:

## Performance Testing Objectives

### 1. Load Testing
**User Load Simulation**
- Test with expected daily active users
- Simulate peak traffic scenarios (10x normal)
- Test gradual ramp-up of users
- Validate sustained load handling
- Test sudden traffic spikes

**Throughput Metrics**
- Requests per second (RPS)
- Transactions per second (TPS)
- Concurrent user limits
- Message processing rates
- Data transfer rates

### 2. Response Time Testing
**Page Load Performance**
- Time to First Byte (TTFB) < 200ms
- First Contentful Paint (FCP) < 1s
- Largest Contentful Paint (LCP) < 2.5s
- Time to Interactive (TTI) < 3s
- Cumulative Layout Shift (CLS) < 0.1

**API Performance**
- Average response time per endpoint
- 95th percentile response times
- 99th percentile response times
- Slowest 1% of requests
- Response time under load

### 3. Stress Testing
**Breaking Points**
- Maximum concurrent users before failure
- Database connection pool limits
- Memory exhaustion points
- CPU saturation thresholds
- Network bandwidth limits

**Recovery Testing**
- Recovery time after stress
- Resource cleanup validation
- Memory leak detection
- Connection pool recovery
- Cache performance under stress

## Resource Utilization Tests

### Memory Performance
- Heap memory usage patterns
- Memory leak detection over time
- Garbage collection frequency and duration
- Memory usage per user session
- Cache memory efficiency

### CPU Performance
- CPU usage under normal load
- CPU spikes during operations
- Multi-core utilization
- Thread pool efficiency
- Background job impact

### Database Performance
- Query execution times
- Index effectiveness
- Connection pool utilization
- Transaction throughput
- Deadlock frequency
- Slow query identification

### Network Performance
- Bandwidth utilization
- Latency measurements
- Packet loss tolerance
- WebSocket connection limits
- CDN cache hit rates

## Scalability Testing

### Horizontal Scaling
- Test with multiple application instances
- Load balancer effectiveness
- Session persistence validation
- Distributed cache performance
- Database replication lag

### Vertical Scaling
- Performance with increased resources
- Resource utilization efficiency
- Diminishing returns analysis
- Cost-performance optimization
- Resource bottleneck identification

## Implementation Framework

### Performance Test Setup
```javascript
// Example structure for performance tests
const scenarios = {
  baseline: {
    users: 100,
    duration: '5m',
    rampUp: '30s'
  },
  stress: {
    users: 1000,
    duration: '15m',
    rampUp: '2m'
  },
  spike: {
    users: 2000,
    duration: '10m',
    rampUp: '10s'
  },
  endurance: {
    users: 500,
    duration: '2h',
    rampUp: '5m'
  }
};
```

### Key Metrics to Capture
- Response time percentiles (50th, 75th, 90th, 95th, 99th)
- Error rates and types
- Throughput (requests/second)
- Resource utilization (CPU, memory, network, disk)
- Business metrics (orders/minute, messages/second)

### Performance Benchmarks
**Set clear pass/fail criteria:**
- Page load time < 3 seconds for 95% of users
- API response time < 500ms for 99% of requests
- Error rate < 0.1% under normal load
- CPU usage < 70% under expected load
- Memory usage stable over time (no leaks)

## Test Scenarios

### 1. Real-World Usage Patterns
- Morning traffic surge simulation
- Lunch-time peak usage
- End-of-day batch processing
- Weekend vs weekday patterns
- Seasonal traffic variations

### 2. Complex Operations
- Bulk data imports/exports
- Report generation performance
- Search with complex filters
- Real-time data aggregation
- Concurrent file uploads

### 3. Cache Performance
- Cold cache performance
- Cache warming strategies
- Cache invalidation impact
- Cache hit/miss ratios
- Distributed cache synchronization

## Performance Optimization Validation

### Before/After Comparison
- Baseline performance metrics
- Post-optimization measurements
- Performance regression detection
- A/B testing of optimizations
- Cost-benefit analysis

### Bottleneck Identification
- Database query optimization needs
- N+1 query problems
- Inefficient algorithms
- Network round trips
- Synchronous operations that could be async

## Reporting Requirements

### Performance Reports Should Include:
- Executive summary with pass/fail status
- Detailed metrics with graphs
- Bottleneck analysis
- Optimization recommendations
- Comparison with previous runs
- Resource utilization heat maps

## Success Criteria
- All performance benchmarks met
- No memory leaks detected
- Graceful degradation under stress
- Quick recovery from failures
- Scalability proven to 10x current load
- Clear bottlenecks identified and documented

Write and execute these performance tests, analyze results, and provide optimization recommendations.

## Command Completion

✅ `/tests-write-performance $ARGUMENTS` command complete.

Summary: Written comprehensive performance tests with load validation, scalability benchmarks, and resource utilization analysis.