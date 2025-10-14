/**
 * Multi-Tenancy Organization Types for NOFX Control Plane
 *
 * This module provides comprehensive type-safe data structures for organization-based
 * multi-tenancy with user roles, permissions, quotas, and resource isolation.
 *
 * @module organizations.types
 */

import type { JsonValue } from './store/types';

// ============================================================================
// Core Enums
// ============================================================================

/**
 * Organization member roles with hierarchical permissions
 *
 * Permission hierarchy (highest to lowest):
 * - owner: Full control, including deletion and billing
 * - admin: Can manage members, settings, and resources
 * - member: Can create and manage own resources
 * - viewer: Read-only access
 *
 * @example
 * ```typescript
 * const userRole: OrganizationRole = OrganizationRole.ADMIN;
 * if (hasMinimumRole(userRole, OrganizationRole.MEMBER)) {
 *   // User can perform member-level actions
 * }
 * ```
 */
export enum OrganizationRole {
  /** Organization owner with full control */
  OWNER = 'owner',
  /** Administrator with management permissions */
  ADMIN = 'admin',
  /** Standard member with resource creation rights */
  MEMBER = 'member',
  /** Read-only viewer */
  VIEWER = 'viewer',
}

/**
 * Granular permissions for fine-grained access control
 *
 * Permissions can be combined to create custom access levels.
 * Standard role mappings:
 * - owner: all permissions
 * - admin: all except org:delete and billing:manage
 * - member: read, write on own resources
 * - viewer: read only
 *
 * @example
 * ```typescript
 * const permissions: OrganizationPermission[] = [
 *   OrganizationPermission.RUNS_READ,
 *   OrganizationPermission.RUNS_WRITE
 * ];
 * ```
 */
export enum OrganizationPermission {
  // Organization permissions
  /** View organization details */
  ORG_READ = 'org:read',
  /** Update organization settings */
  ORG_WRITE = 'org:write',
  /** Delete organization (owner only) */
  ORG_DELETE = 'org:delete',

  // Member management
  /** View organization members */
  MEMBERS_READ = 'members:read',
  /** Invite and manage members */
  MEMBERS_WRITE = 'members:write',
  /** Remove members (admin+) */
  MEMBERS_DELETE = 'members:delete',

  // Project permissions
  /** View projects */
  PROJECTS_READ = 'projects:read',
  /** Create and update projects */
  PROJECTS_WRITE = 'projects:write',
  /** Delete projects */
  PROJECTS_DELETE = 'projects:delete',

  // Run permissions
  /** View runs and their status */
  RUNS_READ = 'runs:read',
  /** Create and execute runs */
  RUNS_WRITE = 'runs:write',
  /** Cancel and delete runs */
  RUNS_DELETE = 'runs:delete',

  // Artifact permissions
  /** View artifacts */
  ARTIFACTS_READ = 'artifacts:read',
  /** Upload artifacts */
  ARTIFACTS_WRITE = 'artifacts:write',
  /** Delete artifacts */
  ARTIFACTS_DELETE = 'artifacts:delete',

  // Billing permissions
  /** View billing information */
  BILLING_READ = 'billing:read',
  /** Manage billing and subscriptions (owner only) */
  BILLING_MANAGE = 'billing:manage',

  // Settings permissions
  /** View organization settings */
  SETTINGS_READ = 'settings:read',
  /** Modify organization settings */
  SETTINGS_WRITE = 'settings:write',
}

/**
 * Organization subscription plan tiers
 *
 * Each tier provides different quotas and features.
 *
 * @example
 * ```typescript
 * const plan: SubscriptionPlan = SubscriptionPlan.PROFESSIONAL;
 * const quotas = getQuotasForPlan(plan);
 * ```
 */
export enum SubscriptionPlan {
  /** Free tier with basic features */
  FREE = 'free',
  /** Professional tier for small teams */
  PROFESSIONAL = 'professional',
  /** Team tier for growing organizations */
  TEAM = 'team',
  /** Enterprise tier with custom quotas */
  ENTERPRISE = 'enterprise',
}

/**
 * Organization subscription status
 *
 * Aligns with Stripe subscription statuses for billing integration.
 *
 * @see https://stripe.com/docs/api/subscriptions/object#subscription_object-status
 */
