# 🧪 Unit Test Coverage Plan - 80% Target

## Current Status
- **Total Source Files**: 114
- **Files with Tests**: 6 (teams + existing unit tests)
- **Coverage Gap**: 108 files need tests
- **Target**: 80% coverage overnight

---

## 📊 Priority Classification

### 🚨 CRITICAL (Must Test - 80%+ coverage required)
**Core Infrastructure & Security** (22 files)

1. **Authentication & Authorization**
   - `src/auth/middleware.ts` ⭐ (some coverage exists)
   - `src/auth/supabase.ts` ⭐
   - `src/lib/auth.ts`

2. **Database & Storage**
   - `src/lib/db.ts` ⭐
   - `src/lib/store.ts` ⭐
   - `src/billing/stripe.ts` ⭐

3. **API Routes** (most critical)
   - `src/api/routes/auth_v2.ts` ⭐ (has team tests)
   - `src/api/routes/billing.ts` ⭐
   - `src/api/routes/webhooks.ts` ⭐
   - `src/api/routes/projects.ts` ⭐
   - `src/api/routes/responses.ts` ⭐

4. **Email System**
   - `src/lib/email/resend-client.ts` ⭐
   - `src/services/email/emailService.ts` ⭐
   - `src/services/email/teamEmails.ts` ⭐

5. **Queue & Processing**
   - `src/lib/queue.ts` ⭐
   - `src/lib/queue/PostgresAdapter.ts` ⭐
   - `src/lib/queue/RedisAdapter.ts` ⭐
   - `src/lib/queue/MemoryAdapter.ts` ⭐

6. **Models & Providers**
   - `src/models/router.ts` ⭐
   - `src/models/providers/openai.ts` ⭐
   - `src/models/providers/anthropic.ts` ⭐
   - `src/models/providers/gemini.ts` ⭐

### 🔥 HIGH PRIORITY (40-60% coverage)
**Business Logic & Core Features** (35 files)

7. **Worker System**
   - `src/worker/runner.ts`
   - `src/worker/handlers/bash.ts`
   - `src/worker/handlers/codegen.ts`
   - `src/worker/handlers/git_ops.ts`

8. **Services & Business Logic**
   - `src/services/responses/runtime.ts`
   - `src/services/responses/runCoordinator.ts`
   - `src/services/responses/openaiClient.ts`
   - `src/services/builder/builderManager.ts`
   - `src/services/builder/builderCompiler.ts`

9. **Configuration & Utils**
   - `src/config/email.ts`
   - `src/config/app.ts`
   - `src/lib/logger.ts`
   - `src/lib/projects.ts`
   - `src/lib/artifacts.ts`
   - `src/lib/json.ts`

10. **API Routes (remaining)**
    - `src/api/routes/settings.ts`
    - `src/api/routes/models.ts`
    - `src/api/routes/queue.ts`
    - `src/api/routes/builder.ts`

### 📝 MEDIUM PRIORITY (20-40% coverage)
**Supporting Features** (30 files)

11. **Email Templates**
    - `src/features/emails/WelcomeEmail.tsx`
    - `src/features/emails/TeamInviteEmail.tsx` (partial coverage)
    - `src/features/emails/PaymentFailedEmail.tsx`
    - `src/features/emails/SubscriptionConfirmationEmail.tsx`

12. **Utility Libraries**
    - `src/lib/cache.ts`
    - `src/lib/backup.ts`
    - `src/lib/settings.ts`
    - `src/lib/metrics.ts`
    - `src/lib/events.ts`

### 🔧 LOW PRIORITY (Basic smoke tests)
**Development & Supporting** (27 files)

13. **Development Tools**
    - `src/api/loader.ts`
    - `src/api/planBuilder.ts`
    - `src/tools/codegen.ts`
    - `src/lib/devRestart.ts`

---

## 🤝 Work Split Proposal

### **Your Half (54 files) - Infrastructure & Core**

