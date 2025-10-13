# Testing Prompt 2: Core API Routes Testing Suite

## Priority: CRITICAL 🔴
**Estimated Time:** 5 hours
**Coverage Target:** 90% for all core API routes

## Objective
Implement comprehensive test coverage for the main API routes that handle core business logic including responses, teams, projects, and settings. These routes have 0% coverage and are essential for system functionality.

## Files to Test

### Response Management Routes
- `src/api/routes/responses.ts` (0% → 90%)
- `src/api/server/handlers/runs.ts` (0% → 85%)
- `src/services/responses/runtime/RuntimeSummaryService.ts` (Modified → 95%)

### Team Management Routes
- `src/api/routes/teams/TeamService.ts` (0% → 90%)
- `src/api/routes/teams/MemberService.ts` (0% → 90%)
- `src/api/routes/teams/InviteService.ts` (0% → 90%)
- `src/api/routes/teams/handlers.ts` (0% → 85%)

### Project Management Routes
- `src/api/routes/projects.ts` (Modified → 90%)
- `src/api/routes/ui_projects.ts` (0% → 85%)
- `src/api/routes/builder.ts` (0% → 85%)

### Settings & Configuration Routes
- `src/api/routes/settings.ts` (0% → 90%)
- `src/api/routes/models.ts` (0% → 85%)
- `src/api/routes/gates.ts` (0% → 85%)

## Test Requirements

### 1. Unit Tests - Response Routes
```typescript
// Test scenarios for responses.ts:
- Create new response (valid/invalid payload)
- Update response status (pending → running → completed)
- Response streaming (SSE events)
- Response pagination and filtering
- Response search functionality
- Response archival and deletion
- Response access control
- Response artifact handling
- Response metrics collection
- Concurrent response updates
- Response rollback functionality
- Response retry logic
- Response timeout handling
- Response error propagation
```

### 2. Unit Tests - Team Management
```typescript
// Test scenarios for team services:
- Team creation with validation
- Team member addition/removal
- Team role management (owner, admin, member)
- Team invitation flow (create, send, accept, reject)
- Team deletion with cascade
- Team quota enforcement
- Team billing integration
- Team activity logging
- Cross-team collaboration
- Team permission inheritance
- Invitation expiration
- Duplicate invitation handling
- Team transfer ownership
- Team suspension/reactivation
```

### 3. Unit Tests - Project Management
```typescript
// Test scenarios for project routes:
- Project creation with templates
- Project configuration updates
- Project deletion with cleanup
- Project cloning/forking
- Project sharing and permissions
- Project environment variables
- Project build configuration
- Project deployment settings
- Project resource limits
- Project version control
- GitHub integration
- Project analytics
- Project backup/restore
- Project migration
```

### 4. Integration Tests - API Workflows
```typescript
// End-to-end API flow tests:
- Complete project lifecycle (create → configure → run → delete)
- Team collaboration workflow
- Response generation pipeline
- Multi-step approval workflow
- Resource allocation and limits
- API versioning compatibility
- Webhook event flow
- Real-time updates via SSE
- Batch operations
- Transaction rollback scenarios
```

### 5. Unit Tests - Settings Management
```typescript
// Settings and configuration tests:
- User settings CRUD operations
- Team settings management
- Global settings (admin only)
- Settings validation and constraints
- Settings migration on schema change
- Settings export/import
- Settings audit trail
- Default settings application
- Settings inheritance hierarchy
- Settings conflict resolution
```

### 6. Unit Tests - Model Routes
```typescript
// Model management tests:
- Model registration and validation
- Model version management
- Model access control
- Model usage tracking
- Model performance metrics
- Model fallback handling
- Model cost calculation
- Custom model configuration
- Model health checks
- Model rotation/switching
```

## Edge Cases to Test

1. **Pagination Edge Cases**
   - Empty result sets
   - Single item pages
   - Out of bounds page numbers
   - Invalid page sizes
   - Cursor-based pagination edge cases

