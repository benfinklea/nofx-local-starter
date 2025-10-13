/**
 * Type guard utilities for safe type narrowing
 *
 * These utilities provide runtime type checking to safely narrow TypeScript types
 * without using unsafe type assertions like `as any` or `as unknown as Type`.
 */

import type { UserProfile } from '../types/teams';

/**
 * Checks if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Checks if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Checks if a value is a number (and not NaN)
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Checks if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Checks if a value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Type guard for UserProfile
 * Note: email field is optional to support test mocks and partial user objects
 */
export function isUserProfile(value: unknown): value is UserProfile {
  return (
    isObject(value) &&
    hasProperty(value, 'id') &&
    isString(value.id) &&
    value.id.length > 0
  );
}

/**
 * Type guard for arrays of a specific type
 */
export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

/**
 * Type guard for records with string keys and specific value types
 */
export function isRecordOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is Record<string, T> {
  if (!isObject(value)) {
    return false;
  }

  return Object.values(value).every(guard);
}

/**
 * Asserts that a value is defined (not null or undefined)
 * Throws an error if the value is nullish
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (isNullish(value)) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Type guard for API key verification result
 */
export interface ApiKeyVerificationResult {
  userId: string;
}

export function isApiKeyVerificationResult(value: unknown): value is ApiKeyVerificationResult {
  return (
    isObject(value) &&
    hasProperty(value, 'userId') &&
    isString(value.userId) &&
    value.userId.length > 0
  );
}

/**
 * Type guard for team member with user data
 */
export interface TeamMemberWithUser {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: Date | string;
  user: UserProfile;
}

export function isTeamMemberWithUser(value: unknown): value is TeamMemberWithUser {
  return (
    isObject(value) &&
    hasProperty(value, 'id') &&
    hasProperty(value, 'teamId') &&
    hasProperty(value, 'userId') &&
    hasProperty(value, 'role') &&
    hasProperty(value, 'user') &&
    isString(value.id) &&
    isString(value.teamId) &&
    isString(value.userId) &&
    isString(value.role) &&
    isUserProfile(value.user)
  );
}

/**
 * Type guard for event row data
 */
export interface EventRow {
  id: string;
  runId: string;
  stepId?: string;
  timestamp: Date | string;
  type: string;
  data?: unknown;
}

export function isEventRow(value: unknown): value is EventRow {
  return (
    isObject(value) &&
    hasProperty(value, 'id') &&
    hasProperty(value, 'runId') &&
    hasProperty(value, 'timestamp') &&
    hasProperty(value, 'type') &&
    isString(value.id) &&
    isString(value.runId) &&
    isString(value.type)
  );
}

/**
 * Safe type assertion that validates at runtime
 * Use this instead of `as Type` when you need to assert a type
 */
export function assertType<T>(
  value: unknown,
  guard: (val: unknown) => val is T,
  errorMessage?: string
): T {
  if (!guard(value)) {
    throw new TypeError(errorMessage || 'Type assertion failed');
  }
  return value;
}

// ============================================================================
// Queue Payload Type Guards
// ============================================================================

/**
 * Type guard for queue retry payload (with __attempt field)
 */
export interface RetryablePayload {
  __attempt?: number;
  [key: string]: unknown;
}

export function isRetryablePayload(value: unknown): value is RetryablePayload {
  return isObject(value) && (!hasProperty(value, '__attempt') || isNumber(value.__attempt));
}

/**
 * Extract attempt number from payload, defaulting to 1
 */
export function getAttemptNumber(payload: unknown): number {
  if (isRetryablePayload(payload) && payload.__attempt !== undefined) {
    return payload.__attempt;
  }
  return 1;
}

/**
 * Type guard for provider payload (with provider field)
 */
export interface ProviderPayload {
  provider?: string;
  [key: string]: unknown;
}

export function isProviderPayload(value: unknown): value is ProviderPayload {
  return isObject(value) && (!hasProperty(value, 'provider') || isString(value.provider));
}

/**
 * Extract provider from payload, defaulting to 'queue'
 */
export function getProvider(payload: unknown): string {
  if (isProviderPayload(payload) && payload.provider !== undefined) {
    return payload.provider;
  }
  return 'queue';
}

/**
 * Type guard for step ready payload
 */
export interface StepReadyPayload {
  runId: string;
  stepId: string;
  idempotencyKey: string;
  __attempt: number;
}

export function isStepReadyPayload(value: unknown): value is StepReadyPayload {
  return (
    isObject(value) &&
    hasProperty(value, 'runId') &&
    hasProperty(value, 'stepId') &&
    hasProperty(value, 'idempotencyKey') &&
    hasProperty(value, '__attempt') &&
    isString(value.runId) &&
    isString(value.stepId) &&
    isString(value.idempotencyKey) &&
    isNumber(value.__attempt)
  );
}

/**
 * Safely convert unknown payload to RetryablePayload
 * Returns a safe object even if the input is not an object
 */
export function toRetryablePayload(payload: unknown): RetryablePayload {
  if (isObject(payload)) {
    return payload;
  }
  return {};
}

/**
 * Create a new retry payload with incremented attempt number
 */
export function createRetryPayload(payload: unknown): RetryablePayload {
  const basePayload = toRetryablePayload(payload);
  const currentAttempt = getAttemptNumber(basePayload);
  return {
    ...basePayload,
    __attempt: currentAttempt + 1,
  };
}