export enum SubscriptionStatus {
  /** Trial period, full access */
  TRIALING = 'trialing',
  /** Active subscription, full access */
  ACTIVE = 'active',
  /** Payment failed, grace period */
  PAST_DUE = 'past_due',
  /** Subscription canceled, access revoked */
  CANCELED = 'canceled',
  /** Subscription incomplete, awaiting payment */
  INCOMPLETE = 'incomplete',
  /** Trial/incomplete expired, access revoked */
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  /** Multiple payment failures, limited access */
  UNPAID = 'unpaid',
  /** Temporarily paused */
  PAUSED = 'paused',
}

/**
 * Workspace and artifact isolation levels
 *
 * Determines how resources are isolated between organizations.
 *
 * @example
 * ```typescript
 * const isolation: IsolationLevel = IsolationLevel.STRICT;
 * if (isolation === IsolationLevel.STRICT) {
 *   // Enforce complete isolation
 * }
 * ```
 */
export enum IsolationLevel {
  /** Complete isolation, no cross-org access */
  STRICT = 'strict',
  /** Standard isolation with explicit sharing */
  STANDARD = 'standard',
  /** Relaxed isolation for development */
  RELAXED = 'relaxed',
}

// ============================================================================
// Organization Entity
// ============================================================================

/**
 * Core organization settings
 *
 * Configurable organization-level preferences and features.
 * All settings are optional with sensible defaults.
 *
 * @example
 * ```typescript
 * const settings: OrganizationSettings = {
 *   isolation_level: IsolationLevel.STRICT,
 *   features: {
 *     advanced_analytics: true,
 *     custom_models: false
 *   },
 *   notifications: {
 *     email_on_run_complete: true,
 *     slack_webhook_url: 'https://...'
 *   }
 * };
 * ```
 */
export interface OrganizationSettings {
  /** Resource isolation level */
  isolation_level?: IsolationLevel;

  /** Feature flags for optional capabilities */
  features?: {
    /** Enable advanced analytics dashboard */
    advanced_analytics?: boolean;
    /** Allow custom AI model configurations */
    custom_models?: boolean;
    /** Enable API access */
    api_access?: boolean;
    /** Enable webhook integrations */
    webhooks?: boolean;
    /** Enable SSO authentication */
    sso_enabled?: boolean;
    /** Enable audit logging */
    audit_logs?: boolean;
    /** Enable git integration */
    git_integration?: boolean;
    /** Enable priority support */
    priority_support?: boolean;
    [key: string]: boolean | undefined;
  };

  /** Notification preferences */
  notifications?: {
    /** Email notification on run completion */
    email_on_run_complete?: boolean;
    /** Email notification on run failure */
    email_on_run_failure?: boolean;
    /** Slack webhook URL for notifications */
    slack_webhook_url?: string;
    /** Discord webhook URL for notifications */
    discord_webhook_url?: string;
    [key: string]: boolean | string | undefined;
  };

  /** Security settings */
  security?: {
    /** Require 2FA for all members */
    require_2fa?: boolean;
    /** IP whitelist for access control */
    ip_whitelist?: readonly string[];
    /** Allowed email domains for auto-join */
    allowed_email_domains?: readonly string[];
    /** Session timeout in minutes */
    session_timeout_minutes?: number;
  };

  /** Additional custom settings */
  [key: string]: unknown;
}

/**
 * Resource quotas and usage limits
 *
 * Defines what an organization is allowed to consume.
 * Actual usage is tracked separately.
 *
 * @example
 * ```typescript
 * const quotas: ResourceQuotas = {
 *   max_projects: 10,
 *   max_runs_per_month: 1000,
 *   max_storage_gb: 50,
 *   max_members: 5
 * };
 * ```
 */
export interface ResourceQuotas {
  /** Maximum number of projects */
  max_projects: number;
  /** Maximum concurrent runs */
  max_concurrent_runs: number;
  /** Maximum runs per month */
  max_runs_per_month: number;
  /** Maximum API calls per month */
  max_api_calls_per_month: number;
  /** Maximum storage in gigabytes */
  max_storage_gb: number;
  /** Maximum number of members */
  max_members: number;
  /** Maximum artifacts per run */
  max_artifacts_per_run: number;
  /** Maximum compute minutes per month */
  max_compute_minutes_per_month: number;
  /** Maximum retention days for artifacts */
  max_artifact_retention_days: number;
  /** Rate limit per minute for API calls */
  rate_limit_per_minute: number;
}

