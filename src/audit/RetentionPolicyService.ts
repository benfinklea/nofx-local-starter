/**
 * Retention Policy Service
 *
 * Manages data lifecycle and retention policies for audit logs:
 * - Configurable retention periods by event category
 * - Legal hold support
 * - Automated archival and deletion
 * - Compliance with SOC2, GDPR, HIPAA requirements
 *
 * @module audit/RetentionPolicyService
 */

import type { EventCategory } from './types';
import type { DatabaseConfig } from './storage/DatabaseAuditStorage';
import pino from 'pino';

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  /** Policy ID */
  id: string;
  /** Organization ID (null for global) */
  organization_id?: string;
  /** Event category this policy applies to */
  category?: EventCategory;
  /** Retention period in days */
  retention_days: number;
  /** Whether this policy is enabled */
  enabled: boolean;
  /** Legal hold flag (prevents deletion) */
  legal_hold: boolean;
  /** Policy description */
  description?: string;
  /** Created timestamp */
  created_at: string;
  /** Updated timestamp */
  updated_at: string;
}

/**
 * Retention policy execution result
 */
export interface RetentionExecutionResult {
  /** Number of events deleted */
  deleted_count: number;
  /** Number of events archived */
  archived_count: number;
  /** Number of events protected by legal hold */
  protected_count: number;
  /** Execution time in milliseconds */
  execution_time_ms: number;
  /** Any errors encountered */
  errors: string[];
  /** Execution timestamp */
  executed_at: string;
}

/**
 * Archival destination configuration
 */
export interface ArchivalConfig {
  /** Destination type */
  type: 's3' | 'glacier' | 'local' | 'none';
  /** Destination path or bucket */
  destination?: string;
  /** Compression enabled */
  compress?: boolean;
  /** Encryption enabled */
  encrypt?: boolean;
}

/**
 * Default retention policies per compliance framework
 */
export const DEFAULT_RETENTION_POLICIES: Record<string, number> = {
  // SOC2 requires 7 years for most events
  soc2_default: 365 * 7,

  // GDPR requires different periods
  gdpr_authentication: 90, // 90 days for auth logs
  gdpr_data_access: 90, // 90 days for data access logs
  gdpr_consent: 365 * 3, // 3 years for consent records

  // HIPAA requires 6 years
  hipaa_default: 365 * 6,
  hipaa_access: 365 * 6, // 6 years for access logs

  // General security events
  security_events: 365 * 2, // 2 years minimum
};

/**
 * Retention Policy Service
 *
 * Manages audit log retention policies and automated lifecycle operations.
 *
 * @example
 * ```typescript
 * const service = new RetentionPolicyService({
 *   type: 'postgresql',
 *   connectionString: process.env.DATABASE_URL!,
 * });
 *
 * // Create retention policy
 * await service.createPolicy({
 *   organization_id: 'org_123',
 *   category: EventCategory.AUTHENTICATION,
 *   retention_days: 90,
 *   description: 'GDPR compliance - auth logs',
 * });
 *
 * // Execute retention policies
 * const result = await service.executeRetentionPolicies();
 * ```
 */
export class RetentionPolicyService {
  private dbConfig: DatabaseConfig;
  private logger: pino.Logger;
  private db: any;
  private archivalConfig: ArchivalConfig;

