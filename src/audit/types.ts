/**
 * Audit Event Type System for NOFX Control Plane
 *
 * Comprehensive type-safe audit logging system supporting SOC2, GDPR, and HIPAA compliance.
 * Provides discriminated unions for all audit events with specific payloads and metadata.
 *
 * @module audit/types
 */

import type { JsonValue } from '../lib/store/types';
import type {
  OrganizationRole,
  OrganizationPermission,
} from '../lib/organizations.types';

// ============================================================================
// Core Enums
// ============================================================================

/**
 * Event categories for audit classification
 *
 * Categories organize events into logical groups for filtering and reporting.
 * Each category contains multiple specific event types.
 *
 * @example
 * ```typescript
 * const event: AuditEvent = {
 *   category: EventCategory.AUTHENTICATION,
 *   event_type: 'auth.login.success',
 *   // ... other fields
 * };
 * ```
 */
export enum EventCategory {
  /** Authentication events (login, logout, token management, MFA) */
  AUTHENTICATION = 'authentication',
  /** Authorization events (permission checks, role changes, access denials) */
  AUTHORIZATION = 'authorization',
  /** Organization management events (create, update, delete, settings) */
  ORGANIZATION = 'organization',
  /** Member management events (invite, add, remove, role changes) */
  MEMBER = 'member',
  /** Project lifecycle events (create, update, delete, clone, init) */
  PROJECT = 'project',
  /** Run execution events (create, start, complete, fail, cancel) */
  RUN = 'run',
  /** Artifact management events (create, read, download, delete) */
  ARTIFACT = 'artifact',
  /** Workspace management events (create, access, modify, delete) */
  WORKSPACE = 'workspace',
  /** Billing and subscription events (plan changes, payments, quota) */
  BILLING = 'billing',
  /** Security events (suspicious activity, rate limits, IP blocks, 2FA) */
  SECURITY = 'security',
  /** System-level events (health checks, migrations, config changes) */
  SYSTEM = 'system',
  /** Compliance-specific events (data export, retention, audit access) */
  COMPLIANCE = 'compliance',
}

/**
 * Event severity levels for prioritization and alerting
 *
 * Severity determines how events should be handled, monitored, and escalated.
 *
 * @example
 * ```typescript
 * if (event.severity === EventSeverity.CRITICAL) {
 *   sendAlertToSecurityTeam(event);
 * }
 * ```
 */
export enum EventSeverity {
  /** Normal operational events */
  INFO = 'info',
  /** Potentially concerning events requiring attention */
  WARNING = 'warning',
  /** Critical events requiring immediate action (security, compliance, failures) */
  CRITICAL = 'critical',
}

/**
 * Event outcome status
 *
 * Indicates whether the attempted action completed successfully.
 *
 * @example
 * ```typescript
 * const event: AuditEvent = {
 *   outcome: EventOutcome.SUCCESS,
 *   error_details: undefined, // No error for successful outcomes
 *   // ... other fields
 * };
 * ```
 */
export enum EventOutcome {
  /** Action completed successfully */
  SUCCESS = 'success',
  /** Action failed completely */
  FAILURE = 'failure',
  /** Action partially completed (some operations succeeded, others failed) */
  PARTIAL_SUCCESS = 'partial_success',
}

/**
 * Resource types for audit subject identification
 *
 * Defines the type of resource being acted upon in an audit event.
 *
 * @example
 * ```typescript
 * const subject: EventSubject = {
 *   resource_type: ResourceType.PROJECT,
 *   resource_id: 'proj_123',
 *   organization_id: 'org_abc',
 * };
 * ```
 */
export enum ResourceType {
  /** Organization entity */
  ORGANIZATION = 'organization',
  /** User entity */
  USER = 'user',
  /** Organization member entity */
  MEMBER = 'member',
  /** Project entity */
  PROJECT = 'project',
  /** Run entity */
  RUN = 'run',
  /** Step entity */
  STEP = 'step',
  /** Artifact entity */
  ARTIFACT = 'artifact',
  /** Workspace entity */
  WORKSPACE = 'workspace',
  /** Subscription entity */
  SUBSCRIPTION = 'subscription',
  /** Invitation entity */
  INVITATION = 'invitation',
  /** API token entity */
  TOKEN = 'token',
  /** System configuration entity */
  SYSTEM_CONFIG = 'system_config',
  /** Audit log entity */
  AUDIT_LOG = 'audit_log',
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Actor information - who performed the action
 *
 * An actor can be a user, system component, or API client.
 * At least one of user_id or system_component must be present.
 *
 * @example
 * ```typescript
 * // User actor
 * const userActor: EventActor = {
 *   user_id: 'user_123',
 *   session_id: 'sess_xyz',
 *   system_component: undefined,
 * };
 *
 * // System actor
 * const systemActor: EventActor = {
 *   user_id: undefined,
 *   session_id: undefined,
 *   system_component: 'cron_job_retention_policy',
 * };
 * ```
 */
export interface EventActor {
  /** User identifier if action performed by user */
  readonly user_id?: string | null;
  /** Session identifier for tracking user sessions */
  readonly session_id?: string | null;
  /** System component name if action performed by system */
  readonly system_component?: string | null;
  /** API client ID if action performed via API */
  readonly api_client_id?: string | null;
  /** Additional actor metadata */
  readonly metadata?: JsonValue;
}

/**
 * Subject information - what was acted upon
 *
 * Identifies the resource(s) affected by the audited action.
 * All events must have a subject with at least resource_type.
 *
 * @example
 * ```typescript
 * const subject: EventSubject = {
 *   resource_type: ResourceType.RUN,
 *   resource_id: 'run_456',
 *   organization_id: 'org_abc',
 *   project_id: 'proj_123',
 * };
 * ```
 */
export interface EventSubject {
  /** Type of resource being acted upon */
  readonly resource_type: ResourceType;
  /** Resource identifier */
  readonly resource_id?: string | null;
  /** Organization context for multi-tenancy */
  readonly organization_id?: string | null;
  /** Project context if applicable */
  readonly project_id?: string | null;
  /** Parent resource ID for nested resources */
  readonly parent_id?: string | null;
  /** Additional subject metadata */
  readonly metadata?: JsonValue;
}

/**
 * Event context - environmental information
 *
 * Captures contextual information about the environment where the event occurred.
 * Useful for security analysis, debugging, and compliance reporting.
 *
 * @example
 * ```typescript
 * const context: EventContext = {
 *   ip_address: '192.168.1.100',
 *   user_agent: 'Mozilla/5.0...',
 *   geo_location: { country: 'US', region: 'CA' },
 *   request_id: 'req_xyz789',
 * };
 * ```
 */
export interface EventContext {
  /** Client IP address (anonymized for privacy if required) */
  readonly ip_address?: string | null;
  /** Client user agent string */
  readonly user_agent?: string | null;
  /** Geographic location information */
  readonly geo_location?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
  } | null;
  /** Request/correlation ID for distributed tracing */
  readonly request_id?: string | null;
  /** HTTP method if applicable (GET, POST, etc.) */
  readonly http_method?: string | null;
  /** HTTP status code if applicable */
  readonly http_status?: number | null;
  /** Endpoint/URL path if applicable */
  readonly endpoint?: string | null;
  /** Additional contextual metadata */
  readonly metadata?: JsonValue;
}

