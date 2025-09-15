---
name: tests-write-integration
description: Write integration tests for component interactions and system flows
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL SYSTEM INTEGRATION TESTING**
Writing integration tests for all component interactions and workflows...
{{else}}
**Mode: RECENT INTEGRATION POINTS**
Focusing on recently modified integrations. I will:
1. Test interactions between recently modified components
2. Cover new API endpoints or service connections
3. Focus on integration points you've recently worked on

To write integration tests for the entire system, use: `/tests-write-integration --all`
{{/if}}

Write comprehensive integration tests to validate component interactions and system workflows:

## Integration Testing Focus

### 1. Component Interaction Testing
- Test communication between modules/services
- Validate data flow across system boundaries
- Verify contract compliance between components
- Test dependency injection and initialization

### 2. Database Integration
- Test actual database operations (CRUD)
- Validate transaction handling and rollbacks
- Test connection pooling and timeouts
- Verify data persistence and retrieval accuracy
- Test migration scripts and schema changes

### 3. External Service Integration
- Test API client interactions with real/mock services
- Validate request/response transformations
- Test retry logic and circuit breakers
- Verify timeout and error handling
- Test rate limiting and throttling

### 4. Message Queue Integration
- Test message publishing and consumption
- Validate message ordering and delivery guarantees
- Test dead letter queue handling
- Verify message serialization/deserialization
- Test concurrent message processing

## Test Scenarios

### Critical User Workflows
- Test complete user journeys (signup → login → action → logout)
- Validate multi-step processes and state transitions
- Test workflow compensation and rollback scenarios
- Verify business rule enforcement across components

### Data Consistency
- Test data synchronization between systems
- Validate cache invalidation and updates
- Test eventual consistency scenarios
- Verify referential integrity across services

### Configuration and Environment
- Test with different configuration profiles
- Validate feature flags and toggles
- Test environment-specific behaviors
- Verify configuration hot-reloading

## Implementation Requirements

### Test Infrastructure
- Set up test databases with realistic data
- Configure test containers or in-memory systems
- Implement test data factories and builders
- Create cleanup procedures for test isolation

### Test Execution
- Run tests against real infrastructure (not mocks)
- Use test transactions where possible for rollback
- Implement proper test ordering if needed
- Ensure tests are idempotent and repeatable

### Validation Points
- Verify data persistence across components
- Check audit logs and event streams
- Validate side effects (emails, notifications, etc.)
- Confirm system state after operations

## Error Scenarios

### Network Issues
- Test connection failures and timeouts
- Simulate network partitions
- Test partial failures in distributed operations
- Verify graceful degradation

### Resource Constraints
- Test behavior under database connection limits
- Simulate memory pressure scenarios
- Test file system constraints
- Verify queue overflow handling

### Concurrent Operations
- Test race conditions and deadlocks
- Validate optimistic locking mechanisms
- Test parallel request handling
- Verify data consistency under load

## Success Criteria
- All integration points covered with tests
- Critical user paths fully tested
- Error scenarios properly handled
- Tests run in reasonable time (< 5 minutes)
- No test pollution or side effects
- Clear failure messages for debugging

Write and execute these integration tests now, fixing any issues discovered.

## Command Completion

✅ `/tests-write-integration $ARGUMENTS` command complete.

Summary: Written comprehensive integration tests covering component interactions, data flows, and system boundaries.