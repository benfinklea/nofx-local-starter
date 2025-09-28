/**
 * Navigation Composer Library
 * Phase 1.5 - Track A: Navigation Framework & Layout Shell
 *
 * This module provides the core logic for parsing navigation manifests,
 * resolving permissions, and managing navigation state across different runtime contexts.
 */

import {
  NavigationManifest,
  NavigationItem,
  NavigationGroup,
  NavigationContext,
  ResolvedNavigationItem,
  NavigationEvent,
  NavigationEventType,
  ManifestValidationResult,
  NavigationMetrics,
  NavigationPermission,
  NavigationItemStatus,
  NavigationItemType,
  NAVIGATION_CACHE_CONFIG,
  DEFAULT_MANIFEST,
} from './navigation';

// ============================================================================
// Navigation Composer Core
// ============================================================================

/**
 * Main navigation composer class that handles manifest processing and state management
 */
export class NavigationComposer {
  private manifest: NavigationManifest;
  private context: NavigationContext;
  private cache: Map<string, unknown> = new Map();
  private eventListeners: Map<NavigationEventType, Set<(event: NavigationEvent) => void>> = new Map();
  private metricsCollector: NavigationMetricsCollector;

  constructor(manifest: NavigationManifest = DEFAULT_MANIFEST, context?: Partial<NavigationContext>) {
    this.manifest = manifest;
    this.context = {
      userRoles: [],
      userPermissions: [],
      featureFlags: {},
      environment: 'development',
      ...context,
    };
    this.metricsCollector = new NavigationMetricsCollector();
  }

  /**
   * Update the navigation manifest
   */
  setManifest(manifest: NavigationManifest): void {
    this.manifest = manifest;
    this.clearCache();
    this.emitEvent({
      type: NavigationEventType.SIDEBAR_TOGGLED,
      timestamp: Date.now(),
      metadata: { action: 'manifest_updated' },
    });
  }

  /**
   * Update the navigation context
   */
  setContext(context: Partial<NavigationContext>): void {
    this.context = { ...this.context, ...context };
    this.clearCache();
  }

  /**
   * Get resolved navigation items with permissions applied
   */
  getResolvedItems(): ResolvedNavigationItem[] {
    const cacheKey = this.getCacheKey('resolved_items');
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startTime = performance.now();
    const items = this.applyEnvironmentOverrides(this.manifest.items);
    const resolved = items.map(item => this.resolveItem(item));
    const filtered = resolved.filter(item => item.visible);

    this.metricsCollector.recordRenderTime(performance.now() - startTime);
    this.metricsCollector.recordItemCounts(filtered.length, resolved.length - filtered.length);

    this.setToCache(cacheKey, filtered);
    return filtered;
  }

  /**
   * Get resolved navigation groups with permissions applied
   */
  getResolvedGroups(): NavigationGroup[] {
    const cacheKey = this.getCacheKey('resolved_groups');
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const groups = this.manifest.groups.filter(group =>
      this.checkPermissions(group.permissions)
    );

    this.setToCache(cacheKey, groups);
    return groups;
  }

  /**
   * Search navigation items
   */
  searchItems(query: string): ResolvedNavigationItem[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const items = this.getResolvedItems();
    const results = this.searchInItems(items, normalizedQuery);

    this.emitEvent({
      type: NavigationEventType.SEARCH_PERFORMED,
      timestamp: Date.now(),
      searchQuery: query,
      metadata: { resultCount: results.length },
    });

    this.metricsCollector.recordSearch(query, results.length);
    return results;
  }

  /**
   * Get breadcrumbs for a given path
   */
  getBreadcrumbs(path: string): Array<{ id: string; label: string; path?: string }> {
    const items = this.getResolvedItems();
    const breadcrumbs: Array<{ id: string; label: string; path?: string }> = [];

    const findPath = (
      items: ResolvedNavigationItem[],
      targetPath: string,
      trail: Array<{ id: string; label: string; path?: string }> = []
    ): boolean => {
      for (const item of items) {
        const currentTrail = [...trail, { id: item.id, label: item.label, path: item.path }];

        if (item.path === targetPath) {
          breadcrumbs.push(...currentTrail);
          return true;
        }

        if (item.children && findPath(item.children, targetPath, currentTrail)) {
          return true;
        }
      }
      return false;
    };

    findPath(items, path);
    return breadcrumbs;
  }

  /**
   * Get navigation item by ID
   */
  getItemById(id: string): ResolvedNavigationItem | null {
    const items = this.getResolvedItems();
    return this.findItemById(items, id);
  }