/**
 * Change record - before/after values for audit trail
 *
 * Records what changed during the event for compliance and rollback purposes.
 * Generic type T represents the shape of the data being changed.
 *
 * @example
 * ```typescript
 * const changes: ChangeRecord<{ role: OrganizationRole }> = {
 *   field: 'role',
 *   old_value: OrganizationRole.MEMBER,
 *   new_value: OrganizationRole.ADMIN,
 * };
 * ```
 */
export interface ChangeRecord<T = JsonValue> {
  /** Field or property that changed */
  readonly field: string;
  /** Value before the change */
  readonly old_value?: T | null;
  /** Value after the change */
  readonly new_value?: T | null;
}

/**
 * Error details for failed events
 *
 * Captures error information when an event outcome is FAILURE or PARTIAL_SUCCESS.
 *
 * @example
 * ```typescript
 * const error: EventErrorDetails = {
 *   error_code: 'PERMISSION_DENIED',
 *   error_message: 'User lacks required permission: org:delete',
 *   error_stack: 'Error: Permission denied\n  at...',
 * };
 * ```
 */
export interface EventErrorDetails {
  /** Error code for categorization */
  readonly error_code?: string | null;
  /** Human-readable error message */
  readonly error_message?: string | null;
  /** Error stack trace (sanitized for security) */
  readonly error_stack?: string | null;
  /** Additional error metadata */
  readonly metadata?: JsonValue;
}

// ============================================================================
// Base Audit Event
// ============================================================================

/**
 * Base audit event structure
 *
 * All specific event types extend this base interface.
 * Provides common fields required for all audit events.
 *
 * @example
 * ```typescript
 * const baseEvent: BaseAuditEvent = {
 *   id: 'evt_123',
 *   timestamp: '2025-10-13T12:00:00.000Z',
 *   event_type: 'auth.login.success',
 *   category: EventCategory.AUTHENTICATION,
 *   severity: EventSeverity.INFO,
 *   actor: { user_id: 'user_123' },
 *   subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
 *   context: { ip_address: '192.168.1.100' },
 *   outcome: EventOutcome.SUCCESS,
 * };
 * ```
 */
export interface BaseAuditEvent {
  /** Unique event identifier */
  readonly id: string;
  /** Event timestamp (ISO 8601) */
  readonly timestamp: string;
  /** Specific event type (e.g., 'auth.login.success') */
  readonly event_type: string;
  /** Event category for classification */
  readonly category: EventCategory;
  /** Event severity level */
  readonly severity: EventSeverity;
  /** Who performed the action */
  readonly actor: EventActor;
  /** What was acted upon */
  readonly subject: EventSubject;
  /** Environmental context */
  readonly context?: EventContext;
  /** Action outcome */
  readonly outcome: EventOutcome;
  /** Error details if outcome is failure */
  readonly error_details?: EventErrorDetails;
  /** Event-specific payload data */
  readonly payload?: JsonValue;
  /** Additional event metadata */
  readonly metadata?: JsonValue;
}

// ============================================================================
// Authentication Events
// ============================================================================

/**
 * Authentication login success event
 *
 * Records successful user authentication.
 *
 * @example
 * ```typescript
 * const event: AuthLoginSuccessEvent = {
 *   category: EventCategory.AUTHENTICATION,
 *   event_type: 'auth.login.success',
 *   severity: EventSeverity.INFO,
 *   outcome: EventOutcome.SUCCESS,
 *   payload: {
 *     auth_method: 'password',
 *     mfa_used: true,
 *   },
 *   // ... base fields
 * };
 * ```
 */
export interface AuthLoginSuccessEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.login.success';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly auth_method?: 'password' | 'oauth' | 'sso' | 'token' | 'api_key';
    readonly mfa_used?: boolean;
    readonly mfa_method?: 'totp' | 'sms' | 'email' | 'backup_code';
    readonly device_fingerprint?: string;
  };
}

/**
 * Authentication login failure event
 *
 * Records failed authentication attempts for security monitoring.
 *
 * @example
 * ```typescript
 * const event: AuthLoginFailureEvent = {
 *   category: EventCategory.AUTHENTICATION,
 *   event_type: 'auth.login.failure',
 *   severity: EventSeverity.WARNING,
 *   outcome: EventOutcome.FAILURE,
 *   error_details: {
 *     error_code: 'INVALID_CREDENTIALS',
 *     error_message: 'Invalid username or password',
 *   },
 *   payload: {
 *     failure_reason: 'invalid_credentials',
 *     attempts_count: 3,
 *   },
 *   // ... base fields
 * };
 * ```
 */
export interface AuthLoginFailureEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.login.failure';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.FAILURE;
  readonly error_details: EventErrorDetails;
  readonly payload?: {
    readonly failure_reason?: 'invalid_credentials' | 'account_locked' | 'mfa_failed' | 'account_disabled' | 'unknown';
    readonly attempts_count?: number;
    readonly lockout_until?: string;
  };
}

/**
 * Authentication logout event
 *
 * Records user logout or session termination.
 */
export interface AuthLogoutEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.logout';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly logout_type?: 'user_initiated' | 'session_expired' | 'forced' | 'security_policy';
    readonly session_duration_seconds?: number;
  };
}

/**
 * Authentication token created event
 *
 * Records creation of API tokens, access tokens, or refresh tokens.
 */
export interface AuthTokenCreatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.token.created';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly token_type?: 'api_key' | 'access_token' | 'refresh_token' | 'personal_access_token';
    readonly token_name?: string;
    readonly expires_at?: string;
    readonly scopes?: string[];
  };
}

/**
 * Authentication token revoked event
 *
 * Records revocation of tokens for security purposes.
 */
