/**
 * Navigation Manifest Schema
 * Phase 1.5 - Track A: Navigation Framework & Layout Shell
 *
 * This module defines the manifest-driven navigation system for the NOFX Control Plane.
 * It provides a single source of truth for navigation entries, permissions, and feature flags.
 */

import { z } from 'zod';

// ============================================================================
// Core Navigation Types
// ============================================================================

/**
 * Navigation item visibility and access control
 */
export const NavigationPermissionSchema = z.object({
  /** Required roles for access */
  roles: z.array(z.string()).optional(),
  /** Required permissions for access */
  permissions: z.array(z.string()).optional(),
  /** Feature flag that must be enabled */
  featureFlag: z.string().optional(),
  /** Custom permission check function name */
  customCheck: z.string().optional(),
});

export type NavigationPermission = z.infer<typeof NavigationPermissionSchema>;

/**
 * Navigation item status for health monitoring
 */
export enum NavigationItemStatus {
  STABLE = 'stable',
  BETA = 'beta',
  ALPHA = 'alpha',
  DEPRECATED = 'deprecated',
  COMING_SOON = 'coming_soon',
}

/**
 * Navigation item type for different UI treatments
 */
export enum NavigationItemType {
  ROUTE = 'route',
  ACTION = 'action',
  EXTERNAL = 'external',
  DIVIDER = 'divider',
  GROUP = 'group',
}

/**
 * Core navigation item definition
 */
export const NavigationItemSchema = z.object({
  /** Unique identifier for the navigation item */
  id: z.string(),
  /** Display label */
  label: z.string(),
  /** Navigation path or action */
  path: z.string().optional(),
  /** Icon identifier (Material UI icon name or custom SVG path) */
  icon: z.string().optional(),
  /** Item type for UI treatment */
  type: z.nativeEnum(NavigationItemType).default(NavigationItemType.ROUTE),
  /** Status indicator */
  status: z.nativeEnum(NavigationItemStatus).default(NavigationItemStatus.STABLE),
  /** Parent group ID for nested navigation */
  groupId: z.string().optional(),
  /** Sort order within group */
  order: z.number().default(0),
  /** Permissions and access control */
  permissions: NavigationPermissionSchema.optional(),
  /** Team or individual responsible for this feature */
  owner: z.string().optional(),
  /** Related documentation URL */
  docsUrl: z.string().url().optional(),
  /** Telemetry event ID for analytics */
  telemetryId: z.string().optional(),
  /** Badge configuration for notifications/counts */
  badge: z.object({
    type: z.enum(['count', 'dot', 'text']),
    value: z.union([z.number(), z.string(), z.boolean()]).optional(),
    color: z.string().optional(),
  }).optional(),
  /** Keyboard shortcut */
  shortcut: z.string().optional(),
  /** Child items for nested navigation */
  children: z.lazy(() => z.array(NavigationItemSchema)).optional(),
  /** Custom metadata for extensions */
  metadata: z.record(z.unknown()).optional(),
});

export type NavigationItem = z.infer<typeof NavigationItemSchema>;

/**
 * Navigation group for organizing items
 */
export const NavigationGroupSchema = z.object({
  /** Unique group identifier */
  id: z.string(),
  /** Group display label */
  label: z.string(),
  /** Group icon */
  icon: z.string().optional(),
  /** Sort order */
  order: z.number().default(0),
  /** Collapsible state */
  collapsible: z.boolean().default(true),
  /** Default expanded state */
  defaultExpanded: z.boolean().default(true),
  /** Group-level permissions */
  permissions: NavigationPermissionSchema.optional(),
});

export type NavigationGroup = z.infer<typeof NavigationGroupSchema>;

/**
 * Environment-specific override for navigation items
 */
export const NavigationOverrideSchema = z.object({
  /** Environment name (development, staging, production) */
  environment: z.string(),
  /** Item ID to override */
  itemId: z.string(),
  /** Override values (partial NavigationItem) */
  overrides: NavigationItemSchema.partial(),
});

export type NavigationOverride = z.infer<typeof NavigationOverrideSchema>;

/**
 * Complete navigation manifest
 */
export const NavigationManifestSchema = z.object({
  /** Manifest version for migration support */
  version: z.string(),
  /** Last updated timestamp */
  updatedAt: z.string().datetime(),
  /** Navigation groups */
  groups: z.array(NavigationGroupSchema).default([]),
  /** Navigation items */
  items: z.array(NavigationItemSchema),
  /** Environment-specific overrides */
  overrides: z.array(NavigationOverrideSchema).default([]),
  /** Global settings */
  settings: z.object({
    /** Enable breadcrumbs */
    showBreadcrumbs: z.boolean().default(true),
    /** Enable search */
    showSearch: z.boolean().default(true),
    /** Enable keyboard shortcuts */
    enableShortcuts: z.boolean().default(true),
    /** Default collapsed state for sidebar */
    sidebarCollapsed: z.boolean().default(false),
    /** Mobile breakpoint */
    mobileBreakpoint: z.number().default(768),
    /** Tablet breakpoint */
    tabletBreakpoint: z.number().default(1024),
  }).default({}),
});