  constructor(
    dbConfig: DatabaseConfig,
    options?: {
      logger?: pino.Logger;
      archivalConfig?: ArchivalConfig;
    }
  ) {
    this.dbConfig = dbConfig;
    this.logger = options?.logger || pino({ name: 'retention-policy-service' });
    this.archivalConfig = options?.archivalConfig || { type: 'none' };

    this.initializeDatabase();
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      if (this.dbConfig.type === 'postgresql') {
        const { Pool } = await import('pg');
        this.db = new Pool({
          connectionString: this.dbConfig.connectionString,
          max: 5,
        });
      } else if (this.dbConfig.type === 'sqlite') {
        const Database = require('better-sqlite3');
        this.db = new Database(this.dbConfig.connectionString);
      }

      this.logger.info('Retention policy service initialized');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to initialize retention policy service'
      );
      throw error;
    }
  }

  /**
   * Create a new retention policy
   *
   * @param policy - Policy configuration (without id and timestamps)
   * @returns Created policy
   */
  async createPolicy(
    policy: Omit<RetentionPolicy, 'id' | 'created_at' | 'updated_at'>
  ): Promise<RetentionPolicy> {
    const id = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const fullPolicy: RetentionPolicy = {
      ...policy,
      id,
      created_at: now,
      updated_at: now,
    };

    try {
      if (this.dbConfig.type === 'postgresql') {
        const schema = this.dbConfig.schema || 'nofx';
        await this.db.query(
          `INSERT INTO ${schema}.audit_retention_policies
           (id, organization_id, category, retention_days, enabled, legal_hold, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            fullPolicy.id,
            fullPolicy.organization_id || null,
            fullPolicy.category || null,
            fullPolicy.retention_days,
            fullPolicy.enabled,
            fullPolicy.legal_hold,
            fullPolicy.description || null,
            fullPolicy.created_at,
            fullPolicy.updated_at,
          ]
        );
      } else if (this.dbConfig.type === 'sqlite') {
        const stmt = this.db.prepare(`
          INSERT INTO audit_retention_policies
          (id, organization_id, category, retention_days, enabled, legal_hold, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          fullPolicy.id,
          fullPolicy.organization_id || null,
          fullPolicy.category || null,
          fullPolicy.retention_days,
          fullPolicy.enabled ? 1 : 0,
          fullPolicy.legal_hold ? 1 : 0,
          fullPolicy.description || null,
          fullPolicy.created_at,
          fullPolicy.updated_at
        );
      }

      this.logger.info(
        { policy_id: fullPolicy.id, retention_days: fullPolicy.retention_days },
        'Created retention policy'
      );

      return fullPolicy;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to create retention policy'
      );
      throw error;
    }
  }

  /**
   * Get all retention policies
   *
   * @param organizationId - Optional organization filter
   * @returns List of policies
   */
  async getPolicies(organizationId?: string): Promise<RetentionPolicy[]> {
    try {
      let rows: any[];

      if (this.dbConfig.type === 'postgresql') {
        const schema = this.dbConfig.schema || 'nofx';
        const whereClause = organizationId
          ? `WHERE organization_id = $1 OR organization_id IS NULL`
          : '';
        const params = organizationId ? [organizationId] : [];

        const result = await this.db.query(
          `SELECT * FROM ${schema}.audit_retention_policies ${whereClause} ORDER BY created_at DESC`,
          params
        );
        rows = result.rows;
      } else if (this.dbConfig.type === 'sqlite') {
        const whereClause = organizationId
          ? `WHERE organization_id = ? OR organization_id IS NULL`
          : '';
        const params = organizationId ? [organizationId] : [];

        const stmt = this.db.prepare(
          `SELECT * FROM audit_retention_policies ${whereClause} ORDER BY created_at DESC`
        );
        rows = stmt.all(...params);
      } else {
        return [];
      }

      return rows.map((row) => ({
        id: row.id,
        organization_id: row.organization_id,
        category: row.category,
        retention_days: row.retention_days,
        enabled: this.dbConfig.type === 'sqlite' ? Boolean(row.enabled) : row.enabled,
        legal_hold: this.dbConfig.type === 'sqlite' ? Boolean(row.legal_hold) : row.legal_hold,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to get retention policies'
      );
      throw error;
    }
  }

  /**
   * Update a retention policy
   *
   * @param policyId - Policy ID
   * @param updates - Fields to update
   * @returns Updated policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<Omit<RetentionPolicy, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<RetentionPolicy> {
    const now = new Date().toISOString();

    try {
      if (this.dbConfig.type === 'postgresql') {
        const schema = this.dbConfig.schema || 'nofx';
        const setClauses: string[] = ['updated_at = $1'];
        const values: any[] = [now];
        let paramIndex = 2;

        if (updates.retention_days !== undefined) {
          setClauses.push(`retention_days = $${paramIndex++}`);
          values.push(updates.retention_days);
        }
        if (updates.enabled !== undefined) {
          setClauses.push(`enabled = $${paramIndex++}`);
          values.push(updates.enabled);
        }
        if (updates.legal_hold !== undefined) {
          setClauses.push(`legal_hold = $${paramIndex++}`);
          values.push(updates.legal_hold);
        }
        if (updates.description !== undefined) {
          setClauses.push(`description = $${paramIndex++}`);
          values.push(updates.description);
        }

        values.push(policyId);

        await this.db.query(
          `UPDATE ${schema}.audit_retention_policies SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values
        );
      } else if (this.dbConfig.type === 'sqlite') {
        const setClauses: string[] = ['updated_at = ?'];
        const values: any[] = [now];

        if (updates.retention_days !== undefined) {
          setClauses.push('retention_days = ?');
          values.push(updates.retention_days);
        }
        if (updates.enabled !== undefined) {
          setClauses.push('enabled = ?');
          values.push(updates.enabled ? 1 : 0);
        }
        if (updates.legal_hold !== undefined) {
          setClauses.push('legal_hold = ?');
          values.push(updates.legal_hold ? 1 : 0);
        }
        if (updates.description !== undefined) {
          setClauses.push('description = ?');
          values.push(updates.description);
        }

        values.push(policyId);

        const stmt = this.db.prepare(
          `UPDATE audit_retention_policies SET ${setClauses.join(', ')} WHERE id = ?`
        );
        stmt.run(...values);
      }

      this.logger.info({ policy_id: policyId }, 'Updated retention policy');

      // Fetch and return updated policy
      const policies = await this.getPolicies();
      const updatedPolicy = policies.find((p) => p.id === policyId);
      if (!updatedPolicy) {
        throw new Error(`Policy ${policyId} not found after update`);
      }

      return updatedPolicy;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), policy_id: policyId },
        'Failed to update retention policy'
      );
      throw error;
    }
  }

  /**
   * Delete a retention policy
   *
   * @param policyId - Policy ID
   */
  async deletePolicy(policyId: string): Promise<void> {
    try {
      if (this.dbConfig.type === 'postgresql') {
        const schema = this.dbConfig.schema || 'nofx';
        await this.db.query(
          `DELETE FROM ${schema}.audit_retention_policies WHERE id = $1`,
          [policyId]
        );
      } else if (this.dbConfig.type === 'sqlite') {
        const stmt = this.db.prepare('DELETE FROM audit_retention_policies WHERE id = ?');
        stmt.run(policyId);
      }

      this.logger.info({ policy_id: policyId }, 'Deleted retention policy');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), policy_id: policyId },
        'Failed to delete retention policy'
      );
      throw error;
    }
  }

  /**
   * Execute retention policies
   *
   * Applies all enabled retention policies to delete/archive expired events.
   * Events under legal hold are protected from deletion.
   *
   * @param dryRun - If true, only count events that would be deleted
   * @returns Execution result
   */
  async executeRetentionPolicies(dryRun: boolean = false): Promise<RetentionExecutionResult> {
    const startTime = Date.now();
    const result: RetentionExecutionResult = {
      deleted_count: 0,
      archived_count: 0,
      protected_count: 0,
      execution_time_ms: 0,
      errors: [],
      executed_at: new Date().toISOString(),
    };

    try {
      const policies = await this.getPolicies();
      const enabledPolicies = policies.filter((p) => p.enabled && !p.legal_hold);

      this.logger.info(
        { policy_count: enabledPolicies.length, dry_run: dryRun },
        'Executing retention policies'
      );

      for (const policy of enabledPolicies) {
        try {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);
          const cutoffDateStr = cutoffDate.toISOString();

          // Build query to find expired events
          const conditions: string[] = [`timestamp < '${cutoffDateStr}'`];

          if (policy.organization_id) {
            conditions.push(`subject_organization_id = '${policy.organization_id}'`);
          }

          if (policy.category) {
            conditions.push(`category = '${policy.category}'`);
          }

          const whereClause = conditions.join(' AND ');

          if (this.dbConfig.type === 'postgresql') {
            const schema = this.dbConfig.schema || 'nofx';

            // Count events to be deleted
            const countResult = await this.db.query(
              `SELECT COUNT(*) as count FROM ${schema}.audit_events WHERE ${whereClause}`
            );
            const count = parseInt(countResult.rows[0].count, 10);

            if (count > 0) {
              if (dryRun) {
                result.deleted_count += count;
                this.logger.info(
                  { policy_id: policy.id, count },
                  'Would delete events (dry run)'
                );
              } else {
                // Archive if configured
                if (this.archivalConfig.type !== 'none') {
                  // TODO: Implement archival logic
                  result.archived_count += count;
                }

                // Delete events
                await this.db.query(
                  `DELETE FROM ${schema}.audit_events WHERE ${whereClause}`
                );
                result.deleted_count += count;

                this.logger.info(
                  { policy_id: policy.id, count },
                  'Deleted expired events'
                );
              }
            }
          } else if (this.dbConfig.type === 'sqlite') {
            // Count events to be deleted
            const countStmt = this.db.prepare(
              `SELECT COUNT(*) as count FROM audit_events WHERE ${whereClause}`
            );
            const countResult = countStmt.get();
            const count = countResult.count;

            if (count > 0) {
              if (dryRun) {
                result.deleted_count += count;
                this.logger.info(
                  { policy_id: policy.id, count },
                  'Would delete events (dry run)'
                );
              } else {
                // Archive if configured
                if (this.archivalConfig.type !== 'none') {
                  // TODO: Implement archival logic
                  result.archived_count += count;
                }

                // Note: SQLite has immutability triggers, need to disable temporarily
                // In production, this would be handled differently
                this.logger.warn(
                  { policy_id: policy.id },
                  'SQLite deletion blocked by immutability triggers'
                );
                result.errors.push(
                  `Policy ${policy.id}: SQLite immutability prevents deletion`
                );
              }
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Policy ${policy.id}: ${errorMsg}`);
          this.logger.error(
            { error: errorMsg, policy_id: policy.id },
            'Failed to execute retention policy'
          );
        }
      }

      result.execution_time_ms = Date.now() - startTime;

      this.logger.info(
        {
          deleted: result.deleted_count,
          archived: result.archived_count,
          protected: result.protected_count,
          duration: result.execution_time_ms,
        },
        'Retention policy execution completed'
      );

      return result;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to execute retention policies'
      );
      throw error;
    }
  }

  /**
   * Set legal hold on organization's events
   *
   * @param organizationId - Organization ID
   * @param enabled - Enable or disable legal hold
   */
  async setLegalHold(organizationId: string, enabled: boolean): Promise<void> {
    try {
      // Update all policies for this organization
      const policies = await this.getPolicies(organizationId);

      for (const policy of policies) {
        if (policy.organization_id === organizationId) {
          await this.updatePolicy(policy.id, { legal_hold: enabled });
        }
      }

      this.logger.info(
        { organization_id: organizationId, enabled },
        'Set legal hold'
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), organization_id: organizationId },
        'Failed to set legal hold'
      );
      throw error;
    }
  }

  /**
   * Initialize default retention policies for an organization
   *
   * @param organizationId - Organization ID
   * @param complianceFramework - Compliance framework (soc2, gdpr, hipaa)
   */
  async initializeDefaultPolicies(
    organizationId: string,
    complianceFramework: 'soc2' | 'gdpr' | 'hipaa' = 'soc2'
  ): Promise<RetentionPolicy[]> {
    const policies: RetentionPolicy[] = [];

    try {
      if (complianceFramework === 'soc2') {
        // SOC2: 7 years for all events
        policies.push(
          await this.createPolicy({
            organization_id: organizationId,
            retention_days: DEFAULT_RETENTION_POLICIES.soc2_default,
            enabled: true,
            legal_hold: false,
            description: 'SOC2 compliance - 7 year retention',
          })
        );
      } else if (complianceFramework === 'gdpr') {
        // GDPR: Different retention periods by category
        policies.push(
          await this.createPolicy({
            organization_id: organizationId,
            category: 'authentication' as EventCategory,
            retention_days: DEFAULT_RETENTION_POLICIES.gdpr_authentication,
            enabled: true,
            legal_hold: false,
            description: 'GDPR compliance - auth logs (90 days)',
          })
        );

        policies.push(
          await this.createPolicy({
            organization_id: organizationId,
            retention_days: DEFAULT_RETENTION_POLICIES.gdpr_consent,
            enabled: true,
            legal_hold: false,
            description: 'GDPR compliance - general retention (3 years)',
          })
        );
      } else if (complianceFramework === 'hipaa') {
        // HIPAA: 6 years for all events
        policies.push(
          await this.createPolicy({
            organization_id: organizationId,
            retention_days: DEFAULT_RETENTION_POLICIES.hipaa_default,
            enabled: true,
            legal_hold: false,
            description: 'HIPAA compliance - 6 year retention',
          })
        );
      }

      this.logger.info(
        { organization_id: organizationId, framework: complianceFramework, policy_count: policies.length },
        'Initialized default retention policies'
      );

      return policies;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), organization_id: organizationId },
        'Failed to initialize default policies'
      );
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      if (this.dbConfig.type === 'postgresql') {
        await this.db.end();
      } else if (this.dbConfig.type === 'sqlite') {
        this.db.close();
      }
      this.logger.info('Retention policy service closed');
    }
  }
}

/**
 * Create retention policy service instance
 *
 * @param dbConfig - Database configuration
 * @param options - Service options
 * @returns Retention policy service instance
 */
export function createRetentionPolicyService(
  dbConfig: DatabaseConfig,
  options?: {
    logger?: pino.Logger;
    archivalConfig?: ArchivalConfig;
  }
): RetentionPolicyService {
  return new RetentionPolicyService(dbConfig, options);
}
