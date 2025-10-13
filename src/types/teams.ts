/**
 * Centralized type definitions for team management
 */

/**
 * Available team roles with their permission levels
 */
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Team permissions that can be assigned
 */
export type Permission = 'read' | 'write' | 'delete' | 'admin';

/**
 * User profile information from Supabase
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

/**
 * Team member with nested user information
 */
export interface TeamMemberWithUser {
  id: string;
  role: TeamRole;
  user: UserProfile;
}

/**
 * Mapping of roles to their permissions
 */
export const ROLE_PERMISSIONS: Record<TeamRole, readonly Permission[]> = {
  owner: ['read', 'write', 'delete', 'admin'] as const,
  admin: ['read', 'write', 'delete'] as const,
  member: ['read', 'write'] as const,
  viewer: ['read'] as const,
} as const;

/**
 * Type guard to check if a string is a valid TeamRole
 */
export function isTeamRole(role: string): role is TeamRole {
  return role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer';
}

/**
 * Get permissions for a given role, with fallback to viewer
 */
export function getRolePermissions(role: string): readonly Permission[] {
  if (isTeamRole(role)) {
    return ROLE_PERMISSIONS[role];
  }
  return ROLE_PERMISSIONS.viewer;
}
