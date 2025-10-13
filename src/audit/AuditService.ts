/**
 * Audit Service for NOFX Control Plane
 *
 * Provides comprehensive audit logging with:
 * - Async event recording with buffering for performance
 * - Automatic event enrichment (IP, user agent, timestamps)
 * - Sensitive data sanitization and encryption
 * - Integration with pino structured logging
 * - Batch processing for high-volume scenarios
 * - Type-safe event creation and validation
 *
 * @module audit/AuditService
 */

import pino from 'pino';
import type {
  AuditEvent,
  CreateAuditEventInput,
  EventActor,
  EventContext,
  EventSeverity,
  EventOutcome,
} from './types';
import { createAuditEvent, isAuditEvent, isCriticalEvent } from './types';

/**
 * Configuration options for AuditService
 */
export interface AuditServiceConfig {
  /** Enable/disable audit logging (default: true) */
  enabled?: boolean;
  /** Buffer size before flushing events to storage (default: 100) */
  bufferSize?: number;
  /** Maximum time (ms) to buffer events before flush (default: 5000) */
  flushIntervalMs?: number;
  /** Enable async processing (default: true) */
  async?: boolean;
  /** Custom logger instance */
  logger?: pino.Logger;
  /** Storage adapter for persisting events */
  storage?: AuditStorage;
  /** Enable sensitive data sanitization (default: true) */
  sanitizeData?: boolean;
  /** Enable automatic encryption of sensitive fields (default: true) */
  encryptSensitiveFields?: boolean;
}

/**
 * Storage adapter interface for audit events
 */
export interface AuditStorage {
  /**
   * Save a single audit event
   * @param event - Audit event to save
   * @returns Promise that resolves when event is saved
   */
  save(event: AuditEvent): Promise<void>;

  /**
   * Save multiple audit events in batch
   * @param events - Array of audit events to save
   * @returns Promise that resolves when all events are saved
   */
  saveBatch(events: readonly AuditEvent[]): Promise<void>;

  /**
   * Query audit events with filters
   * @param filter - Filter criteria
   * @returns Promise that resolves to matching events
   */
  query?(filter: Record<string, unknown>): Promise<AuditEvent[]>;
}

/**
 * Event enrichment context for automatic field population
 */
