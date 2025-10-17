/**
 * SLA Monitoring and Alerting Module
 *
 * Complete SLA monitoring, alerting, and health check system.
 *
 * @module sla
 *
 * @example
 * ```typescript
 * import {
 *   createSLAMonitoringService,
 *   createAlertingService,
 *   createMetricsCollector,
 *   createHealthCheckService,
 *   InMemorySLAStorage,
 *   MetricType,
 *   AlertChannel,
 * } from './sla';
 *
 * // Initialize storage
 * const storage = new InMemorySLAStorage();
 *
 * // Create SLA monitoring service
 * const slaService = createSLAMonitoringService({
 *   storage,
 *   onViolation: async (violation) => {
 *     await alertService.sendAlert(violation);
 *   },
 * });
 *
 * // Create alerting service
 * const alertService = createAlertingService({
 *   storage,
 *   defaultEmail: 'ops@company.com',
 * });
 *
 * // Create metrics collector
 * const metricsCollector = createMetricsCollector({
 *   slaService,
 *   collectSystemMetrics: true,
 * });
 *
 * // Create health check service
 * const healthService = createHealthCheckService({
 *   slaService,
 * });
 *
 * // Use in Express
 * app.use(metricsCollector.createRequestMetricsMiddleware());
 * app.get('/health', healthService.createHealthEndpoint());
 * app.get('/health/ready', healthService.createReadinessEndpoint());
 * app.get('/health/live', healthService.createLivenessEndpoint());
 * ```
 */

// Types
export * from './types';

// Services
export {
  SLAMonitoringService,
  createSLAMonitoringService,
  type SLAStorage,
  type SLAMonitoringServiceConfig,
} from './SLAMonitoringService';

export {
  AlertingService,
  createAlertingService,
  type AlertStorage,
  type AlertingServiceConfig,
  type AlertChannelHandler,
  EmailAlertHandler,
  SlackAlertHandler,
  WebhookAlertHandler,
  LogAlertHandler,
} from './AlertingService';

export {
  MetricsCollector,
  createMetricsCollector,
  type MetricsCollectorConfig,
  Timed,
} from './MetricsCollector';

export {
  HealthCheckService,
  createHealthCheckService,
  type HealthCheckServiceConfig,
  type ComponentHealthChecker,
  DatabaseHealthChecker,
  RedisHealthChecker,
  StorageHealthChecker,
} from './HealthCheckService';

// Storage
export { InMemorySLAStorage } from './storage/InMemorySLAStorage';
