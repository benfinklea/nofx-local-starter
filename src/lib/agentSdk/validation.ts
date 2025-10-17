/**
 * Zod validation schemas for Agent SDK inputs
 *
 * Provides runtime validation with clear error messages
 * Heavy mode reliability enhancement
 */

import { z } from 'zod';

/**
 * Valid Claude models
 */
export const VALID_MODELS = [
  'claude-sonnet-4-5',
  'claude-sonnet-4',
  'claude-opus-4',
  'claude-haiku-3-5',
] as const;

/**
 * Agent SDK Context validation schema
 */
export const AgentSdkContextSchema = z.object({
  runId: z.string().min(1, 'runId is required and must not be empty'),
  model: z.enum(VALID_MODELS).optional(),
  sessionMemory: z.boolean().optional(),
  maxTokens: z.number().int().positive().max(200000).optional(),
  temperature: z.number().min(0).max(1).optional(),
}).strict();

/**
 * Step inputs validation schema
 */
export const StepInputsSchema = z.object({
  prompt: z.string().optional(),
  topic: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  filename: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  _tools: z.array(z.string()).optional(),
}).passthrough(); // Allow additional fields

/**
 * Step configuration validation schema
 */
export const StepSchema = z.object({
  id: z.string().min(1, 'Step ID is required'),
  run_id: z.string().min(1, 'Run ID is required'),
  name: z.string().min(1, 'Step name is required'),
  tool: z.string().min(1, 'Tool is required'),
  inputs: StepInputsSchema.optional(),
  status: z.enum(['pending', 'running', 'succeeded', 'failed']).optional(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
  outputs: z.record(z.unknown()).optional(),
}).strict();

/**
 * Execution result validation schema
 */
export const ExecutionResultSchema = z.object({
  response: z.string().min(1, 'Response must not be empty'),
  metadata: z.object({
    tokensUsed: z.number().int().nonnegative(),
    cost: z.number().nonnegative(),
    model: z.enum(VALID_MODELS),
    sessionId: z.string().min(1),
  }).strict(),
}).strict();

/**
 * SDK options validation schema
 */
export const SdkOptionsSchema = z.object({
  model: z.enum(VALID_MODELS),
  resume: z.string().optional(),
  maxTurns: z.number().int().positive().max(10).optional(),
  cwd: z.string().min(1).optional(),
  allowedTools: z.array(z.string()).optional(),
  hooks: z.any().optional(), // Complex type, validate structure separately
}).passthrough(); // SDK may have additional options

/**
 * Validate and parse Agent SDK context
 *
 * @throws {z.ZodError} if validation fails with detailed error messages
 */
export function validateContext(context: unknown): z.infer<typeof AgentSdkContextSchema> {
  try {
    return AgentSdkContextSchema.parse(context);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid Agent SDK context: ${messages}`);
    }
    throw error;
  }
}

/**
 * Validate and parse Step configuration
 *
 * @throws {z.ZodError} if validation fails with detailed error messages
 */
export function validateStep(step: unknown): z.infer<typeof StepSchema> {
  try {
    return StepSchema.parse(step);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid Step configuration: ${messages}`);
    }
    throw error;
  }
}

/**
 * Validate execution result
 *
 * @throws {z.ZodError} if validation fails with detailed error messages
 */
export function validateExecutionResult(result: unknown): z.infer<typeof ExecutionResultSchema> {
  try {
    return ExecutionResultSchema.parse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid execution result: ${messages}`);
    }
    throw error;
  }
}

/**
 * Validate SDK options
 *
 * @throws {z.ZodError} if validation fails with detailed error messages
 */
export function validateSdkOptions(options: unknown): z.infer<typeof SdkOptionsSchema> {
  try {
    return SdkOptionsSchema.parse(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid SDK options: ${messages}`);
    }
    throw error;
  }
}

/**
 * Safe validation that returns result with success flag
 * Use when you want to handle validation errors gracefully
 */
export function safeValidateContext(context: unknown): {
  success: boolean;
  data?: z.infer<typeof AgentSdkContextSchema>;
  error?: string;
} {
  const result = AgentSdkContextSchema.safeParse(context);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  return { success: false, error: messages };
}

/**
 * Safe validation for Step
 */
export function safeValidateStep(step: unknown): {
  success: boolean;
  data?: z.infer<typeof StepSchema>;
  error?: string;
} {
  const result = StepSchema.safeParse(step);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  return { success: false, error: messages };
}

/**
 * Type exports for use in other modules
 */
export type ValidatedContext = z.infer<typeof AgentSdkContextSchema>;
export type ValidatedStep = z.infer<typeof StepSchema>;
export type ValidatedExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type ValidatedSdkOptions = z.infer<typeof SdkOptionsSchema>;