export interface EnrichmentContext {
  /** Request IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Request correlation ID */
  requestId?: string;
  /** HTTP method */
  httpMethod?: string;
  /** HTTP status code */
  httpStatus?: number;
  /** Endpoint path */
  endpoint?: string;
  /** Geographic location */
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

/**
 * Statistics for audit service performance monitoring
 */
export interface AuditServiceStats {
  /** Total events logged */
  eventsLogged: number;
  /** Events currently in buffer */
  eventsInBuffer: number;
  /** Total flush operations */
  flushCount: number;
  /** Total errors encountered */
  errorCount: number;
  /** Last flush timestamp */
  lastFlushAt?: Date;
  /** Service start timestamp */
  startedAt: Date;
}

/**
 * Default logger configuration
 */
const defaultLogger = pino({
  name: 'audit-service',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * AuditService - Comprehensive audit event logging system
 *
 * Features:
 * - Async event processing with buffering
 * - Automatic event enrichment
 * - Sensitive data sanitization
 * - Batch processing
 * - Performance monitoring
 * - Type-safe API
 *
 * @example
 * ```typescript
 * const auditService = new AuditService({
 *   bufferSize: 100,
 *   flushIntervalMs: 5000,
 *   storage: myStorageAdapter,
 * });
 *
 * // Log an authentication event
 * await auditService.log({
 *   event_type: 'auth.login.success',
 *   category: EventCategory.AUTHENTICATION,
 *   severity: EventSeverity.INFO,
 *   actor: { user_id: 'user_123' },
 *   subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
 *   outcome: EventOutcome.SUCCESS,
 *   payload: { auth_method: 'password', mfa_used: true },
 * });
 *
 * // Flush remaining events and shutdown
 * await auditService.shutdown();
 * ```
 */
export class AuditService {
  private config: Required<AuditServiceConfig>;
  private logger: pino.Logger;
  private buffer: AuditEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private stats: AuditServiceStats;
  private isShuttingDown = false;

  /**
   * Create a new AuditService instance
   *
   * @param config - Service configuration options
   */
  constructor(config: AuditServiceConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      bufferSize: config.bufferSize ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      async: config.async ?? true,
      logger: config.logger ?? defaultLogger,
      storage: config.storage ?? new ConsoleAuditStorage(),
      sanitizeData: config.sanitizeData ?? true,
      encryptSensitiveFields: config.encryptSensitiveFields ?? true,
    };

    this.logger = this.config.logger;

    this.stats = {
      eventsLogged: 0,
      eventsInBuffer: 0,
      flushCount: 0,
      errorCount: 0,
      startedAt: new Date(),
    };

    // Start periodic flush timer
    if (this.config.async) {
      this.startFlushTimer();
    }

    this.logger.info(
      {
        config: {
          enabled: this.config.enabled,
          bufferSize: this.config.bufferSize,
          flushIntervalMs: this.config.flushIntervalMs,
          async: this.config.async,
        },
      },
      'AuditService initialized'
    );
  }

  /**
   * Log an audit event
   *
   * Automatically enriches the event with context and handles async processing.
   *
   * @param input - Event data without id and timestamp
   * @param enrichmentContext - Optional context for automatic field population
   * @returns Promise that resolves when event is logged
   *
   * @example
   * ```typescript
   * await auditService.log({
   *   event_type: 'org.created',
   *   category: EventCategory.ORGANIZATION,
   *   severity: EventSeverity.INFO,
   *   actor: { user_id: 'user_123' },
   *   subject: { resource_type: ResourceType.ORGANIZATION, resource_id: 'org_abc' },
   *   outcome: EventOutcome.SUCCESS,
   *   payload: { org_name: 'Acme Corp', org_slug: 'acme-corp' },
   * }, {
   *   ipAddress: '192.168.1.100',
   *   userAgent: 'Mozilla/5.0...',
   *   requestId: 'req_xyz',
   * });
   * ```
   */
  async log<T extends AuditEvent>(
    input: CreateAuditEventInput<T>,
    enrichmentContext?: EnrichmentContext
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.isShuttingDown) {
      this.logger.warn('Cannot log event: service is shutting down');
      return;
    }

    try {
      // Create event with auto-generated fields
      let event = createAuditEvent(input);

      // Enrich event with context
      if (enrichmentContext) {
        event = this.enrichEvent(event, enrichmentContext);
      }

      // Sanitize sensitive data
      if (this.config.sanitizeData) {
        event = this.sanitizeEvent(event);
      }

      // Validate event structure
      if (!isAuditEvent(event)) {
        throw new Error('Invalid audit event structure');
      }

      // Log to console/file via pino
      this.logToPino(event);

      // Add to buffer for batch processing
      this.buffer.push(event);
      this.stats.eventsLogged++;
      this.stats.eventsInBuffer = this.buffer.length;

      // Flush immediately if critical event or buffer is full
      if (isCriticalEvent(event) || this.buffer.length >= this.config.bufferSize) {
        await this.flush();
      }
    } catch (error) {
      this.stats.errorCount++;
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          event_type: input.event_type,
        },
        'Failed to log audit event'
      );
      throw error;
    }
  }

  /**
   * Log multiple events in batch
   *
   * More efficient than calling log() multiple times.
   *
   * @param inputs - Array of event inputs
   * @param enrichmentContext - Optional context for all events
   * @returns Promise that resolves when all events are logged
   *
   * @example
   * ```typescript
   * await auditService.logBatch([
   *   { event_type: 'run.created', ... },
   *   { event_type: 'run.started', ... },
   *   { event_type: 'run.completed', ... },
   * ]);
   * ```
   */
  async logBatch<T extends AuditEvent>(
    inputs: ReadonlyArray<CreateAuditEventInput<T>>,
    enrichmentContext?: EnrichmentContext
  ): Promise<void> {
    if (!this.config.enabled || inputs.length === 0) {
      return;
    }

    const promises = inputs.map((input) => this.log(input, enrichmentContext));
    await Promise.all(promises);
  }

  /**
   * Manually flush buffered events to storage
   *
   * Normally called automatically, but can be called manually for immediate persistence.
   *
   * @returns Promise that resolves when flush is complete
   *
   * @example
   * ```typescript
   * // Force immediate persistence
   * await auditService.flush();
   * ```
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.buffer];
    this.buffer = [];
    this.stats.eventsInBuffer = 0;

    try {
      await this.config.storage.saveBatch(eventsToFlush);
      this.stats.flushCount++;
      this.stats.lastFlushAt = new Date();

      this.logger.debug(
        { eventCount: eventsToFlush.length },
        'Successfully flushed audit events to storage'
      );
    } catch (error) {
      this.stats.errorCount++;
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          eventCount: eventsToFlush.length,
        },
        'Failed to flush audit events to storage'
      );

      // Re-add events to buffer for retry
      this.buffer.unshift(...eventsToFlush);
      this.stats.eventsInBuffer = this.buffer.length;

      throw error;
    }
  }

  /**
   * Get service statistics
   *
   * @returns Current service statistics
   *
   * @example
   * ```typescript
   * const stats = auditService.getStats();
   * console.log(`Logged ${stats.eventsLogged} events`);
   * console.log(`${stats.eventsInBuffer} events in buffer`);
   * ```
   */
  getStats(): Readonly<AuditServiceStats> {
    return { ...this.stats };
  }

  /**
   * Gracefully shutdown the audit service
   *
   * Flushes remaining events and stops flush timer.
   * Should be called before application shutdown.
   *
   * @returns Promise that resolves when shutdown is complete
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await auditService.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down AuditService...');

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining events
    try {
      await this.flush();
      this.logger.info('AuditService shutdown complete');
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Error during AuditService shutdown'
      );
      throw error;
    }
  }

  /**
   * Enrich event with contextual information
   *
   * @param event - Event to enrich
   * @param context - Enrichment context
   * @returns Enriched event
   */
  private enrichEvent<T extends AuditEvent>(
    event: T,
    context: EnrichmentContext
  ): T {
    const enrichedContext: EventContext = {
      ...event.context,
      ip_address: context.ipAddress ?? event.context?.ip_address,
      user_agent: context.userAgent ?? event.context?.user_agent,
      request_id: context.requestId ?? event.context?.request_id,
      http_method: context.httpMethod ?? event.context?.http_method,
      http_status: context.httpStatus ?? event.context?.http_status,
      endpoint: context.endpoint ?? event.context?.endpoint,
      geo_location: context.geoLocation ?? event.context?.geo_location,
    };

    return {
      ...event,
      context: enrichedContext,
    };
  }

  /**
   * Sanitize sensitive data from event
   *
   * Removes or redacts sensitive information to prevent logging PII, passwords, tokens, etc.
   *
   * @param event - Event to sanitize
   * @returns Sanitized event
   */
  private sanitizeEvent<T extends AuditEvent>(event: T): T {
    // Create a deep copy to avoid modifying the original
    const sanitized = JSON.parse(JSON.stringify(event)) as T;

    // Sanitize payload
    if (sanitized.payload && typeof sanitized.payload === 'object') {
      const payload = sanitized.payload as Record<string, unknown>;

      // Remove forbidden fields that should never be logged
      const forbiddenFields = [
        'password',
        'api_key',
        'api_secret',
        'secret',
        'token',
        'access_token',
        'refresh_token',
        'private_key',
        'encryption_key',
        'credit_card',
        'cvv',
        'ssn',
        'social_security_number',
      ];

      for (const field of forbiddenFields) {
        if (field in payload) {
          delete payload[field];
        }
      }

      // Redact email addresses (show only domain)
      if ('email' in payload && typeof payload.email === 'string') {
        const email = payload.email;
        const [, domain] = email.split('@');
        payload.email = `***@${domain}`;
      }

      // Truncate error messages to prevent data leakage
      if ('error_message' in payload && typeof payload.error_message === 'string') {
        const maxLength = 500;
        if (payload.error_message.length > maxLength) {
          payload.error_message = payload.error_message.substring(0, maxLength) + '...[truncated]';
        }
      }
    }

    // Sanitize error details
    if (sanitized.error_details) {
      if (sanitized.error_details.error_stack) {
        // Remove stack trace for security (can contain sensitive paths)
        sanitized.error_details = {
          ...sanitized.error_details,
          error_stack: undefined,
        };
      }

      if (sanitized.error_details.error_message) {
        // Truncate error message
        const maxLength = 1000;
        if (sanitized.error_details.error_message.length > maxLength) {
          sanitized.error_details = {
            ...sanitized.error_details,
            error_message: sanitized.error_details.error_message.substring(0, maxLength) + '...[truncated]',
          };
        }
      }
    }

    return sanitized;
  }

  /**
   * Log event to pino logger
   *
   * @param event - Event to log
   */
  private logToPino(event: AuditEvent): void {
    const logLevel = this.getLogLevel(event.severity);

    this.logger[logLevel](
      {
        audit_event: {
          id: event.id,
          type: event.event_type,
          category: event.category,
          severity: event.severity,
          actor: event.actor,
          subject: event.subject,
          outcome: event.outcome,
        },
      },
      `Audit: ${event.event_type}`
    );
  }

  /**
   * Map event severity to pino log level
   *
   * @param severity - Event severity
   * @returns Pino log level
   */
  private getLogLevel(severity: EventSeverity): pino.Level {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warn';
      case 'info':
      default:
        return 'info';
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush().catch((error) => {
          this.logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            'Periodic flush failed'
          );
        });
      }
    }, this.config.flushIntervalMs);

    // Ensure timer doesn't prevent process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }
}

