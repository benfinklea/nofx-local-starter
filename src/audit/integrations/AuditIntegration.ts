/**
 * Audit System Integration
 *
 * Provides integration hooks for automatically logging audit events from:
 * - RBAC operations (permission checks, role assignments)
 * - Authentication events (login, logout, API key usage)
 * - Authorization events (access grants/denials)
 * - Organization operations (CRUD, member management)
 *
 * @module audit/integrations/AuditIntegration
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuditService } from '../AuditService';
import type { RBACService } from '../../rbac/RBACService';
import {
  EventCategory,
  EventSeverity,
  EventOutcome,
  type CreateAuditEventInput,
  type EventContext,
} from '../types';
import { OrganizationRole, OrganizationPermission } from '../../lib/organizations.types';
import pino from 'pino';

/**
 * Audit integration configuration
 */
export interface AuditIntegrationConfig {
  /** Audit service instance */
  auditService: AuditService;
  /** Optional RBAC service for enhanced context */
  rbacService?: RBACService;
  /** Logger instance */
  logger?: pino.Logger;
  /** Enable/disable specific event categories */
  enabledCategories?: EventCategory[];
}

/**
 * Extract context from Express request
 */
function extractContextFromRequest(req: Request): EventContext {
  return {
    ip_address: req.ip || req.headers['x-forwarded-for']?.toString() || undefined,
    user_agent: req.headers['user-agent'],
    request_id: req.headers['x-request-id']?.toString() || undefined,
    http_method: req.method,
    http_status: undefined, // Set by response interceptor
    endpoint: req.path,
  };
}

/**
 * Audit Integration Service
 *
 * Provides methods for integrating audit logging into existing services.
 * Can be used as middleware or called directly from service methods.
 *
 * @example
 * ```typescript
 * const integration = new AuditIntegration({
 *   auditService,
 *   rbacService,
 * });
 *
 * // Express middleware
 * app.use(integration.createRequestLoggingMiddleware());
 *
 * // Direct logging
 * await integration.logAuthentication({
 *   type: 'login_success',
 *   userId: 'user_123',
 *   method: 'password',
 *   req,
 * });
 * ```
 */
export class AuditIntegration {
  private auditService: AuditService;
  private rbacService?: RBACService;
  private logger: pino.Logger;
  private enabledCategories: Set<EventCategory>;

  constructor(config: AuditIntegrationConfig) {
    this.auditService = config.auditService;
    this.rbacService = config.rbacService;
    this.logger = config.logger || pino({ name: 'audit-integration' });
    this.enabledCategories = new Set(
      config.enabledCategories || Object.values(EventCategory)
    );
  }

  // ============================================================================
  // Authentication Event Logging
  // ============================================================================

  /**
   * Log authentication event
   */
  async logAuthentication(params: {
    type: 'login_success' | 'login_failure' | 'logout' | 'token_created' | 'token_revoked' | 'session_expired';
    userId?: string;
    sessionId?: string;
    method?: 'password' | 'api_key' | 'oauth' | 'magic_link';
    reason?: string;
    req?: Request;
  }): Promise<void> {
    if (!this.enabledCategories.has(EventCategory.AUTHENTICATION)) {
      return;
    }

    const eventTypeMap = {
      login_success: 'auth.login.success',
      login_failure: 'auth.login.failure',
      logout: 'auth.logout',
      token_created: 'auth.token.created',
      token_revoked: 'auth.token.revoked',
      session_expired: 'auth.session.expired',
    };

    const input: CreateAuditEventInput<any> = {
      event_type: eventTypeMap[params.type],
      category: EventCategory.AUTHENTICATION,
      severity: params.type === 'login_failure' ? EventSeverity.WARNING : EventSeverity.INFO,
      actor: {
        user_id: params.userId,
        session_id: params.sessionId,
      },
      subject: {
        resource_type: 'user',
        resource_id: params.userId,
      },
      outcome: params.type.includes('failure') ? EventOutcome.FAILURE : EventOutcome.SUCCESS,
      payload: {
        auth_method: params.method,
        reason: params.reason,
      },
    };

    await this.auditService.log(
      input,
      params.req ? { request: params.req } : undefined
    );
  }

  /**
   * Log API key usage
   */
  async logApiKeyUsage(params: {
    userId: string;
    apiKeyId: string;
    endpoint: string;
    method: string;
    req?: Request;
  }): Promise<void> {
    if (!this.enabledCategories.has(EventCategory.AUTHENTICATION)) {
      return;
    }

    await this.auditService.log(
      {
        event_type: 'auth.token.created',
        category: EventCategory.AUTHENTICATION,
        severity: EventSeverity.INFO,
        actor: {
          user_id: params.userId,
          api_client_id: params.apiKeyId,
        },
        subject: {
          resource_type: 'api_key',
          resource_id: params.apiKeyId,
        },
        outcome: EventOutcome.SUCCESS,
        payload: {
          endpoint: params.endpoint,
          http_method: params.method,
        },
      },
      params.req ? { request: params.req } : undefined
    );
  }

