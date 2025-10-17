/**
 * SLA Monitoring Types
 *
 * Type definitions for SLA tracking, metrics, and alerting.
 *
 * @module sla/types
 */

/**
 * SLA metric types that can be tracked
 */
export enum MetricType {
  /** API response time in milliseconds */
  RESPONSE_TIME = 'response_time',
  /** Request success rate (0-1) */
  SUCCESS_RATE = 'success_rate',
  /** System uptime percentage (0-1) */
  UPTIME = 'uptime',
  /** Error rate (0-1) */
  ERROR_RATE = 'error_rate',
  /** Database query time in milliseconds */
  DB_QUERY_TIME = 'db_query_time',
  /** Queue processing time in milliseconds */
  QUEUE_TIME = 'queue_time',
  /** Handler execution time in milliseconds */
  HANDLER_TIME = 'handler_time',
  /** Artifact storage time in milliseconds */
  STORAGE_TIME = 'storage_time',
  /** Git operation time in milliseconds */
  GIT_TIME = 'git_time',
  /** Concurrent users count */
  CONCURRENT_USERS = 'concurrent_users',
  /** Requests per minute */
  REQUESTS_PER_MINUTE = 'requests_per_minute',
  /** Memory usage in MB */
  MEMORY_USAGE = 'memory_usage',
  /** CPU usage percentage (0-1) */
  CPU_USAGE = 'cpu_usage',
}

/**
 * SLA severity levels
 */
export enum SLASeverity {
  /** Informational - no action needed */
  INFO = 'info',
  /** Warning - may need attention */
  WARNING = 'warning',
  /** Critical - immediate attention required */
  CRITICAL = 'critical',
  /** Emergency - system failure */
  EMERGENCY = 'emergency',
}

/**
 * SLA status
 */
export enum SLAStatus {
  /** SLA is being met */
  OK = 'ok',
  /** SLA is close to violation */
  WARNING = 'warning',
  /** SLA has been violated */
  VIOLATED = 'violated',
  /** SLA monitoring is disabled */
  DISABLED = 'disabled',
}

/**
 * Alert channel types
 */
export enum AlertChannel {
  /** Email notification */
  EMAIL = 'email',
  /** Slack notification */
  SLACK = 'slack',
  /** PagerDuty incident */
  PAGERDUTY = 'pagerduty',
  /** Webhook POST */
  WEBHOOK = 'webhook',
  /** SMS notification */
  SMS = 'sms',
  /** Log entry only */
  LOG = 'log',
}

/**
 * SLA threshold definition
 */
export interface SLAThreshold {
  /** Metric type being tracked */
  metric: MetricType;
  /** Target value (interpretation depends on metric) */
  target: number;
  /** Warning threshold (triggers warning alerts) */
  warning_threshold: number;
  /** Critical threshold (triggers critical alerts) */
  critical_threshold: number;
  /** Measurement window in seconds */
  window_seconds: number;
  /** Organization ID (null for system-wide) */
  organization_id?: string;
  /** Whether this threshold is enabled */
  enabled: boolean;
}

/**
 * Metric data point
 */
export interface MetricDataPoint {
  /** Unique identifier */
  id?: string;
  /** Metric type */
  metric: MetricType;
  /** Metric value */
  value: number;
  /** Timestamp of measurement */
  timestamp: Date;
  /** Organization ID (null for system-wide) */
  organization_id?: string;
  /** Additional context/labels */
  labels?: Record<string, string>;
  /** Duration in milliseconds (for timing metrics) */
  duration_ms?: number;
}

/**
 * SLA violation event
 */