/**
 * Current resource usage
 *
 * Tracks actual consumption against quotas.
 * Reset monthly based on billing cycle.
 *
 * @example
 * ```typescript
 * const usage: ResourceUsage = {
 *   projects_count: 5,
 *   runs_this_month: 450,
 *   storage_used_gb: 23.5,
 *   members_count: 3
 * };
 *
 * if (usage.runs_this_month >= quotas.max_runs_per_month) {
 *   throw new Error('Monthly run quota exceeded');
 * }
 * ```
 */
export interface ResourceUsage {
  /** Current number of projects */
  projects_count: number;
  /** Active/running runs count */
  concurrent_runs_count: number;
  /** Total runs this billing period */
  runs_this_month: number;
  /** API calls this billing period */
  api_calls_this_month: number;
  /** Storage used in gigabytes */
  storage_used_gb: number;
  /** Current number of members */
  members_count: number;
  /** Total artifacts across all runs */
  artifacts_count: number;
  /** Compute minutes used this period */
  compute_minutes_this_month: number;
  /** Last usage calculation timestamp */
  last_calculated_at: string;
}

/**
 * Billing information
 *
 * Integration with Stripe for payment processing.
 * Sensitive data should only be accessed with proper authorization.
 *
 * @example
 * ```typescript
 * const billing: BillingInfo = {
 *   stripe_customer_id: 'cus_123',
 *   stripe_subscription_id: 'sub_456',
 *   plan: SubscriptionPlan.PROFESSIONAL,
 *   status: SubscriptionStatus.ACTIVE,
 *   current_period_start: '2025-10-01T00:00:00Z',
 *   current_period_end: '2025-11-01T00:00:00Z'
 * };
 * ```
 */
export interface BillingInfo {
  /** Stripe customer ID */
  stripe_customer_id?: string | null;
  /** Stripe subscription ID */
  stripe_subscription_id?: string | null;
  /** Current subscription plan */
  plan: SubscriptionPlan;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Billing email address */
  billing_email?: string | null;
  /** Current period start date (ISO 8601) */
  current_period_start?: string | null;
  /** Current period end date (ISO 8601) */
  current_period_end?: string | null;
  /** Trial end date (ISO 8601) */
  trial_ends_at?: string | null;
  /** Cancellation date (ISO 8601) */
  canceled_at?: string | null;
  /** Payment method last 4 digits */
  payment_method_last4?: string | null;
  /** Payment method brand (visa, mastercard, etc) */
  payment_method_brand?: string | null;
  /** Next invoice amount in cents */
  next_invoice_amount?: number | null;
  /** Additional billing metadata */
  metadata?: JsonValue;
}

/**
 * Complete organization entity
 *
 * Represents an organization with all associated data.
 * This is the primary entity for multi-tenancy.
 *
 * @example
 * ```typescript
 * const org: Organization = {
 *   id: 'org_abc123',
 *   name: 'Acme Corporation',
 *   slug: 'acme-corp',
 *   owner_id: 'user_xyz789',
 *   settings: { isolation_level: IsolationLevel.STRICT },
 *   quotas: defaultQuotas,
 *   usage: initialUsage,
 *   billing: {
 *     plan: SubscriptionPlan.TEAM,
 *     status: SubscriptionStatus.ACTIVE
 *   },
 *   created_at: '2025-10-01T00:00:00Z',
 *   updated_at: '2025-10-13T00:00:00Z'
 * };
 * ```
 */
export interface Organization {
  /** Unique organization identifier (prefixed with org_) */
  readonly id: string;

  /** Organization display name */
  name: string;

  /** URL-safe unique slug for the organization */
  slug: string;

  /** User ID of the organization owner */
  owner_id: string;

  /** Organization configuration settings */
  settings: OrganizationSettings;

  /** Resource quotas for this organization */
  quotas: ResourceQuotas;

  /** Current resource usage */
  usage: ResourceUsage;

  /** Billing and subscription information */
  billing: BillingInfo;

  /** Additional metadata */
  metadata?: JsonValue;