  // ============================================================================
  // Authorization Event Logging
  // ============================================================================

  /**
   * Log authorization event (permission check)
   */
  async logAuthorization(params: {
    type: 'permission_granted' | 'permission_denied' | 'access_denied';
    userId: string;
    organizationId?: string;
    permission?: OrganizationPermission;
    role?: OrganizationRole;
    resourceType?: string;
    resourceId?: string;
    reason?: string;
    req?: Request;
  }): Promise<void> {
    if (!this.enabledCategories.has(EventCategory.AUTHORIZATION)) {
      return;
    }

    const eventTypeMap = {
      permission_granted: 'authz.permission.granted',
      permission_denied: 'authz.permission.denied',
      access_denied: 'authz.access.denied',
    };

    await this.auditService.log(
      {
        event_type: eventTypeMap[params.type],
        category: EventCategory.AUTHORIZATION,
        severity: params.type === 'permission_granted' ? EventSeverity.INFO : EventSeverity.WARNING,
        actor: {
          user_id: params.userId,
        },
        subject: {
          resource_type: params.resourceType || 'unknown',
          resource_id: params.resourceId,
          organization_id: params.organizationId,
        },
        outcome: params.type === 'permission_granted' ? EventOutcome.SUCCESS : EventOutcome.FAILURE,
        payload: {
          permission: params.permission,
          role: params.role,
          reason: params.reason,
        },
      },
      params.req ? { request: params.req } : undefined
    );
  }

  /**
   * Log role assignment
   */
  async logRoleAssignment(params: {
    userId: string;
    targetUserId: string;
    organizationId: string;
    newRole: OrganizationRole;
    oldRole?: OrganizationRole;
    req?: Request;
  }): Promise<void> {
    if (!this.enabledCategories.has(EventCategory.AUTHORIZATION)) {
      return;
    }

    await this.auditService.log(
      {
        event_type: 'authz.role.assigned',
        category: EventCategory.AUTHORIZATION,
        severity: EventSeverity.INFO,
        actor: {
          user_id: params.userId,
        },
        subject: {
          resource_type: 'organization_member',
          resource_id: params.targetUserId,
          organization_id: params.organizationId,
        },
        outcome: EventOutcome.SUCCESS,
        payload: {
          new_role: params.newRole,
          old_role: params.oldRole,
        },
      },
      params.req ? { request: params.req } : undefined
    );
  }

  // ============================================================================
  // Organization Event Logging
  // ============================================================================

  /**
   * Log organization event
   */
  async logOrganization(params: {
    type: 'created' | 'updated' | 'deleted' | 'settings_changed' | 'subscription_changed';
    userId: string;
    organizationId: string;
    changes?: Record<string, any>;
    req?: Request;
  }): Promise<void> {
    if (!this.enabledCategories.has(EventCategory.ORGANIZATION)) {
      return;
    }

    const eventTypeMap = {
      created: 'org.created',
      updated: 'org.updated',
      deleted: 'org.deleted',
      settings_changed: 'org.settings.changed',
      subscription_changed: 'org.subscription.changed',
    };

    await this.auditService.log(
      {
        event_type: eventTypeMap[params.type],
        category: EventCategory.ORGANIZATION,
        severity: params.type === 'deleted' ? EventSeverity.WARNING : EventSeverity.INFO,
        actor: {
          user_id: params.userId,
        },
        subject: {
          resource_type: 'organization',
          resource_id: params.organizationId,
          organization_id: params.organizationId,
        },
        outcome: EventOutcome.SUCCESS,
        payload: {
          changes: params.changes,
        },
      },
      params.req ? { request: params.req } : undefined
    );
  }

  /**
   * Log member event
   */
  async logMember(params: {
    type: 'invited' | 'added' | 'removed' | 'role_changed' | 'permissions_changed';
    userId: string;
    targetUserId: string;
    organizationId: string;
    role?: OrganizationRole;
    permissions?: OrganizationPermission[];
    req?: Request;
  }): Promise<void> {
    if (!this.enabledCategories.has(EventCategory.MEMBER)) {
      return;
    }

    const eventTypeMap = {
      invited: 'member.invited',
      added: 'member.added',
      removed: 'member.removed',
      role_changed: 'member.role_changed',
      permissions_changed: 'member.permissions_changed',
    };

    await this.auditService.log(
      {
        event_type: eventTypeMap[params.type],
        category: EventCategory.MEMBER,
        severity: EventSeverity.INFO,
        actor: {
          user_id: params.userId,
        },
        subject: {
          resource_type: 'organization_member',
          resource_id: params.targetUserId,
          organization_id: params.organizationId,
        },
        outcome: EventOutcome.SUCCESS,
        payload: {
          role: params.role,
          permissions: params.permissions,
        },
      },
      params.req ? { request: params.req } : undefined
    );
  }

  // ============================================================================
  // Security Event Logging
  // ============================================================================