**CRITICAL Priority (11 files)**
1. `src/auth/supabase.ts` - Auth foundation
2. `src/lib/db.ts` - Database layer
3. `src/lib/store.ts` - Core data store
4. `src/billing/stripe.ts` - Payment processing
5. `src/api/routes/billing.ts` - Billing API
6. `src/api/routes/projects.ts` - Project management
7. `src/lib/queue.ts` - Queue system
8. `src/lib/queue/PostgresAdapter.ts` - DB queue
9. `src/models/router.ts` - Model routing
10. `src/models/providers/openai.ts` - OpenAI integration
11. `src/models/providers/anthropic.ts` - Anthropic integration

**HIGH Priority (22 files)**
- Worker handlers (bash, codegen, git_ops, etc.)
- Services (runtime, runCoordinator, etc.)
- Configuration files
- Remaining API routes

**MEDIUM Priority (11 files)**
- Utility libraries
- Cache, backup, settings

**LOW Priority (10 files)**
- Development tools
- Supporting utilities

### **My Half (54 files) - API & Features**

**CRITICAL Priority (11 files)**
1. `src/auth/middleware.ts` - Auth middleware (partial)
2. `src/lib/auth.ts` - Auth utilities
3. `src/api/routes/auth_v2.ts` - Auth API (partial)
4. `src/api/routes/webhooks.ts` - Webhook handling
5. `src/api/routes/responses.ts` - Response API
6. `src/lib/email/resend-client.ts` - Email client
7. `src/services/email/emailService.ts` - Email service
8. `src/services/email/teamEmails.ts` - Team emails
9. `src/lib/queue/RedisAdapter.ts` - Redis queue
10. `src/lib/queue/MemoryAdapter.ts` - Memory queue
11. `src/models/providers/gemini.ts` - Gemini provider

**HIGH Priority (22 files)**
- Builder services
- Response services
- Remaining worker handlers
- Core utilities

**MEDIUM Priority (11 files)**
- Email templates
- Supporting services

**LOW Priority (10 files)**
- Development utilities
- Minor components

---

## 🎯 Coverage Targets

### Critical Files: 80-95%
- Comprehensive unit tests
- Edge case coverage
- Error handling tests
- Security validation

### High Priority: 60-80%
- Core functionality tests
- Main use cases
- Error scenarios

### Medium Priority: 40-60%
- Basic functionality
- Happy path tests
- Simple error cases

### Low Priority: 20-40%
- Smoke tests
- Basic validation

---

## 🏃‍♀️ Execution Plan

### Phase 1: Critical Infrastructure (2-3 hours)
- Authentication & database tests
- API route core tests
- Email system tests
- Queue system tests

### Phase 2: High Priority Features (2-3 hours)
- Worker system tests
- Service layer tests
- Configuration tests

### Phase 3: Medium Priority (1-2 hours)
- Template tests
- Utility tests
- Supporting feature tests

### Phase 4: Cleanup & Verification (1 hour)
- Coverage report generation
- Gap analysis
- Documentation updates

---

## 📋 Test Categories per File

### Standard Test Structure:
```typescript
describe('ModuleName', () => {
  describe('Unit Tests', () => {
    // Basic functionality
    // Input validation
    // Error handling
  });

  describe('Security Tests', () => {
    // XSS prevention
    // SQL injection
    // Auth bypass
  });

  describe('Performance Tests', () => {
    // Load handling
    // Memory usage
    // Response times
  });

  describe('Edge Cases', () => {
    // Boundary conditions
    // Null/undefined handling
    // Network failures
  });
});
```

---

## 🚀 Success Metrics

- **Overall Coverage**: 80%+
- **Critical Files**: 90%+
- **Test Count**: 500+ tests
- **Zero Critical Vulnerabilities**
- **All Tests Passing**

Ready to split the work? I'll take my half and start with the critical auth and email systems!