/**
 * Type Exports for Backplane Store
 *
 * Re-exports all types from the organizations module for use in the backplane store.
 *
 * @module backplane/types
 */

// Re-export all organization types
export type {
  Organization,
  OrganizationSettings,
  ResourceQuotas,
  ResourceUsage,
  BillingInfo,
  OrganizationMembership,
  OrganizationInvite,
  ProjectWithOrganization,
  OrganizationWorkspace,
  OrganizationArtifact,
} from '../../../lib/organizations.types';

export {
  OrganizationRole,
  OrganizationPermission,
  SubscriptionPlan,
  SubscriptionStatus,
  IsolationLevel,
  isOrganizationRole,
  isOrganizationPermission,
  isSubscriptionStatus,
  isOrganization,
  hasMinimumRole,
  getDefaultPermissions,
  getDefaultQuotas,
  hasActiveSubscription,
  hasExceededQuota,
} from '../../../lib/organizations.types';

/**
 * Input type for creating a new organization
 */
export interface CreateOrganizationInput {
  /** Organization display name */
  name: string;
  /** URL-safe unique slug (auto-generated if not provided) */
  slug?: string;
  /** User ID of the organization owner */
  owner_id: string;
  /** Organization settings (optional) */
  settings?: Partial<import('../../../lib/organizations.types').OrganizationSettings>;
  /** Subscription plan (defaults to FREE) */
  plan?: import('../../../lib/organizations.types').SubscriptionPlan;
  /** Additional metadata */
  metadata?: unknown;
}

/**
 * Input type for updating an organization
 */
export interface UpdateOrganizationInput {
  /** Organization display name */
  name?: string;
  /** URL-safe unique slug */
  slug?: string;
  /** Organization settings */
  settings?: Partial<import('../../../lib/organizations.types').OrganizationSettings>;
  /** Additional metadata */
  metadata?: unknown;
}

/**
 * Input type for adding a member to an organization
 */
export interface AddOrganizationMemberInput {
  /** Organization ID */
  organization_id: string;
  /** User ID to add */
  user_id: string;
  /** Role to assign */
  role: import('../../../lib/organizations.types').OrganizationRole;
  /** Custom permissions (optional, overrides role defaults) */
  permissions?: readonly import('../../../lib/organizations.types').OrganizationPermission[];
}

/**
 * Organization with user role information
 */
export interface OrganizationWithRole {
  /** Unique organization identifier (prefixed with org_) */
  readonly id: string;
  /** Organization display name */
  name: string;
  /** URL-safe unique slug for the organization */
  slug: string;
  /** User ID of the organization owner */
  owner_id: string;
  /** Organization configuration settings */
  settings: import('../../../lib/organizations.types').OrganizationSettings;
  /** Resource quotas for this organization */
  quotas: import('../../../lib/organizations.types').ResourceQuotas;
  /** Current resource usage */
  usage: import('../../../lib/organizations.types').ResourceUsage;
  /** Billing and subscription information */
  billing: import('../../../lib/organizations.types').BillingInfo;
  /** Additional metadata */
  metadata?: unknown;
  /** Creation timestamp (ISO 8601) */
  readonly created_at: string;
  /** Last update timestamp (ISO 8601) */
  readonly updated_at: string;
  /** User's role in the organization */
  user_role: import('../../../lib/organizations.types').OrganizationRole;
}

/**
 * Organization member entity (renamed from OrganizationMembership for consistency)
 */
export type OrganizationMember = import('../../../lib/organizations.types').OrganizationMembership;

/**
 * Organization quota information
 */
export interface OrganizationQuota {
  /** Organization ID */
  organization_id: string;
  /** Resource quotas */
  quotas: import('../../../lib/organizations.types').ResourceQuotas;
  /** Current usage */
  usage: import('../../../lib/organizations.types').ResourceUsage;
}
