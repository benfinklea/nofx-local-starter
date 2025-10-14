/**
 * RBAC Express Middleware
 *
 * Express middleware functions for route-level permission and role checking.
 * Integrates with the authentication system and provides comprehensive
 * access control for organization-scoped resources.
 *
 * @module rbac/middleware
 */

/* eslint-disable no-console -- console.log references are only in JSDoc example comments */

import type { Request, Response, NextFunction } from 'express';
import { RBACService } from './RBACService';
import { OrganizationRole, OrganizationPermission } from '../lib/organizations.types';
import { log } from '../lib/logger';

/**
 * RBAC middleware configuration options
 */
export interface RBACMiddlewareOptions {
  /** RBAC service instance */
  rbacService: RBACService;
  /** Custom error messages (optional) */
  errorMessages?: {
    unauthenticated?: string;
    notMember?: string;
    insufficientPermission?: string;
    insufficientRole?: string;
  };
}

/**
 * Default error messages
 */
const DEFAULT_ERROR_MESSAGES = {
  unauthenticated: 'Authentication required',
  notMember: 'Access denied: not a member of this organization',
  insufficientPermission: 'Insufficient permissions for this action',
  insufficientRole: 'Insufficient role level for this action',
};

/**
 * RBAC Middleware Factory
 *
 * Creates middleware functions with access to the RBAC service.
 *
 * @example
 * ```typescript
 * const store = new BackplaneStore();
 * const rbac = new RBACService({ store });
 * const middleware = createRBACMiddleware({ rbacService: rbac });
 *
 * app.post('/projects',
 *   middleware.requirePermission(OrganizationPermission.PROJECTS_WRITE),
 *   createProject
 * );
 * ```
 */