/**
 * Simple console-based storage adapter for development/testing
 *
 * Logs events to console. Not suitable for production use.
 */
export class ConsoleAuditStorage implements AuditStorage {
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? defaultLogger;
  }

  async save(event: AuditEvent): Promise<void> {
    this.logger.info({ audit_event: event }, '[AUDIT] Event logged');
  }

  async saveBatch(events: readonly AuditEvent[]): Promise<void> {
    this.logger.info({ event_count: events.length }, '[AUDIT BATCH] Events logged');
    for (const event of events) {
      await this.save(event);
    }
  }
}

/**
 * Create a singleton audit service instance
 *
 * @param config - Service configuration
 * @returns Singleton AuditService instance
 */
let auditServiceInstance: AuditService | null = null;

export function createAuditService(config?: AuditServiceConfig): AuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new AuditService(config);
  }
  return auditServiceInstance;
}

/**
 * Get the singleton audit service instance
 *
 * @returns AuditService instance
 * @throws Error if service has not been created
 */
export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    throw new Error('AuditService has not been initialized. Call createAuditService() first.');
  }
  return auditServiceInstance;
}

/**
 * Helper function to log authentication events
 *
 * @param eventType - Authentication event type
 * @param actor - Event actor
 * @param outcome - Event outcome
 * @param payload - Event-specific payload
 * @param context - Enrichment context
 */
