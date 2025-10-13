# TypeScript Type Safety Improvements

This document outlines the comprehensive TypeScript improvements implemented to enhance type safety, prevent runtime errors, and improve developer experience across the NOFX Control Plane codebase.

## Table of Contents

- [Overview](#overview)
- [Generic Constraints](#generic-constraints)
- [Standardized API Responses](#standardized-api-responses)
- [Discriminated Unions](#discriminated-unions)
- [Test Type Safety](#test-type-safety)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)

## Overview

The TypeScript improvements focus on four main areas:

1. **Generic Constraints** - Adding proper type constraints to prevent runtime type errors
2. **Standardized API Responses** - Consistent response typing across all endpoints
3. **Discriminated Unions** - Type-safe pattern matching for queue payloads and errors
4. **Test Type Safety** - Properly typed mocks for reliable tests

## Generic Constraints

### Queue Types (`src/lib/queue/types.ts`)

All queue job payloads now extend the `QueuePayload` base constraint:

```typescript
/**
 * Base constraint for all queue job payloads
 * All job data must be JSON-serializable
 */
export interface QueuePayload {
  [key: string]: unknown;
}

/**
 * Generic job with type-safe payload
 */
export interface Job<T extends QueuePayload = QueuePayload> {
  id: string;
  type: string;
  data: T;
  // ... other fields
}

/**
 * Generic job result with type-safe data
 */
export interface JobResult<T extends QueuePayload = QueuePayload> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Benefits:**
- Compile-time guarantee that job data is JSON-serializable
- Type inference for job data based on payload type
- Prevents accidentally passing non-serializable objects (functions, class instances, etc.)

### Store Types (`src/lib/store/types.ts`)

All storable entities now extend the `StorableEntity` base constraint:

```typescript
/**
 * Base constraint for all storable entities
 * Ensures entities have required audit fields
 */
export interface StorableEntity {
  id: string;
  created_at: string;
}

/**
 * Run record with proper type constraints
 */
export interface RunRow extends StorableEntity {
  id: string;
  status: RunStatus | string;
  plan?: JsonValue | null;
  created_at: string;
  // ... other fields
}
```

**Benefits:**
- Ensures all stored entities have consistent audit fields
- Type-safe operations on stored data
- Better IDE autocomplete and type checking

## Standardized API Responses

### Response Types (`src/shared/types.ts`)

All API endpoints now use standardized response envelopes:

```typescript
/**
 * Discriminated union of all API response types
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Successful response envelope
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    correlationId?: string;
    timestamp?: string;
    page?: number;
    limit?: number;
    total?: number;
  };
}

/**
 * Error response envelope
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    type: string;
    message: string;
    details?: unknown;
    code?: string;
  };
}
```

### Type Guards

Type guards enable safe type narrowing:

```typescript
function processResponse(response: ApiResponse<RunData>) {
  if (isApiSuccess(response)) {
    // TypeScript knows response.data exists
    console.log(response.data.runId);
  } else {
    // TypeScript knows response.error exists
    console.error(response.error.message);
  }
}
```

### ApiResponse Utility (`src/lib/apiResponse.ts`)

The `ApiResponse` utility class provides type-safe response helpers:

```typescript
import { ApiResponse } from '../../../lib/apiResponse';
import { createApiError } from '../../../lib/errors';

// Success response
ApiResponse.success(res, { teams });

// Success with status code
ApiResponse.success(res, { team }, 201);

// Error from typed ApiError
const apiError = createApiError.notFound('Team', teamId);
ApiResponse.fromApiError(res, apiError);

// Validation errors
const errors = parsed.error.errors.map(err => ({
  field: err.path.join('.'),
  message: err.message,
  code: err.code
}));
const apiError = createApiError.validationMultiple('Invalid data', errors);
ApiResponse.fromApiError(res, apiError);
```

### Updated Route Handlers

Example from `src/api/routes/teams/handlers.ts`:

```typescript
export async function handleListTeams(req: Request, res: Response): Promise<void> {
  try {
    const teams = await teamService.listUserTeams(req.userId!);
    ApiResponse.success(res, { teams });
  } catch (error) {
    log.error({ error }, 'List teams error');
    const apiError = createApiError.internal(
      'Failed to list teams',
      error,
      { userId: req.userId }
    );
    ApiResponse.fromApiError(res, apiError);
  }
}
```

Example from `src/api/routes/projects.ts`:

```typescript
app.get('/projects/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const row = await getProject(req.params.id);
    if (!row) {
      const apiError = createApiError.notFound('Project', req.params.id);
      return ApiResponse.fromApiError(res, apiError);
    }
    ApiResponse.success(res, row);
  } catch (error) {
    const apiError = createApiError.internal('Failed to get project', error, { projectId: req.params.id });
    ApiResponse.fromApiError(res, apiError);
  }
});
```

**Benefits:**
- Consistent response structure across all endpoints
- Type-safe error handling
- RFC 9457 Problem Details format for errors
- Automatic correlation ID tracking
- Better client-side type inference

## Discriminated Unions

### Queue Payloads (`src/lib/queue/payloads.ts`)

Queue payloads use discriminated unions for type-safe pattern matching:

```typescript
/**
 * Discriminated union of all queue payload types
 */
export type QueueEventPayload =
  | StepReadyPayload
  | StepFailedPayload
  | RunCompletedPayload
  | RunCancelledPayload
  | ArtifactGeneratedPayload
  | GateApprovalRequiredPayload;

/**
 * Payload with discriminant field
 */
export interface StepReadyPayload extends QueuePayload {
  type: 'step.ready';  // Discriminant
  runId: string;
  stepId: string;
  idempotencyKey: string;
  __attempt: number;
}
```

Usage example:

```typescript
function handleQueuePayload(payload: QueueEventPayload) {
  switch (payload.type) {
    case 'step.ready':
      // TypeScript knows payload is StepReadyPayload
      console.log(payload.stepId, payload.__attempt);
      break;

    case 'run.completed':
      // TypeScript knows payload is RunCompletedPayload
      console.log(payload.status, payload.duration);
      break;

    default:
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustive: never = payload;
      throw new Error(`Unhandled payload type: ${_exhaustive}`);
  }
}
```

### API Errors (`src/lib/errors.ts`)

Error types use discriminated unions for type-safe error handling:

```typescript
/**
 * Discriminated union of all API error types
 */
export type ApiError =
  | { type: 'validation'; message: string; field: string; code?: string }
  | { type: 'validation_multiple'; message: string; errors: ValidationErrorDetail[] }
  | { type: 'authentication'; message: string; reason?: string }
  | { type: 'authorization'; message: string; resource?: string; action?: string }
  | { type: 'not_found'; message: string; resource: string; id?: string }
  | { type: 'conflict'; message: string; reason?: string; conflictingId?: string }
  | { type: 'rate_limit'; message: string; retryAfter?: number }
  | { type: 'internal'; message: string; cause?: unknown; context?: Record<string, unknown> }
  | { type: 'external'; message: string; service: string; statusCode?: number; cause?: unknown }
  | { type: 'timeout'; message: string; operation: string; timeoutMs: number }
  | { type: 'bad_request'; message: string; details?: string };
```

Usage with factory functions:

```typescript
// Create typed errors
const error = createApiError.notFound('Team', teamId);
const error = createApiError.validation('email', 'Invalid email format', 'INVALID_EMAIL');
const error = createApiError.internal('Operation failed', originalError, { context });

// Type-safe error handling
function handleError(error: ApiError) {
  switch (error.type) {
    case 'validation':
      console.log(`Field ${error.field} is invalid: ${error.message}`);
      break;

    case 'not_found':
      console.log(`${error.resource} not found`);
      if (error.id) console.log(`ID: ${error.id}`);
      break;

    // ... other cases
  }
}
```

**Benefits:**
- Compile-time exhaustiveness checking
- Type narrowing based on discriminant field
- Impossible to access fields that don't exist for a specific type
- Self-documenting code through explicit type variants

## Test Type Safety

### Typed Mocks (`tests/unit/teams-routes-simple.test.ts`)

Test mocks now use proper TypeScript types:

```typescript
/**
 * Supabase client chainable query builder mock type
 */
interface MockSupabaseChainable {
  from: jest.MockedFunction<(table: string) => MockSupabaseChainable>;
  select: jest.MockedFunction<(columns?: string) => MockSupabaseChainable>;
  insert: jest.MockedFunction<(data: any) => MockSupabaseChainable>;
  update: jest.MockedFunction<(data: any) => MockSupabaseChainable>;
  delete: jest.MockedFunction<() => MockSupabaseChainable>;
  eq: jest.MockedFunction<(column: string, value: any) => MockSupabaseChainable | Promise<any>>;
  // ... other methods
  then: jest.MockedFunction<(resolve: (value: any) => void) => Promise<any>>;
  catch: jest.MockedFunction<(reject?: (reason: any) => void) => Promise<any>>;
}

/**
 * Type-safe middleware mock
 */
type MockMiddleware = jest.MockedFunction<(req: Request, res: Response, next: NextFunction) => void>;
```

Usage:

```typescript
// Create properly typed mock
const createChainableMock = (): MockSupabaseChainable => {
  const chainable = {} as MockSupabaseChainable;

  chainable.from = jest.fn(() => chainable) as jest.MockedFunction<(table: string) => MockSupabaseChainable>;
  chainable.select = jest.fn(() => chainable) as jest.MockedFunction<(columns?: string) => MockSupabaseChainable>;
  // ... configure other methods

  return chainable;
};

// Use in tests
const mockSupabase = createChainableMock();
mockCreateServiceClient.mockReturnValue(mockSupabase as any);
```

**Benefits:**
- Type-safe test setup and assertions
- IDE autocomplete for mock methods
- Catch test errors at compile time
- Better test maintainability

## Best Practices

### 1. Always Use Generic Constraints

```typescript
// ❌ Bad - no constraints
interface Container<T> {
  data: T;
}

// ✅ Good - constrained generic
interface Container<T extends Serializable> {
  data: T;
}
```

### 2. Prefer Discriminated Unions

```typescript
// ❌ Bad - no discriminant
type Result = { success: boolean; data?: any; error?: string };

// ✅ Good - discriminated union
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### 3. Use Type Guards

```typescript
// ❌ Bad - type assertion
const data = response.data as UserData;

// ✅ Good - type guard
if (isApiSuccess(response)) {
  const data = response.data; // Type is inferred safely
}
```

### 4. Leverage JSDoc for Complex Types

```typescript
/**
 * Process a queue job with proper type safety
 *
 * @template T - The payload type (must extend QueuePayload)
 * @param job - The job to process
 * @returns Promise resolving to job result
 *
 * @example
 * ```typescript
 * const job: Job<StepReadyPayload> = { ... };
 * const result = await processJob(job);
 * ```
 */
async function processJob<T extends QueuePayload>(
  job: Job<T>
): Promise<JobResult<T>> {
  // ...
}
```

### 5. Use Factory Functions for Type Safety

```typescript
// ✅ Factory function ensures correct structure
export function createStepReadyPayload(params: {
  runId: string;
  stepId: string;
  idempotencyKey: string;
  tool: string;
}): StepReadyPayload {
  return {
    type: 'step.ready',
    ...params,
  };
}

// Usage
const payload = createStepReadyPayload({
  runId: 'run_123',
  stepId: 'step_456',
  idempotencyKey: 'key_789',
  tool: 'codegen'
});
```

## Migration Guide

### Updating Existing Route Handlers

**Before:**
```typescript
export async function handleListTeams(req: Request, res: Response): Promise<void> {
  try {
    const teams = await teamService.listUserTeams(req.userId!);
    res.json({ teams });
  } catch (error) {
    log.error({ error }, 'List teams error');
    res.status(500).json({ error: (error as Error).message || 'Failed to list teams' });
  }
}
```

**After:**
```typescript
import { ApiResponse } from '../../../lib/apiResponse';
import { createApiError } from '../../../lib/errors';

export async function handleListTeams(req: Request, res: Response): Promise<void> {
  try {
    const teams = await teamService.listUserTeams(req.userId!);
    ApiResponse.success(res, { teams });
  } catch (error) {
    log.error({ error }, 'List teams error');
    const apiError = createApiError.internal(
      'Failed to list teams',
      error,
      { userId: req.userId }
    );
    ApiResponse.fromApiError(res, apiError);
  }
}
```

### Updating Queue Job Processing

**Before:**
```typescript
async function processJob(job: any) {
  if (job.type === 'step.ready') {
    const stepId = job.stepId; // No type checking
    // ...
  }
}
```

**After:**
```typescript
import { QueueEventPayload, isStepReadyPayload } from '../lib/queue/payloads';

async function processJob(job: Job<QueueEventPayload>) {
  const payload = job.data;

  if (isStepReadyPayload(payload)) {
    // TypeScript knows payload.stepId exists
    const stepId = payload.stepId;
    // ...
  }
}
```

### Updating Test Mocks

**Before:**
```typescript
const mockSupabase: any = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  // ... no type safety
};
```

**After:**
```typescript
interface MockSupabaseChainable {
  from: jest.MockedFunction<(table: string) => MockSupabaseChainable>;
  select: jest.MockedFunction<(columns?: string) => MockSupabaseChainable>;
  // ... properly typed
}

const createChainableMock = (): MockSupabaseChainable => {
  // Typed mock implementation
};

const mockSupabase = createChainableMock();
```

## Summary

These TypeScript improvements provide:

1. **Compile-time Safety** - Catch errors before runtime
2. **Better IDE Support** - Improved autocomplete and refactoring
3. **Self-documenting Code** - Types serve as inline documentation
4. **Easier Maintenance** - Changes propagate through type system
5. **Reduced Bugs** - Impossible to pass wrong types

All improvements maintain backward compatibility while adding optional type safety. Existing code continues to work, but new code should follow these patterns for maximum type safety.

## Files Modified

### Type Definitions
- `src/lib/queue/types.ts` - Added generic constraints for queue operations
- `src/lib/store/types.ts` - Added generic constraints for store operations
- `src/lib/queue/payloads.ts` - Enhanced with discriminated unions
- `src/shared/types.ts` - Added standardized API response types
- `src/lib/errors.ts` - Already had discriminated unions (no changes needed)

### API Routes (Examples)
- `src/api/routes/teams/handlers.ts` - Updated to use ApiResponse utility
- `src/api/routes/projects.ts` - Updated to use ApiResponse utility

### Tests (Examples)
- `tests/unit/teams-routes-simple.test.ts` - Improved mock typing

### Documentation
- `docs/TYPESCRIPT_IMPROVEMENTS.md` - This comprehensive guide

## Next Steps

For remaining route files, follow the pattern established in:
- `src/api/routes/teams/handlers.ts` (handler pattern)
- `src/api/routes/projects.ts` (inline route pattern)

Key changes for each file:
1. Import `ApiResponse` and `createApiError`
2. Replace direct `res.json()` calls with `ApiResponse.success()`
3. Replace error responses with `ApiResponse.fromApiError()`
4. Add proper JSDoc comments
5. Use type-safe error creation with `createApiError` factories
