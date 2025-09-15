---
name: tests-run
description: Execute all test suites in optimal order and report comprehensive results
---

## Test Execution Scope

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--recent"}}
**Mode: RECENT CHANGES TEST SUITE**
Running tests only for recently modified code:
- Unit tests for changed functions/classes
- Integration tests for modified components
- API tests for updated endpoints
- E2E tests for affected user flows

Use `/tests-run` without arguments to run ALL tests.
{{else}}
**Mode: FULL TEST SUITE EXECUTION** (Default)
Running complete test suite in optimal order for comprehensive validation.

To run only tests for recent changes, use: `/tests-run --recent`
{{/if}}

Execute test suites in the appropriate order, collecting and reporting results:

## Test Execution Strategy

### Execution Order
Run tests in this specific order to optimize feedback time and resource usage:

1. **Unit Tests** (Fastest feedback)
   - Quick execution (< 30 seconds)
   - No external dependencies
   - Immediate code quality validation
   - Stop on failure: Fix before proceeding

2. **API Tests** (Contract validation)
   - Validate API contracts and schemas
   - Test request/response formats
   - Verify endpoint behavior
   - ~2-5 minutes execution

3. **Integration Tests** (Component verification)
   - Test component interactions
   - Validate data flow
   - Database and service integration
   - ~5-10 minutes execution

4. **Security Tests** (Vulnerability scanning)
   - Run OWASP checks
   - Validate authentication/authorization
   - Test input validation
   - ~5-15 minutes execution

5. **E2E Tests** (User journey validation)
   - Full user workflow testing
   - Browser automation tests
   - Critical path validation
   - ~10-30 minutes execution

6. **Performance Tests** (Load validation)
   - Baseline performance metrics
   - Load and stress testing
   - Resource utilization checks
   - ~15-30 minutes execution

7. **Robustness Tests** (Chaos engineering)
   - Failure injection
   - Recovery validation
   - Resilience testing
   - ~10-20 minutes execution

## Execution Commands

### Pre-Test Setup
```bash
# Environment preparation
echo "🚀 Starting comprehensive test suite execution..."
echo "📅 Test run started at: $(date)"
export TEST_ENV=test
export NODE_ENV=test

# Clean previous test artifacts
rm -rf coverage/ test-results/ reports/
mkdir -p reports/

# Verify test dependencies
npm install --dev || yarn install --dev
```

### Test Suite Execution
```bash
# 1. Unit Tests
echo "1️⃣ Running Unit Tests..."
npm run test:unit || yarn test:unit
UNIT_RESULT=$?

# 2. API Tests
echo "2️⃣ Running API Tests..."
npm run test:api || yarn test:api
API_RESULT=$?

# 3. Integration Tests
echo "3️⃣ Running Integration Tests..."
npm run test:integration || yarn test:integration
INTEGRATION_RESULT=$?

# 4. Security Tests
echo "4️⃣ Running Security Tests..."
npm run test:security || yarn test:security
SECURITY_RESULT=$?

# 5. E2E Tests
echo "5️⃣ Running E2E Tests..."
npm run test:e2e || yarn test:e2e
E2E_RESULT=$?

# 6. Performance Tests
echo "6️⃣ Running Performance Tests..."
npm run test:performance || yarn test:performance
PERFORMANCE_RESULT=$?

# 7. Robustness Tests
echo "7️⃣ Running Robustness Tests..."
npm run test:robustness || yarn test:robustness
ROBUSTNESS_RESULT=$?
```

## Results Collection

### Metrics to Capture
For each test suite, collect:
- Total tests run
- Tests passed/failed/skipped
- Execution time
- Code coverage percentage
- Error messages and stack traces
- Performance metrics
- Security vulnerabilities found