export interface AuthTokenRevokedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.token.revoked';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly token_type?: 'api_key' | 'access_token' | 'refresh_token' | 'personal_access_token';
    readonly token_name?: string;
    readonly revocation_reason?: 'user_requested' | 'security_breach' | 'expired' | 'policy_violation';
  };
}

/**
 * MFA enabled event
 *
 * Records when multi-factor authentication is enabled for a user.
 */
export interface AuthMfaEnabledEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.mfa.enabled';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly mfa_method?: 'totp' | 'sms' | 'email' | 'hardware_key';
    readonly backup_codes_generated?: number;
  };
}

/**
 * MFA disabled event
 *
 * Records when multi-factor authentication is disabled (security concern).
 */
export interface AuthMfaDisabledEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.mfa.disabled';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly mfa_method?: 'totp' | 'sms' | 'email' | 'hardware_key';
    readonly reason?: string;
  };
}

/**
 * Password changed event
 *
 * Records password changes for security auditing.
 */
export interface AuthPasswordChangedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.password.changed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly change_type?: 'user_initiated' | 'forced_reset' | 'expired';
    readonly password_strength?: 'weak' | 'medium' | 'strong';
  };
}

/**
 * Password reset event
 *
 * Records password reset requests and completions.
 */
export interface AuthPasswordResetEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.password.reset';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly reset_method?: 'email_link' | 'security_questions' | 'admin_forced';
    readonly email_address?: string;
  };
}

/**
 * Session expired event
 *
 * Records automatic session expiration.
 */
export interface AuthSessionExpiredEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHENTICATION;
  readonly event_type: 'auth.session.expired';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly session_duration_seconds?: number;
    readonly expiration_reason?: 'timeout' | 'inactivity' | 'policy' | 'security';
  };
}

// ============================================================================
// Authorization Events
// ============================================================================

/**
 * Permission granted event
 *
 * Records when a user is granted a specific permission.
 */
export interface AuthzPermissionGrantedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHORIZATION;
  readonly event_type: 'authz.permission.granted';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly permission?: OrganizationPermission;
    readonly granted_by?: string;
    readonly reason?: string;
  };
}

/**
 * Permission denied event
 *
 * Records access denial for security and compliance auditing.
 */
export interface AuthzPermissionDeniedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHORIZATION;
  readonly event_type: 'authz.permission.denied';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.FAILURE;
  readonly error_details: EventErrorDetails;
  readonly payload?: {
    readonly required_permission?: OrganizationPermission;
    readonly user_role?: OrganizationRole;
    readonly denial_reason?: string;
  };
}

/**
 * Role assigned event
 *
 * Records when a user is assigned a new role.
 */
export interface AuthzRoleAssignedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHORIZATION;
  readonly event_type: 'authz.role.assigned';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord<OrganizationRole>[];
  readonly payload?: {
    readonly old_role?: OrganizationRole;
    readonly new_role?: OrganizationRole;
    readonly assigned_by?: string;
    readonly reason?: string;
  };
}

/**
 * Role removed event
 *
 * Records when a role is removed from a user.
 */
export interface AuthzRoleRemovedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHORIZATION;
  readonly event_type: 'authz.role.removed';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly role?: OrganizationRole;
    readonly removed_by?: string;
    readonly reason?: string;
  };
}

/**
 * Access denied event
 *
 * Records unauthorized access attempts for security monitoring.
 */
export interface AuthzAccessDeniedEvent extends BaseAuditEvent {
  readonly category: EventCategory.AUTHORIZATION;
  readonly event_type: 'authz.access.denied';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.FAILURE;
  readonly error_details: EventErrorDetails;
  readonly payload?: {
    readonly attempted_action?: string;
    readonly denial_reason?: 'insufficient_permissions' | 'resource_not_found' | 'organization_mismatch' | 'suspended_account';
  };
}

// ============================================================================
// Organization Events
// ============================================================================

/**
 * Organization created event
 *
 * Records new organization creation.
 */
export interface OrgCreatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ORGANIZATION;
  readonly event_type: 'org.created';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly org_name?: string;
    readonly org_slug?: string;
    readonly subscription_plan?: string;
  };
}

/**
 * Organization updated event
 *
 * Records organization settings or metadata changes.
 */
export interface OrgUpdatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ORGANIZATION;
  readonly event_type: 'org.updated';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord[];
  readonly payload?: {
    readonly updated_fields?: string[];
  };
}

/**
 * Organization deleted event
 *
 * Records organization deletion (critical audit event).
 */
export interface OrgDeletedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ORGANIZATION;
  readonly event_type: 'org.deleted';
  readonly severity: EventSeverity.CRITICAL;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly org_name?: string;
    readonly org_slug?: string;
    readonly deletion_reason?: string;
    readonly data_retention_days?: number;
  };
}

/**
 * Organization settings changed event
 *
 * Records changes to organization configuration.
 */
export interface OrgSettingsChangedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ORGANIZATION;
  readonly event_type: 'org.settings.changed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord[];
  readonly payload?: {
    readonly settings_changed?: string[];
  };
}

/**
 * Organization subscription changed event
 *
 * Records subscription plan changes.
 */
export interface OrgSubscriptionChangedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ORGANIZATION;
  readonly event_type: 'org.subscription.changed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord<string>[];
  readonly payload?: {
    readonly old_plan?: string;
    readonly new_plan?: string;
    readonly change_reason?: 'upgrade' | 'downgrade' | 'trial_ended' | 'cancellation';
    readonly effective_date?: string;
  };
}

// ============================================================================
// Member Events
// ============================================================================

/**
 * Member invited event
 *
 * Records when a user is invited to join an organization.
 */
export interface MemberInvitedEvent extends BaseAuditEvent {
  readonly category: EventCategory.MEMBER;
  readonly event_type: 'member.invited';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly invitee_email?: string;
    readonly role?: OrganizationRole;
    readonly invitation_expires_at?: string;
  };
}

/**
 * Member added event
 *
 * Records when a new member joins an organization.
 */
export interface MemberAddedEvent extends BaseAuditEvent {
  readonly category: EventCategory.MEMBER;
  readonly event_type: 'member.added';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly member_id?: string;
    readonly role?: OrganizationRole;
    readonly join_method?: 'invitation' | 'admin_added' | 'auto_join';
  };
}

/**
 * Member removed event
 *
 * Records when a member is removed from an organization.
 */
