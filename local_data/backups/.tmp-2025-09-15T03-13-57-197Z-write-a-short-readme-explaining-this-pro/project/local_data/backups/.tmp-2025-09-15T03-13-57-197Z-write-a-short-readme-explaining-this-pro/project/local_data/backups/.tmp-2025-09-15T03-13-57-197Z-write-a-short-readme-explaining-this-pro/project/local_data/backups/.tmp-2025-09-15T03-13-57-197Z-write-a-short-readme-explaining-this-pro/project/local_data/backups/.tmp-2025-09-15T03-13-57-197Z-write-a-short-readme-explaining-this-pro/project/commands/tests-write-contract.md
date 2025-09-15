---
name: tests-write-contract
description: Write contract tests to validate service boundaries and API agreements
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL CONTRACT TESTING SUITE**
Writing contract tests for all service boundaries, API integrations, and external dependencies...
{{else}}
**Mode: RECENT CONTRACT CHANGES**
Focusing on recently modified contracts and integrations. I will:
1. Test new or modified API contracts
2. Validate service boundary changes in recent commits
3. Focus on integration contracts you've recently implemented or discussed

To write contract tests for all service boundaries, use: `/tests-write-contract --all`
{{/if}}

Write comprehensive contract tests to validate service agreements, API contracts, and integration boundaries:

## Contract Testing Objectives

### 1. Provider Contract Testing

**API Provider Contracts**
- Test that APIs match their published specifications
- Validate response schemas and data types
- Verify HTTP status codes and headers
- Test error response formats
- Validate API versioning behavior
- Ensure backward compatibility maintenance

**Message Producer Contracts**
- Test message schema compliance
- Validate message routing and headers
- Verify event payload structures
- Test message ordering guarantees
- Validate retry and dead letter behavior
- Ensure message versioning compatibility

### 2. Consumer Contract Testing

**API Consumer Expectations**
- Test that consumer expectations match provider capabilities
- Validate request format requirements
- Test authentication and authorization flows
- Verify rate limiting and throttling behavior
- Test pagination and filtering requirements
- Validate caching behavior and headers

**Message Consumer Contracts**
- Test message consumption patterns
- Validate event handling logic
- Test consumer group behavior
- Verify message acknowledgment patterns
- Test backpressure handling
- Validate consumer resilience patterns

### 3. Contract-First Development

**OpenAPI/Swagger Contracts**
- Generate tests from OpenAPI specifications
- Validate request/response against schemas
- Test parameter validation rules
- Verify security scheme implementations
- Test content-type negotiations
- Validate example payloads

**AsyncAPI Contracts**
- Test against AsyncAPI specifications
- Validate message channel definitions
- Test operation bindings
- Verify server variable substitutions
- Test message correlation patterns
- Validate security requirements

### 4. Database Contract Testing

**Schema Contracts**
- Test database migration compatibility
- Validate table structure changes
- Test constraint enforcement
- Verify index effectiveness
- Test stored procedure contracts
- Validate view definitions

**Data Access Contracts**
- Test repository interface compliance
- Validate query result structures
- Test transaction boundary behavior
- Verify connection pooling contracts
- Test data access performance contracts
- Validate caching layer contracts

## Implementation Framework

### Contract Testing Tools

**Pact Framework Integration**
```javascript
// Provider contract test example
describe('User API Provider', () => {
  const provider = new Pact({
    provider: 'UserService',
    providerBaseUrl: 'http://localhost:3001',
    pactUrls: ['./pacts/user-consumer-user-provider.json']
  });

  test('validates user creation contract', async () => {
    await provider.verify({
      publishVerificationResult: true,
      providerVersion: process.env.GIT_COMMIT
    });
  });
});

// Consumer contract test example
describe('User API Consumer', () => {
  const provider = new Pact({
    consumer: 'UserConsumer',
    provider: 'UserService'
  });

  test('creates user successfully', async () => {
    await provider
      .given('user data is valid')
      .uponReceiving('a request to create user')
      .withRequest({
        method: 'POST',
        path: '/users',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'John Doe', email: 'john@example.com' }
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: { id: like(1), name: 'John Doe', email: 'john@example.com' }
      });

    const userService = new UserService(provider.mockService.baseUrl);
    const result = await userService.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('John Doe');
  });
});
```

### Contract Validation Strategies

**Schema-First Validation**
- Generate contracts from schemas
- Validate implementation against contracts
- Test schema evolution compatibility
- Verify breaking change detection
- Test semantic versioning compliance
- Validate deprecation handling

**Code-First Validation**
- Generate contracts from implementation
- Test contract generation accuracy
- Validate documentation sync
- Test contract publishing workflows
- Verify consumer notification processes
- Test contract registry integration

### 5. Microservice Contract Testing

**Service Boundary Contracts**
- Test inter-service communication
- Validate service discovery contracts
- Test load balancing behavior
- Verify circuit breaker contracts
- Test timeout and retry policies
- Validate fallback mechanisms

**Event-Driven Architecture**
- Test event publishing contracts
- Validate event consumption patterns
- Test event sourcing contracts
- Verify saga pattern implementations
- Test eventual consistency guarantees
- Validate compensation transactions

### 6. External Integration Contracts

**Third-Party API Contracts**
- Test against external API specifications
- Validate authentication flows
- Test rate limiting compliance
- Verify webhook contract adherence
- Test error handling patterns
- Validate SDK compatibility

