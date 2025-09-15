---
name: tests-write-api
description: Write comprehensive API contract and behavior tests
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL API TEST SUITE**
Writing tests for all API endpoints, contracts, and integrations...
{{else}}
**Mode: RECENT API CHANGES**
Focusing on recently modified API endpoints. I will:
1. Test new or modified API endpoints
2. Validate contract changes in recent commits
3. Focus on APIs you've recently implemented or discussed

To write tests for all API endpoints, use: `/tests-write-api --all`
{{/if}}

Write comprehensive API tests to validate contracts, behavior, and documentation:

## API Testing Objectives

### 1. Contract Testing

**Request Validation**
- Test required vs optional parameters
- Validate parameter data types
- Test parameter constraints (min/max/pattern)
- Verify request header requirements
- Test content-type negotiations
- Validate request body schemas

**Response Validation**
- Verify response status codes
- Validate response headers
- Test response body structure
- Verify data types in responses
- Test pagination metadata
- Validate HATEOAS links

**Schema Compliance**
- Test against OpenAPI/Swagger specs
- Validate JSON Schema compliance
- Test GraphQL schema adherence
- Verify Protocol Buffer contracts
- Test backward compatibility
- Validate versioning strategy

### 2. RESTful Principles

**HTTP Methods**
- GET: Test idempotency and caching
- POST: Test resource creation
- PUT: Test full updates
- PATCH: Test partial updates
- DELETE: Test resource removal
- OPTIONS: Test CORS preflight
- HEAD: Test metadata retrieval

**Status Codes**
```javascript
const expectedStatusCodes = {
  success: {
    200: 'OK - GET/PUT/PATCH',
    201: 'Created - POST',
    204: 'No Content - DELETE',
    206: 'Partial Content - Range requests'
  },
  redirection: {
    301: 'Moved Permanently',
    304: 'Not Modified - Caching',
    307: 'Temporary Redirect'
  },
  clientError: {
    400: 'Bad Request - Invalid input',
    401: 'Unauthorized - Missing auth',
    403: 'Forbidden - Insufficient permissions',
    404: 'Not Found - Resource missing',
    409: 'Conflict - Duplicate/constraint',
    422: 'Unprocessable Entity - Validation',
    429: 'Too Many Requests - Rate limit'
  },
  serverError: {
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  }
};
```

### 3. API Behavior Tests

**CRUD Operations**
- Create: Test entity creation with all fields
- Read: Test single and collection retrieval
- Update: Test full and partial updates
- Delete: Test soft and hard deletes
- List: Test filtering, sorting, pagination
- Search: Test full-text and faceted search

**Business Logic**
- Test complex workflows via API
- Validate business rule enforcement
- Test transaction boundaries
- Verify calculation accuracy
- Test state transitions
- Validate conditional logic

### 4. Data Validation Tests

**Input Validation**
- Test with missing required fields
- Submit invalid data types
- Test boundary values
- Submit malformed JSON/XML
- Test special characters
- Validate internationalization

**Output Validation**
- Verify data transformation accuracy
- Test field masking/filtering
- Validate computed fields
- Test data formatting
- Verify timezone handling
- Test localization

### 5. Authentication & Authorization

**Authentication Methods**
- Test API key authentication
- Validate Bearer token (JWT)
- Test OAuth 2.0 flows
- Verify Basic authentication
- Test session-based auth
- Validate mTLS authentication

**Authorization Scenarios**
- Test role-based access
- Verify resource-level permissions
- Test field-level security
- Validate scope restrictions
- Test delegation scenarios
- Verify tenant isolation

### 6. API Performance Tests

**Response Time**
- Measure baseline response times
- Test under various payloads
- Validate streaming responses
- Test chunked transfer encoding
- Measure time to first byte
- Test connection pooling

**Throughput**
- Test requests per second
- Validate concurrent request handling
- Test rate limiting accuracy
- Verify throttling behavior
- Test burst capacity
- Validate queue management

### 7. Error Handling Tests

**Error Responses**
```javascript
const errorResponseTests = {
  structure: {
    error: 'string',
    message: 'string',
    details: 'array',
    timestamp: 'ISO8601',
    path: 'string',
    requestId: 'uuid'
  },
  scenarios: [
    'Invalid JSON syntax',
    'Missing required fields',
    'Invalid field values',
    'Unauthorized access',
    'Resource not found',
    'Conflict on creation',
    'Server errors'
  ]
};
```

**Error Recovery**
- Test retry-able vs non-retry-able errors
- Validate error code consistency
- Test partial success scenarios
- Verify rollback on errors
- Test error message clarity
- Validate problem details (RFC 7807)

### 8. API Versioning Tests

**Version Compatibility**
- Test multiple API versions
- Validate deprecation warnings
- Test version negotiation
- Verify backward compatibility
- Test migration paths
- Validate sunset headers

### 9. Integration Patterns

**Pagination Tests**
- Test limit/offset pagination
- Validate cursor-based pagination
- Test page size limits
- Verify total count accuracy
- Test navigation links
- Validate stable pagination

**Filtering & Sorting**
- Test single field filters
- Validate complex filter combinations
- Test sort order (ASC/DESC)
- Verify multi-field sorting
- Test filter validation
- Validate default behaviors

**Batch Operations**
- Test bulk create/update/delete
- Validate transaction semantics
- Test partial success handling
- Verify batch size limits
- Test async batch processing
- Validate batch status tracking

### 10. GraphQL Specific Tests

**Query Tests**
- Test query depth limits
- Validate query complexity
- Test field resolution
- Verify N+1 query prevention
- Test query batching
- Validate introspection

**Mutation Tests**
- Test input validation
- Verify optimistic updates
- Test error handling
- Validate side effects
- Test subscription triggers
- Verify cache invalidation

### 11. WebSocket/SSE Tests

**Connection Management**
- Test connection establishment
- Validate authentication
- Test reconnection logic
- Verify heartbeat/ping-pong
- Test connection limits
- Validate graceful shutdown

**Message Flow**
- Test message ordering
- Validate message delivery
- Test broadcast scenarios
- Verify subscription management
- Test backpressure handling
- Validate message replay

## API Documentation Tests

### Documentation Validation
- Test example requests/responses
- Validate against live API
- Test code samples
- Verify parameter descriptions
- Test authentication examples
- Validate error documentation

### API Explorer Tests
- Test interactive documentation
- Validate try-it-out functionality
- Test OAuth flow in docs
- Verify request builders
- Test response visualization
- Validate download features

## Test Implementation

### Test Organization
```javascript
describe('API Test Suite', () => {
  describe('Authentication', () => {
    test('Valid token returns 200', async () => {});
    test('Invalid token returns 401', async () => {});
    test('Expired token returns 401', async () => {});
  });
  
  describe('CRUD Operations', () => {
    test('POST creates resource', async () => {});
    test('GET retrieves resource', async () => {});
    test('PUT updates resource', async () => {});
    test('DELETE removes resource', async () => {});
  });
  
  describe('Edge Cases', () => {
    test('Handles special characters', async () => {});
    test('Handles large payloads', async () => {});
    test('Handles concurrent updates', async () => {});
  });
});
```

## Success Criteria
- 100% endpoint coverage
- All status codes tested
- Contract compliance verified
- Performance benchmarks met
- Security requirements validated
- Documentation accuracy confirmed
- Error handling comprehensive
- Backward compatibility maintained

Write and execute these API tests, validate contracts, and ensure documentation accuracy.

## Command Completion

✅ `/tests-write-api $ARGUMENTS` command complete.

Summary: Written comprehensive API tests covering contract validation, behavior verification, and documentation accuracy.