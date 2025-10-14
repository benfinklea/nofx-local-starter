/**
 * Organization Multi-Tenancy System
 *
 * Comprehensive type-safe organization management for NOFX Control Plane.
 * Provides roles, permissions, quotas, billing, and resource isolation.
 *
 * @module organizations
 *
 * @example
 * ```typescript
 * import {
 *   Organization,
 *   OrganizationRole,
 *   OrganizationPermission,
 *   hasMinimumRole,
 *   getDefaultQuotas,
 * } from './organizations';
 *
 * // Create organization
 * const org: Organization = {
 *   id: 'org_abc',
 *   name: 'Acme Corp',
 *   slug: 'acme-corp',
 *   owner_id: 'user_xyz',
 *   // ... other fields
 * };
 *
 * // Check permissions
 * if (hasMinimumRole(userRole, OrganizationRole.ADMIN)) {
 *   performAdminAction();
 * }
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core organization types
  Organization,
  OrganizationSettings,
  ResourceQuotas,
  ResourceUsage,
  BillingInfo,

  // Membership and access
  OrganizationMembership,
  OrganizationInvite,

  // Resource types
  ProjectWithOrganization,
  OrganizationWorkspace,
  OrganizationArtifact,
} from './organizations.types';

// ============================================================================
// Enum Exports
// ============================================================================

export {
  // Role and permission enums
  OrganizationRole,
  OrganizationPermission,

  // Subscription and status enums
  SubscriptionPlan,
  SubscriptionStatus,

  // Isolation level
  IsolationLevel,
} from './organizations.types';

// ============================================================================
// Type Guard Exports
// ============================================================================

export {
  isOrganizationRole,
  isOrganizationPermission,
  isSubscriptionStatus,
  isOrganization,
} from './organizations.types';

// ============================================================================
// Utility Function Exports
// ============================================================================

export {
  hasMinimumRole,
  getDefaultPermissions,
  getDefaultQuotas,
  hasActiveSubscription,
  hasExceededQuota,
} from './organizations.types';

// ============================================================================
// Re-export everything for advanced usage
// ============================================================================

export * from './organizations.types';