  /**
   * Register keyboard shortcuts
   */
  getShortcuts(): Map<string, NavigationItem> {
    const shortcuts = new Map<string, NavigationItem>();
    const items = this.getResolvedItems();

    const collectShortcuts = (items: ResolvedNavigationItem[]) => {
      items.forEach(item => {
        if (item.shortcut && item.accessible) {
          shortcuts.set(item.shortcut, item);
        }
        if (item.children) {
          collectShortcuts(item.children);
        }
      });
    };

    collectShortcuts(items);
    return shortcuts;
  }

  /**
   * Handle navigation item click
   */
  handleItemClick(itemId: string): void {
    const item = this.getItemById(itemId);
    if (!item || !item.accessible) return;

    this.emitEvent({
      type: NavigationEventType.ITEM_CLICKED,
      timestamp: Date.now(),
      itemId,
      metadata: { path: item.path, type: item.type },
    });

    this.metricsCollector.recordClick(itemId);
  }

  /**
   * Get navigation metrics
   */
  getMetrics(): NavigationMetrics {
    return this.metricsCollector.getMetrics();
  }

  // ============================================================================
  // Event Management
  // ============================================================================

  /**
   * Subscribe to navigation events
   */
  on(type: NavigationEventType, handler: (event: NavigationEvent) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(type)?.delete(handler);
    };
  }

  /**
   * Emit navigation event
   */
  private emitEvent(event: NavigationEvent): void {
    const handlers = this.eventListeners.get(event.type);
    handlers?.forEach(handler => handler(event));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Resolve a navigation item with permissions and state
   */
  private resolveItem(item: NavigationItem): ResolvedNavigationItem {
    const visible = this.checkPermissions(item.permissions);
    const accessible = visible && item.status !== NavigationItemStatus.COMING_SOON;

    const resolved: ResolvedNavigationItem = {
      ...item,
      visible,
      accessible,
    };

    if (item.children) {
      resolved.children = item.children
        .map((child: NavigationItem) => this.resolveItem(child))
        .filter((child: ResolvedNavigationItem) => child.visible);
    }

    return resolved;
  }

  /**
   * Check permissions for an item or group
   */
  private checkPermissions(permissions?: NavigationPermission): boolean {
    if (!permissions) return true;

    // Check feature flag
    if (permissions.featureFlag) {
      if (!this.context.featureFlags[permissions.featureFlag]) {
        return false;
      }
    }

    // Check roles
    if (permissions.roles && permissions.roles.length > 0) {
      const hasRole = permissions.roles.some(role =>
        this.context.userRoles.includes(role)
      );
      if (!hasRole) return false;
    }

    // Check permissions
    if (permissions.permissions && permissions.permissions.length > 0) {
      const hasPermission = permissions.permissions.some(perm =>
        this.context.userPermissions.includes(perm)
      );
      if (!hasPermission) return false;
    }

    // Check custom function
    if (permissions.customCheck && this.context.customChecks) {
      const checkFn = this.context.customChecks[permissions.customCheck];
      if (checkFn) {
        return checkFn({ id: '', label: '', type: NavigationItemType.ROUTE } as NavigationItem);
      }
    }

    return true;
  }

  /**
   * Apply environment-specific overrides
   */
  private applyEnvironmentOverrides(items: NavigationItem[]): NavigationItem[] {
    const overrides = this.manifest.overrides.filter(
      o => o.environment === this.context.environment
    );

    if (overrides.length === 0) return items;

    return items.map(item => {
      const override = overrides.find(o => o.itemId === item.id);
      if (override && override.overrides) {
        return { ...item, ...override.overrides };
      }

      if (item.children) {
        return {
          ...item,
          children: this.applyEnvironmentOverrides(item.children),
        };
      }

      return item;
    });
  }

  /**
   * Search recursively in navigation items
   */
  private searchInItems(
    items: ResolvedNavigationItem[],
    query: string
  ): ResolvedNavigationItem[] {
    const results: ResolvedNavigationItem[] = [];

    items.forEach(item => {
      const labelMatch = item.label.toLowerCase().includes(query);
      const pathMatch = item.path?.toLowerCase().includes(query);

      if (labelMatch || pathMatch) {
        results.push(item);
      }

      if (item.children) {
        results.push(...this.searchInItems(item.children, query));
      }
    });

    return results;
  }

  /**
   * Find item by ID recursively
   */
  private findItemById(
    items: ResolvedNavigationItem[],
    id: string
  ): ResolvedNavigationItem | null {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = this.findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Cache management
   */
  private getCacheKey(type: string): string {
    const contextHash = JSON.stringify({
      roles: this.context.userRoles,
      permissions: this.context.userPermissions,
      flags: this.context.featureFlags,
      env: this.context.environment,
    });
    return `${type}:${contextHash}`;
  }

  private getFromCache(key: string): any {
    if (!NAVIGATION_CACHE_CONFIG.enabled) return null;
    const cached = this.cache.get(key);
    if (cached && typeof cached === 'object' && cached !== null &&
        'timestamp' in cached && 'data' in cached &&
        Date.now() - (cached.timestamp as number) < NAVIGATION_CACHE_CONFIG.ttl) {
      this.metricsCollector.recordCacheHit(true);
      return (cached as any).data;
    }
    this.metricsCollector.recordCacheHit(false);
    return null;
  }

  private setToCache(key: string, data: any): void {
    if (!NAVIGATION_CACHE_CONFIG.enabled) return;
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Navigation Metrics Collector
// ============================================================================

/**
 * Collects and aggregates navigation metrics
 */
class NavigationMetricsCollector {
  private renderTimes: number[] = [];
  private visibleItemCount = 0;
  private hiddenItemCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private itemClicks = new Map<string, number>();
  private searches: Array<{ query: string; resultCount: number }> = [];

  recordRenderTime(ms: number): void {
    this.renderTimes.push(ms);
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }
  }

  recordItemCounts(visible: number, hidden: number): void {
    this.visibleItemCount = visible;
    this.hiddenItemCount = hidden;
  }

  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  recordClick(itemId: string): void {
    const count = this.itemClicks.get(itemId) || 0;
    this.itemClicks.set(itemId, count + 1);
  }

  recordSearch(query: string, resultCount: number): void {
    this.searches.push({ query, resultCount });
    if (this.searches.length > 100) {
      this.searches.shift();
    }
  }

  getMetrics(): NavigationMetrics {
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0;

    const cacheTotal = this.cacheHits + this.cacheMisses;
    const cacheHitRate = cacheTotal > 0 ? this.cacheHits / cacheTotal : 0;

    const topItems = Array.from(this.itemClicks.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([itemId, clicks]) => ({ itemId, clicks }));

    const avgResultCount = this.searches.length > 0
      ? this.searches.reduce((sum, s) => sum + s.resultCount, 0) / this.searches.length
      : 0;

    const searchesWithClicks = this.searches.filter(s => s.resultCount > 0).length;
    const clickThroughRate = this.searches.length > 0
      ? searchesWithClicks / this.searches.length
      : 0;

    return {
      renderTime: avgRenderTime,
      visibleItems: this.visibleItemCount,
      hiddenItems: this.hiddenItemCount,
      cacheHitRate,
      topItems,
      searchStats: {
        totalSearches: this.searches.length,
        averageResultCount: avgResultCount,
        clickThroughRate,
      },
    };
  }
}

// ============================================================================
// Manifest Validation
// ============================================================================

/**
 * Validate a navigation manifest
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: Array<{ path: string; message: string }> = [];

  try {
    // Type validation would go here using zod schema
    // For now, we'll do basic structural validation
    const m = manifest as NavigationManifest;

    // Check for duplicate IDs
    const itemIds = new Set<string>();
    const checkDuplicates = (items: NavigationItem[], path = 'items') => {
      items.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        if (itemIds.has(item.id)) {
          errors.push({
            path: itemPath,
            message: `Duplicate item ID: ${item.id}`,
          });
        }
        itemIds.add(item.id);

        if (item.children) {
          checkDuplicates(item.children, `${itemPath}.children`);
        }
      });
    };

    if (m.items) {
      checkDuplicates(m.items);
    }

    // Check for invalid group references
    const groupIds = new Set(m.groups?.map(g => g.id) || []);
    m.items?.forEach((item, index) => {
      if (item.groupId && !groupIds.has(item.groupId)) {
        warnings.push({
          path: `items[${index}]`,
          message: `Invalid group reference: ${item.groupId}`,
        });
      }
    });

    // Check for deprecated items
    m.items?.forEach((item, index) => {
      if (item.status === NavigationItemStatus.DEPRECATED) {
        warnings.push({
          path: `items[${index}]`,
          message: `Item "${item.label}" is marked as deprecated`,
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: 'root',
        message: error instanceof Error ? error.message : 'Invalid manifest structure',
      }],
    };
  }
}

// ============================================================================
// Export Navigation Composer Factory
// ============================================================================

/**
 * Create a new navigation composer instance
 */
export function createNavigationComposer(
  manifest?: NavigationManifest,
  context?: Partial<NavigationContext>
): NavigationComposer {
  return new NavigationComposer(manifest, context);
}

/**
 * Default export for convenience
 */
export default NavigationComposer;