2. **Concurrency Edge Cases**
   - Simultaneous updates to same resource
   - Race conditions in team member management
   - Concurrent project deletions
   - Parallel response streaming
   - Lock timeout scenarios

3. **Data Validation Edge Cases**
   - Maximum field lengths
   - Special characters in names
   - Unicode handling
   - Null vs undefined values
   - Empty strings vs missing fields

4. **Resource Limit Edge Cases**
   - Quota exceeded scenarios
   - Rate limit boundaries
   - Storage limit enforcement
   - Concurrent connection limits
   - Memory limit handling

## Performance Requirements

- List operations: < 100ms for 100 items
- Create operations: < 50ms
- Update operations: < 30ms
- Delete operations: < 50ms
- Search operations: < 200ms
- Bulk operations: < 500ms for 100 items

## Mocking Strategy

1. **Database Mocks**
   - Mock database connections
   - Mock transaction management
   - Mock query builders
   - Mock connection pools

2. **Service Mocks**
   - Mock email service
   - Mock notification service
   - Mock analytics service
   - Mock storage service

3. **External API Mocks**
   - Mock GitHub API
   - Mock OAuth providers
   - Mock webhook endpoints
   - Mock CDN services

## Testing Framework & Tools

### Primary Testing Framework: Jest
All tests MUST be written using Jest as the testing framework. Jest is already configured in the project with appropriate settings for this codebase.

### Using the test-generator Subagent
Leverage the Claude Code test-generator subagent for efficient test creation:
```bash
# Generate tests for specific routes
/test-generator "Create integration tests for team management API routes"

# Generate comprehensive test suites
/test-generator "Generate unit and integration tests for ResponseService with all edge cases"
```

The test-generator subagent capabilities:
- Analyze route handlers and generate appropriate tests
- Create request/response mocks
- Generate test fixtures for API payloads
- Identify authorization test cases
- Create end-to-end test scenarios

## Testing Patterns

### Request/Response Testing
```typescript
describe('POST /api/responses', () => {
  it('should create response with valid data', async () => {
    const response = await request(app)
      .post('/api/responses')
      .set('Authorization', 'Bearer valid-token')
      .send(validPayload)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      status: 'pending',
      ...validPayload
    });
  });
});
```

### Service Layer Testing
```typescript
describe('TeamService', () => {
  it('should enforce member limits', async () => {
    const team = await createTeamWithLimit(5);
    await addTeamMembers(team, 4);

    await expect(
      teamService.addMember(team.id, newMember)
    ).rejects.toThrow('Team member limit exceeded');
  });
});
```

## Expected Outcomes

1. **API Reliability**: 99.9% uptime for critical endpoints
2. **Response Times**: All endpoints meet performance targets
3. **Error Handling**: Comprehensive error responses with proper status codes
4. **Data Integrity**: No data corruption under concurrent access
5. **Backwards Compatibility**: All v1 endpoints remain functional

## Validation Checklist

- [ ] All CRUD operations tested for each resource
- [ ] Authorization checked for all endpoints
- [ ] Input validation for all request bodies
- [ ] Pagination tested for all list endpoints
- [ ] Error responses follow consistent format
- [ ] API documentation matches implementation
- [ ] Rate limiting applied consistently
- [ ] Database transactions properly managed
- [ ] Resource cleanup on deletion
- [ ] Audit logs generated for all operations

## Testing Guidelines

1. **Test Organization**
   - Group tests by feature/endpoint
   - Use descriptive test names
   - Separate unit and integration tests
   - Use shared test utilities

2. **Data Management**
   - Use factories for test data creation
   - Clean up test data after each test
   - Use transactions for test isolation
   - Avoid hardcoded test data

3. **Assertion Patterns**
   - Test both success and failure paths
   - Verify response structure
   - Check side effects (database, events)
   - Validate error messages

4. **Performance Testing**
   - Include performance assertions
   - Test with realistic data volumes
   - Monitor memory usage
   - Test concurrent request handling