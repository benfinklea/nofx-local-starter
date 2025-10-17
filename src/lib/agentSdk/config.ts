/**
 * Configuration management for Agent SDK
 *
 * Centralized configuration with environment variable support
 * Heavy mode reliability enhancement
 */

import { z } from 'zod';

/**
 * Agent SDK configuration schema
 */
const AgentSdkConfigSchema = z.object({
  // Feature toggle
  enabled: z.boolean().default(false),

  // Model configuration
  defaultModel: z.enum(['claude-sonnet-4-5', 'claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3-5'])
    .default('claude-sonnet-4-5'),

  // Timeout configuration
  defaultTimeoutMs: z.number().int().positive().max(300000).default(60000), // 60s default, 5min max
  maxTimeoutMs: z.number().int().positive().max(600000).default(300000), // 5min default max

  // Retry configuration
  maxRetries: z.number().int().nonnegative().max(10).default(3),
  initialRetryDelayMs: z.number().int().positive().max(10000).default(1000),
  maxRetryDelayMs: z.number().int().positive().max(60000).default(10000),

  // Circuit breaker configuration
  circuitBreakerEnabled: z.boolean().default(true),
  circuitBreakerFailureThreshold: z.number().int().positive().max(20).default(5),
  circuitBreakerSuccessThreshold: z.number().int().positive().max(10).default(2),
  circuitBreakerTimeoutMs: z.number().int().positive().max(300000).default(30000),

  // Rate limiting
  rateLimitEnabled: z.boolean().default(false),
  maxRequestsPerMinute: z.number().int().positive().max(1000).default(60),

  // Cost limits
  costAlertThreshold: z.number().positive().max(1000).default(10.00),
  costDailyLimit: z.number().positive().max(10000).default(100.00),

  // Session management
  enableSessionMemory: z.boolean().default(true),
  sessionTimeoutMs: z.number().int().positive().max(86400000).default(3600000), // 1 hour default

  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  logSdkMessages: z.boolean().default(true),
  logToolCalls: z.boolean().default(true),

  // Model-specific overrides
  modelOverrides: z.record(z.object({
    maxTokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
  })).optional(),
});

export type AgentSdkConfig = z.infer<typeof AgentSdkConfigSchema>;

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): Partial<AgentSdkConfig> {
  const config: Partial<AgentSdkConfig> = {};

  // Feature toggle
  if (process.env.USE_AGENT_SDK !== undefined) {
    config.enabled = process.env.USE_AGENT_SDK === 'true';
  }

  // Model configuration
  if (process.env.AGENT_SDK_MODEL) {
    config.defaultModel = process.env.AGENT_SDK_MODEL as any;
  }

  // Timeout configuration
  if (process.env.AGENT_SDK_TIMEOUT_MS) {
    config.defaultTimeoutMs = parseInt(process.env.AGENT_SDK_TIMEOUT_MS, 10);
  }
  if (process.env.AGENT_SDK_MAX_TIMEOUT_MS) {
    config.maxTimeoutMs = parseInt(process.env.AGENT_SDK_MAX_TIMEOUT_MS, 10);
  }

  // Retry configuration
  if (process.env.AGENT_SDK_MAX_RETRIES) {
    config.maxRetries = parseInt(process.env.AGENT_SDK_MAX_RETRIES, 10);
  }
  if (process.env.AGENT_SDK_INITIAL_RETRY_DELAY_MS) {
    config.initialRetryDelayMs = parseInt(process.env.AGENT_SDK_INITIAL_RETRY_DELAY_MS, 10);
  }
  if (process.env.AGENT_SDK_MAX_RETRY_DELAY_MS) {
    config.maxRetryDelayMs = parseInt(process.env.AGENT_SDK_MAX_RETRY_DELAY_MS, 10);
  }

  // Circuit breaker
  if (process.env.AGENT_SDK_CIRCUIT_BREAKER_ENABLED !== undefined) {
    config.circuitBreakerEnabled = process.env.AGENT_SDK_CIRCUIT_BREAKER_ENABLED === 'true';
  }
  if (process.env.AGENT_SDK_CIRCUIT_FAILURE_THRESHOLD) {
    config.circuitBreakerFailureThreshold = parseInt(process.env.AGENT_SDK_CIRCUIT_FAILURE_THRESHOLD, 10);
  }
  if (process.env.AGENT_SDK_CIRCUIT_TIMEOUT_MS) {
    config.circuitBreakerTimeoutMs = parseInt(process.env.AGENT_SDK_CIRCUIT_TIMEOUT_MS, 10);
  }

  // Rate limiting
  if (process.env.AGENT_SDK_RATE_LIMIT_ENABLED !== undefined) {
    config.rateLimitEnabled = process.env.AGENT_SDK_RATE_LIMIT_ENABLED === 'true';
  }
  if (process.env.AGENT_SDK_MAX_REQUESTS_PER_MINUTE) {
    config.maxRequestsPerMinute = parseInt(process.env.AGENT_SDK_MAX_REQUESTS_PER_MINUTE, 10);
  }

  // Cost limits
  if (process.env.AGENT_SDK_COST_ALERT_THRESHOLD) {
    config.costAlertThreshold = parseFloat(process.env.AGENT_SDK_COST_ALERT_THRESHOLD);
  }
  if (process.env.AGENT_SDK_COST_DAILY_LIMIT) {
    config.costDailyLimit = parseFloat(process.env.AGENT_SDK_COST_DAILY_LIMIT);
  }

  // Session management
  if (process.env.AGENT_SDK_SESSION_MEMORY !== undefined) {
    config.enableSessionMemory = process.env.AGENT_SDK_SESSION_MEMORY === 'true';
  }
  if (process.env.AGENT_SDK_SESSION_TIMEOUT_MS) {
    config.sessionTimeoutMs = parseInt(process.env.AGENT_SDK_SESSION_TIMEOUT_MS, 10);
  }

  // Logging
  if (process.env.AGENT_SDK_LOG_LEVEL) {
    config.logLevel = process.env.AGENT_SDK_LOG_LEVEL as any;
  }
  if (process.env.AGENT_SDK_LOG_SDK_MESSAGES !== undefined) {
    config.logSdkMessages = process.env.AGENT_SDK_LOG_SDK_MESSAGES === 'true';
  }
  if (process.env.AGENT_SDK_LOG_TOOL_CALLS !== undefined) {
    config.logToolCalls = process.env.AGENT_SDK_LOG_TOOL_CALLS === 'true';
  }

  return config;
}