export function createRBACMiddleware(options: RBACMiddlewareOptions) {
  const { rbacService } = options;
  const errorMessages = { ...DEFAULT_ERROR_MESSAGES, ...options.errorMessages };

  /**
   * Require specific permission in an organization
   *
   * Checks if the authenticated user has the required permission in the
   * organization specified by req.params.orgId or req.body.organizationId.
   *
   * @param permission - Required permission
   * @param options - Additional options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.post('/api/orgs/:orgId/projects',
   *   requirePermission(OrganizationPermission.PROJECTS_WRITE),
   *   createProject
   * );
   * ```
   */
  function requirePermission(
    permission: OrganizationPermission,
    opts?: {
      /** Custom error message */
      errorMessage?: string;
      /** Organization ID parameter name (default: orgId) */
      orgIdParam?: string;
    }
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check authentication
        if (!req.userId) {
          res.status(401).json({
            error: errorMessages.unauthenticated,
            message: 'Please authenticate to access this resource',
          });
          return;
        }

        // Extract organization ID from params or body
        const orgIdParam = opts?.orgIdParam ?? 'orgId';
        const organizationId =
          req.params[orgIdParam] ||
          req.body.organizationId ||
          req.body.organization_id ||
          req.query.organizationId ||
          req.query.organization_id;

        if (!organizationId || typeof organizationId !== 'string') {
          res.status(400).json({
            error: 'Organization ID required',
            message: `Please provide organization ID in request`,
          });
          return;
        }

        // Check membership
        const isMember = await rbacService.isMember(req.userId, organizationId);
        if (!isMember) {
          res.status(403).json({
            error: errorMessages.notMember,
            message: `You are not a member of organization ${organizationId}`,
          });
          return;
        }

        // Check permission
        const hasPermission = await rbacService.checkPermission(
          req.userId,
          organizationId,
          permission
        );

        if (!hasPermission) {
          // Get detailed validation result for better error message
          const validation = await rbacService.validatePermissionCheck(
            req.userId,
            organizationId,
            permission
          );

          res.status(403).json({
            error: opts?.errorMessage ?? errorMessages.insufficientPermission,
            message: validation.reason ?? `Required permission: ${permission}`,
            requiredPermission: permission,
          });
          return;
        }

        // Add organization context to request
        const role = await rbacService.getUserRole(req.userId, organizationId);
        const permissions = await rbacService.getUserPermissions(req.userId, organizationId);

        req.organizationId = organizationId;
        req.organizationRole = role ?? undefined;
        req.organizationPermissions = permissions;

        log.debug(
          {
            userId: req.userId,
            organizationId,
            permission,
            role,
          },
          'Permission check passed'
        );

        next();
      } catch (error) {
        log.error({ error, permission, userId: req.userId }, 'Permission check error');
        res.status(500).json({
          error: 'Authorization check failed',
          message: 'An error occurred while checking permissions',
        });
      }
    };
  }

  /**
   * Require minimum role level in an organization
   *
   * Checks if the authenticated user has at least the specified role level.
   * Uses role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
   *
   * @param minimumRole - Minimum required role
   * @param options - Additional options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.delete('/api/orgs/:orgId',
   *   requireRole(OrganizationRole.ADMIN),
   *   deleteOrganization
   * );
   * ```
   */
  function requireRole(
    minimumRole: OrganizationRole,
    opts?: {
      /** Custom error message */
      errorMessage?: string;
      /** Organization ID parameter name (default: orgId) */
      orgIdParam?: string;
    }
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check authentication
        if (!req.userId) {
          res.status(401).json({
            error: errorMessages.unauthenticated,
            message: 'Please authenticate to access this resource',
          });
          return;
        }

        // Extract organization ID
        const orgIdParam = opts?.orgIdParam ?? 'orgId';
        const organizationId =
          req.params[orgIdParam] ||
          req.body.organizationId ||
          req.body.organization_id ||
          req.query.organizationId ||
          req.query.organization_id;

        if (!organizationId || typeof organizationId !== 'string') {
          res.status(400).json({
            error: 'Organization ID required',
            message: 'Please provide organization ID in request',
          });
          return;
        }

        // Check membership
        const isMember = await rbacService.isMember(req.userId, organizationId);
        if (!isMember) {
          res.status(403).json({
            error: errorMessages.notMember,
            message: `You are not a member of organization ${organizationId}`,
          });
          return;
        }

        // Check role
        const hasRole = await rbacService.checkRole(req.userId, organizationId, minimumRole);

        if (!hasRole) {
          // Get detailed validation result for better error message
          const validation = await rbacService.validateRoleCheck(
            req.userId,
            organizationId,
            minimumRole
          );

          res.status(403).json({
            error: opts?.errorMessage ?? errorMessages.insufficientRole,
            message: validation.reason ?? `Required role: ${minimumRole}`,
            requiredRole: minimumRole,
          });
          return;
        }

        // Add organization context to request
        const role = await rbacService.getUserRole(req.userId, organizationId);
        const permissions = await rbacService.getUserPermissions(req.userId, organizationId);

        req.organizationId = organizationId;
        req.organizationRole = role ?? undefined;
        req.organizationPermissions = permissions;

        log.debug(
          {
            userId: req.userId,
            organizationId,
            minimumRole,
            userRole: role,
          },
          'Role check passed'
        );

        next();
      } catch (error) {
        log.error({ error, minimumRole, userId: req.userId }, 'Role check error');
        res.status(500).json({
          error: 'Authorization check failed',
          message: 'An error occurred while checking role',
        });
      }
    };
  }

  /**
   * Require organization access (membership check only)
   *
   * Verifies the user is a member of the organization without checking
   * specific permissions or roles. Useful for read-only endpoints or when
   * fine-grained checks happen in the handler.
   *
   * @param options - Additional options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.get('/api/orgs/:orgId',
   *   requireOrganizationAccess(),
   *   getOrganization
   * );
   * ```
   */
  function requireOrganizationAccess(opts?: {
    /** Custom error message */
    errorMessage?: string;
    /** Organization ID parameter name (default: orgId) */
    orgIdParam?: string;
    /** Add organization context to request (default: true) */
    addContext?: boolean;
  }) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check authentication
        if (!req.userId) {
          res.status(401).json({
            error: errorMessages.unauthenticated,
            message: 'Please authenticate to access this resource',
          });
          return;
        }

        // Extract organization ID
        const orgIdParam = opts?.orgIdParam ?? 'orgId';
        const organizationId =
          req.params[orgIdParam] ||
          req.body.organizationId ||
          req.body.organization_id ||
          req.query.organizationId ||
          req.query.organization_id;

        if (!organizationId || typeof organizationId !== 'string') {
          res.status(400).json({
            error: 'Organization ID required',
            message: 'Please provide organization ID in request',
          });
          return;
        }

        // Check membership
        const isMember = await rbacService.isMember(req.userId, organizationId);
        if (!isMember) {
          res.status(403).json({
            error: opts?.errorMessage ?? errorMessages.notMember,
            message: `You are not a member of organization ${organizationId}`,
          });
          return;
        }

        // Add organization context if requested
        if (opts?.addContext !== false) {
          const role = await rbacService.getUserRole(req.userId, organizationId);
          const permissions = await rbacService.getUserPermissions(req.userId, organizationId);

          req.organizationId = organizationId;
          req.organizationRole = role ?? undefined;
          req.organizationPermissions = permissions;
        } else {
          req.organizationId = organizationId;
        }

        log.debug(
          {
            userId: req.userId,
            organizationId,
          },
          'Organization access granted'
        );

        next();
      } catch (error) {
        log.error({ error, userId: req.userId }, 'Organization access check error');
        res.status(500).json({
          error: 'Authorization check failed',
          message: 'An error occurred while checking organization access',
        });
      }
    };
  }

  /**
   * Optional organization access (soft check)
   *
   * Adds organization context to request if user is authenticated and a member,
   * but does not block the request if they're not. Useful for endpoints that
   * behave differently based on organization membership.
   *
   * @param options - Additional options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.get('/api/projects',
   *   optionalOrganizationAccess(),
   *   listProjects // Shows only org projects if member
   * );
   * ```
   */
  function optionalOrganizationAccess(opts?: {
    /** Organization ID parameter name (default: orgId) */
    orgIdParam?: string;
  }) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Skip if not authenticated
        if (!req.userId) {
          return next();
        }

        // Extract organization ID
        const orgIdParam = opts?.orgIdParam ?? 'orgId';
        const organizationId =
          req.params[orgIdParam] ||
          req.body.organizationId ||
          req.body.organization_id ||
          req.query.organizationId ||
          req.query.organization_id;

        // Skip if no organization ID provided
        if (!organizationId || typeof organizationId !== 'string') {
          return next();
        }

        // Check membership
        const isMember = await rbacService.isMember(req.userId, organizationId);
        if (!isMember) {
          return next();
        }

        // Add organization context
        const role = await rbacService.getUserRole(req.userId, organizationId);
        const permissions = await rbacService.getUserPermissions(req.userId, organizationId);

        req.organizationId = organizationId;
        req.organizationRole = role ?? undefined;
        req.organizationPermissions = permissions;

        log.debug(
          {
            userId: req.userId,
            organizationId,
            role,
          },
          'Optional organization context added'
        );

        next();
      } catch (error) {
        log.error({ error, userId: req.userId }, 'Optional organization access error');
        // Don't fail the request, just continue without context
        next();
      }
    };
  }

  return {
    requirePermission,
    requireRole,
    requireOrganizationAccess,
    optionalOrganizationAccess,
  };
}