export interface MemberRemovedEvent extends BaseAuditEvent {
  readonly category: EventCategory.MEMBER;
  readonly event_type: 'member.removed';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly member_id?: string;
    readonly role?: OrganizationRole;
    readonly removal_reason?: 'left_voluntarily' | 'removed_by_admin' | 'account_deleted' | 'policy_violation';
  };
}

/**
 * Member role changed event
 *
 * Records role changes for organization members.
 */
export interface MemberRoleChangedEvent extends BaseAuditEvent {
  readonly category: EventCategory.MEMBER;
  readonly event_type: 'member.role.changed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord<OrganizationRole>[];
  readonly payload?: {
    readonly member_id?: string;
    readonly old_role?: OrganizationRole;
    readonly new_role?: OrganizationRole;
    readonly changed_by?: string;
  };
}

/**
 * Member permissions changed event
 *
 * Records granular permission changes for members.
 */
export interface MemberPermissionsChangedEvent extends BaseAuditEvent {
  readonly category: EventCategory.MEMBER;
  readonly event_type: 'member.permissions.changed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord<readonly OrganizationPermission[]>[];
  readonly payload?: {
    readonly member_id?: string;
    readonly permissions_added?: OrganizationPermission[];
    readonly permissions_removed?: OrganizationPermission[];
  };
}

// ============================================================================
// Project Events
// ============================================================================

/**
 * Project created event
 *
 * Records new project creation.
 */
export interface ProjectCreatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.PROJECT;
  readonly event_type: 'project.created';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly project_name?: string;
    readonly project_id?: string;
    readonly repo_url?: string;
    readonly workspace_mode?: 'local_path' | 'clone' | 'worktree';
  };
}

/**
 * Project updated event
 *
 * Records project configuration changes.
 */
export interface ProjectUpdatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.PROJECT;
  readonly event_type: 'project.updated';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord[];
  readonly payload?: {
    readonly project_id?: string;
    readonly updated_fields?: string[];
  };
}

/**
 * Project deleted event
 *
 * Records project deletion.
 */
export interface ProjectDeletedEvent extends BaseAuditEvent {
  readonly category: EventCategory.PROJECT;
  readonly event_type: 'project.deleted';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly project_id?: string;
    readonly project_name?: string;
    readonly deletion_reason?: string;
  };
}

/**
 * Project cloned event
 *
 * Records repository cloning operations.
 */
export interface ProjectClonedEvent extends BaseAuditEvent {
  readonly category: EventCategory.PROJECT;
  readonly event_type: 'project.cloned';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly project_id?: string;
    readonly repo_url?: string;
    readonly clone_depth?: number;
    readonly branch?: string;
  };
}

/**
 * Project initialized event
 *
 * Records project initialization completion.
 */
export interface ProjectInitializedEvent extends BaseAuditEvent {
  readonly category: EventCategory.PROJECT;
  readonly event_type: 'project.initialized';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly project_id?: string;
    readonly initialization_time_ms?: number;
  };
}

// ============================================================================
// Run Events
// ============================================================================

/**
 * Run created event
 *
 * Records creation of a new run.
 */
export interface RunCreatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.RUN;
  readonly event_type: 'run.created';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly run_id?: string;
    readonly project_id?: string;
    readonly plan_hash?: string;
    readonly steps_count?: number;
  };
}

/**
 * Run started event
 *
 * Records run execution start.
 */
export interface RunStartedEvent extends BaseAuditEvent {
  readonly category: EventCategory.RUN;
  readonly event_type: 'run.started';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly run_id?: string;
    readonly project_id?: string;
  };
}

/**
 * Run completed event
 *
 * Records successful run completion.
 */
export interface RunCompletedEvent extends BaseAuditEvent {
  readonly category: EventCategory.RUN;
  readonly event_type: 'run.completed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly run_id?: string;
    readonly project_id?: string;
    readonly duration_ms?: number;
    readonly steps_succeeded?: number;
    readonly artifacts_created?: number;
  };
}

/**
 * Run failed event
 *
 * Records run failures for debugging and monitoring.
 */
export interface RunFailedEvent extends BaseAuditEvent {
  readonly category: EventCategory.RUN;
  readonly event_type: 'run.failed';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.FAILURE;
  readonly error_details: EventErrorDetails;
  readonly payload?: {
    readonly run_id?: string;
    readonly project_id?: string;
    readonly duration_ms?: number;
    readonly failed_step_id?: string;
    readonly failure_reason?: string;
  };
}

/**
 * Run cancelled event
 *
 * Records run cancellation.
 */
export interface RunCancelledEvent extends BaseAuditEvent {
  readonly category: EventCategory.RUN;
  readonly event_type: 'run.cancelled';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly run_id?: string;
    readonly project_id?: string;
    readonly cancelled_by?: string;
    readonly cancellation_reason?: string;
  };
}

// ============================================================================
// Artifact Events
// ============================================================================

/**
 * Artifact created event
 *
 * Records artifact creation/upload.
 */
export interface ArtifactCreatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ARTIFACT;
  readonly event_type: 'artifact.created';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly artifact_id?: string;
    readonly artifact_type?: string;
    readonly size_bytes?: number;
    readonly mime_type?: string;
    readonly run_id?: string;
    readonly step_id?: string;
  };
}

/**
 * Artifact read event
 *
 * Records artifact access for compliance.
 */
export interface ArtifactReadEvent extends BaseAuditEvent {
  readonly category: EventCategory.ARTIFACT;
  readonly event_type: 'artifact.read';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly artifact_id?: string;
    readonly artifact_type?: string;
    readonly access_method?: 'view' | 'download' | 'api';
  };
}

/**
 * Artifact downloaded event
 *
 * Records artifact downloads.
 */
export interface ArtifactDownloadedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ARTIFACT;
  readonly event_type: 'artifact.downloaded';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly artifact_id?: string;
    readonly artifact_type?: string;
    readonly size_bytes?: number;
    readonly download_method?: 'direct' | 'api' | 'cli';
  };
}

/**
 * Artifact deleted event
 *
 * Records artifact deletion (compliance requirement).
 */
export interface ArtifactDeletedEvent extends BaseAuditEvent {
  readonly category: EventCategory.ARTIFACT;
  readonly event_type: 'artifact.deleted';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly artifact_id?: string;
    readonly artifact_type?: string;
    readonly deletion_reason?: 'user_requested' | 'retention_policy' | 'quota_exceeded' | 'project_deleted';
  };
}

// ============================================================================
// Workspace Events
// ============================================================================

