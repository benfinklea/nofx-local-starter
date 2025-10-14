/**
 * Database Storage Adapters for Audit Events
 *
 * Provides storage implementations for both PostgreSQL (Supabase) and SQLite (better-sqlite3).
 * Handles batch inserts, querying, and retention policy enforcement.
 *
 * @module audit/storage/DatabaseAuditStorage
 */

import type { AuditStorage } from '../AuditService';
import type { AuditEvent, AuditEventFilter } from '../types';
import pino from 'pino';

/**
 * Database configuration for storage adapter
 */
export interface DatabaseConfig {
  /** Database type */
  type: 'postgresql' | 'sqlite';
  /** Connection string (PostgreSQL) or file path (SQLite) */
  connectionString: string;
  /** Schema name (PostgreSQL only, default: 'nofx') */
  schema?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom logger */
  logger?: pino.Logger;
}

/**
 * PostgreSQL storage adapter using Supabase client or pg driver
 *
 * Implements batch inserts, querying with filters, and leverages PostgreSQL-specific features:
 * - Partitioned tables for performance
 * - Row Level Security for multi-tenancy
 * - JSONB queries for flexible filtering
 * - Full-text search on event payloads
 *
 * @example
 * ```typescript
 * const storage = new PostgreSQLAuditStorage({
 *   type: 'postgresql',
 *   connectionString: process.env.DATABASE_URL!,
 *   schema: 'nofx',
 * });
 *
 * await storage.save(auditEvent);
 * const events = await storage.query({
 *   organization_id: 'org_123',
 *   categories: [EventCategory.SECURITY],
 *   date_from: '2025-10-01T00:00:00Z',
 *   limit: 100,
 * });
 * ```
 */
export class PostgreSQLAuditStorage implements AuditStorage {
  private config: Required<DatabaseConfig>;
  private logger: pino.Logger;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any; // pg.Pool type (avoiding direct dependency)

  constructor(config: DatabaseConfig) {
    if (config.type !== 'postgresql') {
      throw new Error('PostgreSQLAuditStorage requires type: "postgresql"');
    }

    this.config = {
      type: config.type,
      connectionString: config.connectionString,
      schema: config.schema || 'nofx',
      debug: config.debug || false,
      logger: config.logger || pino({ name: 'postgresql-audit-storage' }),
    };

    this.logger = this.config.logger;

    // Initialize PostgreSQL connection pool
    this.initializePool();
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  private async initializePool(): Promise<void> {
    try {
      // Dynamically import pg to avoid build-time dependency
      const { Pool } = await import('pg');

      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: 20, // Maximum number of clients
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      this.logger.info('PostgreSQL connection pool initialized');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to initialize PostgreSQL connection pool'
      );
      throw error;
    }
  }

  /**
   * Save a single audit event
   *
   * @param event - Audit event to save
   */
  async save(event: AuditEvent): Promise<void> {
    await this.saveBatch([event]);
  }

