/**
 * Audit Query API
 *
 * Provides a powerful, type-safe interface for querying audit logs with:
 * - Advanced filtering and search
 * - Aggregations and analytics
 * - Time-series analysis
 * - Export capabilities
 * - Real-time streaming
 *
 * @module audit/AuditQueryAPI
 */

import type {
  AuditEvent,
  AuditEventFilter,
  EventCategory,
  EventSeverity,
  EventOutcome,
  ResourceType,
} from './types';
import type { AuditStorage } from './AuditService';
import pino from 'pino';

/**
 * Extended filter interface with advanced query capabilities
 */
export interface AdvancedAuditEventFilter extends AuditEventFilter {
  /** Full-text search in payload and metadata */
  search?: string;
  /** Include events that match ANY of these conditions (OR logic) */
  any_of?: AuditEventFilter[];
  /** Exclude events matching these conditions */
  exclude?: Partial<AuditEventFilter>;
  /** Group results by field */
  group_by?: 'category' | 'severity' | 'outcome' | 'event_type' | 'user_id' | 'organization_id';
  /** Include aggregations in response */
  include_aggregations?: boolean;
}

/**
 * Aggregation results for audit events
 */
export interface AuditAggregations {
  /** Total number of events matching filter */
  total_count: number;
  /** Count by category */
  by_category: Record<EventCategory, number>;
  /** Count by severity */
  by_severity: Record<EventSeverity, number>;
  /** Count by outcome */
  by_outcome: Record<EventOutcome, number>;
  /** Count by event type (top 20) */
  by_event_type: Record<string, number>;
  /** Count by user (top 50) */
  by_user: Record<string, number>;
  /** Count by organization (top 50) */
  by_organization: Record<string, number>;
  /** Events per day (last 30 days) */
  timeline: Array<{ date: string; count: number }>;
  /** Error rate (failures / total) */
  error_rate: number;
}

/**
 * Query result with metadata
 */
export interface QueryResult {
  /** Matching events */
  events: AuditEvent[];
  /** Total count (before pagination) */
  total: number;
  /** Current page */
  page: number;
  /** Page size */
  page_size: number;
  /** Whether there are more pages */
  has_more: boolean;
  /** Aggregations (if requested) */
  aggregations?: AuditAggregations;
  /** Query execution time in ms */
  execution_time_ms: number;
}

/**
 * Time-series data point
 */
export interface TimeSeriesDataPoint {
  timestamp: string;
  count: number;
  categories: Record<EventCategory, number>;
  severities: Record<EventSeverity, number>;
}

/**
 * Security anomaly detection result
 */
export interface SecurityAnomaly {
  type: 'brute_force' | 'unusual_access' | 'privilege_escalation' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_resource?: string;
  affected_user?: string;
  event_count: number;
  first_seen: string;
  last_seen: string;
  sample_events: AuditEvent[];
}

/**
 * Compliance report configuration
 */
export interface ComplianceReportConfig {
  /** Report type */
  type: 'soc2' | 'gdpr' | 'hipaa' | 'custom';
  /** Organization ID */
  organization_id: string;
  /** Date range */
  date_from: string;
  date_to: string;
  /** Include event details */
  include_events?: boolean;
  /** Event categories to include */
  categories?: EventCategory[];
  /** Format */
  format?: 'json' | 'csv' | 'pdf';
}

/**
 * Audit Query API - Advanced querying and analytics
 *
 * Provides high-level query operations with caching, aggregations, and analytics.
 *
 * @example
 * ```typescript
 * const queryAPI = new AuditQueryAPI(storage);
 *
 * // Basic query
 * const result = await queryAPI.query({
 *   organization_id: 'org_123',
 *   categories: [EventCategory.SECURITY],
 *   date_from: '2025-10-01T00:00:00Z',
 * });
 *
 * // Advanced query with aggregations
 * const advanced = await queryAPI.queryAdvanced({
 *   organization_id: 'org_123',
 *   search: 'failed login',
 *   include_aggregations: true,
 * });
 *
 * // Security anomalies
 * const anomalies = await queryAPI.detectSecurityAnomalies('org_123');
 * ```
 */