/**
 * Workspace created event
 *
 * Records workspace creation.
 */
export interface WorkspaceCreatedEvent extends BaseAuditEvent {
  readonly category: EventCategory.WORKSPACE;
  readonly event_type: 'workspace.created';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly workspace_id?: string;
    readonly project_id?: string;
    readonly isolation_level?: string;
  };
}

/**
 * Workspace accessed event
 *
 * Records workspace access for security monitoring.
 */
export interface WorkspaceAccessedEvent extends BaseAuditEvent {
  readonly category: EventCategory.WORKSPACE;
  readonly event_type: 'workspace.accessed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly workspace_id?: string;
    readonly access_type?: 'read' | 'write' | 'execute';
  };
}

/**
 * Workspace modified event
 *
 * Records workspace configuration changes.
 */
export interface WorkspaceModifiedEvent extends BaseAuditEvent {
  readonly category: EventCategory.WORKSPACE;
  readonly event_type: 'workspace.modified';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord[];
  readonly payload?: {
    readonly workspace_id?: string;
    readonly modified_fields?: string[];
  };
}

/**
 * Workspace deleted event
 *
 * Records workspace deletion.
 */
export interface WorkspaceDeletedEvent extends BaseAuditEvent {
  readonly category: EventCategory.WORKSPACE;
  readonly event_type: 'workspace.deleted';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly workspace_id?: string;
    readonly deletion_reason?: string;
  };
}

// ============================================================================
// Billing Events
// ============================================================================

/**
 * Subscription changed event
 *
 * Records billing plan changes.
 */
export interface BillingSubscriptionChangedEvent extends BaseAuditEvent {
  readonly category: EventCategory.BILLING;
  readonly event_type: 'billing.subscription.changed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord<string>[];
  readonly payload?: {
    readonly old_plan?: string;
    readonly new_plan?: string;
    readonly change_type?: 'upgrade' | 'downgrade' | 'cancellation';
    readonly effective_date?: string;
    readonly stripe_subscription_id?: string;
  };
}

/**
 * Payment processed event
 *
 * Records payment transactions.
 */
export interface BillingPaymentProcessedEvent extends BaseAuditEvent {
  readonly category: EventCategory.BILLING;
  readonly event_type: 'billing.payment.processed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly amount_cents?: number;
    readonly currency?: string;
    readonly payment_method?: string;
    readonly stripe_payment_id?: string;
    readonly invoice_id?: string;
  };
}

/**
 * Quota exceeded event
 *
 * Records quota violations.
 */
export interface BillingQuotaExceededEvent extends BaseAuditEvent {
  readonly category: EventCategory.BILLING;
  readonly event_type: 'billing.quota.exceeded';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.FAILURE;
  readonly error_details: EventErrorDetails;
  readonly payload?: {
    readonly quota_type?: string;
    readonly quota_limit?: number;
    readonly current_usage?: number;
    readonly action_blocked?: string;
  };
}

// ============================================================================
// Security Events
// ============================================================================

/**
 * Suspicious activity event
 *
 * Records detected suspicious behavior.
 */
export interface SecuritySuspiciousActivityEvent extends BaseAuditEvent {
  readonly category: EventCategory.SECURITY;
  readonly event_type: 'security.suspicious_activity';
  readonly severity: EventSeverity.CRITICAL;
  readonly outcome: EventOutcome.FAILURE;
  readonly payload?: {
    readonly activity_type?: 'multiple_failed_logins' | 'unusual_access_pattern' | 'privilege_escalation' | 'data_exfiltration';
    readonly risk_score?: number;
    readonly automated_action?: 'account_locked' | 'ip_blocked' | 'session_terminated' | 'admin_notified';
  };
}

/**
 * Rate limit exceeded event
 *
 * Records rate limit violations.
 */
export interface SecurityRateLimitExceededEvent extends BaseAuditEvent {
  readonly category: EventCategory.SECURITY;
  readonly event_type: 'security.rate_limit.exceeded';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.FAILURE;
  readonly error_details: EventErrorDetails;
  readonly payload?: {
    readonly limit_type?: 'api_calls' | 'login_attempts' | 'requests_per_minute';
    readonly limit_value?: number;
    readonly current_count?: number;
    readonly window_seconds?: number;
  };
}

/**
 * IP blocked event
 *
 * Records IP address blocking for security.
 */
export interface SecurityIpBlockedEvent extends BaseAuditEvent {
  readonly category: EventCategory.SECURITY;
  readonly event_type: 'security.ip.blocked';
  readonly severity: EventSeverity.CRITICAL;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly blocked_ip?: string;
    readonly block_reason?: 'rate_limit' | 'suspicious_activity' | 'brute_force' | 'manual';
    readonly block_duration_seconds?: number;
    readonly expires_at?: string;
  };
}

/**
 * Brute force detected event
 *
 * Records detected brute force attacks.
 */
export interface SecurityBruteForceDetectedEvent extends BaseAuditEvent {
  readonly category: EventCategory.SECURITY;
  readonly event_type: 'security.brute_force.detected';
  readonly severity: EventSeverity.CRITICAL;
  readonly outcome: EventOutcome.FAILURE;
  readonly payload?: {
    readonly target_type?: 'login' | 'api' | 'password_reset';
    readonly attempts_count?: number;
    readonly time_window_seconds?: number;
    readonly automated_action?: 'ip_blocked' | 'account_locked' | 'captcha_required';
  };
}

/**
 * Unauthorized access attempted event
 *
 * Records unauthorized access attempts.
 */
export interface SecurityUnauthorizedAccessAttemptedEvent extends BaseAuditEvent {
  readonly category: EventCategory.SECURITY;
  readonly event_type: 'security.unauthorized_access.attempted';
  readonly severity: EventSeverity.CRITICAL;
  readonly outcome: EventOutcome.FAILURE;
  readonly error_details: EventErrorDetails;
  readonly payload?: {
    readonly attempted_resource?: string;
    readonly attempted_action?: string;
    readonly user_role?: OrganizationRole;
    readonly required_permission?: OrganizationPermission;
  };
}

// ============================================================================
// System Events
// ============================================================================

/**
 * System health check event
 *
 * Records system health check results.
 */
export interface SystemHealthCheckEvent extends BaseAuditEvent {
  readonly category: EventCategory.SYSTEM;
  readonly event_type: 'system.health_check';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS | EventOutcome.FAILURE;
  readonly payload?: {
    readonly service_name?: string;
    readonly health_status?: 'healthy' | 'degraded' | 'unhealthy';
    readonly response_time_ms?: number;
    readonly checks_performed?: string[];
  };
}

