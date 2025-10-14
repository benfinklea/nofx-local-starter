/**
 * RBAC Service - Core Role-Based Access Control Logic
 *
 * Provides comprehensive organization-aware permission checking with
 * integration to the BackplaneStore for multi-tenancy support.
 *
 * Features:
 * - Organization-scoped permission checks
 * - Role hierarchy validation
 * - Custom permission overrides
 * - Caching for performance
 * - Detailed error messages
 *
 * @module rbac/RBACService
 */

import { BackplaneStore } from '../storage/backplane/store';
import type {
  OrganizationMember,
  OrganizationWithRole,
} from '../storage/backplane/types';
import {
  OrganizationRole,
  OrganizationPermission,
} from '../lib/organizations.types';
import {
  hasRequiredRole,
  hasPermission,
  getEffectivePermissions,
  validatePermission,
  validateRole,
  type PermissionCheckResult,
} from './permissions';
import { log } from '../lib/logger';

/**
 * Options for RBAC service initialization
 */
export interface RBACServiceOptions {
  /** BackplaneStore instance for organization data access */
  store: BackplaneStore;
  /** Enable permission result caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 60000 = 1 minute) */
  cacheTtl?: number;
}

/**
 * Cached permission result with expiration
 */
interface CachedPermissionResult {
  result: boolean;
  expiresAt: number;
}

/**
 * User's organization context with role and permissions
 */
export interface OrganizationContext {
  /** Organization ID */
  organizationId: string;
  /** User's role in the organization */
  role: OrganizationRole;
  /** User's effective permissions (role + custom) */
  permissions: readonly OrganizationPermission[];
  /** Organization member record */
  member: OrganizationMember;
}

/**
 * RBAC Service Class
 *
 * Core service for role-based access control with organization-aware
 * permission checking and caching.
 *
 * @example
 * ```typescript
 * const store = new BackplaneStore();
 * const rbac = new RBACService({ store });
 *
 * // Check permission
 * const canCreate = await rbac.checkPermission(
 *   'user_123',
 *   'org_abc',
 *   OrganizationPermission.PROJECTS_CREATE
 * );
 *
 * // Check role
 * const isAdmin = await rbac.checkRole(
 *   'user_123',
 *   'org_abc',
 *   OrganizationRole.ADMIN
 * );
 * ```
 */
export class RBACService {
  private readonly store: BackplaneStore;
  private readonly enableCache: boolean;
  private readonly cacheTtl: number;
  private readonly cache: Map<string, CachedPermissionResult>;

  /**
   * Create a new RBACService instance
   *
   * @param options - Service configuration options
   */
  constructor(options: RBACServiceOptions) {
    this.store = options.store;
    this.enableCache = options.enableCache ?? true;
    this.cacheTtl = options.cacheTtl ?? 60000; // 1 minute default
    this.cache = new Map();
  }

