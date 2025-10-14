/**
 * Audit Module - Complete Audit Logging System
 *
 * Provides comprehensive audit logging for SOC2, GDPR, and HIPAA compliance.
 *
 * @module audit
 *
 * @example
 * ```typescript
 * import { createAuditService, createDatabaseAuditStorage, EventCategory, EventSeverity, EventOutcome } from './audit';
 *
 * // Create storage adapter
 * const storage = createDatabaseAuditStorage({
 *   type: 'postgresql',
 *   connectionString: process.env.DATABASE_URL!,
 * });
 *
 * // Create audit service
 * const auditService = createAuditService({
 *   storage,
 *   bufferSize: 100,
 *   flushIntervalMs: 5000,
 * });
 *
 * // Log an event
 * await auditService.log({
 *   event_type: 'auth.login.success',
 *   category: EventCategory.AUTHENTICATION,
 *   severity: EventSeverity.INFO,
 *   actor: { user_id: 'user_123' },
 *   subject: { resource_type: 'user', resource_id: 'user_123' },
 *   outcome: EventOutcome.SUCCESS,
 * });
 * ```
 */

// Export all types
export type {
  // Core event types
  AuditEvent,
  BaseAuditEvent,
  CreateAuditEventInput,

  // Enums
  EventCategory,
  EventSeverity,
  EventOutcome,
  ResourceType,

  // Core interfaces
  EventActor,
  EventSubject,
  EventContext,
  ChangeRecord,
  EventErrorDetails,

  // Filter and utilities
  AuditEventFilter,
  ExtractEventPayload,
  ExtractEventByCategory,
  ExtractEventBySeverity,

  // Specific event types
  AuthLoginSuccessEvent,
  AuthLoginFailureEvent,
  AuthLogoutEvent,
  AuthTokenCreatedEvent,
  AuthTokenRevokedEvent,
  AuthMfaEnabledEvent,
  AuthMfaDisabledEvent,
  AuthPasswordChangedEvent,
  AuthPasswordResetEvent,
  AuthSessionExpiredEvent,

  AuthzPermissionGrantedEvent,
  AuthzPermissionDeniedEvent,
  AuthzRoleAssignedEvent,
  AuthzRoleRemovedEvent,
  AuthzAccessDeniedEvent,

  OrgCreatedEvent,
  OrgUpdatedEvent,
  OrgDeletedEvent,
  OrgSettingsChangedEvent,
  OrgSubscriptionChangedEvent,

  MemberInvitedEvent,
  MemberAddedEvent,
  MemberRemovedEvent,
  MemberRoleChangedEvent,
  MemberPermissionsChangedEvent,

  ProjectCreatedEvent,
  ProjectUpdatedEvent,
  ProjectDeletedEvent,
  ProjectClonedEvent,
  ProjectInitializedEvent,

  RunCreatedEvent,
  RunStartedEvent,
  RunCompletedEvent,
  RunFailedEvent,
  RunCancelledEvent,

  ArtifactCreatedEvent,
  ArtifactReadEvent,
  ArtifactDownloadedEvent,
  ArtifactDeletedEvent,

  WorkspaceCreatedEvent,
  WorkspaceAccessedEvent,
  WorkspaceModifiedEvent,
  WorkspaceDeletedEvent,

  BillingSubscriptionChangedEvent,
  BillingPaymentProcessedEvent,
  BillingQuotaExceededEvent,

  SecuritySuspiciousActivityEvent,
  SecurityRateLimitExceededEvent,
  SecurityIpBlockedEvent,
  SecurityBruteForceDetectedEvent,
  SecurityUnauthorizedAccessAttemptedEvent,

  SystemHealthCheckEvent,
  SystemMigrationEvent,
  SystemConfigChangedEvent,

  ComplianceDataExportRequestedEvent,
  ComplianceDataExportCompletedEvent,
  ComplianceRetentionPolicyAppliedEvent,
  ComplianceAuditLogAccessedEvent,
} from './types';

export {
  // Enums
  EventCategory,
  EventSeverity,
  EventOutcome,
  ResourceType,

  // Type guards
  isEventCategory,
  isEventSeverity,
  isEventOutcome,
  isResourceType,
  isAuthenticationEvent,
  isAuthorizationEvent,
  isOrganizationEvent,
  isSecurityEvent,
  isComplianceEvent,
  isFailureEvent,
  isSuccessEvent,
  isCriticalEvent,
  isAuditEvent,

  // Helper functions
  createAuditEvent,
  getEventCategoryDisplayName,
  getSeverityLevel,
  matchesFilter,
  formatEventDescription,
} from './types';

// Export service
export {
  AuditService,
  ConsoleAuditStorage,
  createAuditService,
  getAuditService,
  logAuthEvent,
  logSecurityEvent,
} from './AuditService';

export type {
  AuditServiceConfig,
  AuditStorage,
  EnrichmentContext,
  AuditServiceStats,
} from './AuditService';

// Export storage adapters
export {
  PostgreSQLAuditStorage,
  SQLiteAuditStorage,
  createDatabaseAuditStorage,
} from './storage/DatabaseAuditStorage';

export type {
  DatabaseConfig,
} from './storage/DatabaseAuditStorage';

// Export query API
export {
  AuditQueryAPI,
  createAuditQueryAPI,
} from './AuditQueryAPI';

export type {
  AdvancedAuditEventFilter,
  AuditAggregations,
  QueryResult,
  TimeSeriesDataPoint,
  SecurityAnomaly,
  ComplianceReportConfig,
} from './AuditQueryAPI';

// Export retention policy service
export {
  RetentionPolicyService,
  createRetentionPolicyService,
  DEFAULT_RETENTION_POLICIES,
} from './RetentionPolicyService';

export type {
  RetentionPolicy,
  RetentionExecutionResult,
  ArchivalConfig,
} from './RetentionPolicyService';

// Export audit integration
export {
  AuditIntegration,
  createAuditIntegration,
} from './integrations/AuditIntegration';

export type {
  AuditIntegrationConfig,
} from './integrations/AuditIntegration';
