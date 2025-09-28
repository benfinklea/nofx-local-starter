/**
 * Navigation manifest types for the unified navigation system
 * Phase 1.5 - Track C implementation
 */

import { z } from 'zod';

// Navigation item permission requirements
export const NavigationPermissionSchema = z.object({
  role: z.enum(['admin', 'user', 'viewer', 'public']).optional(),
  feature: z.string().optional(),
  custom: z.function().optional(),
});

// Navigation item metadata
export const NavigationMetadataSchema = z.object({
  owner: z.string(),
  stability: z.enum(['stable', 'beta', 'alpha', 'experimental', 'deprecated']),
  docs: z.string().optional(),
  tests: z.array(z.string()).optional(),
  envVars: z.array(z.string()).optional(),
});

// Telemetry configuration
export const NavigationTelemetrySchema = z.object({
  eventName: z.string(),
  category: z.string(),
  properties: z.record(z.any()).optional(),
});

// Single navigation item
export const NavigationItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  icon: z.string().optional(),
  group: z.string().optional(),
  permissions: NavigationPermissionSchema.optional(),
  metadata: NavigationMetadataSchema,
  telemetry: NavigationTelemetrySchema.optional(),
  rolloutFlag: z.string().optional(),
  badge: z.object({
    text: z.string(),
    type: z.enum(['new', 'beta', 'alpha', 'coming-soon', 'deprecated']),
  }).optional(),
  children: z.lazy(() => z.array(NavigationItemSchema)).optional(),
  contextual: z.boolean().optional(), // For contextual actions
  keyboard: z.string().optional(), // Keyboard shortcut
  searchTerms: z.array(z.string()).optional(), // For search
  visible: z.boolean().default(true),
  order: z.number().optional(),
});

// Complete navigation manifest
export const NavigationManifestSchema = z.object({
  version: z.string(),
  items: z.array(NavigationItemSchema),
  groups: z.array(z.object({
    id: z.string(),
    label: z.string(),
    order: z.number(),
    collapsed: z.boolean().optional(),
  })).optional(),
  settings: z.object({
    enableKeyboardShortcuts: z.boolean().default(true),
    enableSearch: z.boolean().default(true),
    enableTelemetry: z.boolean().default(true),
    enableFeedback: z.boolean().default(true),
    legacyMode: z.boolean().default(false),
  }).optional(),
});

// Type exports
export type NavigationPermission = z.infer<typeof NavigationPermissionSchema>;
export type NavigationMetadata = z.infer<typeof NavigationMetadataSchema>;
export type NavigationTelemetry = z.infer<typeof NavigationTelemetrySchema>;
export type NavigationItem = z.infer<typeof NavigationItemSchema>;
export type NavigationManifest = z.infer<typeof NavigationManifestSchema>;

// Navigation context for breadcrumbs and contextual actions
export interface NavigationContext {
  path: string[];
  params: Record<string, string>;
  breadcrumbs: Array<{
    label: string;
    path: string;
    icon?: string;
  }>;
  actions: Array<{
    label: string;
    action: () => void;
    icon?: string;
    keyboard?: string;
  }>;
}

// Navigation analytics event
export interface NavigationAnalyticsEvent {
  type: 'click' | 'search' | 'keyboard' | 'breadcrumb' | 'action';
  item: string;
  path: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

// Navigation performance metrics
export interface NavigationMetrics {
  renderTime: number;
  manifestLoadTime: number;
  searchTime?: number;
  clickToRoute?: number;
  bounceRate?: number;
  timeToFeature?: Record<string, number>;
}