export interface SLAViolation {
  /** Unique identifier */
  id: string;
  /** SLA threshold that was violated */
  threshold_id: string;
  /** Metric type */
  metric: MetricType;
  /** Current value that triggered violation */
  current_value: number;
  /** Target value */
  target_value: number;
  /** Threshold value that was exceeded */
  threshold_value: number;
  /** Severity of violation */
  severity: SLASeverity;
  /** When violation was detected */
  detected_at: Date;
  /** When violation was resolved (null if ongoing) */
  resolved_at?: Date;
  /** Organization ID */
  organization_id?: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Unique identifier */
  id?: string;
  /** Alert name */
  name: string;
  /** Description */
  description?: string;
  /** Metric type to monitor */
  metric: MetricType;
  /** Severity levels that trigger this alert */
  severities: SLASeverity[];
  /** Alert channels to use */
  channels: AlertChannel[];
  /** Channel-specific configuration */
  channel_config?: {
    email?: {
      to: string[];
      cc?: string[];
      template?: string;
    };
    slack?: {
      webhook_url: string;
      channel?: string;
      mentions?: string[];
    };
    pagerduty?: {
      service_key: string;
      escalation_policy?: string;
    };
    webhook?: {
      url: string;
      method?: 'POST' | 'PUT';
      headers?: Record<string, string>;
    };
    sms?: {
      to: string[];
      provider?: 'twilio' | 'aws_sns';
    };
  };
  /** Whether this alert is enabled */
  enabled: boolean;
  /** Organization ID (null for system-wide) */
  organization_id?: string;
  /** Cooldown period in seconds to prevent alert spam */
  cooldown_seconds?: number;
  /** Last time alert was sent */
  last_sent_at?: Date;
}

/**
 * Alert notification
 */
export interface AlertNotification {
  /** Unique identifier */
  id: string;
  /** Alert configuration ID */
  alert_id: string;
  /** SLA violation ID */
  violation_id: string;
  /** Channel used */
  channel: AlertChannel;
  /** Severity */
  severity: SLASeverity;
  /** Notification subject/title */
  subject: string;
  /** Notification body/message */
  message: string;
  /** When notification was sent */
  sent_at: Date;
  /** Delivery status */
  status: 'pending' | 'sent' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Organization ID */
  organization_id?: string;
}

/**
 * Health check status
 */
export interface HealthCheckStatus {
  /** Overall system status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Timestamp of check */
  timestamp: Date;
  /** Individual component statuses */
  components: {
    database?: ComponentHealth;
    redis?: ComponentHealth;
    storage?: ComponentHealth;
    queue?: ComponentHealth;
    ai_providers?: ComponentHealth;
    git?: ComponentHealth;
  };
  /** Current SLA status */
  sla_status?: SLAStatus;
  /** Active violations count */
  active_violations?: number;
  /** System uptime in seconds */
  uptime_seconds?: number;
  /** Version information */
  version?: string;
}

/**
 * Individual component health
 */
export interface ComponentHealth {
  /** Component status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Response time in milliseconds */
  response_time_ms?: number;
  /** Last check timestamp */
  last_check?: Date;
  /** Error message if unhealthy */
  error?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * SLA report
 */
export interface SLAReport {
  /** Report period start */
  period_start: Date;
  /** Report period end */
  period_end: Date;
  /** Organization ID (null for system-wide) */
  organization_id?: string;
  /** Overall SLA compliance percentage (0-1) */
  compliance_rate: number;
  /** Metric-specific compliance */
  metrics: {
    [key in MetricType]?: {
      /** Target value */
      target: number;
      /** Actual average value */
      actual: number;
      /** Compliance percentage (0-1) */
      compliance: number;
      /** Number of violations */
      violations: number;
      /** Percentile values */
      p50?: number;
      p95?: number;
      p99?: number;
    };
  };
  /** Total violations during period */
  total_violations: number;
  /** Violations by severity */
  violations_by_severity: {
    [key in SLASeverity]?: number;
  };
  /** Generated at timestamp */
  generated_at: Date;
}

/**
 * Metric aggregation
 */
export interface MetricAggregation {
  /** Metric type */
  metric: MetricType;
  /** Time window */
  window_start: Date;
  window_end: Date;
  /** Average value */
  avg: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** 50th percentile */
  p50: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** Total count of data points */
  count: number;
  /** Organization ID */
  organization_id?: string;
}

/**
 * SLA configuration
 */
export interface SLAConfig {
  /** Default thresholds */
  default_thresholds: SLAThreshold[];
  /** Data retention period in days */
  retention_days: number;
  /** Metric collection interval in seconds */
  collection_interval_seconds: number;
  /** Enable automatic health checks */
  enable_health_checks: boolean;
  /** Health check interval in seconds */
  health_check_interval_seconds: number;
}
