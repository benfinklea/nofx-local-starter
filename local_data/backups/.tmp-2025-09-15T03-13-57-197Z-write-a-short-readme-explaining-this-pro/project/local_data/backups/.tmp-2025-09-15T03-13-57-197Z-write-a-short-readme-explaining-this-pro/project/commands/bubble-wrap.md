---
name: bubble-wrap
description: Wrap your working feature in protective layers of tests so it never breaks again
---

## Mission Statement

**NEVER BREAK AGAIN PROTOCOL**

This feature works now. We're going to wrap it in so many tests that it becomes virtually unbreakable. Every angle, every edge case, every possible failure mode - covered.

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: BULLETPROOF ENTIRE CODEBASE**
Applying comprehensive test coverage to all features and components...
{{else}}
**Mode: BULLETPROOF RECENT CHANGES**
Focusing on recently implemented or modified features. I will:
1. Identify the feature(s) you just got working
2. Analyze all possible failure points
3. Create comprehensive test coverage for bulletproof reliability

To bulletproof the entire codebase, use: `/tests-bulletproof --all`
{{/if}}

## Bulletproofing Strategy

### Phase 1: Feature Analysis & Test Planning

**Feature Mapping**
- Identify all components involved in the feature
- Map data flow from input to output  
- Document all external dependencies
- List all configuration points
- Identify all user interaction paths
- Map all error conditions

**Failure Mode Analysis**
- What could go wrong with user input?
- How could the database fail this?
- What if external services are down?
- What about network failures?
- How could this break under load?
- What if memory/CPU is constrained?
- How could concurrent users break this?
- What about edge cases in data?

### Phase 2: Comprehensive Test Suite Creation

## 1. Unit Tests - Microscopic Protection

**Function-Level Bulletproofing**
- Test every function with valid inputs
- Test with null/undefined/empty values
- Test boundary conditions (min/max values)
- Test with malformed data types
- Test with special characters and Unicode
- Test mathematical edge cases (division by zero, overflow)
- Test with extremely large/small inputs
- Mock all dependencies and test in isolation

```javascript
// Example bulletproof unit test structure
describe('CriticalFeature', () => {
  describe('input validation', () => {
    test.each([
      [null, 'handles null input'],
      [undefined, 'handles undefined input'],
      ['', 'handles empty string'],
      [0, 'handles zero value'],
      [-1, 'handles negative numbers'],
      [Number.MAX_VALUE, 'handles maximum values'],
      ['<script>alert("xss")</script>', 'sanitizes malicious input'],
      ['🚀🎉💥', 'handles emoji and special unicode'],
      [' '.repeat(1000000), 'handles extremely long strings']
    ])('with %p input: %s', async (input, description) => {
      // Test implementation
    });
  });
});
```

## 2. Integration Tests - Component Interaction Shield

**Service Integration Bulletproofing**
- Test all service-to-service communication
- Test database transactions and rollbacks
- Test with real external API calls (and mocked failures)
- Test message queue publish/consume cycles
- Test file system operations
- Test caching layers and cache invalidation
- Test authentication and authorization flows
- Test configuration loading and hot-reloading

**Data Flow Validation**
- Test complete data pipelines
- Verify data transformations at each step
- Test with corrupted data at each stage
- Validate data consistency across services
- Test eventual consistency scenarios
- Test data migration and versioning

## 3. Contract Tests - Boundary Fortification

**API Contract Bulletproofing**
- Test all request/response combinations
- Test with malformed JSON/XML
- Test API versioning and backward compatibility
- Test rate limiting and throttling
- Test authentication failure scenarios
- Test with missing/extra headers
- Test content-type edge cases

**Service Boundary Protection**
- Test microservice communication contracts
- Test event publishing/consuming contracts
- Test database schema evolution
- Test third-party integration contracts
- Test webhook signature validation

## 4. End-to-End Tests - User Journey Armor

**Complete Workflow Protection**
- Test happy path user journeys
- Test every possible error path
- Test browser back/forward navigation
- Test page refreshes at critical moments
- Test network interruptions during workflows
- Test concurrent user sessions
- Test mobile/desktop/tablet variations
- Test with different browsers and versions

**Real-World Scenario Testing**
- Test during peak traffic simulation
- Test with slow network connections
- Test with intermittent connectivity
- Test with various screen sizes and orientations
- Test with accessibility tools enabled
- Test with JavaScript disabled (where applicable)

## 5. Performance Tests - Load Resistance Shield

**Bulletproof Performance**
- Test with 10x expected load
- Test memory usage under stress
- Test CPU utilization patterns
- Test database connection exhaustion
- Test file handle limits
- Test with large datasets
- Test concurrent operations
- Test sustained load over time

## 6. Security Tests - Attack Resistance Armor

**Security Bulletproofing**
- Test all OWASP Top 10 vulnerabilities
- Test SQL injection in every input field
- Test XSS in all user-facing outputs
- Test CSRF protection on all forms
- Test authentication bypass attempts
- Test authorization escalation attempts
- Test session fixation and hijacking
- Test file upload vulnerabilities