**Payment Gateway Contracts**
- Test payment processing flows
- Validate webhook signature verification
- Test refund and cancellation flows
- Verify compliance requirements
- Test currency and locale handling
- Validate PCI DSS requirements

**Identity Provider Contracts**
- Test OAuth/OIDC flows
- Validate token exchange patterns
- Test user profile mapping
- Verify logout and session management
- Test multi-factor authentication
- Validate role and permission mapping

## Contract Testing Scenarios

### 1. Breaking Change Detection

**API Breaking Changes**
- Remove required fields
- Change field data types
- Remove endpoints
- Change HTTP methods
- Modify authentication requirements
- Alter error response formats

**Schema Breaking Changes**
- Remove required properties
- Change property types
- Remove enum values
- Modify validation rules
- Change array item schemas
- Alter inheritance hierarchies

### 2. Backward Compatibility

**Version Compatibility**
- Test multiple API versions simultaneously
- Validate graceful degradation
- Test feature flag compatibility
- Verify migration path validity
- Test rollback scenarios
- Validate sunset timeline adherence

### 3. Cross-Platform Contracts

**Mobile App Contracts**
- Test iOS/Android API requirements
- Validate offline/online transitions
- Test push notification contracts
- Verify deep linking behavior
- Test biometric authentication
- Validate app store compliance

**Web Application Contracts**
- Test browser compatibility requirements
- Validate CORS configuration
- Test WebSocket connection contracts
- Verify PWA manifest compliance
- Test service worker contracts
- Validate accessibility requirements

## Contract Lifecycle Management

### Contract Publishing

**Contract Registry**
- Publish contracts to central registry
- Version contracts semantically
- Tag contracts with metadata
- Implement contract approval workflows
- Track contract usage metrics
- Manage contract deprecation

**Documentation Generation**
- Auto-generate API documentation
- Create integration guides
- Generate SDK documentation
- Produce changelog summaries
- Create migration guides
- Generate compliance reports

### Contract Monitoring

**Runtime Validation**
- Monitor contract compliance in production
- Track breaking change impact
- Measure contract performance
- Detect schema drift
- Monitor consumer adoption
- Track error patterns

**Contract Metrics**
```javascript
const contractMetrics = {
  compliance: {
    successRate: 99.5,
    errorRate: 0.5,
    timeouts: 0.1
  },
  performance: {
    avgResponseTime: 120,
    p95ResponseTime: 300,
    p99ResponseTime: 800
  },
  adoption: {
    activeConsumers: 45,
    deprecatedUsage: 5,
    newVersionAdoption: 85
  }
};
```

## Advanced Contract Testing

### Consumer-Driven Contracts

**Pact Workflow**
1. Consumer defines expectations
2. Generate pact file
3. Share with provider
4. Provider validates against pact
5. Publish verification results
6. Integrate into CI/CD pipeline

### Provider-Driven Contracts

**OpenAPI-First Approach**
1. Define API specification
2. Generate provider implementation
3. Generate consumer SDKs
4. Validate implementation compliance
5. Test consumer integration
6. Monitor production usage

### Bi-Directional Contracts

**Mutual Validation**
- Consumer tests against provider contract
- Provider tests against consumer expectations
- Validate contract compatibility
- Test integration scenarios
- Verify error handling alignment
- Test performance requirements

## Testing Infrastructure

### Test Environment Setup

**Contract Test Environment**
- Isolated contract testing environment
- Mock external dependencies
- Seed test data consistently
- Configure service stubs
- Set up monitoring and logging
- Implement cleanup procedures

**CI/CD Integration**
```yaml
# Example pipeline stage
contract-tests:
  stage: test
  script:
    - npm run test:contracts
    - npm run pact:publish
    - npm run pact:verify
  artifacts:
    reports:
      junit: contract-test-results.xml
    paths:
      - pacts/
      - contract-reports/
```

### Contract Test Data

**Test Data Management**
- Use contract-specific test data
- Implement data builders for contracts
- Manage test data versioning
- Clean up test data after runs
- Handle sensitive data appropriately
- Maintain data consistency

## Error Handling & Recovery

### Contract Violation Handling

**Violation Detection**
- Detect schema mismatches
- Identify breaking changes
- Monitor error rates
- Track performance degradation
- Alert on compliance failures
- Generate violation reports

**Recovery Strategies**
- Implement graceful fallbacks
- Use circuit breaker patterns
- Cache previous valid responses
- Route to backup services
- Implement retry with backoff
- Provide user-friendly errors

## Success Criteria

- 100% service boundary coverage
- All API contracts validated
- Breaking changes detected automatically
- Consumer expectations verified
- Provider capabilities confirmed
- Contract documentation generated
- CI/CD pipeline integration complete
- Production monitoring established

## Contract Testing Best Practices

### Design Principles
- Start with contracts, not implementations
- Version contracts semantically
- Minimize breaking changes
- Use evolution strategies
- Document contract decisions
- Automate contract validation

### Maintenance Guidelines
- Review contracts regularly
- Update documentation promptly
- Monitor usage patterns
- Plan deprecation carefully
- Communicate changes early
- Test upgrade paths

Write and execute these contract tests, establish contract validation pipelines, and ensure robust service boundary agreements.

## Command Completion

✅ `/tests-write-contract $ARGUMENTS` command complete.

Summary: Written comprehensive contract tests covering service boundaries, API agreements, and integration contracts with automated validation and monitoring.