/**
 * Singleton configuration instance
 */
let cachedConfig: AgentSdkConfig | null = null;

/**
 * Get current Agent SDK configuration
 *
 * Configuration is loaded from environment variables and validated
 * against the schema. Configuration is cached for performance.
 */
export function getAgentSdkConfig(): AgentSdkConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const envConfig = loadConfigFromEnv();
  const validated = AgentSdkConfigSchema.parse(envConfig);

  cachedConfig = validated;
  return validated;
}

/**
 * Update configuration (for testing or runtime changes)
 *
 * This will override the cached configuration.
 * Use sparingly - prefer environment variables for production.
 */
export function updateAgentSdkConfig(updates: Partial<AgentSdkConfig>): AgentSdkConfig {
  const current = cachedConfig || AgentSdkConfigSchema.parse({});
  const merged = { ...current, ...updates };
  const validated = AgentSdkConfigSchema.parse(merged);

  cachedConfig = validated;
  return validated;
}

/**
 * Reset configuration cache (for testing)
 */
export function resetAgentSdkConfig(): void {
  cachedConfig = null;
}

/**
 * Get configuration for specific model
 *
 * Returns base configuration with model-specific overrides applied
 */
export function getModelConfig(model: string): {
  maxTokens?: number;
  temperature?: number;
  timeoutMs: number;
} {
  const config = getAgentSdkConfig();

  const override = config.modelOverrides?.[model];

  return {
    maxTokens: override?.maxTokens,
    temperature: override?.temperature,
    timeoutMs: override?.timeoutMs || config.defaultTimeoutMs,
  };
}

/**
 * Check if Agent SDK is enabled
 */
export function isAgentSdkEnabled(): boolean {
  return getAgentSdkConfig().enabled;
}

/**
 * Get retry configuration
 */
export function getRetryConfig() {
  const config = getAgentSdkConfig();
  return {
    maxRetries: config.maxRetries,
    initialDelayMs: config.initialRetryDelayMs,
    maxDelayMs: config.maxRetryDelayMs,
    backoffMultiplier: 2, // Exponential backoff
    retryableErrors: [
      '429', // Rate limit
      '500', '502', '503', '504', // Server errors
      'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', // Network errors
      'network', 'timeout', // Generic errors
    ],
  };
}

/**
 * Get circuit breaker configuration
 */
export function getCircuitBreakerConfig() {
  const config = getAgentSdkConfig();
  return {
    enabled: config.circuitBreakerEnabled,
    failureThreshold: config.circuitBreakerFailureThreshold,
    successThreshold: config.circuitBreakerSuccessThreshold,
    timeout: config.circuitBreakerTimeoutMs,
    monitoringPeriod: 60000, // 1 minute
  };
}

/**
 * Validate configuration and return any issues
 */
export function validateConfig(): { valid: boolean; errors?: string[] } {
  try {
    const envConfig = loadConfigFromEnv();
    AgentSdkConfigSchema.parse(envConfig);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Export schema for external validation
 */
export { AgentSdkConfigSchema };