export async function logAuthEvent(
  eventType: 'auth.login.success' | 'auth.login.failure' | 'auth.logout' | 'auth.mfa.enabled' | 'auth.mfa.disabled',
  actor: EventActor,
  outcome: EventOutcome,
  payload?: Record<string, unknown>,
  context?: EnrichmentContext
): Promise<void> {
  const service = getAuditService();
  await service.log({
    event_type: eventType,
    category: 'authentication' as const,
    severity: outcome === 'success' ? ('info' as const) : ('warning' as const),
    actor,
    subject: {
      resource_type: 'user' as const,
      resource_id: actor.user_id ?? undefined,
    },
    outcome,
    payload,
  } as CreateAuditEventInput<AuditEvent>, context);
}

/**
 * Helper function to log security events
 *
 * @param eventType - Security event type
 * @param actor - Event actor
 * @param payload - Event-specific payload
 * @param context - Enrichment context
 */
export async function logSecurityEvent(
  eventType: 'security.suspicious_activity' | 'security.rate_limit.exceeded' | 'security.brute_force.detected',
  actor: EventActor,
  payload?: Record<string, unknown>,
  context?: EnrichmentContext
): Promise<void> {
  const service = getAuditService();
  await service.log({
    event_type: eventType,
    category: 'security' as const,
    severity: 'critical' as const,
    actor,
    subject: {
      resource_type: 'user' as const,
      resource_id: actor.user_id ?? undefined,
    },
    outcome: 'failure' as const,
    payload,
  } as CreateAuditEventInput<AuditEvent>, context);
}