## 7. Chaos Tests - Failure Resilience Testing

**Infrastructure Failure Simulation**
- Kill random services during operations
- Corrupt database connections mid-transaction
- Simulate network partitions
- Test disk space exhaustion
- Test memory exhaustion scenarios
- Test CPU starvation conditions
- Test with system clock changes
- Test with DNS failures

## 8. Regression Tests - Historical Protection

**Prevent Past Failures**
- Create tests for every bug ever found in this feature
- Test for issues found in similar features
- Test edge cases discovered through support tickets
- Test scenarios that caused production incidents
- Test fixes for race conditions
- Test solutions to memory leaks

## 9. Compatibility Tests - Environment Resilience

**Cross-Platform Bulletproofing**
- Test on all supported operating systems
- Test with different Node.js/Python/etc versions
- Test with various database versions
- Test with different browser versions
- Test with various mobile devices
- Test with different network conditions
- Test with various time zones and locales

## 10. Monitoring Tests - Observability Validation

**Bulletproof Monitoring**
- Test that all metrics are being collected
- Test alert triggers under failure conditions
- Test log aggregation and search
- Test distributed tracing coverage
- Test health check endpoints
- Test circuit breaker functionality

## Implementation Protocol

### Step 1: Comprehensive Analysis
```bash
echo "🔍 ANALYZING FEATURE FOR BULLETPROOFING..."
echo "📋 Mapping all components and dependencies"
echo "⚠️  Identifying potential failure points"
echo "🎯 Creating comprehensive test plan"
```

### Step 2: Test Suite Generation
```bash
echo "🛡️  CREATING BULLETPROOF TEST SUITE..."
echo "1️⃣ Writing exhaustive unit tests..."
echo "2️⃣ Creating integration test scenarios..."
echo "3️⃣ Building contract validation tests..."
echo "4️⃣ Developing end-to-end workflows..."
echo "5️⃣ Implementing performance benchmarks..."
echo "6️⃣ Adding security penetration tests..."
echo "7️⃣ Creating chaos engineering tests..."
echo "8️⃣ Building regression prevention tests..."
```

### Step 3: Execution & Validation
```bash
echo "🚀 EXECUTING BULLETPROOF TEST SUITE..."
echo "✅ Running all test categories"
echo "📊 Collecting comprehensive metrics"
echo "🔍 Analyzing coverage gaps"
echo "🛠️  Fixing any discovered issues"
echo "🔄 Re-running until 100% bulletproof"
```

## Success Metrics

### Coverage Requirements
- **Unit Tests**: 100% line, branch, and function coverage
- **Integration**: All service boundaries tested
- **Contract**: All API endpoints and schemas validated
- **E2E**: All user journeys covered
- **Performance**: All SLA requirements validated
- **Security**: All OWASP categories tested
- **Chaos**: All infrastructure failure modes tested

### Quality Gates
```javascript
const bulletproofCriteria = {
  testCoverage: {
    lines: 100,
    branches: 100,
    functions: 100,
    statements: 100
  },
  performance: {
    responseTime: '< 100ms p95',
    throughput: '> 1000 rps',
    memoryUsage: 'stable over 24h',
    errorRate: '< 0.01%'
  },
  reliability: {
    uptime: '99.99%',
    mttr: '< 5 minutes',
    mtbf: '> 720 hours',
    dataIntegrity: '100%'
  },
  security: {
    vulnerabilities: 0,
    penetrationTests: 'passed',
    complianceChecks: 'passed',
    auditTrail: 'complete'
  }
};
```

## Bulletproof Maintenance Protocol

### Continuous Protection
- Run all tests on every commit
- Add new tests for every bug report
- Update tests when requirements change
- Monitor production for new failure patterns
- Implement automated test generation
- Regular chaos engineering exercises

### Test Evolution
- Review test suite quarterly
- Update performance benchmarks
- Add new security threat tests
- Expand compatibility matrix
- Enhance monitoring coverage
- Improve error simulation

## Final Bulletproofing Checklist

**Before declaring feature bulletproof:**
- [ ] All possible input combinations tested
- [ ] All error conditions have tests
- [ ] All external dependencies mocked and real tested
- [ ] All performance benchmarks met
- [ ] All security vulnerabilities tested
- [ ] All browsers and devices tested
- [ ] All infrastructure failure modes tested
- [ ] All monitoring and alerting validated
- [ ] All past bugs have regression tests
- [ ] All team members can run tests successfully

## Warranty Statement

Upon completion, this feature will have:
- **Comprehensive test coverage** protecting against all known failure modes
- **Automated validation** on every code change
- **Performance guarantees** under expected and stress conditions
- **Security assurance** against common attack vectors
- **Reliability metrics** with defined SLA compliance
- **Monitoring coverage** for immediate issue detection

**This feature will be production-hardened and virtually unbreakable.**

## Command Completion

✅ `/tests-bulletproof $ARGUMENTS` command complete.

Summary: Created comprehensive bulletproof test suite covering every possible failure mode, ensuring this feature never breaks again through exhaustive validation and protection.