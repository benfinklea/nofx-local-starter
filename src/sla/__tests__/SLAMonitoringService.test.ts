import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  SLAMonitoringService,
  createSLAMonitoringService,
} from '../SLAMonitoringService';
import { InMemorySLAStorage } from '../storage/InMemorySLAStorage';
import {
  MetricType,
  SLASeverity,
  SLAStatus,
  type MetricDataPoint,
  type SLAViolation,
} from '../types';

describe('SLAMonitoringService', () => {
  let storage: InMemorySLAStorage;
  let service: SLAMonitoringService;
  let onViolationMock: jest.Mock<(violation: SLAViolation) => Promise<void>>;

  beforeEach(() => {
    storage = new InMemorySLAStorage();
    onViolationMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void);
    service = createSLAMonitoringService({
      storage,
      onViolation: onViolationMock,
    });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Metric Recording', () => {
    it('should record a single metric', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 150,
        timestamp: new Date(),
      });

      await service.flush();

      const metrics = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
      expect(metrics[0]!.value).toBe(150);
    });

    it('should record batch metrics', async () => {
      const metrics: MetricDataPoint[] = [
        { metric: MetricType.RESPONSE_TIME, value: 100, timestamp: new Date() },
        { metric: MetricType.RESPONSE_TIME, value: 200, timestamp: new Date() },
        { metric: MetricType.RESPONSE_TIME, value: 150, timestamp: new Date() },
      ];

      await service.recordMetricsBatch(metrics);
      await service.flush();

      const stored = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(stored.length).toBe(3);
    });

    it('should auto-flush when buffer reaches limit', async () => {
      const metrics: MetricDataPoint[] = [];
      for (let i = 0; i < 101; i++) {
        metrics.push({
          metric: MetricType.RESPONSE_TIME,
          value: i,
          timestamp: new Date(),
        });
      }

      await service.recordMetricsBatch(metrics);

      // Should auto-flush at 100
      const stored = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(stored.length).toBeGreaterThanOrEqual(100);
    });

    it('should add labels to metrics', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 150,
        timestamp: new Date(),
        labels: {
          endpoint: '/api/users',
          method: 'GET',
        },
      });

      await service.flush();

      const metrics = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics[0]!.labels).toEqual({
        endpoint: '/api/users',
        method: 'GET',
      });
    });
  });

  describe('Threshold Management', () => {
    it('should initialize default thresholds', async () => {
      await service.initializeDefaultThresholds();

      const thresholds = await storage.getThresholds();

      expect(thresholds.length).toBeGreaterThan(0);
      expect(thresholds.some(t => t.metric === MetricType.RESPONSE_TIME)).toBe(true);
      expect(thresholds.some(t => t.metric === MetricType.SUCCESS_RATE)).toBe(true);
    });

    it('should initialize organization-specific thresholds', async () => {
      await service.initializeDefaultThresholds('org_123');

      const thresholds = await storage.getThresholds('org_123');

      expect(thresholds.length).toBeGreaterThan(0);
      expect(thresholds[0]!.organization_id).toBe('org_123');
    });
  });

  describe('Violation Detection', () => {
    beforeEach(async () => {
      await service.initializeDefaultThresholds();
    });

    it('should detect critical response time violation', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 1500, // Exceeds critical threshold of 1000ms
        timestamp: new Date(),
      });

      await service.flush();

      expect(onViolationMock).toHaveBeenCalled();
      const violation = onViolationMock.mock.calls[0]![0];
      expect(violation.metric).toBe(MetricType.RESPONSE_TIME);
      expect(violation.severity).toBe(SLASeverity.CRITICAL);
      expect(violation.current_value).toBe(1500);
    });

    it('should detect warning response time violation', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 750, // Between warning (500) and critical (1000)
        timestamp: new Date(),
      });

      await service.flush();

      expect(onViolationMock).toHaveBeenCalled();
      const violation = onViolationMock.mock.calls[0]![0];
      expect(violation.severity).toBe(SLASeverity.WARNING);
    });

    it('should detect low success rate violation', async () => {
      await service.recordMetric({
        metric: MetricType.SUCCESS_RATE,
        value: 0.94, // Below critical threshold of 0.95
        timestamp: new Date(),
      });

      await service.flush();

      expect(onViolationMock).toHaveBeenCalled();
      const violation = onViolationMock.mock.calls[0]![0];
      expect(violation.metric).toBe(MetricType.SUCCESS_RATE);
      expect(violation.severity).toBe(SLASeverity.CRITICAL);
    });

    it('should not detect violation for metrics within thresholds', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 100, // Well below warning threshold
        timestamp: new Date(),
      });

      await service.flush();

      expect(onViolationMock).not.toHaveBeenCalled();
    });

    it('should save violations to storage', async () => {
      await service.recordMetric({
        metric: MetricType.ERROR_RATE,
        value: 0.06, // Above critical threshold of 0.05
        timestamp: new Date(),
      });

      await service.flush();

      const violations = await storage.getViolations();
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]!.metric).toBe(MetricType.ERROR_RATE);
    });
  });

  describe('SLA Status', () => {
    beforeEach(async () => {
      await service.initializeDefaultThresholds();
    });

    it('should return OK status when no violations', async () => {
      const status = await service.getSLAStatus();
      expect(status).toBe(SLAStatus.OK);
    });

    it('should return VIOLATED status when critical violations exist', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 2000,
        timestamp: new Date(),
      });

      await service.flush();

      const status = await service.getSLAStatus();
      expect(status).toBe(SLAStatus.VIOLATED);
    });

    it('should return WARNING status when only warning violations exist', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 600,
        timestamp: new Date(),
      });

      await service.flush();

      const status = await service.getSLAStatus();
      expect(status).toBe(SLAStatus.WARNING);
    });
  });

  describe('Metric Aggregation', () => {
    it('should calculate aggregation from metrics', async () => {
      const now = new Date();
      const metrics: MetricDataPoint[] = [
        { metric: MetricType.RESPONSE_TIME, value: 100, timestamp: now },
        { metric: MetricType.RESPONSE_TIME, value: 200, timestamp: now },
        { metric: MetricType.RESPONSE_TIME, value: 300, timestamp: now },
        { metric: MetricType.RESPONSE_TIME, value: 400, timestamp: now },
        { metric: MetricType.RESPONSE_TIME, value: 500, timestamp: now },
      ];

      await service.recordMetricsBatch(metrics);
      await service.flush();

      const agg = await service.getAggregation(
        MetricType.RESPONSE_TIME,
        new Date(now.getTime() - 60000),
        new Date(now.getTime() + 60000)
      );

      expect(agg).not.toBeNull();
      expect(agg!.avg).toBe(300);
      expect(agg!.min).toBe(100);
      expect(agg!.max).toBe(500);
      expect(agg!.count).toBe(5);
    });

    it('should calculate percentiles correctly', async () => {
      const now = new Date();
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const metrics = values.map(v => ({
        metric: MetricType.RESPONSE_TIME,
        value: v,
        timestamp: now,
      }));

      await service.recordMetricsBatch(metrics);
      await service.flush();

      const agg = await service.getAggregation(
        MetricType.RESPONSE_TIME,
        new Date(now.getTime() - 60000),
        new Date(now.getTime() + 60000)
      );

      expect(agg!.p50).toBe(50);
      expect(agg!.p95).toBe(95);
      expect(agg!.p99).toBe(99);
    });

    it('should return null for empty time window', async () => {
      const agg = await service.getAggregation(
        MetricType.RESPONSE_TIME,
        new Date('2020-01-01'),
        new Date('2020-01-02')
      );

      expect(agg).toBeNull();
    });
  });

  describe('SLA Reports', () => {
    beforeEach(async () => {
      await service.initializeDefaultThresholds();
    });

    it('should generate compliance report', async () => {
      const start = new Date();
      const end = new Date(start.getTime() + 3600000); // 1 hour later

      // Add some metrics
      await service.recordMetricsBatch([
        { metric: MetricType.RESPONSE_TIME, value: 150, timestamp: start },
        { metric: MetricType.RESPONSE_TIME, value: 200, timestamp: start },
        { metric: MetricType.SUCCESS_RATE, value: 1, timestamp: start },
      ]);

      await service.flush();

      const report = await service.generateReport(start, end);

      expect(report.period_start).toEqual(start);
      expect(report.period_end).toEqual(end);
      expect(report.compliance_rate).toBeGreaterThan(0);
      expect(report.generated_at).toBeInstanceOf(Date);
    });

    it('should include violation counts in report', async () => {
      const start = new Date();
      const end = new Date(start.getTime() + 3600000);

      // Create violations
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 1500,
        timestamp: start,
      });

      await service.flush();

      const report = await service.generateReport(start, end);

      expect(report.total_violations).toBeGreaterThan(0);
      expect(report.violations_by_severity[SLASeverity.CRITICAL]).toBeGreaterThan(0);
    });

    it('should calculate metric-specific compliance', async () => {
      const start = new Date();
      const end = new Date(start.getTime() + 3600000);

      await service.recordMetricsBatch([
        { metric: MetricType.RESPONSE_TIME, value: 100, timestamp: start },
        { metric: MetricType.RESPONSE_TIME, value: 150, timestamp: start },
        { metric: MetricType.RESPONSE_TIME, value: 200, timestamp: start },
      ]);

      await service.flush();

      const report = await service.generateReport(start, end);

      expect(report.metrics[MetricType.RESPONSE_TIME]).toBeDefined();
      expect(report.metrics[MetricType.RESPONSE_TIME]!.actual).toBeCloseTo(150);
      expect(report.metrics[MetricType.RESPONSE_TIME]!.target).toBe(200);
    });
  });

  describe('Shutdown', () => {
    it('should flush metrics on shutdown', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 100,
        timestamp: new Date(),
      });

      await service.shutdown();

      const metrics = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      expect(metrics.length).toBe(1);
    });

    it('should stop flush timer on shutdown', async () => {
      await service.shutdown();

      // Record metric after shutdown
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 100,
        timestamp: new Date(),
      });

      // Timer should be stopped, no auto-flush
      const metrics = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date()
      );

      // Metric is in buffer but not flushed
      expect(metrics.length).toBe(0);
    });
  });

  describe('Organization-specific Metrics', () => {
    beforeEach(async () => {
      await service.initializeDefaultThresholds('org_123');
    });

    it('should track metrics per organization', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 100,
        timestamp: new Date(),
        organization_id: 'org_123',
      });

      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 200,
        timestamp: new Date(),
        organization_id: 'org_456',
      });

      await service.flush();

      const org123Metrics = await storage.getMetrics(
        MetricType.RESPONSE_TIME,
        new Date(Date.now() - 60000),
        new Date(),
        'org_123'
      );

      expect(org123Metrics.length).toBe(1);
      expect(org123Metrics[0]!.value).toBe(100);
    });

    it('should detect violations per organization', async () => {
      await service.recordMetric({
        metric: MetricType.RESPONSE_TIME,
        value: 1500,
        timestamp: new Date(),
        organization_id: 'org_123',
      });

      await service.flush();

      const violations = await storage.getViolations(
        undefined,
        undefined,
        'org_123'
      );

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]!.organization_id).toBe('org_123');
    });
  });
});