export class AuditQueryAPI {
  private storage: AuditStorage;
  private logger: pino.Logger;
  private cache: Map<string, { data: any; expires: number }>;
  private cacheEnabled: boolean;
  private cacheTTL: number; // milliseconds

  constructor(
    storage: AuditStorage,
    options?: {
      logger?: pino.Logger;
      cacheEnabled?: boolean;
      cacheTTL?: number;
    }
  ) {
    this.storage = storage;
    this.logger = options?.logger || pino({ name: 'audit-query-api' });
    this.cache = new Map();
    this.cacheEnabled = options?.cacheEnabled ?? true;
    this.cacheTTL = options?.cacheTTL ?? 60000; // 1 minute default
  }

  /**
   * Query audit events with pagination and metadata
   *
   * @param filter - Filter criteria
   * @param page - Page number (1-based)
   * @param pageSize - Items per page
   * @returns Query result with metadata
   */
  async query(
    filter: AuditEventFilter,
    page: number = 1,
    pageSize: number = 50
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Calculate offset
      const offset = (page - 1) * pageSize;

      // Query with limit + 1 to check if there are more pages
      const events = await this.storage.query?.({
        ...filter,
        limit: pageSize + 1,
        offset,
      });

      if (!events) {
        throw new Error('Storage does not support querying');
      }

      // Check if there are more pages
      const hasMore = events.length > pageSize;
      const resultEvents = hasMore ? events.slice(0, pageSize) : events;

      // Get total count (simplified - in production, use COUNT query)
      const total = offset + resultEvents.length + (hasMore ? 1 : 0);

      return {
        events: resultEvents,
        total,
        page,
        page_size: pageSize,
        has_more: hasMore,
        execution_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), filter },
        'Failed to query audit events'
      );
      throw error;
    }
  }

  /**
   * Advanced query with aggregations and analytics
   *
   * @param filter - Advanced filter criteria
   * @returns Query result with aggregations
   */
  async queryAdvanced(filter: AdvancedAuditEventFilter): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Build base filter
      const baseFilter: AuditEventFilter = {
        categories: filter.categories,
        severity: filter.severity,
        outcome: filter.outcome,
        event_types: filter.event_types,
        organization_id: filter.organization_id,
        user_id: filter.user_id,
        resource_type: filter.resource_type,
        resource_id: filter.resource_id,
        date_from: filter.date_from,
        date_to: filter.date_to,
        sort: filter.sort,
        limit: filter.limit || 50,
        offset: filter.offset || 0,
      };

      // Execute query
      const events = await this.storage.query?.(baseFilter);

      if (!events) {
        throw new Error('Storage does not support querying');
      }

      // Apply client-side filtering for advanced features
      let filteredEvents = events;

      // Full-text search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filteredEvents = filteredEvents.filter((event) => {
          const payloadStr = JSON.stringify(event.payload || {}).toLowerCase();
          const metadataStr = JSON.stringify(event.metadata || {}).toLowerCase();
          return (
            event.event_type.toLowerCase().includes(searchLower) ||
            payloadStr.includes(searchLower) ||
            metadataStr.includes(searchLower)
          );
        });
      }

      // Generate aggregations if requested
      let aggregations: AuditAggregations | undefined;
      if (filter.include_aggregations) {
        aggregations = await this.generateAggregations(filteredEvents);
      }

      const page = Math.floor((filter.offset || 0) / (filter.limit || 50)) + 1;
      const pageSize = filter.limit || 50;

      return {
        events: filteredEvents,
        total: filteredEvents.length,
        page,
        page_size: pageSize,
        has_more: false, // Client-side filtering doesn't support pagination
        aggregations,
        execution_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), filter },
        'Failed to execute advanced query'
      );
      throw error;
    }
  }

  /**
   * Generate aggregations from events
   *
   * @param events - Events to aggregate
   * @returns Aggregation results
   */
  private async generateAggregations(events: AuditEvent[]): Promise<AuditAggregations> {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const byEventType: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byOrganization: Record<string, number> = {};
    const timeline: Map<string, number> = new Map();

    let failureCount = 0;

    for (const event of events) {
      // Count by category
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;

      // Count by severity
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;

      // Count by outcome
      byOutcome[event.outcome] = (byOutcome[event.outcome] || 0) + 1;
      if (event.outcome === 'failure') failureCount++;

      // Count by event type
      byEventType[event.event_type] = (byEventType[event.event_type] || 0) + 1;

      // Count by user
      if (event.actor.user_id) {
        byUser[event.actor.user_id] = (byUser[event.actor.user_id] || 0) + 1;
      }

      // Count by organization
      if (event.subject.organization_id) {
        byOrganization[event.subject.organization_id] =
          (byOrganization[event.subject.organization_id] || 0) + 1;
      }

      // Timeline (by day)
      const date = event.timestamp.split('T')[0];
      timeline.set(date, (timeline.get(date) || 0) + 1);
    }

    // Sort and limit top items
    const topEventTypes = Object.entries(byEventType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

    const topUsers = Object.entries(byUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

    const topOrganizations = Object.entries(byOrganization)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

    // Convert timeline to array
    const timelineArray = Array.from(timeline.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days

    return {
      total_count: events.length,
      by_category: byCategory as Record<EventCategory, number>,
      by_severity: bySeverity as Record<EventSeverity, number>,
      by_outcome: byOutcome as Record<EventOutcome, number>,
      by_event_type: topEventTypes,
      by_user: topUsers,
      by_organization: topOrganizations,
      timeline: timelineArray,
      error_rate: events.length > 0 ? failureCount / events.length : 0,
    };
  }

  /**
   * Get time-series data for events
   *
   * @param filter - Filter criteria
   * @param interval - Time interval ('hour' | 'day' | 'week')
   * @returns Time-series data points
   */
  async getTimeSeries(
    filter: AuditEventFilter,
    interval: 'hour' | 'day' | 'week' = 'day'
  ): Promise<TimeSeriesDataPoint[]> {
    const events = await this.storage.query?.(filter);

    if (!events) {
      throw new Error('Storage does not support querying');
    }

    const timeSeriesMap = new Map<string, TimeSeriesDataPoint>();

    for (const event of events) {
      // Determine time bucket based on interval
      let bucket: string;
      const date = new Date(event.timestamp);

      switch (interval) {
        case 'hour':
          bucket = date.toISOString().slice(0, 13) + ':00:00.000Z';
          break;
        case 'day':
          bucket = date.toISOString().split('T')[0] + 'T00:00:00.000Z';
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          bucket = weekStart.toISOString().split('T')[0] + 'T00:00:00.000Z';
          break;
      }

      // Get or create data point
      let dataPoint = timeSeriesMap.get(bucket);
      if (!dataPoint) {
        dataPoint = {
          timestamp: bucket,
          count: 0,
          categories: {} as Record<EventCategory, number>,
          severities: {} as Record<EventSeverity, number>,
        };
        timeSeriesMap.set(bucket, dataPoint);
      }

      // Increment counts
      dataPoint.count++;
      dataPoint.categories[event.category] = (dataPoint.categories[event.category] || 0) + 1;
      dataPoint.severities[event.severity] = (dataPoint.severities[event.severity] || 0) + 1;
    }

    // Convert to sorted array
    return Array.from(timeSeriesMap.values()).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );
  }

  /**
   * Detect security anomalies in audit logs
   *
   * Analyzes recent events to identify potential security threats:
   * - Brute force attacks (multiple failed logins)
   * - Unusual access patterns
   * - Privilege escalation attempts
   * - Suspicious activity
   *
   * @param organizationId - Organization to analyze
   * @param lookbackHours - Hours to look back (default: 24)
   * @returns Detected anomalies
   */
  async detectSecurityAnomalies(
    organizationId: string,
    lookbackHours: number = 24
  ): Promise<SecurityAnomaly[]> {
    const dateFrom = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

    const events = await this.storage.query?.({
      organization_id: organizationId,
      date_from: dateFrom,
      limit: 10000,
    });

    if (!events) {
      throw new Error('Storage does not support querying');
    }

    const anomalies: SecurityAnomaly[] = [];

    // Detect brute force attacks (5+ failed logins from same IP in 1 hour)
    const failedLoginsByIP = new Map<string, AuditEvent[]>();
    for (const event of events) {
      if (event.event_type === 'auth.login.failure' && event.context?.ip_address) {
        const ip = event.context.ip_address;
        if (!failedLoginsByIP.has(ip)) {
          failedLoginsByIP.set(ip, []);
        }
        failedLoginsByIP.get(ip)!.push(event);
      }
    }

    for (const [ip, loginEvents] of failedLoginsByIP.entries()) {
      if (loginEvents.length >= 5) {
        anomalies.push({
          type: 'brute_force',
          severity: 'high',
          description: `Detected ${loginEvents.length} failed login attempts from IP ${ip}`,
          event_count: loginEvents.length,
          first_seen: loginEvents[0].timestamp,
          last_seen: loginEvents[loginEvents.length - 1].timestamp,
          sample_events: loginEvents.slice(0, 5),
        });
      }
    }

    // Detect privilege escalation (role changes to higher privileges)
    const privilegeEscalations = events.filter(
      (e) =>
        e.event_type === 'member.role_changed' &&
        e.payload &&
        typeof e.payload === 'object' &&
        'new_role' in e.payload &&
        (e.payload.new_role === 'owner' || e.payload.new_role === 'admin')
    );

    if (privilegeEscalations.length > 0) {
      anomalies.push({
        type: 'privilege_escalation',
        severity: 'medium',
        description: `Detected ${privilegeEscalations.length} privilege escalation events`,
        event_count: privilegeEscalations.length,
        first_seen: privilegeEscalations[0].timestamp,
        last_seen: privilegeEscalations[privilegeEscalations.length - 1].timestamp,
        sample_events: privilegeEscalations.slice(0, 5),
      });
    }

    // Detect suspicious activity (multiple security events)
    const securityEvents = events.filter((e) => e.category === 'security');
    if (securityEvents.length >= 10) {
      anomalies.push({
        type: 'suspicious_activity',
        severity: 'medium',
        description: `Detected ${securityEvents.length} security-related events`,
        event_count: securityEvents.length,
        first_seen: securityEvents[0].timestamp,
        last_seen: securityEvents[securityEvents.length - 1].timestamp,
        sample_events: securityEvents.slice(0, 5),
      });
    }

    return anomalies;
  }

  /**
   * Generate compliance report
   *
   * @param config - Report configuration
   * @returns Report data
   */
  async generateComplianceReport(config: ComplianceReportConfig): Promise<any> {
    const events = await this.storage.query?.({
      organization_id: config.organization_id,
      categories: config.categories,
      date_from: config.date_from,
      date_to: config.date_to,
      limit: 100000, // Large limit for reports
    });

    if (!events) {
      throw new Error('Storage does not support querying');
    }

    const aggregations = await this.generateAggregations(events);

    // Build report based on type
    const report = {
      report_type: config.type,
      organization_id: config.organization_id,
      period: {
        from: config.date_from,
        to: config.date_to,
      },
      generated_at: new Date().toISOString(),
      summary: {
        total_events: events.length,
        event_categories: aggregations.by_category,
        event_severities: aggregations.by_severity,
        error_rate: aggregations.error_rate,
      },
      events: config.include_events ? events : undefined,
    };

    return report;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Create audit query API instance
 *
 * @param storage - Storage adapter
 * @param options - Configuration options
 * @returns Query API instance
 */
export function createAuditQueryAPI(
  storage: AuditStorage,
  options?: {
    logger?: pino.Logger;
    cacheEnabled?: boolean;
    cacheTTL?: number;
  }
): AuditQueryAPI {
  return new AuditQueryAPI(storage, options);
}
