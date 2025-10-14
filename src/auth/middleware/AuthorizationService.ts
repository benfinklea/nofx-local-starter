/**
 * Authorization Service - extracted from middleware.ts
 * Handles role checks, admin checks, team access, and organization RBAC
 */

import { Request, Response, NextFunction } from 'express';
import { hasActiveSubscription } from '../supabase';
import { log } from '../../lib/logger';
import type { RBACService } from '../../rbac/RBACService';
import { OrganizationRole, OrganizationPermission } from '../../lib/organizations.types';

/**
 * Authorization service options
 */
export interface AuthorizationServiceOptions {
  /** Optional RBAC service for organization-aware authorization */
  rbacService?: RBACService;
}

export class AuthorizationService {
  private rbacService?: RBACService;

  /**
   * Create a new AuthorizationService instance
   *
   * @param options - Service configuration options
   */
  constructor(options?: AuthorizationServiceOptions) {
    this.rbacService = options?.rbacService;
  }
  /**
   * Require active subscription
   */
  async requireSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasSubscription = await hasActiveSubscription(req.userId);
    if (!hasSubscription) {
      res.status(403).json({
        error: 'Subscription required',
        message: 'Please upgrade to a paid plan to access this feature',
        upgradeUrl: '/billing/upgrade'
      });
      return;
    }

