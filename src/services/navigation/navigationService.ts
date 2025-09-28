import { log } from '../../lib/observability';
import type {
  NavigationManifest,
  NavigationEntry,
  NavigationState,
  NavigationEvent,
  FeatureHealth
} from '../../types/navigation-manifest';

/**
 * Navigation Service
 * Handles navigation manifest management, permission checking, and telemetry
 */
export class NavigationService {
  private manifest: NavigationManifest | null = null;
  private state: NavigationState;
  private permissionCache: Map<string, boolean> = new Map();
  private healthStatuses: Map<string, FeatureHealth> = new Map();
  private telemetryQueue: NavigationEvent[] = [];
  private readonly maxTelemetryQueue = 100;

  constructor() {
    this.state = {
      manifest: {} as NavigationManifest,
      health_status: new Map(),
      permission_cache: new Map(),
      active_entry: null,
      breadcrumbs: []
    };

    // Initialize with empty manifest
    this.loadManifest();
  }

  /**
   * Load navigation manifest from configuration
   */
  async loadManifest(): Promise<void> {
    const startTime = Date.now();
    const correlationId = `nav-load-${Date.now()}`;

    try {
      log.info('Loading navigation manifest', {
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      });

      // In production, this would load from a CDN or API
      // For now, load from local config
      const manifestModule = await import('../../../config/navigation-manifest.json');
      this.manifest = manifestModule.default as NavigationManifest;

      this.state.manifest = this.manifest;

      // Log manifest statistics
      log.info('Navigation manifest loaded successfully', {
        correlation_id: correlationId,
        duration_ms: Date.now() - startTime,
        stats: {
          total_entries: this.manifest.entries.length,
          groups: this.manifest.groups.length,
          version: this.manifest.version
        }
      });

      // Initialize health checks
      this.initializeHealthChecks();
    } catch (error) {
      log.error('Failed to load navigation manifest', {
        correlation_id: correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration_ms: Date.now() - startTime
      });

      // Fallback to a minimal manifest
      this.manifest = this.getMinimalManifest();
    }
  }

  /**
   * Check if a user has permission to view a navigation entry
   */
  async checkPermission(
    entry: NavigationEntry,
    userContext: {
      userId?: string;
      roles?: string[];
      featureFlags?: string[];
      customChecks?: Record<string, boolean>;
    }
  ): Promise<boolean> {
    const cacheKey = `${entry.id}-${JSON.stringify(userContext)}`;

    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    let hasPermission = true;
    const checkId = `perm-check-${Date.now()}`;

    try {
      // Log permission check attempt
      log.debug('Checking navigation permissions', {
        entry_id: entry.id,
        user_id: userContext.userId,
        check_id: checkId,
        requirements: entry.permissions
      });

      if (entry.permissions) {
        // Role check
        if (entry.permissions.role && userContext.roles) {
          hasPermission = userContext.roles.includes(entry.permissions.role);
        }

        // Feature flag check
        if (hasPermission && entry.permissions.feature_flag && userContext.featureFlags) {
          hasPermission = userContext.featureFlags.includes(entry.permissions.feature_flag);
        }

        // Custom check
        if (hasPermission && entry.permissions.custom_check && userContext.customChecks) {
          hasPermission = userContext.customChecks[entry.permissions.custom_check] || false;
        }
      }

      // Check rollout percentage
      if (hasPermission && entry.rollout_percentage < 100) {
        // Simple hash-based rollout
        const hash = this.hashUserId(userContext.userId || 'anonymous');
        const rolloutThreshold = (hash % 100);
        hasPermission = rolloutThreshold < entry.rollout_percentage;

        if (!hasPermission) {
          log.info('Entry hidden due to rollout percentage', {
            entry_id: entry.id,
            user_id: userContext.userId,
            rollout_percentage: entry.rollout_percentage,
            user_threshold: rolloutThreshold
          });
        }
      }

      // Check if entry is disabled or hidden
      if (entry.disabled || entry.hidden) {
        hasPermission = false;
        log.debug('Entry disabled or hidden', {
          entry_id: entry.id,
          disabled: entry.disabled,
          hidden: entry.hidden
        });
      }

      // Cache the result
      this.permissionCache.set(cacheKey, hasPermission);

      // Log the result
      log.debug('Permission check completed', {
        entry_id: entry.id,
        user_id: userContext.userId,
        check_id: checkId,
        result: hasPermission
      });

      return hasPermission;
    } catch (error) {
      log.error('Permission check failed', {
        entry_id: entry.id,
        check_id: checkId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Fail closed - deny access on error
      return false;
    }
  }

  /**
   * Get filtered navigation entries based on user permissions
   */
  async getFilteredEntries(userContext: {
    userId?: string;
    roles?: string[];
    featureFlags?: string[];
    customChecks?: Record<string, boolean>;
  }): Promise<NavigationEntry[]> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    const startTime = Date.now();
    const filteredEntries: NavigationEntry[] = [];

    for (const entry of this.manifest!.entries) {
      const hasPermission = await this.checkPermission(entry, userContext);
      if (hasPermission) {
        filteredEntries.push(entry);
      }
    }

    log.info('Navigation entries filtered', {
      user_id: userContext.userId,
      total_entries: this.manifest!.entries.length,
      visible_entries: filteredEntries.length,
      hidden_entries: this.manifest!.entries.length - filteredEntries.length,
      duration_ms: Date.now() - startTime
    });

    return filteredEntries;
  }

  /**
   * Track navigation event for telemetry
   */
  trackNavigationEvent(event: NavigationEvent): void {
    try {
      // Add to telemetry queue
      this.telemetryQueue.push(event);

      // Log the event with structured data
      log.info('Navigation event tracked', {
        event_type: event.event_type,
        entry_id: event.entry_id,
        user_id: event.user_id,
        session_id: event.session_id,
        timestamp: event.timestamp.toISOString(),
        metadata: event.metadata
      });

      // Find the entry to check telemetry config
      const entry = this.manifest?.entries.find(e => e.id === event.entry_id);
      if (entry?.telemetry) {
        // Additional telemetry based on entry config
        if (entry.telemetry.track_time_to_feature) {
          this.trackTimeToFeature(event);
        }

        // Custom attributes
        if (entry.telemetry.custom_attributes) {
          log.info('Custom telemetry attributes', {
            entry_id: event.entry_id,
            custom_attributes: entry.telemetry.custom_attributes
          });
        }
      }

      // Flush queue if it's getting too large
      if (this.telemetryQueue.length >= this.maxTelemetryQueue) {
        this.flushTelemetry();
      }
    } catch (error) {
      log.error('Failed to track navigation event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event_type: event.event_type,
        entry_id: event.entry_id
      });
    }
  }