  /** Creation timestamp (ISO 8601) */
  readonly created_at: string;

  /** Last update timestamp (ISO 8601) */
  readonly updated_at: string;
}

// ============================================================================
// User-Organization Relationships
// ============================================================================

/**
 * Organization membership record
 *
 * Links users to organizations with roles and permissions.
 * Many-to-many relationship between users and organizations.
 *
 * @example
 * ```typescript
 * const membership: OrganizationMembership = {
 *   id: 'mem_123',
 *   organization_id: 'org_abc',
 *   user_id: 'user_xyz',
 *   role: OrganizationRole.MEMBER,
 *   permissions: [
 *     OrganizationPermission.RUNS_READ,
 *     OrganizationPermission.RUNS_WRITE
 *   ],
 *   joined_at: '2025-10-01T00:00:00Z',
 *   updated_at: '2025-10-01T00:00:00Z'
 * };
 * ```
 */
export interface OrganizationMembership {
  /** Unique membership identifier */
  readonly id: string;

  /** Organization ID */
  organization_id: string;

  /** User ID from auth.users */
  user_id: string;

  /** User's role in the organization */
  role: OrganizationRole;

  /** Granular permissions (overrides role defaults) */
  permissions?: readonly OrganizationPermission[];

  /** Custom permission metadata */
  permission_metadata?: JsonValue;

  /** When user joined the organization (ISO 8601) */
  readonly joined_at: string;

  /** Last membership update (ISO 8601) */
  readonly updated_at: string;
}

/**
 * Organization invitation record
 *
 * Manages pending invitations to join an organization.
 * Invitations expire after a set period.
 *
 * @example
 * ```typescript
 * const invite: OrganizationInvite = {
 *   id: 'inv_123',
 *   organization_id: 'org_abc',
 *   inviter_id: 'user_xyz',
 *   email: 'newuser@example.com',
 *   role: OrganizationRole.MEMBER,
 *   token: 'secure_random_token',
 *   status: 'pending',
 *   expires_at: '2025-10-20T00:00:00Z',
 *   created_at: '2025-10-13T00:00:00Z'
 * };
 * ```
 */
export interface OrganizationInvite {
  /** Unique invitation identifier */
  readonly id: string;

  /** Organization ID */
  organization_id: string;

  /** User ID of the inviter */
  inviter_id: string;

  /** Email address of invitee */
  email: string;

  /** Role to be assigned upon acceptance */
  role: OrganizationRole;

  /** Secure token for accepting invitation */
  readonly token: string;

  /** Invitation status */
  status: 'pending' | 'accepted' | 'expired' | 'revoked';

  /** Optional personal message */
  message?: string | null;

  /** When invitation expires (ISO 8601) */
  expires_at: string;

  /** When invitation was accepted (ISO 8601) */
  accepted_at?: string | null;

  /** Creation timestamp (ISO 8601) */
  readonly created_at: string;

  /** Last update timestamp (ISO 8601) */
  readonly updated_at: string;
}

// ============================================================================
// Project-Organization Integration
// ============================================================================

/**
 * Project entity with organization ownership
 *
 * Extends the existing Project type to include organization context.
 * All projects belong to exactly one organization.
 *
 * @example
 * ```typescript
 * const project: ProjectWithOrganization = {
 *   id: 'proj_123',
 *   organization_id: 'org_abc',
 *   name: 'Mobile App',
 *   repo_url: 'https://github.com/acme/mobile-app',
 *   workspace_mode: 'clone',
 *   default_branch: 'main',
 *   git_mode: 'advanced',
 *   initialized: true
 * };
 * ```
 */
export interface ProjectWithOrganization {
  /** Project identifier */
  id: string;

  /** Organization that owns this project */
  organization_id: string;

  /** Project display name */
  name: string;

  /** Git repository URL */
  repo_url?: string | null;

  /** Local filesystem path */
  local_path?: string | null;

  /** Workspace management mode */
  workspace_mode?: 'local_path' | 'clone' | 'worktree';

  /** Default git branch */
  default_branch?: string | null;

  /** Git integration level */
  git_mode?: 'hidden' | 'basic' | 'advanced';

  /** Whether project is initialized */
  initialized?: boolean;

  /** User ID of project creator */
  created_by?: string;