/**
 * System migration event
 *
 * Records database or system migrations.
 */
export interface SystemMigrationEvent extends BaseAuditEvent {
  readonly category: EventCategory.SYSTEM;
  readonly event_type: 'system.migration';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS | EventOutcome.FAILURE;
  readonly payload?: {
    readonly migration_name?: string;
    readonly migration_version?: string;
    readonly duration_ms?: number;
    readonly records_affected?: number;
  };
}

/**
 * System config changed event
 *
 * Records system configuration changes.
 */
export interface SystemConfigChangedEvent extends BaseAuditEvent {
  readonly category: EventCategory.SYSTEM;
  readonly event_type: 'system.config.changed';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly changes?: readonly ChangeRecord[];
  readonly payload?: {
    readonly config_keys?: string[];
    readonly change_reason?: string;
  };
}

// ============================================================================
// Compliance Events
// ============================================================================

/**
 * Data export requested event
 *
 * Records GDPR/compliance data export requests.
 */
export interface ComplianceDataExportRequestedEvent extends BaseAuditEvent {
  readonly category: EventCategory.COMPLIANCE;
  readonly event_type: 'compliance.data_export.requested';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly export_type?: 'gdpr' | 'hipaa' | 'soc2' | 'full';
    readonly data_scope?: string[];
    readonly requested_by?: string;
  };
}

/**
 * Data export completed event
 *
 * Records completion of data export.
 */
export interface ComplianceDataExportCompletedEvent extends BaseAuditEvent {
  readonly category: EventCategory.COMPLIANCE;
  readonly event_type: 'compliance.data_export.completed';
  readonly severity: EventSeverity.INFO;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly export_id?: string;
    readonly export_type?: 'gdpr' | 'hipaa' | 'soc2' | 'full';
    readonly file_size_bytes?: number;
    readonly records_exported?: number;
    readonly duration_ms?: number;
  };
}

/**
 * Retention policy applied event
 *
 * Records automatic data retention/deletion.
 */
export interface ComplianceRetentionPolicyAppliedEvent extends BaseAuditEvent {
  readonly category: EventCategory.COMPLIANCE;
  readonly event_type: 'compliance.retention.policy_applied';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly policy_name?: string;
    readonly resource_type?: ResourceType;
    readonly retention_days?: number;
    readonly records_deleted?: number;
  };
}

/**
 * Audit log accessed event
 *
 * Records access to audit logs (meta-auditing).
 */
export interface ComplianceAuditLogAccessedEvent extends BaseAuditEvent {
  readonly category: EventCategory.COMPLIANCE;
  readonly event_type: 'compliance.audit_log.accessed';
  readonly severity: EventSeverity.WARNING;
  readonly outcome: EventOutcome.SUCCESS;
  readonly payload?: {
    readonly access_reason?: string;
    readonly date_range_start?: string;
    readonly date_range_end?: string;
    readonly records_accessed?: number;
    readonly export_requested?: boolean;
  };
}

// ============================================================================
// Discriminated Union of All Event Types
// ============================================================================

/**
 * Union type of all specific audit events
 *
 * This discriminated union allows type-safe handling of all event types.
 * TypeScript can narrow the type based on the event_type field.
 *
 * @example
 * ```typescript
 * function handleEvent(event: AuditEvent): void {
 *   switch (event.event_type) {
 *     case 'auth.login.success':
 *       // TypeScript knows this is AuthLoginSuccessEvent
 *       console.log('MFA used:', event.payload?.mfa_used);
 *       break;
 *     case 'org.deleted':
 *       // TypeScript knows this is OrgDeletedEvent
 *       console.log('Org deleted:', event.payload?.org_name);
 *       break;
 *     // ... other cases
 *   }
 * }
 * ```
 */
export type AuditEvent =
  // Authentication events
  | AuthLoginSuccessEvent
  | AuthLoginFailureEvent
  | AuthLogoutEvent
  | AuthTokenCreatedEvent
  | AuthTokenRevokedEvent
  | AuthMfaEnabledEvent
  | AuthMfaDisabledEvent
  | AuthPasswordChangedEvent
  | AuthPasswordResetEvent
  | AuthSessionExpiredEvent
  // Authorization events
  | AuthzPermissionGrantedEvent
  | AuthzPermissionDeniedEvent
  | AuthzRoleAssignedEvent
  | AuthzRoleRemovedEvent
  | AuthzAccessDeniedEvent
  // Organization events
  | OrgCreatedEvent
  | OrgUpdatedEvent
  | OrgDeletedEvent
  | OrgSettingsChangedEvent
  | OrgSubscriptionChangedEvent
  // Member events
  | MemberInvitedEvent
  | MemberAddedEvent
  | MemberRemovedEvent
  | MemberRoleChangedEvent
  | MemberPermissionsChangedEvent
  // Project events
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | ProjectDeletedEvent
  | ProjectClonedEvent
  | ProjectInitializedEvent
  // Run events
  | RunCreatedEvent
  | RunStartedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | RunCancelledEvent
  // Artifact events
  | ArtifactCreatedEvent
  | ArtifactReadEvent
  | ArtifactDownloadedEvent
  | ArtifactDeletedEvent
  // Workspace events
  | WorkspaceCreatedEvent
  | WorkspaceAccessedEvent
  | WorkspaceModifiedEvent
  | WorkspaceDeletedEvent
  // Billing events
  | BillingSubscriptionChangedEvent
  | BillingPaymentProcessedEvent
  | BillingQuotaExceededEvent
  // Security events
  | SecuritySuspiciousActivityEvent
  | SecurityRateLimitExceededEvent
  | SecurityIpBlockedEvent
  | SecurityBruteForceDetectedEvent
  | SecurityUnauthorizedAccessAttemptedEvent
  // System events
  | SystemHealthCheckEvent
  | SystemMigrationEvent
  | SystemConfigChangedEvent
  // Compliance events
  | ComplianceDataExportRequestedEvent
  | ComplianceDataExportCompletedEvent
  | ComplianceRetentionPolicyAppliedEvent
  | ComplianceAuditLogAccessedEvent;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid EventCategory
 *
 * @param value - Value to check
 * @returns true if value is a valid EventCategory
 *
 * @example
 * ```typescript
 * if (isEventCategory(input)) {
 *   // input is guaranteed to be EventCategory
 *   processCategory(input);
 * }
 * ```
 */
