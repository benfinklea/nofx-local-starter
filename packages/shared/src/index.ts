/**
 * NOFX Control Plane Shared Package
 * Central exports for shared types and utilities
 */

// Core types
export * from './types';

// Agent system types
export * from './agents';

// Template system types
export * from './templates';

// Navigation framework (Phase 1.5)
export * from './navigation';
export * from './nav-composer';

// Re-export commonly used items for convenience
export {
  NavigationManifest,
  NavigationItem,
  DEFAULT_MANIFEST,
} from './navigation';

export {
  NavigationComposer,
  createNavigationComposer,
  validateManifest,
} from './nav-composer';

export { default as NavComposer } from './nav-composer';