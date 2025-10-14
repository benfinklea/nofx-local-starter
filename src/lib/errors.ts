/**
 * Centralized error handling utilities
 */

/**
 * Type guard to check if a value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Extract error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}

/**
 * Create a normalized error object from unknown error type
 * Useful for logging and serialization
 */
export function normalizeError(error: unknown): { message: string; stack?: string; name: string } {
  if (isError(error)) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: getErrorMessage(error),
  };
}

/**
 * Convert unknown error to Error instance
 * Preserves Error instances, wraps other types
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }

  return new Error(getErrorMessage(error));
}

// ============================================================================
// Discriminated Union Error Types for Type-Safe Error Handling
// ============================================================================

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

/**
 * Discriminated union of all API error types
 * This provides compile-time type safety for error handling across the application
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

/**
 * Type guard to check if a value is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    typeof (error as ApiError).type === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}

/**
 * Convert Error or unknown to ApiError
 * Preserves ApiError types, converts others to internal errors
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (isError(error)) {
    return {
      type: 'internal',
      message: error.message,
      cause: error,
      context: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  return {
    type: 'internal',
    message: getErrorMessage(error),
    cause: error,
  };
}

/**
 * Extract HTTP status code from ApiError type
 */
export function getHttpStatusFromApiError(error: ApiError): number {
  switch (error.type) {
    case 'validation':
    case 'validation_multiple':
    case 'bad_request':
      return 400;
    case 'authentication':
      return 401;
    case 'authorization':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'rate_limit':
      return 429;
    case 'timeout':
      return 408;
    case 'external':
      return 502; // Bad Gateway
    case 'internal':
      return 500;
    default:
      // Exhaustive check - TypeScript will error if we miss a case
      // @ts-ignore - Exhaustiveness check variable
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustive: never = error;
      return 500;
  }
}

/**
 * Factory functions for creating typed errors
 */
export const createApiError = {
  validation: (field: string, message: string, code?: string): ApiError => ({
    type: 'validation',
    field,
    message,
    code,
  }),

  validationMultiple: (message: string, errors: ValidationErrorDetail[]): ApiError => ({
    type: 'validation_multiple',
    message,
    errors,
  }),

  authentication: (message: string, reason?: string): ApiError => ({
    type: 'authentication',
    message,
    reason,
  }),

  authorization: (message: string, resource?: string, action?: string): ApiError => ({
    type: 'authorization',
    message,
    resource,
    action,
  }),

  notFound: (resource: string, id?: string): ApiError => ({
    type: 'not_found',
    message: id ? `${resource} with id "${id}" not found` : `${resource} not found`,
    resource,
    id,
  }),

  conflict: (message: string, reason?: string, conflictingId?: string): ApiError => ({
    type: 'conflict',
    message,
    reason,
    conflictingId,
  }),

  rateLimit: (message: string, retryAfter?: number): ApiError => ({
    type: 'rate_limit',
    message,
    retryAfter,
  }),

  internal: (message: string, cause?: unknown, context?: Record<string, unknown>): ApiError => ({
    type: 'internal',
    message,
    cause,
    context,
  }),

  external: (service: string, message: string, statusCode?: number, cause?: unknown): ApiError => ({
    type: 'external',
    message,
    service,
    statusCode,
    cause,
  }),

  timeout: (operation: string, timeoutMs: number): ApiError => ({
    type: 'timeout',
    message: `Operation "${operation}" timed out after ${timeoutMs}ms`,
    operation,
    timeoutMs,
  }),

  badRequest: (message: string, details?: string): ApiError => ({
    type: 'bad_request',
    message,
    details,
  }),
};
