/**
 * Environment Variable Validation
 *
 * Validates critical environment variables at startup to catch
 * configuration issues before they cause production failures.
 *
 * Based on common Vercel + Supabase production issues.
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate environment variables
 */
export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const required = [
    'DATABASE_URL',
  ];

  // Check for missing required vars
  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate DATABASE_URL format (Supabase transaction pooler)
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl) {
    const hasPooler = dbUrl.includes('pooler.supabase.com');
    const hasPort6543 = dbUrl.includes(':6543');

    if (!hasPooler || !hasPort6543) {
      warnings.push(
        'DATABASE_URL may not be using Supabase transaction pooler. ' +
        'Expected format: postgresql://user:pass@aws-0-region.pooler.supabase.com:6543/postgres'
      );
    }

    // Check for common mistakes
    if (dbUrl.includes(':5432')) {
      errors.push(
        'DATABASE_URL uses port 5432 (session mode). ' +
        'Serverless functions require port 6543 (transaction mode pooler)'
      );
    }
  }

  // Supabase client variables (optional but common)
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY) {
    warnings.push('SUPABASE_URL set but SUPABASE_ANON_KEY is missing');
  }

  // Worker authentication (warn if missing in production)
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.WORKER_SECRET && !process.env.ADMIN_PASSWORD) {
      warnings.push(
        'Neither WORKER_SECRET nor ADMIN_PASSWORD set. ' +
        'Worker endpoint will only accept Vercel cron requests.'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate and throw if invalid (for startup validation)
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Configuration Warnings:');
    result.warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
    console.warn('');
  }

  // Throw on errors
  if (!result.valid) {
    console.error('❌ Environment Configuration Errors:');
    result.errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    console.error('');
    throw new Error(
      `Environment validation failed: ${result.errors.length} error(s). ` +
      'Fix the errors above before starting the application.'
    );
  }

  console.log('✅ Environment variables validated');
}

/**
 * Get environment info for debugging
 */
export function getEnvInfo(): Record<string, any> {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    hasDatabase: !!process.env.DATABASE_URL,
    databaseHost: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'not set',
    hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    hasWorkerAuth: !!(process.env.WORKER_SECRET || process.env.ADMIN_PASSWORD),
    vercelEnv: process.env.VERCEL_ENV || 'none',  // 'production' | 'preview' | 'development'
    vercelRegion: process.env.VERCEL_REGION || 'unknown',
  };
}
