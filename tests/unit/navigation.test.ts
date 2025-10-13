/**
 * Navigation System Unit Tests
 * Phase 1.5 - Track A: Navigation Framework & Layout Shell
 */

import {
  NavigationComposer,
  NavigationManifest,
  NavigationContext,
  NavigationItemStatus,
  NavigationItemType,
  validateManifest
} from '../../packages/shared/src';

describe('Navigation System Tests', () => {
  let manifest: NavigationManifest;
  let context: NavigationContext;
  let composer: NavigationComposer;

  beforeEach(() => {
    // Set up test manifest
    manifest = {
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
          id: 'admin',
          label: 'Admin',
          order: 1,
          collapsible: true,
          defaultExpanded: false,
          permissions: {
            roles: ['admin'],
          },
        },
      ],
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          path: '/',
          icon: 'Dashboard',
          type: NavigationItemType.ROUTE,
          status: NavigationItemStatus.STABLE,
          groupId: 'main',
          order: 0,
          telemetryId: 'nav.dashboard',
          shortcut: 'g d',
        },
        {
          id: 'runs',
          label: 'Runs',
          path: '/runs',
          icon: 'PlayArrow',
          type: NavigationItemType.ROUTE,
          status: NavigationItemStatus.STABLE,
          groupId: 'main',
          order: 1,
          telemetryId: 'nav.runs',
          badge: {
            type: 'count',
            value: 5,
          },
        },
        {
          id: 'responses',
          label: 'Responses',
          path: '/responses',
          icon: 'Chat',
          type: NavigationItemType.ROUTE,
          status: NavigationItemStatus.BETA,
          groupId: 'main',
          order: 2,
          permissions: {
            featureFlag: 'responsesEnabled',
          },
        },
        {
          id: 'settings',
          label: 'Settings',
          path: '/settings',
          icon: 'Settings',
          type: NavigationItemType.ROUTE,
          status: NavigationItemStatus.STABLE,
          groupId: 'admin',
          order: 0,
          permissions: {
            roles: ['admin'],
          },
          children: [
            {
              id: 'settings-general',
              label: 'General',
              path: '/settings/general',
              type: NavigationItemType.ROUTE,
              status: NavigationItemStatus.STABLE,
              order: 0,
            },
            {
              id: 'settings-security',
              label: 'Security',
              path: '/settings/security',
              type: NavigationItemType.ROUTE,
              status: NavigationItemStatus.STABLE,
              order: 1,
              permissions: {
                roles: ['super-admin'],
              },
            },
          ],
        },
        {
          id: 'coming-soon-feature',
          label: 'New Feature',
          path: '/new-feature',
          type: NavigationItemType.ROUTE,
          status: NavigationItemStatus.COMING_SOON,
          groupId: 'main',
          order: 3,
        },
        {
          id: 'docs',
          label: 'Documentation',
          path: 'https://docs.example.com',
          icon: 'Help',
          type: NavigationItemType.EXTERNAL,
          status: NavigationItemStatus.STABLE,
          groupId: 'main',
          order: 100,
        },
      ],
      overrides: [
        {
          environment: 'production',
          itemId: 'responses',
          overrides: {
            status: NavigationItemStatus.STABLE,
          },
        },
      ],
      settings: {
        showBreadcrumbs: true,
        showSearch: true,
        enableShortcuts: true,
        sidebarCollapsed: false,
        mobileBreakpoint: 768,
        tabletBreakpoint: 1024,
      },
    };

    // Set up test context
    context = {
      userRoles: ['user'],
      userPermissions: [],
      featureFlags: {
        responsesEnabled: false,
      },
      environment: 'development',
    };

    // Create composer
    composer = new NavigationComposer(manifest, context);
  });

  describe('NavigationComposer', () => {
    test('should initialize with default manifest', () => {
      const defaultComposer = new NavigationComposer();
      const items = defaultComposer.getResolvedItems();
      expect(items).toEqual([]);
    });

    test('should initialize with custom manifest and context', () => {
      expect(composer).toBeDefined();
      const items = composer.getResolvedItems();
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('Permission Resolution', () => {
    test('should hide items based on feature flags', () => {
      const items = composer.getResolvedItems();
      const responses = items.find(item => item.id === 'responses');
      expect(responses).toBeUndefined();
    });

    test('should show items when feature flag is enabled', () => {
      composer.setContext({
        ...context,
        featureFlags: { responsesEnabled: true },
      });
      const items = composer.getResolvedItems();
      const responses = items.find(item => item.id === 'responses');
      expect(responses).toBeDefined();
      expect(responses?.visible).toBe(true);
    });

    test('should hide items based on roles', () => {
      const items = composer.getResolvedItems();
      const settings = items.find(item => item.id === 'settings');
      expect(settings).toBeUndefined();
    });

    test('should show items when user has required role', () => {
      composer.setContext({
        ...context,
        userRoles: ['admin'],
      });
      const items = composer.getResolvedItems();
      const settings = items.find(item => item.id === 'settings');
      expect(settings).toBeDefined();
      expect(settings?.visible).toBe(true);
    });

    test('should hide child items based on permissions', () => {
      composer.setContext({
        ...context,
        userRoles: ['admin'],
      });
      const items = composer.getResolvedItems();
      const settings = items.find(item => item.id === 'settings');
      expect(settings?.children?.length).toBe(1);
      const securitySettings = settings?.children?.find(
        child => child.id === 'settings-security'
      );
      expect(securitySettings).toBeUndefined();
    });

    test('should hide groups based on permissions', () => {
      const groups = composer.getResolvedGroups();
      const adminGroup = groups.find(g => g.id === 'admin');
      expect(adminGroup).toBeUndefined();
    });
  });

  describe('Item Accessibility', () => {
    test('should mark coming soon items as inaccessible', () => {
      composer.setContext({
        ...context,
        userRoles: ['admin'],
      });
      const items = composer.getResolvedItems();
      const comingSoon = items.find(item => item.id === 'coming-soon-feature');
      expect(comingSoon).toBeDefined();
      expect(comingSoon?.accessible).toBe(false);
    });

    test('should mark stable items as accessible', () => {
      const items = composer.getResolvedItems();
      const dashboard = items.find(item => item.id === 'dashboard');
      expect(dashboard).toBeDefined();
      expect(dashboard?.accessible).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    test('should find items by label', () => {
      composer.setContext({
        ...context,
        userRoles: ['admin'],
        featureFlags: { responsesEnabled: true },
      });
      const results = composer.searchItems('dash');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('dashboard');
    });

    test('should find items by path', () => {
      composer.setContext({
        ...context,
        userRoles: ['admin'],
      });
      const results = composer.searchItems('settings');
      expect(results.length).toBeGreaterThan(0);
      const hasSettings = results.some(item => item.id === 'settings');
      expect(hasSettings).toBe(true);
    });

    test('should return empty array for no matches', () => {
      const results = composer.searchItems('nonexistent');
      expect(results).toEqual([]);
    });

    test('should not return hidden items in search', () => {
      // Without admin role
      const results = composer.searchItems('settings');
      expect(results.length).toBe(0);
    });
  });

  describe('Breadcrumbs', () => {
    test('should generate breadcrumbs for top-level items', () => {
      const breadcrumbs = composer.getBreadcrumbs('/runs');
      expect(breadcrumbs).toEqual([
        { id: 'runs', label: 'Runs', path: '/runs' },
      ]);
    });

    test('should generate breadcrumbs for nested items', () => {
      composer.setContext({
        ...context,
        userRoles: ['admin'],
      });
      const breadcrumbs = composer.getBreadcrumbs('/settings/general');
      expect(breadcrumbs).toEqual([
        { id: 'settings', label: 'Settings', path: '/settings' },
        { id: 'settings-general', label: 'General', path: '/settings/general' },
      ]);
    });

    test('should return empty breadcrumbs for unknown path', () => {
      const breadcrumbs = composer.getBreadcrumbs('/unknown/path');
      expect(breadcrumbs).toEqual([]);
    });
  });

  describe('Shortcuts', () => {
    test('should collect shortcuts from accessible items', () => {
      const shortcuts = composer.getShortcuts();
      expect(shortcuts.size).toBeGreaterThan(0);
      expect(shortcuts.has('g d')).toBe(true);
    });

    test('should not include shortcuts from inaccessible items', () => {
      composer.setContext({
        ...context,
        userRoles: ['admin'],
      });
      const items = composer.getResolvedItems();
      const comingSoon = items.find(item => item.status === NavigationItemStatus.COMING_SOON);
      if (comingSoon?.shortcut) {
        const shortcuts = composer.getShortcuts();
        expect(shortcuts.has(comingSoon.shortcut)).toBe(false);
      }
    });
  });

  describe('Environment Overrides', () => {
    test('should apply environment-specific overrides', () => {
      composer.setContext({
        ...context,
        environment: 'production',
        featureFlags: { responsesEnabled: true },
      });
      const items = composer.getResolvedItems();
      const responses = items.find(item => item.id === 'responses');
      expect(responses?.status).toBe(NavigationItemStatus.STABLE);
    });

    test('should not apply overrides for different environment', () => {
      composer.setContext({
        ...context,
        environment: 'development',
        featureFlags: { responsesEnabled: true },
      });
      const items = composer.getResolvedItems();
      const responses = items.find(item => item.id === 'responses');
      expect(responses?.status).toBe(NavigationItemStatus.BETA);
    });
  });

  describe('Event Handling', () => {
    test('should emit events on item click', () => {
      const eventHandler = jest.fn();
      composer.on('nav.item.clicked' as any, eventHandler);

      composer.handleItemClick('dashboard');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nav.item.clicked',
          itemId: 'dashboard',
        })
      );
    });

    test('should track search events', () => {
      const eventHandler = jest.fn();
      composer.on('nav.search.performed' as any, eventHandler);

      composer.searchItems('test');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nav.search.performed',
          searchQuery: 'test',
        })
      );
    });
  });

  describe('Manifest Validation', () => {
    test('should validate a correct manifest', () => {
      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    test('should detect duplicate item IDs', () => {
      const invalidManifest = {
        ...manifest,
        items: [
          ...manifest.items,
          {
            id: 'dashboard', // Duplicate ID
            label: 'Another Dashboard',
            type: NavigationItemType.ROUTE,
          },
        ],
      };
      const result = validateManifest(invalidManifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('Duplicate item ID');
    });

    test('should warn about invalid group references', () => {
      const invalidManifest = {
        ...manifest,
        items: [
          {
            id: 'orphan',
            label: 'Orphan Item',
            groupId: 'nonexistent',
            type: NavigationItemType.ROUTE,
          },
        ],
      };
      const result = validateManifest(invalidManifest);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0].message).toContain('Invalid group reference');
    });

    test('should warn about deprecated items', () => {
      const deprecatedManifest = {
        ...manifest,
        items: [
          {
            id: 'deprecated',
            label: 'Old Feature',
            status: NavigationItemStatus.DEPRECATED,
            type: NavigationItemType.ROUTE,
          },
        ],
      };
      const result = validateManifest(deprecatedManifest);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0].message).toContain('deprecated');
    });
  });

  describe('Metrics Collection', () => {
    test('should collect navigation metrics', () => {
      // Perform some actions
      composer.getResolvedItems();
      composer.searchItems('test');
      composer.handleItemClick('dashboard');

      const metrics = composer.getMetrics();

      expect(metrics.visibleItems).toBeGreaterThan(0);
      expect(metrics.searchStats.totalSearches).toBe(1);
      expect(metrics.topItems.length).toBeGreaterThan(0);
    });

    test('should track cache hit rate', () => {
      // First call - cache miss
      composer.getResolvedItems();
      // Second call - cache hit
      composer.getResolvedItems();

      const metrics = composer.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    test('should cache resolved items', () => {
      const items1 = composer.getResolvedItems();
      const items2 = composer.getResolvedItems();

      // Should return the same reference if cached
      expect(items1).toBe(items2);
    });

    test('should invalidate cache on context change', () => {
      const items1 = composer.getResolvedItems();

      composer.setContext({
        ...context,
        userRoles: ['admin'],
      });

      const items2 = composer.getResolvedItems();

      // Should return different items after context change
      expect(items1).not.toBe(items2);
      expect(items2.length).not.toBe(items1.length);
    });

    test('should invalidate cache on manifest change', () => {
      composer.getResolvedItems(); // First call to populate cache

      composer.setManifest({
        ...manifest,
        items: [],
      });

      const items2 = composer.getResolvedItems();

      expect(items2.length).toBe(0);
    });
  });
});