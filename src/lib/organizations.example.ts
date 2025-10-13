/**
 * Example usage of organization types
 *
 * This file demonstrates how to use the organization types system
 * for multi-tenancy in the NOFX Control Plane.
 *
 * @module organizations.example
 */

import type {
  Organization,
  OrganizationMembership,
  OrganizationInvite,
  ProjectWithOrganization,
} from './organizations.types';

import {
  OrganizationRole,
  OrganizationPermission,
  SubscriptionPlan,
  SubscriptionStatus,
  IsolationLevel,
  isOrganizationRole,
  isOrganizationPermission,
  hasMinimumRole,
  getDefaultPermissions,
  getDefaultQuotas,
  hasActiveSubscription,
  hasExceededQuota,
} from './organizations.types';

// ============================================================================
// Example 1: Creating a New Organization
// ============================================================================

/**
 * Create a new organization with default settings
 */
function createNewOrganization(
  name: string,
  ownerUserId: string,
  plan: SubscriptionPlan = SubscriptionPlan.FREE
): Organization {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const quotas = getDefaultQuotas(plan);

  const org: Organization = {
    id: `org_${generateId()}`,
    name,
    slug,
    owner_id: ownerUserId,
    settings: {
      isolation_level: IsolationLevel.STANDARD,
      features: {
        advanced_analytics: plan !== SubscriptionPlan.FREE,
        custom_models: plan === SubscriptionPlan.ENTERPRISE,
        api_access: true,
        webhooks: plan !== SubscriptionPlan.FREE,
        sso_enabled: plan === SubscriptionPlan.ENTERPRISE,
        audit_logs: true,
        git_integration: true,
        priority_support: plan === SubscriptionPlan.ENTERPRISE,
      },
      notifications: {
        email_on_run_complete: true,
        email_on_run_failure: true,
      },
      security: {
        require_2fa: plan === SubscriptionPlan.ENTERPRISE,
        session_timeout_minutes: 60,
      },
    },
    quotas,
    usage: {
      projects_count: 0,
      concurrent_runs_count: 0,
      runs_this_month: 0,
      api_calls_this_month: 0,
      storage_used_gb: 0,
      members_count: 1, // Owner
      artifacts_count: 0,
      compute_minutes_this_month: 0,
      last_calculated_at: new Date().toISOString(),
    },
    billing: {
      plan,
      status: SubscriptionStatus.TRIALING,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
    },
    metadata: {
      created_via: 'signup',
      onboarding_completed: false,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return org;
}

// ============================================================================
// Example 2: Managing Organization Members
// ============================================================================

/**
 * Add a member to an organization
 */
function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: OrganizationRole = OrganizationRole.MEMBER
): OrganizationMembership {
  const membership: OrganizationMembership = {
    id: `mem_${generateId()}`,
    organization_id: organizationId,
    user_id: userId,
    role,
    permissions: getDefaultPermissions(role),
    joined_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return membership;
}

/**
 * Invite a user to join an organization
 */
function inviteUserToOrganization(
  organizationId: string,
  inviterUserId: string,
  email: string,
  role: OrganizationRole = OrganizationRole.MEMBER,
  message?: string
): OrganizationInvite {
  const invite: OrganizationInvite = {
    id: `inv_${generateId()}`,
    organization_id: organizationId,
    inviter_id: inviterUserId,
    email,
    role,
    token: generateSecureToken(),
    status: 'pending',
    message: message || null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return invite;
}

// ============================================================================
// Example 3: Permission Checking
// ============================================================================

/**
 * Check if a user can perform an action
 */
function canUserPerformAction(
  membership: OrganizationMembership,
  permission: OrganizationPermission
): boolean {
  // Check explicit permissions first
  if (membership.permissions) {
    return membership.permissions.includes(permission);
  }

  // Fall back to default role permissions
  const defaultPermissions = getDefaultPermissions(membership.role);
  return defaultPermissions.includes(permission);
}

/**
 * Example: Check if user can create a project
 */
function canCreateProject(membership: OrganizationMembership): boolean {
  return canUserPerformAction(membership, OrganizationPermission.PROJECTS_WRITE);
}

/**
 * Example: Check if user can manage billing
 */
function canManageBilling(membership: OrganizationMembership): boolean {
  return canUserPerformAction(membership, OrganizationPermission.BILLING_MANAGE);
}

/**
 * Example: Check if user has admin privileges
 */
function isAdmin(membership: OrganizationMembership): boolean {
  return hasMinimumRole(membership.role, OrganizationRole.ADMIN);
}

// ============================================================================
// Example 4: Quota Management
// ============================================================================

/**
 * Check if organization can create a new project
 */
function canCreateNewProject(org: Organization): boolean {
  if (!hasActiveSubscription(org)) {
    return false;
  }

  if (hasExceededQuota(org, 'max_projects')) {
    return false;
  }

  return true;
}

/**
 * Check if organization can start a new run
 */
function canStartNewRun(org: Organization): boolean {
  if (!hasActiveSubscription(org)) {
    return false;
  }

  if (hasExceededQuota(org, 'max_runs_per_month')) {
    return false;
  }

  if (hasExceededQuota(org, 'max_concurrent_runs')) {
    return false;
  }

  return true;
}

/**
 * Get quota status for an organization
 */
interface QuotaStatus {
  quota: string;
  current: number;
  limit: number;
  percentage: number;
  exceeded: boolean;
}

function getQuotaStatus(org: Organization): QuotaStatus[] {
  const quotas: QuotaStatus[] = [];

  // Projects quota
  quotas.push({
    quota: 'projects',
    current: org.usage.projects_count,
    limit: org.quotas.max_projects,
    percentage:
      org.quotas.max_projects === -1
        ? 0
        : (org.usage.projects_count / org.quotas.max_projects) * 100,
    exceeded: hasExceededQuota(org, 'max_projects'),
  });

  // Runs quota
  quotas.push({
    quota: 'runs_this_month',
    current: org.usage.runs_this_month,
    limit: org.quotas.max_runs_per_month,
    percentage:
      org.quotas.max_runs_per_month === -1
        ? 0
        : (org.usage.runs_this_month / org.quotas.max_runs_per_month) * 100,
    exceeded: hasExceededQuota(org, 'max_runs_per_month'),
  });

  // Storage quota
  quotas.push({
    quota: 'storage_gb',
    current: org.usage.storage_used_gb,
    limit: org.quotas.max_storage_gb,
    percentage:
      org.quotas.max_storage_gb === -1
        ? 0
        : (org.usage.storage_used_gb / org.quotas.max_storage_gb) * 100,
    exceeded: hasExceededQuota(org, 'max_storage_gb'),
  });

  return quotas;
}

// ============================================================================
// Example 5: Project Creation with Organization
// ============================================================================

/**
 * Create a project within an organization
 */
function createProjectInOrganization(
  org: Organization,
  name: string,
  creatorUserId: string,
  repoUrl?: string
): ProjectWithOrganization | Error {
  // Check quota
  if (!canCreateNewProject(org)) {
    if (!hasActiveSubscription(org)) {
      return new Error('Organization subscription is not active');
    }
    return new Error('Organization has reached maximum number of projects');
  }

  const project: ProjectWithOrganization = {
    id: `proj_${generateId()}`,
    organization_id: org.id,
    name,
    repo_url: repoUrl || null,
    workspace_mode: 'clone',
    default_branch: 'main',
    git_mode: 'advanced',
    initialized: false,
    created_by: creatorUserId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return project;
}

// ============================================================================
// Example 6: Upgrade Organization Plan
// ============================================================================

/**
 * Upgrade organization to a new plan
 */
function upgradeOrganizationPlan(
  org: Organization,
  newPlan: SubscriptionPlan,
  stripeSubscriptionId: string
): Organization {
  const newQuotas = getDefaultQuotas(newPlan);

  const updatedOrg: Organization = {
    ...org,
    quotas: newQuotas,
    billing: {
      ...org.billing,
      plan: newPlan,
      status: SubscriptionStatus.ACTIVE,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      trial_ends_at: null,
    },
    settings: {
      ...org.settings,
      features: {
        ...org.settings.features,
        advanced_analytics: newPlan !== SubscriptionPlan.FREE,
        custom_models: newPlan === SubscriptionPlan.ENTERPRISE,
        webhooks: newPlan !== SubscriptionPlan.FREE,
        sso_enabled: newPlan === SubscriptionPlan.ENTERPRISE,
        priority_support: newPlan === SubscriptionPlan.ENTERPRISE,
      },
    },
    updated_at: new Date().toISOString(),
  };

  return updatedOrg;
}

// ============================================================================
// Example 7: Validation with Type Guards
// ============================================================================

/**
 * Safely parse user role from user input
 */
function parseUserRole(input: unknown): OrganizationRole | Error {
  if (isOrganizationRole(input)) {
    return input;
  }
  return new Error(`Invalid role: ${input}`);
}

/**
 * Safely parse permission from user input
 */
function parsePermission(input: unknown): OrganizationPermission | Error {
  if (isOrganizationPermission(input)) {
    return input;
  }
  return new Error(`Invalid permission: ${input}`);
}

/**
 * Validate organization data from API
 */
function validateOrganizationData(data: unknown): data is Organization {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Partial<Organization>;

  return !!(
    obj.id &&
    obj.name &&
    obj.slug &&
    obj.owner_id &&
    obj.settings &&
    obj.quotas &&
    obj.usage &&
    obj.billing &&
    obj.created_at &&
    obj.updated_at
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateSecureToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// Export Examples
// ============================================================================

export {
  createNewOrganization,
  addOrganizationMember,
  inviteUserToOrganization,
  canUserPerformAction,
  canCreateProject,
  canManageBilling,
  isAdmin,
  canCreateNewProject,
  canStartNewRun,
  getQuotaStatus,
  createProjectInOrganization,
  upgradeOrganizationPlan,
  parseUserRole,
  parsePermission,
  validateOrganizationData,
};
