/**
 * Health Check Service
 *
 * Provides comprehensive health checks for system components.
 *
 * @module sla/HealthCheckService
 */

import pino from 'pino';
import type { SLAMonitoringService } from './SLAMonitoringService';
import type {
  HealthCheckStatus,
  ComponentHealth,
} from './types';

/**
 * Component health checker interface
 */
export interface ComponentHealthChecker {
  /** Component name */
  name: string;
  /** Check component health */
  check(): Promise<ComponentHealth>;
}

/**
 * Health Check Service Configuration
 */
export interface HealthCheckServiceConfig {
  /** SLA Monitoring Service */
  slaService: SLAMonitoringService;
  /** Logger instance */
  logger?: pino.Logger;
  /** Component checkers */
  checkers?: ComponentHealthChecker[];
  /** Health check timeout in ms */
  checkTimeout?: number;
}

/**
 * Database Health Checker
 */
export class DatabaseHealthChecker implements ComponentHealthChecker {
  name = 'database';

  constructor(private checkQuery?: () => Promise<void>) {}

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      if (this.checkQuery) {
        await this.checkQuery();
      }

      return {
        status: 'healthy',
        response_time_ms: Date.now() - startTime,
        last_check: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        last_check: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Redis Health Checker
 */
export class RedisHealthChecker implements ComponentHealthChecker {
  name = 'redis';

  constructor(private pingRedis?: () => Promise<string>) {}

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      if (this.pingRedis) {
        const pong = await this.pingRedis();
        if (pong !== 'PONG') {
          throw new Error('Invalid Redis response');
        }
      }

      return {
        status: 'healthy',
        response_time_ms: Date.now() - startTime,
        last_check: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        last_check: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Storage Health Checker
 */
export class StorageHealthChecker implements ComponentHealthChecker {
  name = 'storage';

  constructor(private checkStorage?: () => Promise<boolean>) {}

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      if (this.checkStorage) {
        const available = await this.checkStorage();
        if (!available) {
          throw new Error('Storage not available');
        }
      }

      return {
        status: 'healthy',
        response_time_ms: Date.now() - startTime,
        last_check: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        last_check: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Health Check Service
 *
 * Performs health checks on system components and provides status endpoints.
 *
 * @example
 * ```typescript
 * const healthService = new HealthCheckService({
 *   slaService,
 *   checkers: [
 *     new DatabaseHealthChecker(async () => { await db.query('SELECT 1') }),
 *     new RedisHealthChecker(async () => { return await redis.ping() }),
 *   ],
 * });
 *
 * // Perform health check
 * const status = await healthService.check();
 *
 * // Express endpoint
 * app.get('/health', async (req, res) => {
 *   const status = await healthService.check();
 *   res.status(status.status === 'healthy' ? 200 : 503).json(status);
 * });
 * ```
 */
export class HealthCheckService {
  private slaService: SLAMonitoringService;
  private logger: pino.Logger;
  private checkers: Map<string, ComponentHealthChecker>;
  private checkTimeout: number;
  private lastStatus?: HealthCheckStatus;
  private startTime: number;

  constructor(config: HealthCheckServiceConfig) {
    this.slaService = config.slaService;
    this.logger = config.logger || pino({ name: 'health-check' });
    this.checkTimeout = config.checkTimeout || 5000;
    this.startTime = Date.now();

    // Initialize checkers
    this.checkers = new Map();
    if (config.checkers) {
      for (const checker of config.checkers) {
        this.checkers.set(checker.name, checker);
      }
    }
  }

  /**
   * Perform comprehensive health check
   */
  async check(includeDetails = true): Promise<HealthCheckStatus> {
    const checkStartTime = Date.now();

    try {
      // Check all components
      const componentChecks = await Promise.all(
        Array.from(this.checkers.values()).map(checker =>
          this.checkComponentWithTimeout(checker)
        )
      );

      // Build component health map
      const components: HealthCheckStatus['components'] = {};
      for (const [name, health] of componentChecks) {
        components[name as keyof HealthCheckStatus['components']] = health;
      }

      // Get SLA status
      const slaStatus = await this.slaService.getSLAStatus();
      const activeViolations = await this.slaService['storage'].getActiveViolations();

      // Determine overall status
      const overallStatus = this.determineOverallStatus(
        Object.values(components),
        slaStatus
      );

      const status: HealthCheckStatus = {
        status: overallStatus,
        timestamp: new Date(),
        components: includeDetails ? components : {},
        sla_status: slaStatus,
        active_violations: activeViolations.length,
        uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
        version: process.env.npm_package_version || '1.0.0',
      };

      this.lastStatus = status;

      // Log if unhealthy
      if (status.status !== 'healthy') {
        this.logger.warn(
          {
            status: status.status,
            activeViolations: status.active_violations,
            unhealthyComponents: Object.entries(components)
              .filter(([, health]) => health.status !== 'healthy')
              .map(([name]) => name),
          },
          'System health check indicates issues'
        );
      }

      return status;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Health check failed'
      );

      return {
        status: 'unhealthy',
        timestamp: new Date(),
        components: {},
        uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      };
    }
  }

  /**
   * Get cached health status (for quick checks)
   */
  getCachedStatus(): HealthCheckStatus | undefined {
    return this.lastStatus;
  }

  /**
   * Check specific component
   */
  async checkComponent(name: string): Promise<ComponentHealth> {
    const checker = this.checkers.get(name);

    if (!checker) {
      return {
        status: 'unhealthy',
        error: 'Component checker not found',
        last_check: new Date(),
      };
    }

    const [, health] = await this.checkComponentWithTimeout(checker);
    return health;
  }

  /**
   * Register component health checker
   */
  registerChecker(checker: ComponentHealthChecker): void {
    this.checkers.set(checker.name, checker);
    this.logger.info({ component: checker.name }, 'Health checker registered');
  }

  /**
   * Unregister component health checker
   */
  unregisterChecker(name: string): void {
    this.checkers.delete(name);
    this.logger.info({ component: name }, 'Health checker unregistered');
  }

  /**
   * Check component with timeout
   */
  private async checkComponentWithTimeout(
    checker: ComponentHealthChecker
  ): Promise<[string, ComponentHealth]> {
    return Promise.race([
      checker.check().then(health => [checker.name, health] as [string, ComponentHealth]),
      new Promise<[string, ComponentHealth]>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Health check timeout for ${checker.name}`)),
          this.checkTimeout
        )
      ),
    ]).catch(error => {
      return [
        checker.name,
        {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
          last_check: new Date(),
        },
      ] as [string, ComponentHealth];
    });
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(
    components: ComponentHealth[],
    slaStatus: string
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;

    // If any component is unhealthy, system is unhealthy
    if (unhealthyCount > 0) {
      return 'unhealthy';
    }

    // If SLA is violated or components are degraded, system is degraded
    if (slaStatus === 'violated' || degradedCount > 0) {
      return 'degraded';
    }

    // All components healthy and SLA OK
    return 'healthy';
  }

  /**
   * Create Express health check endpoint
   */
  createHealthEndpoint() {
    return async (req: any, res: any): Promise<void> => {
      const includeDetails = req.query.details !== 'false';
      const status = await this.check(includeDetails);

      const httpStatus = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;

      res.status(httpStatus).json(status);
    };
  }

  /**
   * Create Express readiness check endpoint
   */
  createReadinessEndpoint() {
    return async (req: any, res: any): Promise<void> => {
      const status = await this.check(false);

      // Readiness check is stricter - degraded is not ready
      const isReady = status.status === 'healthy';

      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        status: status.status,
        timestamp: status.timestamp,
      });
    };
  }

  /**
   * Create Express liveness check endpoint
   */
  createLivenessEndpoint() {
    return (req: any, res: any): void => {
      // Liveness just checks if process is running
      res.status(200).json({
        alive: true,
        timestamp: new Date(),
        uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      });
    };
  }
}

/**
 * Create Health Check Service instance
 */
export function createHealthCheckService(
  config: HealthCheckServiceConfig
): HealthCheckService {
  return new HealthCheckService(config);
}