export function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === 'string' &&
    Object.values(EventCategory).includes(value as EventCategory)
  );
}

/**
 * Type guard to check if a value is a valid EventSeverity
 *
 * @param value - Value to check
 * @returns true if value is a valid EventSeverity
 */
export function isEventSeverity(value: unknown): value is EventSeverity {
  return (
    typeof value === 'string' &&
    Object.values(EventSeverity).includes(value as EventSeverity)
  );
}

/**
 * Type guard to check if a value is a valid EventOutcome
 *
 * @param value - Value to check
 * @returns true if value is a valid EventOutcome
 */
export function isEventOutcome(value: unknown): value is EventOutcome {
  return (
    typeof value === 'string' &&
    Object.values(EventOutcome).includes(value as EventOutcome)
  );
}

/**
 * Type guard to check if a value is a valid ResourceType
 *
 * @param value - Value to check
 * @returns true if value is a valid ResourceType
 */
export function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === 'string' &&
    Object.values(ResourceType).includes(value as ResourceType)
  );
}

/**
 * Type guard to check if an event is an authentication event
 *
 * @param event - Event to check
 * @returns true if event is an authentication event
 *
 * @example
 * ```typescript
 * if (isAuthenticationEvent(event)) {
 *   // event.category is guaranteed to be EventCategory.AUTHENTICATION
 *   handleAuthEvent(event);
 * }
 * ```
 */
export function isAuthenticationEvent(event: AuditEvent): event is Extract<AuditEvent, { category: EventCategory.AUTHENTICATION }> {
  return event.category === EventCategory.AUTHENTICATION;
}

/**
 * Type guard to check if an event is an authorization event
 *
 * @param event - Event to check
 * @returns true if event is an authorization event
 */
export function isAuthorizationEvent(event: AuditEvent): event is Extract<AuditEvent, { category: EventCategory.AUTHORIZATION }> {
  return event.category === EventCategory.AUTHORIZATION;
}

/**
 * Type guard to check if an event is an organization event
 *
 * @param event - Event to check
 * @returns true if event is an organization event
 */
export function isOrganizationEvent(event: AuditEvent): event is Extract<AuditEvent, { category: EventCategory.ORGANIZATION }> {
  return event.category === EventCategory.ORGANIZATION;
}

/**
 * Type guard to check if an event is a security event
 *
 * @param event - Event to check
 * @returns true if event is a security event
 */
export function isSecurityEvent(event: AuditEvent): event is Extract<AuditEvent, { category: EventCategory.SECURITY }> {
  return event.category === EventCategory.SECURITY;
}

/**
 * Type guard to check if an event is a compliance event
 *
 * @param event - Event to check
 * @returns true if event is a compliance event
 */
export function isComplianceEvent(event: AuditEvent): event is Extract<AuditEvent, { category: EventCategory.COMPLIANCE }> {
  return event.category === EventCategory.COMPLIANCE;
}

/**
 * Type guard to check if an event represents a failure
 *
 * @param event - Event to check
 * @returns true if event outcome is FAILURE or PARTIAL_SUCCESS
 *
 * @example
 * ```typescript
 * if (isFailureEvent(event)) {
 *   // event.error_details should be present
 *   logError(event.error_details);
 * }
 * ```
 */
export function isFailureEvent(event: AuditEvent | BaseAuditEvent): boolean {
  return event.outcome === EventOutcome.FAILURE || event.outcome === EventOutcome.PARTIAL_SUCCESS;
}

/**
 * Type guard to check if an event has a successful outcome
 *
 * @param event - Event to check
 * @returns true if event outcome is SUCCESS
 */
export function isSuccessEvent(event: AuditEvent): boolean {
  return event.outcome === EventOutcome.SUCCESS;
}

/**
 * Type guard to check if an event is critical severity
 *
 * @param event - Event to check
 * @returns true if event severity is CRITICAL
 */
export function isCriticalEvent(event: AuditEvent): boolean {
  return event.severity === EventSeverity.CRITICAL;
}

/**
 * Type guard to check if a value is a valid BaseAuditEvent
 *
 * Validates that an object has all required base audit event fields.
 *
 * @param value - Value to check
 * @returns true if value is a valid BaseAuditEvent
 */
export function isAuditEvent(value: unknown): value is BaseAuditEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.id === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.event_type === 'string' &&
    isEventCategory(event.category) &&
    isEventSeverity(event.severity) &&
    typeof event.actor === 'object' &&
    typeof event.subject === 'object' &&
    isEventOutcome(event.outcome)
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract event payload type by event type
 *
 * Utility type to extract the payload type for a specific event type.
 * Useful for type-safe event creation and handling.
 *
 * @example
 * ```typescript
 * type LoginPayload = ExtractEventPayload<'auth.login.success'>;
 * // LoginPayload = AuthLoginSuccessEvent['payload']
 * ```
 */
export type ExtractEventPayload<T extends AuditEvent['event_type']> = Extract<
  AuditEvent,
  { event_type: T }
>['payload'];

/**
 * Extract event type by category
 *
 * Utility type to get all event types for a specific category.
 *
 * @example
 * ```typescript
 * type AuthEvent = ExtractEventByCategory<EventCategory.AUTHENTICATION>;
 * // AuthEvent = AuthLoginSuccessEvent | AuthLoginFailureEvent | ...
 * ```
 */
export type ExtractEventByCategory<C extends EventCategory> = Extract<
  AuditEvent,
  { category: C }
>;

/**
 * Extract event types by severity
 *
 * Utility type to get all event types with a specific severity.
 *
 * @example
 * ```typescript
 * type CriticalEvents = ExtractEventBySeverity<EventSeverity.CRITICAL>;
 * ```
 */
export type ExtractEventBySeverity<S extends EventSeverity> = Extract<
  AuditEvent,
  { severity: S }
>;

/**
 * Event creation input type
 *
 * Utility type for creating events without system-generated fields.
 * Omits id and timestamp which are generated automatically.
 *
 * @example
 * ```typescript
 * const input: CreateAuditEventInput<AuthLoginSuccessEvent> = {
 *   event_type: 'auth.login.success',
 *   category: EventCategory.AUTHENTICATION,
 *   severity: EventSeverity.INFO,
 *   actor: { user_id: 'user_123' },
 *   subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
 *   outcome: EventOutcome.SUCCESS,
 *   payload: { auth_method: 'password', mfa_used: true },
 * };
 * ```
 */