  /**
   * Save multiple audit events in batch
   *
   * Uses PostgreSQL's UNNEST for efficient batch inserts.
   *
   * @param events - Array of audit events to save
   */
  async saveBatch(events: readonly AuditEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const startTime = Date.now();

    try {
      // Build batch insert using UNNEST for performance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any[] = [];
      const placeholders: string[] = [];

      events.forEach((event, index) => {
        const offset = index * 29; // 29 fields per event
        placeholders.push(`(
          $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6},
          $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11},
          $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16},
          $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21},
          $${offset + 22}, $${offset + 23}, $${offset + 24}, $${offset + 25}, $${offset + 26},
          $${offset + 27}, $${offset + 28}, $${offset + 29}
        )`);

        values.push(
          event.id,
          event.timestamp,
          event.event_type,
          event.category,
          event.severity,
          event.outcome,
          // Actor
          event.actor.user_id || null,
          event.actor.session_id || null,
          event.actor.system_component || null,
          event.actor.api_client_id || null,
          event.actor.metadata ? JSON.stringify(event.actor.metadata) : null,
          // Subject
          event.subject.resource_type,
          event.subject.resource_id || null,
          event.subject.organization_id || null,
          event.subject.project_id || null,
          event.subject.parent_id || null,
          event.subject.metadata ? JSON.stringify(event.subject.metadata) : null,
          // Context
          event.context?.ip_address || null,
          event.context?.user_agent || null,
          event.context?.geo_location ? JSON.stringify(event.context.geo_location) : null,
          event.context?.request_id || null,
          event.context?.http_method || null,
          event.context?.http_status || null,
          event.context?.endpoint || null,
          event.context?.metadata ? JSON.stringify(event.context.metadata) : null,
          // Error details
          event.error_details?.error_code || null,
          event.error_details?.error_message || null,
          event.error_details?.metadata ? JSON.stringify(event.error_details.metadata) : null,
          // Event data
          event.payload ? JSON.stringify(event.payload) : null,
          event.metadata ? JSON.stringify(event.metadata) : null
        );
      });

      const query = `
        INSERT INTO ${this.config.schema}.audit_events (
          id, timestamp, event_type, category, severity, outcome,
          actor_user_id, actor_session_id, actor_system_component, actor_api_client_id, actor_metadata,
          subject_resource_type, subject_resource_id, subject_organization_id, subject_project_id, subject_parent_id, subject_metadata,
          context_ip_address, context_user_agent, context_geo_location, context_request_id, context_http_method, context_http_status, context_endpoint, context_metadata,
          error_code, error_message, error_metadata,
          payload, metadata
        )
        VALUES ${placeholders.join(', ')}
      `;

      await this.pool.query(query, values);

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          event_count: events.length,
          duration_ms: duration,
          events_per_second: Math.round((events.length / duration) * 1000),
        },
        'Successfully saved audit events batch'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          event_count: events.length,
        },
        'Failed to save audit events batch'
      );
      throw error;
    }
  }

  /**
   * Query audit events with filters
   *
   * @param filter - Filter criteria
   * @returns Promise that resolves to matching events
   */
  async query(filter: AuditEventFilter): Promise<AuditEvent[]> {
    const conditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (filter.categories && filter.categories.length > 0) {
      conditions.push(`category = ANY($${paramIndex})`);
      values.push(filter.categories);
      paramIndex++;
    }

    if (filter.severity) {
      conditions.push(`severity = $${paramIndex}`);
      values.push(filter.severity);
      paramIndex++;
    }

    if (filter.outcome) {
      conditions.push(`outcome = $${paramIndex}`);
      values.push(filter.outcome);
      paramIndex++;
    }

    if (filter.event_types && filter.event_types.length > 0) {
      conditions.push(`event_type = ANY($${paramIndex})`);
      values.push(filter.event_types);
      paramIndex++;
    }

    if (filter.organization_id) {
      conditions.push(`subject_organization_id = $${paramIndex}`);
      values.push(filter.organization_id);
      paramIndex++;
    }

    if (filter.user_id) {
      conditions.push(`actor_user_id = $${paramIndex}`);
      values.push(filter.user_id);
      paramIndex++;
    }

    if (filter.resource_type) {
      conditions.push(`subject_resource_type = $${paramIndex}`);
      values.push(filter.resource_type);
      paramIndex++;
    }

    if (filter.resource_id) {
      conditions.push(`subject_resource_id = $${paramIndex}`);
      values.push(filter.resource_id);
      paramIndex++;
    }

    if (filter.date_from) {
      conditions.push(`timestamp >= $${paramIndex}`);
      values.push(filter.date_from);
      paramIndex++;
    }

    if (filter.date_to) {
      conditions.push(`timestamp <= $${paramIndex}`);
      values.push(filter.date_to);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY timestamp ${filter.sort === 'asc' ? 'ASC' : 'DESC'}`;
    const limitClause = filter.limit ? `LIMIT $${paramIndex}` : '';
    if (filter.limit) {
      values.push(filter.limit);
      paramIndex++;
    }

    const offsetClause = filter.offset ? `OFFSET $${paramIndex}` : '';
    if (filter.offset) {
      values.push(filter.offset);
    }

    const query = `
      SELECT * FROM ${this.config.schema}.audit_events
      ${whereClause}
      ${orderClause}
      ${limitClause}
      ${offsetClause}
    `;

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(this.rowToAuditEvent);
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          filter,
        },
        'Failed to query audit events'
      );
      throw error;
    }
  }

  /**
   * Convert database row to AuditEvent
   *
   * @param row - Database row
   * @returns AuditEvent object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToAuditEvent(row: any): AuditEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      event_type: row.event_type,
      category: row.category,
      severity: row.severity,
      outcome: row.outcome,
      actor: {
        user_id: row.actor_user_id,
        session_id: row.actor_session_id,
        system_component: row.actor_system_component,
        api_client_id: row.actor_api_client_id,
        metadata: row.actor_metadata,
      },
      subject: {
        resource_type: row.subject_resource_type,
        resource_id: row.subject_resource_id,
        organization_id: row.subject_organization_id,
        project_id: row.subject_project_id,
        parent_id: row.subject_parent_id,
        metadata: row.subject_metadata,
      },
      context: row.context_ip_address || row.context_user_agent || row.context_request_id
        ? {
            ip_address: row.context_ip_address,
            user_agent: row.context_user_agent,
            geo_location: row.context_geo_location,
            request_id: row.context_request_id,
            http_method: row.context_http_method,
            http_status: row.context_http_status,
            endpoint: row.context_endpoint,
            metadata: row.context_metadata,
          }
        : undefined,
      error_details: row.error_code || row.error_message
        ? {
            error_code: row.error_code,
            error_message: row.error_message,
            error_stack: undefined,
            metadata: row.error_metadata,
          }
        : undefined,
      payload: row.payload,
      metadata: row.metadata,
    } as AuditEvent;
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.logger.info('PostgreSQL connection pool closed');
    }
  }
}

/**
 * SQLite storage adapter using better-sqlite3
 *
 * Optimized for local development and testing. Provides synchronous API with good performance.
 *
 * @example
 * ```typescript
 * const storage = new SQLiteAuditStorage({
 *   type: 'sqlite',
 *   connectionString: './local_data/audit.db',
 * });
 *
 * await storage.save(auditEvent);
 * const events = await storage.query({
 *   user_id: 'user_123',
 *   limit: 50,
 * });
 * ```
 */
export class SQLiteAuditStorage implements AuditStorage {
  private config: Required<DatabaseConfig>;
  private logger: pino.Logger;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any; // Database type (avoiding direct dependency)

  constructor(config: DatabaseConfig) {
    if (config.type !== 'sqlite') {
      throw new Error('SQLiteAuditStorage requires type: "sqlite"');
    }

    this.config = {
      type: config.type,
      connectionString: config.connectionString,
      schema: config.schema || 'main',
      debug: config.debug || false,
      logger: config.logger || pino({ name: 'sqlite-audit-storage' }),
    };

    this.logger = this.config.logger;

    // Initialize SQLite database
    this.initializeDatabase();
  }

  /**
   * Initialize SQLite database
   */
  private initializeDatabase(): void {
    try {
      // Dynamically import better-sqlite3 to avoid build-time dependency
      const Database = require('better-sqlite3');

      this.db = new Database(this.config.connectionString);
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache

      this.logger.info(
        { database_path: this.config.connectionString },
        'SQLite database initialized'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          database_path: this.config.connectionString,
        },
        'Failed to initialize SQLite database'
      );
      throw error;
    }
  }

  /**
   * Save a single audit event
   *
   * @param event - Audit event to save
   */
  async save(event: AuditEvent): Promise<void> {
    await this.saveBatch([event]);
  }

  /**
   * Save multiple audit events in batch
   *
   * Uses SQLite transactions for atomic batch inserts.
   *
   * @param events - Array of audit events to save
   */
  async saveBatch(events: readonly AuditEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const startTime = Date.now();

    try {
      const insertStmt = this.db.prepare(`
        INSERT INTO audit_events (
          id, timestamp, event_type, category, severity, outcome,
          actor_user_id, actor_session_id, actor_system_component, actor_api_client_id, actor_metadata,
          subject_resource_type, subject_resource_id, subject_organization_id, subject_project_id, subject_parent_id, subject_metadata,
          context_ip_address, context_user_agent, context_geo_location, context_request_id, context_http_method, context_http_status, context_endpoint, context_metadata,
          error_code, error_message, error_metadata,
          payload, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((eventsToInsert: readonly AuditEvent[]) => {
        for (const event of eventsToInsert) {
          insertStmt.run(
            event.id,
            event.timestamp,
            event.event_type,
            event.category,
            event.severity,
            event.outcome,
            // Actor
            event.actor.user_id || null,
            event.actor.session_id || null,
            event.actor.system_component || null,
            event.actor.api_client_id || null,
            event.actor.metadata ? JSON.stringify(event.actor.metadata) : null,
            // Subject
            event.subject.resource_type,
            event.subject.resource_id || null,
            event.subject.organization_id || null,
            event.subject.project_id || null,
            event.subject.parent_id || null,
            event.subject.metadata ? JSON.stringify(event.subject.metadata) : null,
            // Context
            event.context?.ip_address || null,
            event.context?.user_agent || null,
            event.context?.geo_location ? JSON.stringify(event.context.geo_location) : null,
            event.context?.request_id || null,
            event.context?.http_method || null,
            event.context?.http_status || null,
            event.context?.endpoint || null,
            event.context?.metadata ? JSON.stringify(event.context.metadata) : null,
            // Error details
            event.error_details?.error_code || null,
            event.error_details?.error_message || null,
            event.error_details?.metadata ? JSON.stringify(event.error_details.metadata) : null,
            // Event data
            event.payload ? JSON.stringify(event.payload) : null,
            event.metadata ? JSON.stringify(event.metadata) : null
          );
        }
      });

      insertMany(events);

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          event_count: events.length,
          duration_ms: duration,
          events_per_second: Math.round((events.length / duration) * 1000),
        },
        'Successfully saved audit events batch'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          event_count: events.length,
        },
        'Failed to save audit events batch'
      );
      throw error;
    }
  }

  /**
   * Query audit events with filters
   *
   * @param filter - Filter criteria
   * @returns Promise that resolves to matching events
   */
  async query(filter: AuditEventFilter): Promise<AuditEvent[]> {
    const conditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];

    // Build WHERE conditions
    if (filter.categories && filter.categories.length > 0) {
      const placeholders = filter.categories.map(() => '?').join(',');
      conditions.push(`category IN (${placeholders})`);
      values.push(...filter.categories);
    }

    if (filter.severity) {
      conditions.push('severity = ?');
      values.push(filter.severity);
    }

    if (filter.outcome) {
      conditions.push('outcome = ?');
      values.push(filter.outcome);
    }

    if (filter.event_types && filter.event_types.length > 0) {
      const placeholders = filter.event_types.map(() => '?').join(',');
      conditions.push(`event_type IN (${placeholders})`);
      values.push(...filter.event_types);
    }

    if (filter.organization_id) {
      conditions.push('subject_organization_id = ?');
      values.push(filter.organization_id);
    }

    if (filter.user_id) {
      conditions.push('actor_user_id = ?');
      values.push(filter.user_id);
    }

    if (filter.resource_type) {
      conditions.push('subject_resource_type = ?');
      values.push(filter.resource_type);
    }

    if (filter.resource_id) {
      conditions.push('subject_resource_id = ?');
      values.push(filter.resource_id);
    }

    if (filter.date_from) {
      conditions.push('timestamp >= ?');
      values.push(filter.date_from);
    }

    if (filter.date_to) {
      conditions.push('timestamp <= ?');
      values.push(filter.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY timestamp ${filter.sort === 'asc' ? 'ASC' : 'DESC'}`;
    const limitClause = filter.limit ? `LIMIT ${filter.limit}` : '';
    const offsetClause = filter.offset ? `OFFSET ${filter.offset}` : '';

    const query = `
      SELECT * FROM audit_events
      ${whereClause}
      ${orderClause}
      ${limitClause}
      ${offsetClause}
    `;

    try {
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...values);
      return rows.map(this.rowToAuditEvent);
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          filter,
        },
        'Failed to query audit events'
      );
      throw error;
    }
  }

  /**
   * Convert database row to AuditEvent
   *
   * @param row - Database row
   * @returns AuditEvent object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToAuditEvent(row: any): AuditEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      event_type: row.event_type,
      category: row.category,
      severity: row.severity,
      outcome: row.outcome,
      actor: {
        user_id: row.actor_user_id,
        session_id: row.actor_session_id,
        system_component: row.actor_system_component,
        api_client_id: row.actor_api_client_id,
        metadata: row.actor_metadata ? JSON.parse(row.actor_metadata) : undefined,
      },
      subject: {
        resource_type: row.subject_resource_type,
        resource_id: row.subject_resource_id,
        organization_id: row.subject_organization_id,
        project_id: row.subject_project_id,
        parent_id: row.subject_parent_id,
        metadata: row.subject_metadata ? JSON.parse(row.subject_metadata) : undefined,
      },
      context: row.context_ip_address || row.context_user_agent || row.context_request_id
        ? {
            ip_address: row.context_ip_address,
            user_agent: row.context_user_agent,
            geo_location: row.context_geo_location ? JSON.parse(row.context_geo_location) : undefined,
            request_id: row.context_request_id,
            http_method: row.context_http_method,
            http_status: row.context_http_status,
            endpoint: row.context_endpoint,
            metadata: row.context_metadata ? JSON.parse(row.context_metadata) : undefined,
          }
        : undefined,
      error_details: row.error_code || row.error_message
        ? {
            error_code: row.error_code,
            error_message: row.error_message,
            error_stack: undefined,
            metadata: row.error_metadata ? JSON.parse(row.error_metadata) : undefined,
          }
        : undefined,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    } as AuditEvent;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.logger.info('SQLite database closed');
    }
  }
}

/**
 * Create appropriate storage adapter based on configuration
 *
 * Factory function that automatically selects the right storage adapter.
 *
 * @param config - Database configuration
 * @returns Storage adapter instance
 *
 * @example
 * ```typescript
 * // PostgreSQL
 * const storage = createDatabaseAuditStorage({
 *   type: 'postgresql',
 *   connectionString: process.env.DATABASE_URL!,
 * });
 *
 * // SQLite
 * const storage = createDatabaseAuditStorage({
 *   type: 'sqlite',
 *   connectionString: './audit.db',
 * });
 * ```
 */
export function createDatabaseAuditStorage(config: DatabaseConfig): AuditStorage {
  switch (config.type) {
    case 'postgresql':
      return new PostgreSQLAuditStorage(config);
    case 'sqlite':
      return new SQLiteAuditStorage(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}
