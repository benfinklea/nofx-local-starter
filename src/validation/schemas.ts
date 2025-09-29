/**
 * Comprehensive input validation schemas using Zod
 */
import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

// UUID validation
export const UuidSchema = z.string().uuid('Invalid UUID format');

// JSON value schema
const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    JsonPrimitiveSchema,
    z.array(JsonValueSchema),
    z.record(JsonValueSchema)
  ])
);

// Status enums
export const RunStatusSchema = z.enum([
  'queued',
  'running',
  'blocked',
  'succeeded',
  'failed',
  'cancelled'
]);

export const StepStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'timed_out'
]);

export const GateStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'failed',
  'succeeded',
  'cancelled',
  'skipped'
]);

// ============================================================================
// PLAN SCHEMAS
// ============================================================================

export const StepInputSchema = z.object({
  tool: z.string().min(1, 'Tool name required'),
  name: z.string().min(1, 'Step name required'),
  inputs: z.record(z.unknown()).optional(),
  tools_allowed: z.array(z.string()).optional(),
  env_allowed: z.array(z.string()).optional(),
  secrets_scope: z.string().optional()
});

export const PlanSchema = z.object({
  steps: z.array(StepInputSchema).min(1, 'At least one step required'),
  goal: z.string().min(1, 'Goal description required'),
  metadata: z.record(z.unknown()).optional()
});

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

export const CreateRunRequestSchema = z.object({
  plan: PlanSchema,
  projectId: z.string().min(1).default('default')
});

export const StandardModeRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  quality: z.boolean().default(true),
  openPr: z.boolean().default(false),
  filePath: z.string().optional(),
  summarizeQuery: z.string().optional(),
  summarizeTarget: z.string().optional()
});

export const PreviewRunRequestSchema = z.object({
  standard: StandardModeRequestSchema
});

export const UpdateStepRequestSchema = z.object({
  status: StepStatusSchema.optional(),
  outputs: z.record(z.unknown()).optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional()
});

export const UpdateGateRequestSchema = z.object({
  status: GateStatusSchema,
  approved_by: z.string().optional(),
  reason: z.string().optional()
});

export const RetryStepRequestSchema = z.object({
  runId: UuidSchema,
  stepId: UuidSchema
});

// ============================================================================
// DATABASE SCHEMAS
// ============================================================================

export const DatabaseConnectionSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres://')),
  DATABASE_POOL_MAX: z.coerce.number().min(1).max(100).default(20),
  DATABASE_POOL_IDLE_TIMEOUT: z.coerce.number().min(1000).default(30000),
  DATABASE_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(2000)
});

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

export const EnvironmentSchema = z.object({
  // Required
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),

  // Database
  DATABASE_URL: z.string().optional(),
  DATA_DRIVER: z.enum(['db', 'filesystem']).default('filesystem'),

  // Authentication
  JWT_SECRET: z.string().min(32).optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  // Supabase (if using SaaS features)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  // Stripe (if using billing)
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),

  // Queue configuration
  QUEUE_DRIVER: z.enum(['memory', 'postgres']).default('memory'),
  BACKPRESSURE_AGE_MS: z.coerce.number().min(0).default(5000),

  // Security
  CORS_ORIGINS: z.string().transform(s => s.split(',')).optional(),
  ALLOWED_HOSTS: z.string().transform(s => s.split(',')).optional(),

  // Monitoring
  OPENTELEMETRY_ENABLED: z.coerce.boolean().default(false),
  OPENTELEMETRY_ENDPOINT: z.string().url().optional(),

  // Development
  DISABLE_INLINE_RUNNER: z.coerce.boolean().default(false),
  DEV_RESTART_WATCH: z.coerce.boolean().default(false)
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and sanitize user input
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize SQL identifier (table/column names)
 */
export function sanitizeSqlIdentifier(identifier: string): string {
  // Only allow alphanumeric and underscore
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Validate environment variables on startup
 */
export function validateEnvironment(): z.infer<typeof EnvironmentSchema> {
  const result = EnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

// ============================================================================
// REQUEST VALIDATORS
// ============================================================================

/**
 * Express middleware for request validation
 */
import { Request, Response, NextFunction } from 'express';

export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.format()
      });
      return;
    }

    // Replace request body with validated data
    req.body = result.data;
    next();
  };
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.format()
      });
      return;
    }

    // Replace query with validated data
    req.query = result.data as any;
    next();
  };
}

/**
 * Validate route parameters
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        error: 'Invalid route parameters',
        details: result.error.format()
      });
      return;
    }

    // Replace params with validated data
    req.params = result.data as any;
    next();
  };
}