    next();
  }

  /**
   * Require admin role
   */
  async requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const isAdmin = await this.checkAdminRole(req.user.id);
      if (!isAdmin) {
        res.status(403).json({
          error: 'Admin access required',
          message: 'This action requires administrator privileges'
        });
        return;
      }

      next();
    } catch (error) {
      log.error({ error }, 'Error checking admin status');
      res.status(500).json({ error: 'Authorization check failed' });
      return;
    }
  }

  /**
   * Require team access with optional role requirements
   */
  requireTeamAccess(requiredRole?: 'owner' | 'admin' | 'member' | 'viewer') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const teamId = req.params.teamId || req.body.teamId;
      if (!teamId) {
        res.status(400).json({ error: 'Team ID required' });
        return;
      }

      try {
        const memberRole = await this.getTeamMemberRole(req.userId, teamId);
        if (!memberRole) {
          res.status(403).json({
            error: 'Access denied',
            message: 'You are not a member of this team'
          });
          return;
        }

        // Check role hierarchy if required role specified
        if (requiredRole && !this.hasRequiredTeamRole(memberRole, requiredRole)) {
          res.status(403).json({
            error: 'Insufficient permissions',
            message: `This action requires ${requiredRole} role or higher`
          });
          return;
        }

        // Add team info to request
        req.teamRole = memberRole;
        req.teamId = teamId;

        next();
      } catch (error) {
        log.error({ error }, 'Error checking team access');
        res.status(500).json({ error: 'Authorization check failed' });
        return;
      }
    };
  }

  /**
   * Check if user has admin role
   */
  private async checkAdminRole(userId: string): Promise<boolean> {
    const { createServiceClient } = require('../supabase');
    const supabase = createServiceClient();

    if (!supabase) {
      throw new Error('Service unavailable');
    }

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    return !error && data && data.role === 'admin';
  }

  /**
   * Get team member role
   */
  private async getTeamMemberRole(userId: string, teamId: string): Promise<string | null> {
    const { createServiceClient } = require('../supabase');
    const supabase = createServiceClient();

    if (!supabase) {
      throw new Error('Service unavailable');
    }

    const { data: member, error } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    return error || !member ? null : member.role;
  }

  /**
   * Check if user has required team role
   */
  private hasRequiredTeamRole(userRole: string, requiredRole: string): boolean {
    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1
    };

    const userRoleLevel = roleHierarchy[userRole] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }

  /**
   * Check if user is admin for ownership validation
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      return await this.checkAdminRole(userId);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Organization RBAC Methods
  // ============================================================================

  /**
   * Require organization membership
   *
   * Checks if the user is a member of the specified organization.
   * Adds organization context to the request.
   *
   * @param options - Configuration options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.get('/orgs/:orgId',
   *   authService.requireOrganizationMembership(),
   *   getOrganization
   * );
   * ```
   */
  requireOrganizationMembership(options?: {
    orgIdParam?: string;
    errorMessage?: string;
  }) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!this.rbacService) {
        log.warn('RBAC service not configured, skipping organization membership check');
        next();
        return;
      }

      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const orgIdParam = options?.orgIdParam ?? 'orgId';
      const organizationId = req.params[orgIdParam] || req.body.organizationId;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID required' });
        return;
      }

      try {
        const isMember = await this.rbacService.isMember(req.userId, organizationId);
        if (!isMember) {
          res.status(403).json({
            error: options?.errorMessage ?? 'Not a member of this organization',
            message: `You do not have access to organization ${organizationId}`,
          });
          return;
        }

        // Add organization context
        const role = await this.rbacService.getUserRole(req.userId, organizationId);
        const permissions = await this.rbacService.getUserPermissions(req.userId, organizationId);

        req.organizationId = organizationId;
        req.organizationRole = role ?? undefined;
        req.organizationPermissions = permissions;

        next();
      } catch (error) {
        log.error({ error, userId: req.userId, organizationId }, 'Organization membership check failed');
        res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  }

  /**
   * Require specific organization permission
   *
   * Checks if the user has the required permission in the organization.
   *
   * @param permission - Required permission
   * @param options - Configuration options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.post('/orgs/:orgId/projects',
   *   authService.requireOrganizationPermission(OrganizationPermission.PROJECTS_WRITE),
   *   createProject
   * );
   * ```
   */
  requireOrganizationPermission(
    permission: OrganizationPermission,
    options?: {
      orgIdParam?: string;
      errorMessage?: string;
    }
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!this.rbacService) {
        log.warn('RBAC service not configured, skipping permission check');
        next();
        return;
      }

      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const orgIdParam = options?.orgIdParam ?? 'orgId';
      const organizationId = req.params[orgIdParam] || req.body.organizationId;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID required' });
        return;
      }

      try {
        const hasPermission = await this.rbacService.checkPermission(
          req.userId,
          organizationId,
          permission
        );

        if (!hasPermission) {
          const validation = await this.rbacService.validatePermissionCheck(
            req.userId,
            organizationId,
            permission
          );

          res.status(403).json({
            error: options?.errorMessage ?? 'Insufficient permissions',
            message: validation.reason ?? `Required permission: ${permission}`,
            requiredPermission: permission,
          });
          return;
        }

        // Add organization context
        const role = await this.rbacService.getUserRole(req.userId, organizationId);
        const permissions = await this.rbacService.getUserPermissions(req.userId, organizationId);

        req.organizationId = organizationId;
        req.organizationRole = role ?? undefined;
        req.organizationPermissions = permissions;

        next();
      } catch (error) {
        log.error({ error, userId: req.userId, organizationId, permission }, 'Permission check failed');
        res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  }

  /**
   * Require minimum organization role
   *
   * Checks if the user has at least the specified role level.
   *
   * @param minimumRole - Minimum required role
   * @param options - Configuration options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.delete('/orgs/:orgId',
   *   authService.requireOrganizationRole(OrganizationRole.ADMIN),
   *   deleteOrganization
   * );
   * ```
   */
  requireOrganizationRole(
    minimumRole: OrganizationRole,
    options?: {
      orgIdParam?: string;
      errorMessage?: string;
    }
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!this.rbacService) {
        log.warn('RBAC service not configured, skipping role check');
        next();
        return;
      }

      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const orgIdParam = options?.orgIdParam ?? 'orgId';
      const organizationId = req.params[orgIdParam] || req.body.organizationId;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID required' });
        return;
      }

      try {
        const hasRole = await this.rbacService.checkRole(
          req.userId,
          organizationId,
          minimumRole
        );

        if (!hasRole) {
          const validation = await this.rbacService.validateRoleCheck(
            req.userId,
            organizationId,
            minimumRole
          );

          res.status(403).json({
            error: options?.errorMessage ?? 'Insufficient role level',
            message: validation.reason ?? `Required role: ${minimumRole}`,
            requiredRole: minimumRole,
          });
          return;
        }

        // Add organization context
        const role = await this.rbacService.getUserRole(req.userId, organizationId);
        const permissions = await this.rbacService.getUserPermissions(req.userId, organizationId);

        req.organizationId = organizationId;
        req.organizationRole = role ?? undefined;
        req.organizationPermissions = permissions;

        next();
      } catch (error) {
        log.error({ error, userId: req.userId, organizationId, minimumRole }, 'Role check failed');
        res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  }

  /**
   * Check if user has permission in organization (async utility)
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param permission - Permission to check
   * @returns true if user has permission
   */
  async hasOrganizationPermission(
    userId: string,
    organizationId: string,
    permission: OrganizationPermission
  ): Promise<boolean> {
    if (!this.rbacService) {
      log.warn('RBAC service not configured');
      return false;
    }

    try {
      return await this.rbacService.checkPermission(userId, organizationId, permission);
    } catch (error) {
      log.error({ error, userId, organizationId, permission }, 'Permission check error');
      return false;
    }
  }

  /**
   * Check if user has role in organization (async utility)
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param minimumRole - Minimum role to check
   * @returns true if user has sufficient role
   */
  async hasOrganizationRole(
    userId: string,
    organizationId: string,
    minimumRole: OrganizationRole
  ): Promise<boolean> {
    if (!this.rbacService) {
      log.warn('RBAC service not configured');
      return false;
    }

    try {
      return await this.rbacService.checkRole(userId, organizationId, minimumRole);
    } catch (error) {
      log.error({ error, userId, organizationId, minimumRole }, 'Role check error');
      return false;
    }
  }
}
