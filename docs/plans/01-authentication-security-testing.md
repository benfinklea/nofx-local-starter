# Testing Prompt 1: Authentication & Security Testing Suite

## Priority: CRITICAL 🔴
**Estimated Time:** 5 hours
**Coverage Target:** 95% for all authentication and security modules

## Objective
Implement comprehensive test coverage for authentication, authorization, API key management, rate limiting, and security middleware. These are the most critical components protecting the system from unauthorized access and abuse.

## Files to Test

### Core Authentication Services
- `src/auth/middleware/AuthenticationService.ts` (0% → 95%)
- `src/auth/middleware/AuthorizationService.ts` (0% → 95%)
- `src/auth/middleware/OwnershipValidationService.ts` (0% → 95%)
- `src/auth/middleware.ts` (0% → 90%)
- `src/auth/supabase.ts` (0% → 85%)

### API Key Management
- `src/api/routes/auth_v2/ApiKeyService.ts` (0% → 95%)
- `src/api/routes/auth_v2/AuthService.ts` (0% → 95%)
- `src/api/routes/auth_v2/handlers.ts` (0% → 90%)

### Rate Limiting & Usage Tracking
- `src/auth/middleware/RateLimitingService.ts` (0% → 95%)
- `src/auth/middleware/UsageTrackingService.ts` (0% → 90%)

### Security Middleware
- `src/middleware/security.ts` (0% → 95%)
- `src/api/server/middleware.ts` (0% → 85%)

## Test Requirements

### 1. Unit Tests - AuthenticationService
```typescript
// Test scenarios to implement:
- JWT token validation (valid, expired, malformed, missing)
- Session management (create, refresh, invalidate)
- User authentication flow (login, logout, session persistence)
- Multi-factor authentication if applicable
- Password reset token generation and validation
- OAuth provider integration (GitHub, Google, etc.)
- Token signature verification
- Token payload extraction and validation
- Refresh token rotation
- Concurrent session handling
```

### 2. Unit Tests - AuthorizationService
```typescript
// Test scenarios to implement:
- Role-based access control (admin, user, guest)
- Permission checking for resources
- Team membership validation
- Project access validation
- API endpoint authorization
- Resource ownership verification
- Hierarchical permission inheritance
- Permission caching and invalidation
- Cross-team resource access
- Service account authorization
```

### 3. Unit Tests - ApiKeyService
```typescript
// Test scenarios to implement:
- API key generation (entropy, uniqueness)
- Key rotation and expiration
- Key scoping and permissions
- Key validation and authentication
- Key revocation and blacklisting
- Rate limiting per key
- Key usage analytics
- Key encryption at rest
- Temporary key generation
- Key audit logging
```

### 4. Integration Tests - Authentication Flow
```typescript
// Full authentication flow tests:
- Complete user registration flow
- Login with email/password
- Login with OAuth providers
- Session refresh flow
- Password reset flow
- Account verification flow
- MFA enrollment and verification
- Account lockout after failed attempts
- Concurrent login from multiple devices
- Session timeout and extension
```

### 5. Security Tests - Rate Limiting
```typescript
// Rate limiting scenarios:
- Request throttling per IP
- Request throttling per user
- Request throttling per API key
- Burst handling
- Rate limit headers
- Distributed rate limiting (Redis)
- Rate limit bypass for admin
- Custom rate limits per endpoint
- Rate limit recovery
- DDoS protection
```

### 6. Security Tests - Input Validation
```typescript
// Security validation tests:
- SQL injection prevention
- XSS attack prevention
- CSRF token validation
- Input sanitization
- File upload validation
- JSON payload size limits
- Request header validation
- Path traversal prevention
- Command injection prevention
- XXE attack prevention
```

## Edge Cases to Test

1. **Token Edge Cases**
   - Clock skew tolerance
   - Token issued in the future
   - Duplicate token usage
   - Token with invalid signature algorithm
   - Token with manipulated claims

2. **Session Edge Cases**
   - Session fixation attacks
   - Session hijacking attempts
   - Concurrent session modifications
   - Session storage failures
   - Cross-domain session sharing

3. **API Key Edge Cases**
   - Key enumeration attacks
   - Timing attacks on key validation
   - Key collision probability
   - Key format validation
   - Unicode and special characters in keys

4. **Rate Limiting Edge Cases**
   - Time window boundary conditions
   - Counter overflow scenarios
   - Redis connection failures
   - Rate limit state corruption
   - Clock synchronization issues

## Performance Requirements

- Authentication check: < 10ms
- Authorization check: < 5ms
- API key validation: < 15ms
- Rate limit check: < 3ms
- Token generation: < 50ms
- Password hashing: < 100ms

## Mocking Strategy

1. **Database Mocks**
   - Mock Supabase client
   - Mock user tables
   - Mock session storage
   - Mock API key storage

2. **External Service Mocks**
   - Mock OAuth providers
   - Mock email service for password reset
   - Mock Redis for rate limiting
   - Mock audit logging service

3. **Time-based Mocks**
   - Mock Date.now() for token expiration
   - Mock setTimeout for session timeouts
   - Mock rate limit windows

## Testing Framework & Tools

### Primary Testing Framework: Jest
All tests MUST be written using Jest as the testing framework. Jest configuration is already set up in the project.

### Using the test-generator Subagent
For efficient test generation, use the Claude Code test-generator subagent:
```bash
# Use the test-generator subagent to create tests
# Example command:
/test-generator "Create comprehensive unit tests for AuthenticationService"
```

The test-generator subagent can:
- Generate test scaffolding based on code analysis
- Create test data factories
- Generate mock implementations
- Suggest edge cases based on code paths
- Create integration test scenarios

### Required Testing Tools
- **Jest**: Primary testing framework (already configured)
- **Supertest**: API integration tests
- **Jest-extended**: Additional matchers
- **Mockdate**: Time manipulation
- **Redis-mock**: Rate limiting tests
- **JWT libraries**: Token manipulation

## Expected Outcomes

1. **Security Vulnerabilities**: Zero security vulnerabilities in authentication flow
2. **Performance**: All auth operations under specified thresholds
3. **Coverage**: Minimum 95% code coverage for critical auth modules
4. **Documentation**: Complete test documentation for security review
5. **Regression Prevention**: Comprehensive test suite preventing auth bugs

## Validation Checklist

- [ ] All auth endpoints have integration tests
- [ ] All security middleware have unit tests
- [ ] Rate limiting works across distributed system
- [ ] Token validation is timing-attack resistant
- [ ] Session management is thread-safe
- [ ] API keys are properly encrypted
- [ ] Auth logs are comprehensive for audit
- [ ] Error messages don't leak sensitive info
- [ ] All OWASP Top 10 vulnerabilities tested
- [ ] Performance benchmarks are met

## Notes for Test Implementation

- Use factory patterns for test user creation
- Implement helper functions for auth token generation
- Create test fixtures for common auth scenarios
- Use snapshot testing for error responses
- Implement custom Jest matchers for auth assertions
- Consider property-based testing for token generation
- Use coverage reports to identify untested branches
- Document security test rationale in comments