### Report Generation
```javascript
const testReport = {
  summary: {
    startTime: new Date(),
    endTime: null,
    duration: null,
    totalSuites: 7,
    passedSuites: 0,
    failedSuites: 0,
    overallStatus: 'PENDING'
  },
  suites: {
    unit: { status: null, tests: 0, passed: 0, failed: 0, coverage: 0 },
    api: { status: null, endpoints: 0, passed: 0, failed: 0 },
    integration: { status: null, flows: 0, passed: 0, failed: 0 },
    security: { status: null, vulnerabilities: 0, critical: 0, high: 0 },
    e2e: { status: null, scenarios: 0, passed: 0, failed: 0 },
    performance: { status: null, avgResponse: 0, p95: 0, p99: 0 },
    robustness: { status: null, failures: 0, recovered: 0, mttr: 0 }
  }
};
```

## Results Display

### Console Output Format
```
═══════════════════════════════════════════════════════════════
                    TEST EXECUTION SUMMARY
═══════════════════════════════════════════════════════════════

1. UNIT TESTS          ✅ PASSED
   • Tests: 250/250 passed
   • Coverage: 98.5%
   • Duration: 12.3s

2. API TESTS           ✅ PASSED
   • Endpoints: 45/45 tested
   • Contracts: Valid
   • Duration: 3m 21s

3. INTEGRATION TESTS   ⚠️  WARNING
   • Flows: 28/30 passed
   • Failed: Database timeout (2)
   • Duration: 8m 45s

4. SECURITY TESTS      ❌ FAILED
   • Vulnerabilities: 3 High, 7 Medium
   • Critical: SQL Injection in /api/search
   • Duration: 12m 10s

5. E2E TESTS          ✅ PASSED
   • Scenarios: 15/15 passed
   • Browsers: Chrome ✓, Firefox ✓, Safari ✓
   • Duration: 25m 30s

6. PERFORMANCE TESTS   ✅ PASSED
   • Avg Response: 142ms
   • P95: 412ms, P99: 892ms
   • Duration: 18m 22s

7. ROBUSTNESS TESTS   ✅ PASSED
   • Chaos Tests: 12/12 recovered
   • MTTR: 34 seconds
   • Duration: 15m 18s

═══════════════════════════════════════════════════════════════
OVERALL STATUS: ❌ FAILED (Security Issues Found)
TOTAL DURATION: 1h 35m 47s
═══════════════════════════════════════════════════════════════
```

### Detailed Failure Report
For any failed tests, provide:
- Test name and location
- Expected vs actual results
- Error message and stack trace
- Steps to reproduce
- Suggested fixes
- Related code files

### Coverage Report
```
File Coverage Summary:
----------------------
src/
  ├── controllers/   95.2% (142/149 lines)
  ├── services/      98.1% (523/533 lines)
  ├── models/        92.8% (89/96 lines)
  ├── utils/         100% (234/234 lines)
  └── middleware/    96.5% (167/173 lines)

Overall Coverage: 96.8%
```

## Action Items Generation

### Priority Classification
Based on test results, generate action items:

**🔴 Critical (Fix Immediately)**
- Security vulnerabilities
- Data loss bugs
- Complete test failures
- Performance SLA violations

**🟡 High (Fix within 24 hours)**
- Failing integration tests
- Flaky E2E tests
- Performance degradation
- Major UX issues

**🟢 Medium (Fix this sprint)**
- Minor bugs
- Code coverage gaps
- Performance optimizations
- Documentation updates

**🔵 Low (Backlog)**
- Code style issues
- Refactoring opportunities
- Test improvements
- Nice-to-have features

## Continuous Improvement

### Test Health Metrics
Track over time:
- Test execution duration trends
- Flaky test frequency
- Coverage trends
- Bug escape rate
- Mean time to fix

### Recommendations
Based on results, suggest:
- Additional test scenarios needed
- Performance optimization opportunities
- Security hardening requirements
- Architecture improvements
- Monitoring enhancements

## Final Steps

1. **Generate HTML/PDF reports** for stakeholders
2. **Upload results** to test management system
3. **Create tickets** for failures in issue tracker
4. **Send notifications** to relevant teams
5. **Archive test artifacts** for analysis
6. **Update dashboards** with latest metrics

Execute all test suites now and provide comprehensive results summary with actionable recommendations.

## Command Completion

✅ `/tests-run $ARGUMENTS` command complete.

Summary: Executed comprehensive test suite with detailed results, metrics analysis, and actionable improvement recommendations.