  /** Creation timestamp (ISO 8601) */
  created_at?: string;

  /** Last update timestamp (ISO 8601) */
  updated_at?: string;
}

// ============================================================================
// Workspace and Artifact Isolation
// ============================================================================

/**
 * Workspace with organization isolation
 *
 * Ensures workspaces are isolated per organization.
 *
 * @example
 * ```typescript
 * const workspace: OrganizationWorkspace = {
 *   id: 'ws_123',
 *   organization_id: 'org_abc',
 *   project_id: 'proj_456',
 *   path: '/workspaces/org_abc/proj_456',
 *   isolation_level: IsolationLevel.STRICT,
 *   created_at: '2025-10-13T00:00:00Z'
 * };
 * ```
 */
export interface OrganizationWorkspace {
  /** Workspace identifier */
  readonly id: string;

  /** Organization ID for isolation */
  organization_id: string;

  /** Associated project ID */
  project_id: string;

  /** Filesystem path to workspace */
  path: string;

  /** Isolation enforcement level */
  isolation_level: IsolationLevel;

  /** Workspace metadata */
  metadata?: JsonValue;

  /** Creation timestamp (ISO 8601) */
  readonly created_at: string;
}

/**
 * Artifact with organization context
 *
 * Extends artifact records to include organization for access control.
 *
 * @example
 * ```typescript
 * const artifact: OrganizationArtifact = {
 *   id: 'art_123',
 *   organization_id: 'org_abc',
 *   run_id: 'run_456',
 *   step_id: 'step_789',
 *   type: 'file',
 *   path: '/artifacts/org_abc/run_456/output.js',
 *   size_bytes: 12345,
 *   mime_type: 'application/javascript',
 *   created_at: '2025-10-13T00:00:00Z'
 * };
 * ```
 */
export interface OrganizationArtifact {
  /** Artifact identifier */
  readonly id: string;

  /** Organization ID for access control */
  organization_id: string;

  /** Parent run ID */
  run_id: string;

  /** Parent step ID */
  step_id: string;

  /** Artifact type (file, log, image, etc) */
  type: string;

  /** Storage path */
  path: string;

  /** File size in bytes */
  size_bytes?: number;

  /** MIME type */
  mime_type?: string;

  /** Additional metadata */
  metadata?: JsonValue;

  /** Creation timestamp (ISO 8601) */
  readonly created_at: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid OrganizationRole
 *
 * @param value - Value to check
 * @returns true if value is a valid OrganizationRole
 *
 * @example
 * ```typescript
 * if (isOrganizationRole(userInput)) {
 *   // userInput is guaranteed to be OrganizationRole
 *   assignRole(userInput);
 * }
 * ```
 */
export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return (
    typeof value === 'string' &&
    Object.values(OrganizationRole).includes(value as OrganizationRole)
  );
}

/**
 * Type guard to check if a value is a valid OrganizationPermission
 *
 * @param value - Value to check
 * @returns true if value is a valid OrganizationPermission
 *
 * @example
 * ```typescript
 * if (isOrganizationPermission(permission)) {
 *   // permission is guaranteed to be OrganizationPermission
 *   grantPermission(userId, permission);
 * }
 * ```
 */
export function isOrganizationPermission(value: unknown): value is OrganizationPermission {
  return (
    typeof value === 'string' &&
    Object.values(OrganizationPermission).includes(value as OrganizationPermission)
  );
}

/**
 * Type guard to check if a value is a valid SubscriptionStatus
 *
 * @param value - Value to check
 * @returns true if value is a valid SubscriptionStatus
 *
 * @example
 * ```typescript
 * if (isSubscriptionStatus(status)) {
 *   // status is guaranteed to be SubscriptionStatus
 *   updateBillingStatus(status);
 * }
 * ```
 */
export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === 'string' &&
    Object.values(SubscriptionStatus).includes(value as SubscriptionStatus)
  );
}

/**
 * Type guard to check if a value is a valid Organization
 *
 * @param value - Value to check
 * @returns true if value is a valid Organization with all required fields
 *
 * @example
 * ```typescript
 * const data = JSON.parse(response);
 * if (isOrganization(data)) {
 *   // data is guaranteed to be Organization
 *   processOrganization(data);
 * }
 * ```
 */
