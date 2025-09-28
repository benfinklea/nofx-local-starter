import { z } from 'zod';

/**
 * Navigation manifest schema for the NOFX Control Plane
 * Defines the structure for feature registration and navigation entries
 */

// Feature stability status enum
export const FeatureStatus = z.enum(['stable', 'beta', 'alpha', 'experimental', 'deprecated']);
export type FeatureStatus = z.infer<typeof FeatureStatus>;

// Feature ownership metadata
export const FeatureOwnership = z.object({
  team: z.string(),
  slack: z.string().optional(),
  email: z.string().email().optional(),
  github: z.string().optional(),
});
export type FeatureOwnership = z.infer<typeof FeatureOwnership>;

// Health status for feature monitoring
export const FeatureHealth = z.enum(['healthy', 'degraded', 'unavailable', 'unknown']);
export type FeatureHealth = z.infer<typeof FeatureHealth>;

// Permission requirements
export const PermissionRequirement = z.object({
  role: z.string().optional(),
  scope: z.string().optional(),
  feature_flag: z.string().optional(),
  custom_check: z.string().optional(),
});
export type PermissionRequirement = z.infer<typeof PermissionRequirement>;

// Telemetry configuration
export const TelemetryConfig = z.object({
  event_name: z.string(),
  track_clicks: z.boolean().default(true),
  track_time_to_feature: z.boolean().default(true),
  custom_attributes: z.record(z.any()).optional(),
});
export type TelemetryConfig = z.infer<typeof TelemetryConfig>;

// Single navigation entry in the manifest
export const NavigationEntry = z.object({
  // Required fields
  id: z.string(),
  label: z.string(),
  path: z.string(),
  icon: z.string(),

  // Organization
  group: z.string().default('main'),
  order: z.number().default(0),
  parent_id: z.string().optional(),

  // Feature metadata
  description: z.string(),
  status: FeatureStatus.default('stable'),
  ownership: FeatureOwnership,
  version: z.string().default('1.0.0'),

  // Access control
  permissions: PermissionRequirement.optional(),
  rollout_percentage: z.number().min(0).max(100).default(100),
  environments: z.array(z.string()).default(['development', 'staging', 'production']),

  // Documentation and support
  docs_url: z.string().url().optional(),
  support_url: z.string().url().optional(),
  changelog_url: z.string().url().optional(),

  // Testing and validation
  test_suite_path: z.string().optional(),
  health_check_url: z.string().optional(),
  sli_targets: z.object({
    availability: z.number().optional(),
    latency_p99_ms: z.number().optional(),
    error_rate: z.number().optional(),
  }).optional(),

  // Telemetry
  telemetry: TelemetryConfig.optional(),

  // Display options
  badge: z.string().optional(), // e.g., "NEW", "BETA", "COMING SOON"
  disabled: z.boolean().default(false),
  hidden: z.boolean().default(false),
  keyboard_shortcut: z.string().optional(), // e.g., "g+r" for runs

  // Timestamps
  added_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  deprecated_at: z.string().datetime().optional(),
});
export type NavigationEntry = z.infer<typeof NavigationEntry>;

// Navigation group configuration
export const NavigationGroup = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  order: z.number().default(0),
  collapsed_by_default: z.boolean().default(false),
});
export type NavigationGroup = z.infer<typeof NavigationGroup>;

// Complete navigation manifest
export const NavigationManifest = z.object({
  version: z.string(),
  generated_at: z.string().datetime(),
  groups: z.array(NavigationGroup),
  entries: z.array(NavigationEntry),
  metadata: z.object({
    build_id: z.string().optional(),
    commit_sha: z.string().optional(),
    environment: z.string().optional(),
  }).optional(),
});
export type NavigationManifest = z.infer<typeof NavigationManifest>;

// Runtime navigation state
export interface NavigationState {
  manifest: NavigationManifest;
  health_status: Map<string, FeatureHealth>;
  permission_cache: Map<string, boolean>;
  active_entry: string | null;
  breadcrumbs: NavigationEntry[];
}

// Navigation event for telemetry
export interface NavigationEvent {
  entry_id: string;
  event_type: 'click' | 'keyboard' | 'search' | 'breadcrumb';
  timestamp: Date;
  user_id?: string;
  session_id?: string;
  metadata?: Record<string, any>;
}