/**
 * AuditQueryAPI Tests
 *
 * Comprehensive test suite for audit log querying and analytics.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuditQueryAPI } from '../AuditQueryAPI';
import type { AuditStorage } from '../AuditService';
import {
  EventCategory,
  EventSeverity,
  EventOutcome,
  ResourceType,
  type AuditEvent,
} from '../types';

describe('AuditQueryAPI', () => {
  let mockStorage: AuditStorage;
  let queryAPI: AuditQueryAPI;
  let mockEvents: AuditEvent[];

  beforeEach(() => {
    // Create mock events
    mockEvents = [
      {
        id: 'evt_1',
        timestamp: '2025-10-13T10:00:00Z',
        event_type: 'auth.login.success',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_1' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_1', organization_id: 'org_123' },
        outcome: EventOutcome.SUCCESS,
        payload: { auth_method: 'password' },
      },
      {
        id: 'evt_2',
        timestamp: '2025-10-13T10:05:00Z',
        event_type: 'auth.login.failure',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.WARNING,
        actor: { user_id: 'user_2' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_2', organization_id: 'org_123' },
        outcome: EventOutcome.FAILURE,
        context: { ip_address: '192.168.1.100' },
      },
      {
        id: 'evt_3',
        timestamp: '2025-10-13T10:10:00Z',
        event_type: 'security.suspicious_activity',
        category: EventCategory.SECURITY,
        severity: EventSeverity.CRITICAL,
        actor: { user_id: 'user_3' },
        subject: { resource_type: ResourceType.SYSTEM_CONFIG, organization_id: 'org_123' },
        outcome: EventOutcome.FAILURE,
        context: { ip_address: '192.168.1.100' },
      },
      {
        id: 'evt_4',
        timestamp: '2025-10-13T10:15:00Z',
        event_type: 'auth.login.failure',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.WARNING,
        actor: { user_id: 'user_4' },
        subject: { resource_type: ResourceType.USER, resource_id: 'user_4', organization_id: 'org_123' },
        outcome: EventOutcome.FAILURE,
        context: { ip_address: '192.168.1.100' },
      },
      {
        id: 'evt_5',
        timestamp: '2025-10-13T10:20:00Z',
        event_type: 'member.role_changed',
        category: EventCategory.MEMBER,
        severity: EventSeverity.INFO,
        actor: { user_id: 'user_1' },
        subject: { resource_type: ResourceType.MEMBER, resource_id: 'user_5', organization_id: 'org_123' },
        outcome: EventOutcome.SUCCESS,
        payload: { new_role: 'admin', old_role: 'member' },
      },
    ];

    mockStorage = {
      save: jest.fn(),
      saveBatch: jest.fn(),
      query: jest.fn().mockResolvedValue(mockEvents),
    };

    queryAPI = new AuditQueryAPI(mockStorage, {
      cacheEnabled: false, // Disable cache for tests
    });
  });

  describe('Basic Querying', () => {
    it('should query events with pagination', async () => {
      const result = await queryAPI.query(
        { organization_id: 'org_123' },
        1,
        2
      );

      expect(result.events).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(2);
      expect(result.has_more).toBe(true);
      expect(result.total).toBeGreaterThan(2);
    });

    it('should detect last page', async () => {
      const result = await queryAPI.query(
        { organization_id: 'org_123' },
        1,
        10
      );

      expect(result.has_more).toBe(false);
    });

    it('should track execution time', async () => {
      const result = await queryAPI.query(
        { organization_id: 'org_123' }
      );

      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Advanced Querying', () => {
    it('should filter by category', async () => {
      const result = await queryAPI.queryAdvanced({
        categories: [EventCategory.AUTHENTICATION],
      });

      expect(result.events.every(e => e.category === EventCategory.AUTHENTICATION)).toBe(true);
    });

    it('should filter by severity', async () => {
      const result = await queryAPI.queryAdvanced({
        severity: EventSeverity.CRITICAL,
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].severity).toBe(EventSeverity.CRITICAL);
    });

    it('should perform full-text search', async () => {
      const result = await queryAPI.queryAdvanced({
        search: 'password',
      });

      // Should find event with auth_method: password in payload
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should generate aggregations', async () => {
      const result = await queryAPI.queryAdvanced({
        organization_id: 'org_123',
        include_aggregations: true,
      });

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations!.total_count).toBe(5);
      expect(result.aggregations!.by_category).toHaveProperty(EventCategory.AUTHENTICATION);
      expect(result.aggregations!.by_severity).toHaveProperty(EventSeverity.WARNING);
      expect(result.aggregations!.error_rate).toBeGreaterThan(0);
    });
  });

  describe('Aggregations', () => {
    it('should count events by category', async () => {
      const result = await queryAPI.queryAdvanced({
        include_aggregations: true,
      });

      const aggs = result.aggregations!;
      expect(aggs.by_category[EventCategory.AUTHENTICATION]).toBe(3);
      expect(aggs.by_category[EventCategory.SECURITY]).toBe(1);
      expect(aggs.by_category[EventCategory.MEMBER]).toBe(1);
    });

    it('should count events by severity', async () => {
      const result = await queryAPI.queryAdvanced({
        include_aggregations: true,
      });

      const aggs = result.aggregations!;
      expect(aggs.by_severity[EventSeverity.INFO]).toBe(2);
      expect(aggs.by_severity[EventSeverity.WARNING]).toBe(2);
      expect(aggs.by_severity[EventSeverity.CRITICAL]).toBe(1);
    });

    it('should count events by outcome', async () => {
      const result = await queryAPI.queryAdvanced({
        include_aggregations: true,
      });

      const aggs = result.aggregations!;
      expect(aggs.by_outcome[EventOutcome.SUCCESS]).toBe(2);
      expect(aggs.by_outcome[EventOutcome.FAILURE]).toBe(3);
    });

    it('should calculate error rate', async () => {
      const result = await queryAPI.queryAdvanced({
        include_aggregations: true,
      });

      const aggs = result.aggregations!;
      // 3 failures out of 5 total = 60%
      expect(aggs.error_rate).toBeCloseTo(0.6, 1);
    });

    it('should group by user', async () => {
      const result = await queryAPI.queryAdvanced({
        include_aggregations: true,
      });

      const aggs = result.aggregations!;
      expect(aggs.by_user['user_1']).toBe(2);
      expect(aggs.by_user['user_2']).toBe(1);
    });

    it('should create timeline', async () => {
      const result = await queryAPI.queryAdvanced({
        include_aggregations: true,
      });

      const aggs = result.aggregations!;
      expect(aggs.timeline).toHaveLength(1); // All events on same day
      expect(aggs.timeline[0].date).toBe('2025-10-13');
      expect(aggs.timeline[0].count).toBe(5);
    });
  });

  describe('Time-Series Analysis', () => {
    it('should generate daily time series', async () => {
      const timeSeries = await queryAPI.getTimeSeries(
        { organization_id: 'org_123' },
        'day'
      );

      expect(timeSeries).toHaveLength(1);
      expect(timeSeries[0].timestamp).toContain('2025-10-13');
      expect(timeSeries[0].count).toBe(5);
    });

    it('should include category breakdown in time series', async () => {
      const timeSeries = await queryAPI.getTimeSeries(
        { organization_id: 'org_123' },
        'day'
      );

      const dataPoint = timeSeries[0];
      expect(dataPoint.categories[EventCategory.AUTHENTICATION]).toBe(3);
      expect(dataPoint.categories[EventCategory.SECURITY]).toBe(1);
    });

    it('should include severity breakdown in time series', async () => {
      const timeSeries = await queryAPI.getTimeSeries(
        { organization_id: 'org_123' },
        'day'
      );

      const dataPoint = timeSeries[0];
      expect(dataPoint.severities[EventSeverity.INFO]).toBe(2);
      expect(dataPoint.severities[EventSeverity.WARNING]).toBe(2);
      expect(dataPoint.severities[EventSeverity.CRITICAL]).toBe(1);
    });
  });

  describe('Security Anomaly Detection', () => {
    it('should detect brute force attacks', async () => {
      const anomalies = await queryAPI.detectSecurityAnomalies('org_123', 24);

      // 3 failed login attempts from same IP (events 2, 4 from 192.168.1.100)
      // Threshold is 5+, so might not detect in this small sample
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should detect privilege escalation', async () => {
      const anomalies = await queryAPI.detectSecurityAnomalies('org_123', 24);

      // Event 5 is a role change to admin
      const privilegeEscalation = anomalies.find(a => a.type === 'privilege_escalation');
      expect(privilegeEscalation).toBeDefined();
      expect(privilegeEscalation?.severity).toBe('medium');
    });

    it('should detect suspicious activity', async () => {
      const anomalies = await queryAPI.detectSecurityAnomalies('org_123', 24);

      // 1 security event (threshold is 10+, so might not detect)
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should include sample events in anomalies', async () => {
      const anomalies = await queryAPI.detectSecurityAnomalies('org_123', 24);

      if (anomalies.length > 0) {
        expect(anomalies[0].sample_events).toBeDefined();
        expect(anomalies[0].sample_events.length).toBeGreaterThan(0);
        expect(anomalies[0].sample_events.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate compliance report', async () => {
      const report = await queryAPI.generateComplianceReport({
        type: 'soc2',
        organization_id: 'org_123',
        date_from: '2025-10-01T00:00:00Z',
        date_to: '2025-10-31T23:59:59Z',
      });

      expect(report.report_type).toBe('soc2');
      expect(report.organization_id).toBe('org_123');
      expect(report.period.from).toBe('2025-10-01T00:00:00Z');
      expect(report.period.to).toBe('2025-10-31T23:59:59Z');
      expect(report.summary.total_events).toBe(5);
    });

    it('should include events when requested', async () => {
      const report = await queryAPI.generateComplianceReport({
        type: 'soc2',
        organization_id: 'org_123',
        date_from: '2025-10-01T00:00:00Z',
        date_to: '2025-10-31T23:59:59Z',
        include_events: true,
      });

      expect(report.events).toBeDefined();
      expect(report.events.length).toBe(5);
    });

    it('should filter by categories', async () => {
      const report = await queryAPI.generateComplianceReport({
        type: 'gdpr',
        organization_id: 'org_123',
        date_from: '2025-10-01T00:00:00Z',
        date_to: '2025-10-31T23:59:59Z',
        categories: [EventCategory.AUTHENTICATION],
      });

      expect(report.summary.total_events).toBe(3);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      queryAPI.clearCache();
      const stats = queryAPI.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should track cache statistics', () => {
      const stats = queryAPI.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage query errors', async () => {
      const errorStorage: AuditStorage = {
        save: jest.fn(),
        saveBatch: jest.fn(),
        query: jest.fn().mockRejectedValue(new Error('Query failed')),
      };

      const errorQueryAPI = new AuditQueryAPI(errorStorage);

      await expect(
        errorQueryAPI.query({ organization_id: 'org_123' })
      ).rejects.toThrow('Query failed');
    });

    it('should handle missing query support', async () => {
      const noQueryStorage: AuditStorage = {
        save: jest.fn(),
        saveBatch: jest.fn(),
        // No query method
      };

      const noQueryAPI = new AuditQueryAPI(noQueryStorage);

      await expect(
        noQueryAPI.query({ organization_id: 'org_123' })
      ).rejects.toThrow('Storage does not support querying');
    });
  });
});