export function isOrganization(value: unknown): value is Organization {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    typeof obj.owner_id === 'string' &&
    typeof obj.settings === 'object' &&
    typeof obj.quotas === 'object' &&
    typeof obj.usage === 'object' &&
    typeof obj.billing === 'object' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a role has at least the minimum required permission level
 *
 * Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if user has sufficient permissions
 *
 * @example
 * ```typescript
 * if (hasMinimumRole(userRole, OrganizationRole.MEMBER)) {
 *   // User can perform member-level actions
 *   createProject();
 * }
 * ```
 */
export function hasMinimumRole(
  userRole: OrganizationRole,
  requiredRole: OrganizationRole
): boolean {
  const roleHierarchy: Record<OrganizationRole, number> = {
    [OrganizationRole.OWNER]: 4,
    [OrganizationRole.ADMIN]: 3,
    [OrganizationRole.MEMBER]: 2,
    [OrganizationRole.VIEWER]: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Get default permissions for a role
 *
 * Returns the standard set of permissions for each role.
 * Can be overridden with custom permissions.
 *
 * @param role - The organization role
 * @returns Array of default permissions for the role
 *
 * @example
 * ```typescript
 * const permissions = getDefaultPermissions(OrganizationRole.MEMBER);
 * // Returns: [ORG_READ, PROJECTS_READ, PROJECTS_WRITE, RUNS_READ, RUNS_WRITE, ...]
 * ```
 */
export function getDefaultPermissions(role: OrganizationRole): readonly OrganizationPermission[] {
  switch (role) {
    case OrganizationRole.OWNER:
      return Object.values(OrganizationPermission);

    case OrganizationRole.ADMIN:
      return [
        OrganizationPermission.ORG_READ,
        OrganizationPermission.ORG_WRITE,
        OrganizationPermission.MEMBERS_READ,
        OrganizationPermission.MEMBERS_WRITE,
        OrganizationPermission.MEMBERS_DELETE,
        OrganizationPermission.PROJECTS_READ,
        OrganizationPermission.PROJECTS_WRITE,
        OrganizationPermission.PROJECTS_DELETE,
        OrganizationPermission.RUNS_READ,
        OrganizationPermission.RUNS_WRITE,
        OrganizationPermission.RUNS_DELETE,
        OrganizationPermission.ARTIFACTS_READ,
        OrganizationPermission.ARTIFACTS_WRITE,
        OrganizationPermission.ARTIFACTS_DELETE,
        OrganizationPermission.BILLING_READ,
        OrganizationPermission.SETTINGS_READ,
        OrganizationPermission.SETTINGS_WRITE,
      ];

    case OrganizationRole.MEMBER:
      return [
        OrganizationPermission.ORG_READ,
        OrganizationPermission.MEMBERS_READ,
        OrganizationPermission.PROJECTS_READ,
        OrganizationPermission.PROJECTS_WRITE,
        OrganizationPermission.RUNS_READ,
        OrganizationPermission.RUNS_WRITE,
        OrganizationPermission.ARTIFACTS_READ,
        OrganizationPermission.ARTIFACTS_WRITE,
        OrganizationPermission.SETTINGS_READ,
      ];

    case OrganizationRole.VIEWER:
      return [
        OrganizationPermission.ORG_READ,
        OrganizationPermission.MEMBERS_READ,
        OrganizationPermission.PROJECTS_READ,
        OrganizationPermission.RUNS_READ,
        OrganizationPermission.ARTIFACTS_READ,
        OrganizationPermission.SETTINGS_READ,
      ];

    default:
      return [];
  }
}

/**
 * Get default quotas for a subscription plan
 *
 * Returns standard resource quotas based on plan tier.
 * Enterprise plans should use custom quotas.
 *
 * @param plan - The subscription plan
 * @returns Default resource quotas for the plan
 *
 * @example
 * ```typescript
 * const quotas = getDefaultQuotas(SubscriptionPlan.PROFESSIONAL);
 * // Returns quotas for professional tier
 * ```
 */
export function getDefaultQuotas(plan: SubscriptionPlan): ResourceQuotas {
  switch (plan) {
    case SubscriptionPlan.FREE:
      return {
        max_projects: 3,
        max_concurrent_runs: 1,
        max_runs_per_month: 100,
        max_api_calls_per_month: 1000,
        max_storage_gb: 5,
        max_members: 1,
        max_artifacts_per_run: 10,
        max_compute_minutes_per_month: 60,
        max_artifact_retention_days: 7,
        rate_limit_per_minute: 10,
      };

    case SubscriptionPlan.PROFESSIONAL:
      return {
        max_projects: 10,
        max_concurrent_runs: 3,
        max_runs_per_month: 1000,
        max_api_calls_per_month: 10000,
        max_storage_gb: 50,
        max_members: 5,
        max_artifacts_per_run: 50,
        max_compute_minutes_per_month: 600,
        max_artifact_retention_days: 30,
        rate_limit_per_minute: 60,
      };

    case SubscriptionPlan.TEAM:
      return {
        max_projects: 50,
        max_concurrent_runs: 10,
        max_runs_per_month: 10000,
        max_api_calls_per_month: 100000,
        max_storage_gb: 200,
        max_members: 20,
        max_artifacts_per_run: 200,
        max_compute_minutes_per_month: 3000,
        max_artifact_retention_days: 90,
        rate_limit_per_minute: 300,
      };

    case SubscriptionPlan.ENTERPRISE:
      return {
        max_projects: -1, // unlimited
        max_concurrent_runs: 50,
        max_runs_per_month: -1, // unlimited
        max_api_calls_per_month: -1, // unlimited
        max_storage_gb: 1000,
        max_members: -1, // unlimited
        max_artifacts_per_run: 1000,
        max_compute_minutes_per_month: -1, // unlimited
        max_artifact_retention_days: 365,
        rate_limit_per_minute: 1000,
      };

    default:
      // Default to free tier if unknown plan
      return getDefaultQuotas(SubscriptionPlan.FREE);
  }
}

/**
 * Check if organization has an active subscription
 *
 * An organization has an active subscription if:
 * - Status is ACTIVE or TRIALING
 * - Current period has not ended (if applicable)
 *
 * @param org - The organization to check
 * @returns true if organization has active subscription
 *
 * @example
 * ```typescript
 * if (hasActiveSubscription(org)) {
 *   // Organization can use platform features
 *   allowAccess();
 * } else {
 *   // Redirect to billing
 *   redirectToBilling();
 * }
 * ```
 */
export function hasActiveSubscription(org: Organization): boolean {
  const { billing } = org;

  // Check status
  const activeStatuses: SubscriptionStatus[] = [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING,
  ];

  if (!activeStatuses.includes(billing.status)) {
    return false;
  }

  // Check if trial/period hasn't ended
  if (billing.trial_ends_at) {
    const trialEnd = new Date(billing.trial_ends_at);
    if (trialEnd < new Date()) {
      return false;
    }
  }

  if (billing.current_period_end) {
    const periodEnd = new Date(billing.current_period_end);
    if (periodEnd < new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Check if organization has exceeded a specific quota
 *
 * Compares current usage against quota limits.
 * Returns false for unlimited quotas (-1).
 *
 * @param org - The organization to check
 * @param quotaKey - The quota to check
 * @returns true if quota is exceeded
 *
 * @example
 * ```typescript
 * if (hasExceededQuota(org, 'max_runs_per_month')) {
 *   throw new Error('Monthly run quota exceeded');
 * }
 * ```
 */
export function hasExceededQuota(
  org: Organization,
  quotaKey: keyof ResourceQuotas
): boolean {
  const quota = org.quotas[quotaKey];

  // Unlimited quota
  if (quota === -1) {
    return false;
  }

  // Map quota key to usage key
  const usageKeyMap: Record<string, keyof ResourceUsage> = {
    max_projects: 'projects_count',
    max_concurrent_runs: 'concurrent_runs_count',
    max_runs_per_month: 'runs_this_month',
    max_api_calls_per_month: 'api_calls_this_month',
    max_storage_gb: 'storage_used_gb',
    max_members: 'members_count',
    max_artifacts_per_run: 'artifacts_count',
    max_compute_minutes_per_month: 'compute_minutes_this_month',
  };

  const usageKey = usageKeyMap[quotaKey];
  if (!usageKey) {
    return false;
  }

  const currentUsage = org.usage[usageKey];
  return typeof currentUsage === 'number' && currentUsage >= quota;
}
