/**
 * RBAC Permission Validation and Role Hierarchy
 *
 * Provides type-safe permission checking, role hierarchy validation,
 * and permission inheritance logic for the NOFX Control Plane RBAC system.
 *
 * @module rbac/permissions
 */

import {
  OrganizationRole,
  OrganizationPermission,
  hasMinimumRole,
  getDefaultPermissions,
} from '../lib/organizations.types';

/**
 * Permission check result with detailed information
 *
 * Used to provide comprehensive feedback about permission checks,
 * including why a check succeeded or failed.
 *
 * @example
 * ```typescript
 * const result = checkUserPermission(user, 'projects:create');
 * if (!result.granted) {
 *   console.error(result.reason);
 * }
 * ```
 */
export interface PermissionCheckResult {
  /** Whether the permission is granted */
  granted: boolean;
  /** The reason for the decision */
  reason?: string;
  /** The effective permissions that led to the decision */
  effectivePermissions?: readonly OrganizationPermission[];
}

/**
 * Role hierarchy level mapping
 *
 * Higher numbers indicate higher privilege levels.
 * Used for fast role comparison operations.
 */
const ROLE_HIERARCHY: Readonly<Record<OrganizationRole, number>> = {
  [OrganizationRole.OWNER]: 4,
  [OrganizationRole.ADMIN]: 3,
  [OrganizationRole.MEMBER]: 2,
  [OrganizationRole.VIEWER]: 1,
} as const;

/**
 * Check if a user's role meets the minimum required role level
 *
 * Uses the role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
 *
 * @param userRole - The user's current role
 * @param minimumRole - The minimum required role
 * @returns true if user's role is equal to or higher than the minimum
 *
 * @example
 * ```typescript
 * if (hasRequiredRole(OrganizationRole.ADMIN, OrganizationRole.MEMBER)) {
 *   // Admin can perform member-level actions
 *   performMemberAction();
 * }
 * ```
 */
export function hasRequiredRole(
  userRole: OrganizationRole,
  minimumRole: OrganizationRole
): boolean {
  return hasMinimumRole(userRole, minimumRole);
}

/**
 * Get the numeric level for a role
 *
 * @param role - The organization role
 * @returns Numeric level (1-4, higher is more privileged)
 *
 * @example
 * ```typescript
 * const level = getRoleLevel(OrganizationRole.ADMIN); // Returns 3
 * ```
 */