  /**
   * Log security event
   */
  async logSecurity(params: {
    type: 'suspicious_activity' | 'rate_limit' | 'ip_blocked' | 'brute_force' | 'unauthorized_access';
    userId?: string;
    severity?: EventSeverity;
    description: string;
    metadata?: Record<string, any>;
    req?: Request;
  }): Promise<void> {
    if (!this.enabledCategories.has(EventCategory.SECURITY)) {
      return;
    }

    const eventTypeMap = {
      suspicious_activity: 'security.suspicious_activity',
      rate_limit: 'security.rate_limit.exceeded',
      ip_blocked: 'security.ip.blocked',
      brute_force: 'security.brute_force.detected',
      unauthorized_access: 'security.unauthorized_access_attempted',
    };

    await this.auditService.log(
      {
        event_type: eventTypeMap[params.type],
        category: EventCategory.SECURITY,
        severity: params.severity || EventSeverity.CRITICAL,
        actor: {
          user_id: params.userId,
        },
        subject: {
          resource_type: 'system',
        },
        outcome: EventOutcome.FAILURE,
        payload: {
          description: params.description,
          ...params.metadata,
        },
      },
      params.req ? { request: params.req } : undefined
    );
  }

  // ============================================================================
  // Express Middleware
  // ============================================================================

  /**
   * Create Express middleware for automatic request logging
   *
   * Logs all HTTP requests with response status and duration.
   *
   * @example
   * ```typescript
   * app.use(integration.createRequestLoggingMiddleware());
   * ```
   */
  createRequestLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();

      // Intercept response to log after completion
      const originalSend = res.send;
      res.send = function (body: any): Response {
        const duration = Date.now() - startTime;

        // Log request (async, don't block response)
        void (async () => {
          try {
            const context = extractContextFromRequest(req);
            context.http_status = res.statusCode;

            await this.auditService.log(
              {
                event_type: 'system.http_request',
                category: EventCategory.SYSTEM,
                severity: res.statusCode >= 500 ? EventSeverity.ERROR : EventSeverity.INFO,
                actor: {
                  user_id: req.userId,
                  api_client_id: req.apiKeyId,
                },
                subject: {
                  resource_type: 'http_request',
                  organization_id: req.organizationId,
                },
                outcome: res.statusCode < 400 ? EventOutcome.SUCCESS : EventOutcome.FAILURE,
                payload: {
                  method: req.method,
                  path: req.path,
                  status: res.statusCode,
                  duration_ms: duration,
                },
                context,
              }
            );
          } catch (error) {
            this.logger.error(
              { error: error instanceof Error ? error.message : String(error) },
              'Failed to log HTTP request'
            );
          }
        })();

        return originalSend.call(this, body);
      }.bind(this);

      next();
    };
  }

  /**
   * Create Express middleware for authentication event logging
   *
   * Automatically logs login/logout events based on route patterns.
   *
   * @example
   * ```typescript
   * app.post('/auth/login', integration.createAuthLoggingMiddleware('login'));
   * app.post('/auth/logout', integration.createAuthLoggingMiddleware('logout'));
   * ```
   */
  createAuthLoggingMiddleware(type: 'login' | 'logout') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const originalSend = res.send;

      res.send = function (body: any): Response {
        // Log after response (async, don't block)
        void (async () => {
          try {
            const success = res.statusCode < 400;
            await this.logAuthentication({
              type: success ? (type === 'login' ? 'login_success' : 'logout') : 'login_failure',
              userId: req.userId || req.body?.email,
              method: req.body?.method || 'password',
              reason: success ? undefined : body?.error || body?.message,
              req,
            });
          } catch (error) {
            this.logger.error(
              { error: error instanceof Error ? error.message : String(error) },
              'Failed to log authentication event'
            );
          }
        })();

        return originalSend.call(this, body);
      }.bind(this);

      next();
    };
  }

  /**
   * Create Express middleware for RBAC audit integration
   *
   * Logs permission checks and authorization decisions.
   *
   * @example
   * ```typescript
   * app.use('/orgs/:orgId', integration.createRBACLoggingMiddleware());
   * ```
   */
  createRBACLoggingMiddleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Log permission checks from request context
      if (req.organizationPermissions && req.organizationId) {
        await this.logAuthorization({
          type: 'permission_granted',
          userId: req.userId!,
          organizationId: req.organizationId,
          role: req.organizationRole,
          req,
        });
      }

      next();
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Enable event category
   */
  enableCategory(category: EventCategory): void {
    this.enabledCategories.add(category);
  }

  /**
   * Disable event category
   */
  disableCategory(category: EventCategory): void {
    this.enabledCategories.delete(category);
  }

  /**
   * Check if category is enabled
   */
  isCategoryEnabled(category: EventCategory): boolean {
    return this.enabledCategories.has(category);
  }
}

/**
 * Create audit integration instance
 *
 * @param config - Integration configuration
 * @returns Audit integration instance
 */
export function createAuditIntegration(config: AuditIntegrationConfig): AuditIntegration {
  return new AuditIntegration(config);
}