export type NavigationManifest = z.infer<typeof NavigationManifestSchema>;

// ============================================================================
// Navigation Context and State
// ============================================================================

/**
 * Runtime navigation context for permission resolution
 */
export interface NavigationContext {
  /** Current user's roles */
  userRoles: string[];
  /** Current user's permissions */
  userPermissions: string[];
  /** Enabled feature flags */
  featureFlags: Record<string, boolean>;
  /** Current environment */
  environment: string;
  /** Custom permission check functions */
  customChecks?: Record<string, (item: NavigationItem) => boolean>;
}

/**
 * Resolved navigation item with computed properties
 */
export interface ResolvedNavigationItem extends NavigationItem {
  /** Whether the item is visible based on permissions */
  visible: boolean;
  /** Whether the item is accessible (clickable) */
  accessible: boolean;
  /** Whether the item is currently active */
  active?: boolean;
  /** Resolved children (if any) */
  children?: ResolvedNavigationItem[];
  /** Computed badge value */
  badgeValue?: string | number;
}

/**
 * Navigation state for UI components
 */
export interface NavigationState {
  /** Resolved navigation items */
  items: ResolvedNavigationItem[];
  /** Resolved groups */
  groups: NavigationGroup[];
  /** Current active item ID */
  activeItemId?: string;
  /** Breadcrumb trail */
  breadcrumbs: Array<{ id: string; label: string; path?: string }>;
  /** Search results (if search is active) */
  searchResults?: ResolvedNavigationItem[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error?: string;
}

// ============================================================================
// Navigation Events for Telemetry
// ============================================================================

/**
 * Navigation telemetry event types
 */
export enum NavigationEventType {
  ITEM_CLICKED = 'nav.item.clicked',
  SEARCH_PERFORMED = 'nav.search.performed',
  SHORTCUT_USED = 'nav.shortcut.used',
  BREADCRUMB_CLICKED = 'nav.breadcrumb.clicked',
  SIDEBAR_TOGGLED = 'nav.sidebar.toggled',
  GROUP_TOGGLED = 'nav.group.toggled',
}

/**
 * Navigation telemetry event payload
 */
export interface NavigationEvent {
  type: NavigationEventType;
  timestamp: number;
  itemId?: string;
  groupId?: string;
  searchQuery?: string;
  shortcut?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Navigation manifest validation result
 */
export interface ManifestValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  warnings?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Navigation metrics for monitoring
 */
export interface NavigationMetrics {
  /** Time to render navigation */
  renderTime: number;
  /** Number of visible items */
  visibleItems: number;
  /** Number of hidden items (due to permissions) */
  hiddenItems: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Most clicked items */
  topItems: Array<{ itemId: string; clicks: number }>;
  /** Search usage stats */
  searchStats: {
    totalSearches: number;
    averageResultCount: number;
    clickThroughRate: number;
  };
}

// ============================================================================
// Default Values and Constants
// ============================================================================

/**
 * Default navigation manifest for initial setup
 */
export const DEFAULT_MANIFEST: NavigationManifest = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  groups: [
    {
      id: 'main',
      label: 'Main',
      order: 0,
      collapsible: false,
      defaultExpanded: true,
    },
    {
      id: 'tools',
      label: 'Tools',
      order: 1,
      icon: 'Build',
      collapsible: true,
      defaultExpanded: true,
    },
    {
      id: 'admin',
      label: 'Administration',
      order: 2,
      icon: 'Settings',
      collapsible: true,
      defaultExpanded: false,
      permissions: {
        roles: ['admin'],
      },
    },
  ],
  items: [],
  overrides: [],
  settings: {
    showBreadcrumbs: true,
    showSearch: true,
    enableShortcuts: true,
    sidebarCollapsed: false,
    mobileBreakpoint: 768,
    tabletBreakpoint: 1024,
  },
};

/**
 * Navigation cache configuration
 */
export const NAVIGATION_CACHE_CONFIG = {
  /** Cache TTL in milliseconds */
  ttl: 5 * 60 * 1000, // 5 minutes
  /** Cache key prefix */
  keyPrefix: 'nav:manifest:',
  /** Enable cache */
  enabled: true,
  /** Cache implementation (memory, redis, etc.) */
  type: 'memory' as 'memory' | 'redis' | 'localStorage',
};