  /**
   * Update health status for a navigation entry
   */
  updateHealthStatus(entryId: string, health: FeatureHealth): void {
    const previousHealth = this.healthStatuses.get(entryId);
    this.healthStatuses.set(entryId, health);
    this.state.health_status.set(entryId, health);

    // Log health status change
    if (previousHealth !== health) {
      const logLevel = health === 'unavailable' ? 'error' :
                      health === 'degraded' ? 'warn' : 'info';

      log[logLevel]('Navigation entry health status changed', {
        entry_id: entryId,
        previous_health: previousHealth,
        current_health: health,
        timestamp: new Date().toISOString()
      });

      // Alert on critical health changes
      if (health === 'unavailable') {
        this.alertOnUnavailable(entryId);
      }
    }
  }

  /**
   * Set active navigation entry and update breadcrumbs
   */
  setActiveEntry(entryId: string): void {
    const entry = this.manifest?.entries.find(e => e.id === entryId);
    if (!entry) {
      log.warn('Attempted to set non-existent entry as active', {
        entry_id: entryId
      });
      return;
    }

    this.state.active_entry = entryId;

    // Update breadcrumbs
    this.updateBreadcrumbs(entry);

    // Track navigation
    this.trackNavigationEvent({
      entry_id: entryId,
      event_type: 'click',
      timestamp: new Date()
    });

    log.debug('Active navigation entry updated', {
      entry_id: entryId,
      path: entry.path,
      breadcrumb_depth: this.state.breadcrumbs.length
    });
  }

  /**
   * Get coming soon entries
   */
  getComingSoonEntries(): NavigationEntry[] {
    if (!this.manifest) return [];

    return this.manifest.entries.filter(entry =>
      entry.badge === 'COMING SOON' ||
      entry.rollout_percentage === 0 ||
      (entry.status === 'alpha' && entry.hidden)
    );
  }

  // Private helper methods

  private initializeHealthChecks(): void {
    // Initialize all entries as unknown health
    for (const entry of this.manifest!.entries) {
      this.healthStatuses.set(entry.id, 'unknown');
      this.state.health_status.set(entry.id, 'unknown');
    }
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private trackTimeToFeature(event: NavigationEvent): void {
    // Track time from session start to feature access
    const sessionStart = this.getSessionStartTime(event.session_id);
    if (sessionStart) {
      const timeToFeature = event.timestamp.getTime() - sessionStart;
      log.info('Time to feature tracked', {
        entry_id: event.entry_id,
        session_id: event.session_id,
        time_to_feature_ms: timeToFeature
      });
    }
  }

  private getSessionStartTime(_sessionId?: string): number | null {
    // In a real implementation, this would query session storage
    return Date.now() - (5 * 60 * 1000); // Mock: 5 minutes ago
  }

  private updateBreadcrumbs(entry: NavigationEntry): void {
    const breadcrumbs: NavigationEntry[] = [entry];

    // Build breadcrumb trail from parent entries
    let currentEntry = entry;
    while (currentEntry.parent_id) {
      const parent = this.manifest?.entries.find(e => e.id === currentEntry.parent_id);
      if (parent) {
        breadcrumbs.unshift(parent);
        currentEntry = parent;
      } else {
        break;
      }
    }

    this.state.breadcrumbs = breadcrumbs;
  }

  private flushTelemetry(): void {
    if (this.telemetryQueue.length === 0) return;

    log.info('Flushing telemetry queue', {
      event_count: this.telemetryQueue.length
    });

    // In production, this would send to analytics service
    // For now, just clear the queue
    this.telemetryQueue = [];
  }

  private alertOnUnavailable(entryId: string): void {
    const entry = this.manifest?.entries.find(e => e.id === entryId);
    if (!entry) return;

    log.error('ALERT: Navigation entry unavailable', {
      entry_id: entryId,
      entry_label: entry.label,
      entry_path: entry.path,
      owner_team: entry.ownership.team,
      owner_slack: entry.ownership.slack,
      alert_type: 'navigation_unavailable',
      severity: 'high'
    });

    // In production, this would trigger PagerDuty/Slack alerts
  }

  private getMinimalManifest(): NavigationManifest {
    return {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      groups: [{
        id: 'main',
        label: 'Main',
        order: 0,
        collapsed_by_default: false
      }],
      entries: [{
        id: 'dashboard',
        label: 'Dashboard',
        path: '/',
        icon: 'DashboardIcon',
        group: 'main',
        order: 0,
        description: 'Main dashboard',
        status: 'stable',
        ownership: {
          team: 'platform'
        },
        version: '1.0.0'
      }]
    };
  }
}

// Singleton instance
export const navigationService = new NavigationService();