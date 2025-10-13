import { z } from "zod";
import type { JsonValue } from "../lib/store/types";

// ============================================================================
// Standardized API Response Types
// ============================================================================

/**
 * Standard successful API response envelope
 *
 * @template T - The type of data being returned
 *
 * @example
 * ```typescript
 * const response: ApiSuccessResponse<{ runId: string }> = {
 *   success: true,
 *   data: { runId: 'run_123' },
 *   meta: { timestamp: '2025-01-01T00:00:00Z' }
 * };
 * ```
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
    [key: string]: unknown;
  };
}

/**
 * Standard error API response envelope
 *
 * @example
 * ```typescript
 * const response: ApiErrorResponse = {
 *   success: false,
 *   error: {
 *     type: 'validation',
 *     message: 'Invalid input data',
 *     details: { field: 'email', code: 'invalid_format' }
 *   }
 * };
 * ```
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

/**
 * Discriminated union of all API response types
 *
 * Use this type for functions that can return either success or error responses.
 * The `success` field acts as a discriminant for type narrowing.
 *
 * @template T - The type of successful response data
 *
 * @example
 * ```typescript
 * function createRun(): ApiResponse<{ runId: string }> {
 *   if (error) {
 *     return {
 *       success: false,
 *       error: { type: 'validation', message: 'Invalid plan' }
 *     };
 *   }
 *   return {
 *     success: true,
 *     data: { runId: 'run_123' }
 *   };
 * }
 *
 * const result = createRun();
 * if (result.success) {
 *   console.log(result.data.runId); // TypeScript knows this is safe
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard to check if response is successful
 *
 * @param response - The API response to check
 * @returns true if response is successful, false otherwise
 *
 * @example
 * ```typescript
 * const response = await fetchData();
 * if (isApiSuccess(response)) {
 *   // TypeScript knows response.data is available
 *   console.log(response.data);
 * }
 * ```
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 *
 * @param response - The API response to check
 * @returns true if response is an error, false otherwise
 *
 * @example
 * ```typescript
 * const response = await fetchData();
 * if (isApiError(response)) {
 *   // TypeScript knows response.error is available
 *   console.error(response.error.message);
 * }
 * ```
 */
export function isApiError<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
  return response.success === false;
}

// ============================================================================
// Plan & Step Validation Schemas
// ============================================================================

// More specific schema for step inputs
const DynamicInputSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.unknown()),
    z.record(z.unknown())
  ])
).optional();

export const StepInputSchema = z.object({
  name: z.string(),
  tool: z.string(),
  inputs: DynamicInputSchema,
  // Security & Policy (optional per-step)
  tools_allowed: z.array(z.string()).optional(),
  env_allowed: z.array(z.string()).optional(),
  secrets_scope: z.string().optional()
});

export const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(StepInputSchema).min(1)
});

export type Plan = z.infer<typeof PlanSchema>;
export type StepInput = z.infer<typeof StepInputSchema>;

/**
 * Extended run data structure with user context
 */
export interface CreateRunData {
  goal: string;
  steps: Array<{
    name: string;
    tool: string;
    inputs?: Record<string, JsonValue>;
    tools_allowed?: string[];
    env_allowed?: string[];
    secrets_scope?: string;
  }>;
  user_id?: string;
  metadata?: {
    created_by?: string;
    tier?: string;
    [key: string]: JsonValue | undefined;
  };
}