  /**
   * Check if a user has a specific permission in an organization
   *
   * Checks both role-based permissions and custom permission overrides.
   * Results are cached for performance.
   *
   * @param userId - User ID to check
   * @param organizationId - Organization ID
   * @param permission - Required permission
   * @returns true if user has the permission
   *
   * @example
   * ```typescript
   * const canWrite = await rbac.checkPermission(
   *   'user_123',
   *   'org_abc',
   *   OrganizationPermission.PROJECTS_WRITE
   * );
   * if (canWrite) {
   *   // Allow project creation
   * }
   * ```
   */
  async checkPermission(
    userId: string,
    organizationId: string,
    permission: OrganizationPermission
  ): Promise<boolean> {
    const cacheKey = `perm:${userId}:${organizationId}:${permission}`;

    // Check cache
    if (this.enableCache) {
      const cached = this.getCached(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    try {
      // Get organization context
      const context = await this.getOrganizationContext(userId, organizationId);
      if (!context) {
        this.setCached(cacheKey, false);
        return false;
      }

      // Check permission
      const result = hasPermission(context.permissions, permission);
      this.setCached(cacheKey, result);

      log.debug(
        {
          userId,
          organizationId,
          permission,
          role: context.role,
          granted: result,
        },
        'Permission check completed'
      );

      return result;
    } catch (error) {
      log.error({ error, userId, organizationId, permission }, 'Permission check failed');
      this.setCached(cacheKey, false);
      return false;
    }
  }

  /**
   * Check if a user has a minimum role level in an organization
   *
   * Uses role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
   *
   * @param userId - User ID to check
   * @param organizationId - Organization ID
   * @param minimumRole - Minimum required role
   * @returns true if user's role is equal to or higher than minimum
   *
   * @example
   * ```typescript
   * const isAdmin = await rbac.checkRole(
   *   'user_123',
   *   'org_abc',
   *   OrganizationRole.ADMIN
   * );
   * if (isAdmin) {
   *   // User is admin or owner
   * }
   * ```
   */
  async checkRole(
    userId: string,
    organizationId: string,
    minimumRole: OrganizationRole
  ): Promise<boolean> {
    const cacheKey = `role:${userId}:${organizationId}:${minimumRole}`;

    // Check cache
    if (this.enableCache) {
      const cached = this.getCached(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    try {
      // Get organization context
      const context = await this.getOrganizationContext(userId, organizationId);
      if (!context) {
        this.setCached(cacheKey, false);
        return false;
      }

      // Check role hierarchy
      const result = hasRequiredRole(context.role, minimumRole);
      this.setCached(cacheKey, result);

      log.debug(
        {
          userId,
          organizationId,
          userRole: context.role,
          minimumRole,
          granted: result,
        },
        'Role check completed'
      );

      return result;
    } catch (error) {
      log.error({ error, userId, organizationId, minimumRole }, 'Role check failed');
      this.setCached(cacheKey, false);
      return false;
    }
  }

  /**
   * Get all effective permissions for a user in an organization
   *
   * Returns the combined set of role-based and custom permissions.
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @returns Array of effective permissions, or empty array if not a member
   *
   * @example
   * ```typescript
   * const permissions = await rbac.getUserPermissions('user_123', 'org_abc');
   * console.log('User has permissions:', permissions);
   * ```
   */
  async getUserPermissions(
    userId: string,
    organizationId: string
  ): Promise<readonly OrganizationPermission[]> {
    try {
      const context = await this.getOrganizationContext(userId, organizationId);
      return context?.permissions ?? [];
    } catch (error) {
      log.error({ error, userId, organizationId }, 'Failed to get user permissions');
      return [];
    }
  }

  /**
   * Get a user's role in an organization
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @returns User's role, or null if not a member
   *
   * @example
   * ```typescript
   * const role = await rbac.getUserRole('user_123', 'org_abc');
   * if (role === OrganizationRole.OWNER) {
   *   // User owns the organization
   * }
   * ```
   */
  async getUserRole(
    userId: string,
    organizationId: string
  ): Promise<OrganizationRole | null> {
    try {
      const context = await this.getOrganizationContext(userId, organizationId);
      return context?.role ?? null;
    } catch (error) {
      log.error({ error, userId, organizationId }, 'Failed to get user role');
      return null;
    }
  }

  /**
   * Get all organizations a user has access to
   *
   * Returns organizations with the user's role in each.
   *
   * @param userId - User ID
   * @returns Array of organizations with user roles
   *
   * @example
   * ```typescript
   * const orgs = await rbac.getUserOrganizations('user_123');
   * orgs.forEach(org => {
   *   console.log(`${org.name}: ${org.user_role}`);
   * });
   * ```
   */
  async getUserOrganizations(userId: string): Promise<OrganizationWithRole[]> {
    try {
      return this.store.getUserOrganizations(userId);
    } catch (error) {
      log.error({ error, userId }, 'Failed to get user organizations');
      return [];
    }
  }

  /**
   * Check if a user is a member of an organization
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @returns true if user is a member
   *
   * @example
   * ```typescript
   * if (await rbac.isMember('user_123', 'org_abc')) {
   *   // User has access to organization
   * }
   * ```
   */
  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const cacheKey = `member:${userId}:${organizationId}`;

    // Check cache
    if (this.enableCache) {
      const cached = this.getCached(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    try {
      const context = await this.getOrganizationContext(userId, organizationId);
      const result = context !== null;
      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      log.error({ error, userId, organizationId }, 'Failed to check membership');
      this.setCached(cacheKey, false);
      return false;
    }
  }

  /**
   * Validate a permission check with detailed result
   *
   * Provides comprehensive information about why a permission check
   * succeeded or failed.
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param permission - Required permission
   * @returns Detailed permission check result
   *
   * @example
   * ```typescript
   * const result = await rbac.validatePermission(
   *   'user_123',
   *   'org_abc',
   *   OrganizationPermission.MEMBERS_DELETE
   * );
   * if (!result.granted) {
   *   return res.status(403).json({ error: result.reason });
   * }
   * ```
   */
  async validatePermissionCheck(
    userId: string,
    organizationId: string,
    permission: OrganizationPermission
  ): Promise<PermissionCheckResult> {
    try {
      const context = await this.getOrganizationContext(userId, organizationId);
      if (!context) {
        return {
          granted: false,
          reason: `User ${userId} is not a member of organization ${organizationId}`,
        };
      }

      return validatePermission(context.role, permission, context.member.permissions);
    } catch (error) {
      log.error({ error, userId, organizationId, permission }, 'Permission validation failed');
      return {
        granted: false,
        reason: 'Permission validation error occurred',
      };
    }
  }

  /**
   * Validate a role check with detailed result
   *
   * Provides comprehensive information about why a role check
   * succeeded or failed.
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param minimumRole - Minimum required role
   * @returns Detailed permission check result
   *
   * @example
   * ```typescript
   * const result = await rbac.validateRoleCheck(
   *   'user_123',
   *   'org_abc',
   *   OrganizationRole.ADMIN
   * );
   * if (!result.granted) {
   *   return res.status(403).json({ error: result.reason });
   * }
   * ```
   */
  async validateRoleCheck(
    userId: string,
    organizationId: string,
    minimumRole: OrganizationRole
  ): Promise<PermissionCheckResult> {
    try {
      const context = await this.getOrganizationContext(userId, organizationId);
      if (!context) {
        return {
          granted: false,
          reason: `User ${userId} is not a member of organization ${organizationId}`,
        };
      }

      return validateRole(context.role, minimumRole);
    } catch (error) {
      log.error({ error, userId, organizationId, minimumRole }, 'Role validation failed');
      return {
        granted: false,
        reason: 'Role validation error occurred',
      };
    }
  }

  /**
   * Clear all cached permission results
   *
   * Use this when organization membership or permissions change.
   *
   * @example
   * ```typescript
   * // After updating user role
   * rbac.clearCache();
   * ```
   */
  clearCache(): void {
    this.cache.clear();
    log.debug('RBAC cache cleared');
  }

  /**
   * Clear cached results for a specific user
   *
   * @param userId - User ID to clear cache for
   *
   * @example
   * ```typescript
   * // After user role changes
   * rbac.clearUserCache('user_123');
   * ```
   */
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_value, key) => {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
    log.debug({ userId }, 'User RBAC cache cleared');
  }

  /**
   * Clear cached results for a specific organization
   *
   * @param organizationId - Organization ID to clear cache for
   *
   * @example
   * ```typescript
   * // After organization permissions change
   * rbac.clearOrganizationCache('org_abc');
   * ```
   */
  clearOrganizationCache(organizationId: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_value, key) => {
      if (key.includes(organizationId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
    log.debug({ organizationId }, 'Organization RBAC cache cleared');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get organization context for a user
   *
   * Retrieves the user's membership, role, and effective permissions
   * for an organization.
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @returns Organization context or null if not a member
   */
  private async getOrganizationContext(
    userId: string,
    organizationId: string
  ): Promise<OrganizationContext | null> {
    try {
      // Get all user organizations
      const userOrgs = this.store.getUserOrganizations(userId);
      const org = userOrgs.find((o) => o.id === organizationId);

      if (!org) {
        return null;
      }

      // Get member record for permissions
      const members = this.store.getOrganizationMembers(organizationId);
      const member = members.find((m) => m.user_id === userId);

      if (!member) {
        return null;
      }

      // Calculate effective permissions
      const permissions = getEffectivePermissions(member.role, member.permissions);

      return {
        organizationId,
        role: member.role,
        permissions,
        member,
      };
    } catch (error) {
      log.error({ error, userId, organizationId }, 'Failed to get organization context');
      return null;
    }
  }

  /**
   * Get cached permission result
   *
   * @param key - Cache key
   * @returns Cached result or null if expired/not found
   */
  private getCached(key: string): boolean | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check expiration
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached permission result
   *
   * @param key - Cache key
   * @param result - Result to cache
   */
  private setCached(key: string, result: boolean): void {
    if (!this.enableCache) {
      return;
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.cacheTtl,
    });
  }
}