export type CreateAuditEventInput<T extends AuditEvent> = Omit<T, 'id' | 'timestamp'>;

/**
 * Event filter criteria
 *
 * Type-safe filter options for querying audit events.
 *
 * @example
 * ```typescript
 * const filter: AuditEventFilter = {
 *   categories: [EventCategory.SECURITY, EventCategory.AUTHENTICATION],
 *   severity: EventSeverity.CRITICAL,
 *   date_from: '2025-10-01T00:00:00Z',
 *   date_to: '2025-10-13T23:59:59Z',
 *   organization_id: 'org_abc',
 * };
 * ```
 */
export interface AuditEventFilter {
  /** Filter by event categories */
  readonly categories?: readonly EventCategory[];
  /** Filter by severity level */
  readonly severity?: EventSeverity;
  /** Filter by minimum severity (includes higher severities) */
  readonly min_severity?: EventSeverity;
  /** Filter by outcome */
  readonly outcome?: EventOutcome;
  /** Filter by specific event types */
  readonly event_types?: readonly string[];
  /** Filter by organization ID */
  readonly organization_id?: string;
  /** Filter by user ID (actor) */
  readonly user_id?: string;
  /** Filter by resource type */
  readonly resource_type?: ResourceType;
  /** Filter by resource ID */
  readonly resource_id?: string;
  /** Filter by date range start (ISO 8601) */
  readonly date_from?: string;
  /** Filter by date range end (ISO 8601) */
  readonly date_to?: string;
  /** Limit number of results */
  readonly limit?: number;
  /** Offset for pagination */
  readonly offset?: number;
  /** Sort order */
  readonly sort?: 'asc' | 'desc';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a type-safe audit event with auto-generated fields
 *
 * Helper function to create audit events with automatic ID and timestamp generation.
 *
 * @param input - Event data without id and timestamp
 * @returns Complete audit event with generated fields
 *
 * @example
 * ```typescript
 * const event = createAuditEvent({
 *   event_type: 'auth.login.success',
 *   category: EventCategory.AUTHENTICATION,
 *   severity: EventSeverity.INFO,
 *   actor: { user_id: 'user_123' },
 *   subject: { resource_type: ResourceType.USER, resource_id: 'user_123' },
 *   outcome: EventOutcome.SUCCESS,
 * });
 * ```
 */
export function createAuditEvent<T extends AuditEvent>(
  input: CreateAuditEventInput<T>
): T {
  return {
    ...input,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
    timestamp: new Date().toISOString(),
  } as T;
}

/**
 * Get event category display name
 *
 * Returns human-readable name for event category.
 *
 * @param category - Event category
 * @returns Human-readable category name
 */
export function getEventCategoryDisplayName(category: EventCategory): string {
  const displayNames: Record<EventCategory, string> = {
    [EventCategory.AUTHENTICATION]: 'Authentication',
    [EventCategory.AUTHORIZATION]: 'Authorization',
    [EventCategory.ORGANIZATION]: 'Organization',
    [EventCategory.MEMBER]: 'Member Management',
    [EventCategory.PROJECT]: 'Project',
    [EventCategory.RUN]: 'Run Execution',
    [EventCategory.ARTIFACT]: 'Artifact',
    [EventCategory.WORKSPACE]: 'Workspace',
    [EventCategory.BILLING]: 'Billing',
    [EventCategory.SECURITY]: 'Security',
    [EventCategory.SYSTEM]: 'System',
    [EventCategory.COMPLIANCE]: 'Compliance',
  };

  return displayNames[category];
}

/**
 * Get severity level numeric value for comparison
 *
 * Returns numeric severity level for comparison operations.
 * Higher numbers indicate higher severity.
 *
 * @param severity - Event severity
 * @returns Numeric severity level (1-3)
 *
 * @example
 * ```typescript
 * if (getSeverityLevel(event.severity) >= getSeverityLevel(EventSeverity.WARNING)) {
 *   sendAlert(event);
 * }
 * ```
 */
export function getSeverityLevel(severity: EventSeverity): number {
  const levels: Record<EventSeverity, number> = {
    [EventSeverity.INFO]: 1,
    [EventSeverity.WARNING]: 2,
    [EventSeverity.CRITICAL]: 3,
  };

  return levels[severity];
}

/**
 * Check if event matches filter criteria
 *
 * Helper function to filter events based on criteria.
 *
 * @param event - Event to check
 * @param filter - Filter criteria
 * @returns true if event matches all filter criteria
 *
 * @example
 * ```typescript
 * const events = allEvents.filter(event => matchesFilter(event, {
 *   categories: [EventCategory.SECURITY],
 *   severity: EventSeverity.CRITICAL,
 * }));
 * ```
 */
export function matchesFilter(event: AuditEvent, filter: AuditEventFilter): boolean {
  if (filter.categories && !filter.categories.includes(event.category)) {
    return false;
  }

  if (filter.severity && event.severity !== filter.severity) {
    return false;
  }

  if (filter.min_severity && getSeverityLevel(event.severity) < getSeverityLevel(filter.min_severity)) {
    return false;
  }

  if (filter.outcome && event.outcome !== filter.outcome) {
    return false;
  }

  if (filter.event_types && !filter.event_types.includes(event.event_type)) {
    return false;
  }

  if (filter.organization_id && event.subject.organization_id !== filter.organization_id) {
    return false;
  }

  if (filter.user_id && event.actor.user_id !== filter.user_id) {
    return false;
  }

  if (filter.resource_type && event.subject.resource_type !== filter.resource_type) {
    return false;
  }

  if (filter.resource_id && event.subject.resource_id !== filter.resource_id) {
    return false;
  }

  if (filter.date_from && event.timestamp < filter.date_from) {
    return false;
  }

  if (filter.date_to && event.timestamp > filter.date_to) {
    return false;
  }

  return true;
}

/**
 * Format event for human-readable display
 *
 * Creates a human-readable description of the event.
 *
 * @param event - Event to format
 * @returns Human-readable event description
 *
 * @example
 * ```typescript
 * const description = formatEventDescription(event);
 * // "User user_123 successfully logged in with MFA enabled"
 * ```
 */
export function formatEventDescription(event: AuditEvent): string {
  const actor = event.actor.user_id || event.actor.system_component || 'Unknown';
  const resource = event.subject.resource_id || event.subject.resource_type;
  const outcome = event.outcome === EventOutcome.SUCCESS ? 'successfully' : 'failed to';

  return `${actor} ${outcome} ${event.event_type.replace(/\./g, ' ')} for ${resource}`;
}