export function getRoleLevel(role: OrganizationRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

/**
 * Check if a set of permissions includes a specific permission
 *
 * Performs a simple includes check with type safety.
 *
 * @param permissions - Array of permissions to check
 * @param requiredPermission - The permission to look for
 * @returns true if the permission is present
 *
 * @example
 * ```typescript
 * const perms = [OrganizationPermission.PROJECTS_READ, OrganizationPermission.PROJECTS_WRITE];
 * if (hasPermission(perms, OrganizationPermission.PROJECTS_WRITE)) {
 *   // User can write projects
 * }
 * ```
 */
export function hasPermission(
  permissions: readonly OrganizationPermission[],
  requiredPermission: OrganizationPermission
): boolean {
  return permissions.includes(requiredPermission);
}

/**
 * Check if a set of permissions includes all required permissions
 *
 * All permissions in the required array must be present.
 *
 * @param permissions - Array of permissions to check
 * @param requiredPermissions - Array of required permissions
 * @returns true if all required permissions are present
 *
 * @example
 * ```typescript
 * const userPerms = [
 *   OrganizationPermission.PROJECTS_READ,
 *   OrganizationPermission.PROJECTS_WRITE,
 *   OrganizationPermission.RUNS_READ
 * ];
 * const required = [
 *   OrganizationPermission.PROJECTS_READ,
 *   OrganizationPermission.RUNS_READ
 * ];
 * if (hasAllPermissions(userPerms, required)) {
 *   // User has all required permissions
 * }
 * ```
 */
export function hasAllPermissions(
  permissions: readonly OrganizationPermission[],
  requiredPermissions: readonly OrganizationPermission[]
): boolean {
  return requiredPermissions.every((perm) => permissions.includes(perm));
}

/**
 * Check if a set of permissions includes any of the required permissions
 *
 * At least one permission from the required array must be present.
 *
 * @param permissions - Array of permissions to check
 * @param requiredPermissions - Array of required permissions (any will suffice)
 * @returns true if any required permission is present
 *
 * @example
 * ```typescript
 * const userPerms = [OrganizationPermission.PROJECTS_READ];
 * const required = [
 *   OrganizationPermission.PROJECTS_WRITE,
 *   OrganizationPermission.PROJECTS_DELETE
 * ];
 * if (hasAnyPermission(userPerms, required)) {
 *   // User has at least one of the required permissions
 * }
 * ```
 */
export function hasAnyPermission(
  permissions: readonly OrganizationPermission[],
  requiredPermissions: readonly OrganizationPermission[]
): boolean {
  return requiredPermissions.some((perm) => permissions.includes(perm));
}

/**
 * Get effective permissions for a role with optional overrides
 *
 * Combines role-based permissions with custom permission overrides.
 * Custom permissions are additive - they extend the base role permissions.
 *
 * @param role - The user's organization role
 * @param customPermissions - Optional custom permissions to add
 * @returns Array of effective permissions
 *
 * @example
 * ```typescript
 * // Member role with additional admin permission
 * const perms = getEffectivePermissions(
 *   OrganizationRole.MEMBER,
 *   [OrganizationPermission.MEMBERS_WRITE]
 * );
 * // Returns: member permissions + MEMBERS_WRITE
 * ```
 */
export function getEffectivePermissions(
  role: OrganizationRole,
  customPermissions?: readonly OrganizationPermission[]
): readonly OrganizationPermission[] {
  const basePermissions = getDefaultPermissions(role);

  // If no custom permissions, return base permissions
  if (!customPermissions || customPermissions.length === 0) {
    return basePermissions;
  }

  // Merge and deduplicate permissions
  const allPermissions = new Set([...basePermissions, ...customPermissions]);
  return Array.from(allPermissions);
}

/**
 * Validate a permission check with detailed result
 *
 * Performs a comprehensive permission check and returns detailed information
 * about the decision, including the reason and effective permissions.
 *
 * @param role - The user's organization role
 * @param requiredPermission - The permission to check
 * @param customPermissions - Optional custom permissions
 * @returns Detailed permission check result
 *
 * @example
 * ```typescript
 * const result = validatePermission(
 *   OrganizationRole.MEMBER,
 *   OrganizationPermission.MEMBERS_DELETE
 * );
 * if (!result.granted) {
 *   return res.status(403).json({ error: result.reason });
 * }
 * ```
 */
export function validatePermission(
  role: OrganizationRole,
  requiredPermission: OrganizationPermission,
  customPermissions?: readonly OrganizationPermission[]
): PermissionCheckResult {
  const effectivePermissions = getEffectivePermissions(role, customPermissions);
  const granted = hasPermission(effectivePermissions, requiredPermission);

  if (granted) {
    return {
      granted: true,
      effectivePermissions,
    };
  }

  return {
    granted: false,
    reason: `Permission denied: ${requiredPermission} is not granted to role ${role}`,
    effectivePermissions,
  };
}

/**
 * Validate role hierarchy check with detailed result
 *
 * Checks if a user's role meets the minimum required level and provides
 * detailed information about the decision.
 *
 * @param userRole - The user's current role
 * @param minimumRole - The minimum required role
 * @returns Detailed permission check result
 *
 * @example
 * ```typescript
 * const result = validateRole(
 *   OrganizationRole.MEMBER,
 *   OrganizationRole.ADMIN
 * );
 * if (!result.granted) {
 *   return res.status(403).json({ error: result.reason });
 * }
 * ```
 */
export function validateRole(
  userRole: OrganizationRole,
  minimumRole: OrganizationRole
): PermissionCheckResult {
  const granted = hasRequiredRole(userRole, minimumRole);
  const userLevel = getRoleLevel(userRole);
  const requiredLevel = getRoleLevel(minimumRole);

  if (granted) {
    return {
      granted: true,
    };
  }

  return {
    granted: false,
    reason: `Role level insufficient: ${userRole} (level ${userLevel}) < ${minimumRole} (level ${requiredLevel})`,
  };
}

/**
 * Check if a permission is a read-only permission
 *
 * Useful for implementing read-only access patterns.
 *
 * @param permission - The permission to check
 * @returns true if the permission is read-only
 *
 * @example
 * ```typescript
 * if (isReadOnlyPermission(OrganizationPermission.PROJECTS_READ)) {
 *   // Grant read access
 * }
 * ```
 */
export function isReadOnlyPermission(permission: OrganizationPermission): boolean {
  return (
    permission.endsWith(':read') ||
    permission === OrganizationPermission.ORG_READ ||
    permission === OrganizationPermission.MEMBERS_READ ||
    permission === OrganizationPermission.PROJECTS_READ ||
    permission === OrganizationPermission.RUNS_READ ||
    permission === OrganizationPermission.ARTIFACTS_READ ||
    permission === OrganizationPermission.BILLING_READ ||
    permission === OrganizationPermission.SETTINGS_READ
  );
}

/**
 * Check if a permission is a write permission
 *
 * Write permissions include create, update, and modify operations.
 *
 * @param permission - The permission to check
 * @returns true if the permission is a write permission
 *
 * @example
 * ```typescript
 * if (isWritePermission(OrganizationPermission.PROJECTS_WRITE)) {
 *   // Validate write operation
 * }
 * ```
 */
export function isWritePermission(permission: OrganizationPermission): boolean {
  return permission.endsWith(':write') || permission === OrganizationPermission.BILLING_MANAGE;
}

/**
 * Check if a permission is a delete permission
 *
 * Delete permissions are the most destructive and require careful handling.
 *
 * @param permission - The permission to check
 * @returns true if the permission is a delete permission
 *
 * @example
 * ```typescript
 * if (isDeletePermission(OrganizationPermission.PROJECTS_DELETE)) {
 *   // Require additional confirmation
 * }
 * ```
 */
export function isDeletePermission(permission: OrganizationPermission): boolean {
  return permission.endsWith(':delete') || permission === OrganizationPermission.ORG_DELETE;
}

/**
 * Get all permissions for a specific resource type
 *
 * Filters permissions to return only those related to a specific resource.
 *
 * @param resourceType - The resource type (projects, runs, artifacts, etc.)
 * @returns Array of permissions for the resource
 *
 * @example
 * ```typescript
 * const projectPerms = getResourcePermissions('projects');
 * // Returns: [PROJECTS_READ, PROJECTS_WRITE, PROJECTS_DELETE]
 * ```
 */
export function getResourcePermissions(
  resourceType: 'org' | 'members' | 'projects' | 'runs' | 'artifacts' | 'billing' | 'settings'
): readonly OrganizationPermission[] {
  return Object.values(OrganizationPermission).filter((perm) => perm.startsWith(`${resourceType}:`));
}

/**
 * Check if a user can perform an action based on role and resource ownership
 *
 * Implements a common pattern where users can perform actions on their own
 * resources even without organization-level permissions.
 *
 * @param role - The user's organization role
 * @param requiredPermission - The permission required
 * @param isOwner - Whether the user owns the resource
 * @param customPermissions - Optional custom permissions
 * @returns true if the action is allowed
 *
 * @example
 * ```typescript
 * // User can delete their own projects even as MEMBER
 * const canDelete = canPerformAction(
 *   OrganizationRole.MEMBER,
 *   OrganizationPermission.PROJECTS_DELETE,
 *   true // user owns the project
 * );
 * ```
 */
export function canPerformAction(
  role: OrganizationRole,
  requiredPermission: OrganizationPermission,
  isOwner: boolean,
  customPermissions?: readonly OrganizationPermission[]
): boolean {
  // Check if user has the permission through role or custom permissions
  const effectivePermissions = getEffectivePermissions(role, customPermissions);
  if (hasPermission(effectivePermissions, requiredPermission)) {
    return true;
  }

  // For delete operations, allow resource owners to delete their own resources
  if (isOwner && isDeletePermission(requiredPermission)) {
    return true;
  }

  return false;
}