/**
 * Convenience function to check permission in handler
 *
 * Use this for dynamic permission checks within route handlers.
 *
 * @param req - Express request
 * @param permission - Required permission
 * @returns true if user has permission in current organization context
 *
 * @example
 * ```typescript
 * async function updateProject(req: Request, res: Response) {
 *   if (!hasPermissionInContext(req, OrganizationPermission.PROJECTS_WRITE)) {
 *     return res.status(403).json({ error: 'Forbidden' });
 *   }
 *   // ... update logic
 * }
 * ```
 */
export function hasPermissionInContext(
  req: Request,
  permission: OrganizationPermission
): boolean {
  if (!req.organizationPermissions) {
    return false;
  }
  return req.organizationPermissions.includes(permission);
}

/**
 * Convenience function to check role in handler
 *
 * Use this for dynamic role checks within route handlers.
 *
 * @param req - Express request
 * @param minimumRole - Minimum required role
 * @returns true if user's role meets minimum
 *
 * @example
 * ```typescript
 * async function deleteOrganization(req: Request, res: Response) {
 *   if (!hasRoleInContext(req, OrganizationRole.OWNER)) {
 *     return res.status(403).json({ error: 'Only owners can delete organizations' });
 *   }
 *   // ... delete logic
 * }
 * ```
 */
export function hasRoleInContext(req: Request, minimumRole: OrganizationRole): boolean {
  if (!req.organizationRole) {
    return false;
  }

  const roleHierarchy: Record<OrganizationRole, number> = {
    [OrganizationRole.OWNER]: 4,
    [OrganizationRole.ADMIN]: 3,
    [OrganizationRole.MEMBER]: 2,
    [OrganizationRole.VIEWER]: 1,
  };

  const userLevel = roleHierarchy[req.organizationRole] ?? 0;
  const requiredLevel = roleHierarchy[minimumRole] ?? 0;

  return userLevel >= requiredLevel;
}
