/**
 * Navigation hooks for the unified navigation system
 * Phase 1.5 - Track C implementation
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  NavigationItem,
  NavigationManifest,
  NavigationContext,
  NavigationAnalyticsEvent,
  NavigationMetrics
} from '@nofx/shared/navigation/types';
import { navigationManifest } from '../navigation.manifest';
import { uiFlags } from '../config';

// Check if user has permission to view a navigation item
const checkPermission = (item: NavigationItem, userRole?: string): boolean => {
  if (!item.permissions) return true;

  if (item.permissions.role && userRole !== item.permissions.role) {
    return false;
  }

  if (item.permissions.feature && !uiFlags[item.permissions.feature]) {
    return false;
  }

  if (item.permissions.custom) {
    return item.permissions.custom();
  }

  return true;
};

// Check if feature flag allows item to be shown
const checkFeatureFlag = (item: NavigationItem): boolean => {
  if (!item.rolloutFlag) return true;
  return uiFlags[item.rolloutFlag] === true;
};

// Track navigation analytics
const trackNavigation = (event: NavigationAnalyticsEvent) => {
  // Send to analytics service
  if (window.analytics) {
    window.analytics.track(event.type, {
      item: event.item,
      path: event.path,
      timestamp: event.timestamp,
      metadata: event.metadata,
    });
  }

  // Log to console in dev mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[Navigation Analytics]', event);
  }
};

// Main navigation hook
export const useNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [manifest] = useState<NavigationManifest>(navigationManifest);
  const [metrics, setMetrics] = useState<NavigationMetrics>({
    renderTime: 0,
    manifestLoadTime: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLegacyMode, setIsLegacyMode] = useState(false);

  // Filter navigation items based on permissions and flags
  const visibleItems = useMemo(() => {
    const filterItems = (items: NavigationItem[]): NavigationItem[] => {
      return items
        .filter(item => checkPermission(item, 'user')) // TODO: Get actual user role
        .filter(item => checkFeatureFlag(item))
        .filter(item => item.visible !== false)
        .map(item => ({
          ...item,
          children: item.children ? filterItems(item.children) : undefined,
        }));
    };

    const startTime = performance.now();
    const filtered = filterItems(manifest.items);
    const endTime = performance.now();

    setMetrics(prev => ({
      ...prev,
      renderTime: endTime - startTime,
    }));

    return filtered;
  }, [manifest]);

  // Search navigation items
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];

    const startTime = performance.now();
    const term = searchTerm.toLowerCase();
    const results: NavigationItem[] = [];

    const searchItems = (items: NavigationItem[]) => {
      items.forEach(item => {
        if (
          item.label.toLowerCase().includes(term) ||
          item.searchTerms?.some(t => t.toLowerCase().includes(term))
        ) {
          results.push(item);
        }

        if (item.children) {
          searchItems(item.children);
        }
      });
    };

    searchItems(visibleItems);

    const endTime = performance.now();
    setMetrics(prev => ({
      ...prev,
      searchTime: endTime - startTime,
    }));

    return results;
  }, [searchTerm, visibleItems]);

  // Get breadcrumbs for current location
  const breadcrumbs = useMemo(() => {
    const path = location.pathname;
    const crumbs: NavigationContext['breadcrumbs'] = [];

    const findPath = (items: NavigationItem[], currentPath = ''): boolean => {
      for (const item of items) {
        if (item.path === path) {
          crumbs.push({
            label: item.label,
            path: item.path,
            icon: item.icon,
          });
          return true;
        }

        if (item.children) {
          crumbs.push({
            label: item.label,
            path: item.path,
            icon: item.icon,
          });

          if (findPath(item.children, item.path)) {
            return true;
          }

          crumbs.pop();
        }
      }

      return false;
    };

    findPath(visibleItems);
    return crumbs;
  }, [location.pathname, visibleItems]);

  // Get contextual actions for current location
  const contextualActions = useMemo(() => {
    const path = location.pathname;
    const actions: NavigationContext['actions'] = [];

    visibleItems.forEach(item => {
      if (item.children) {
        item.children.forEach(child => {
          if (child.contextual && path.startsWith(item.path)) {
            actions.push({
              label: child.label,
              path: child.path,
              icon: child.icon,
              keyboard: child.keyboard,
              action: () => navigateTo(child.path),
            });
          }
        });
      }
    });

    return actions;
  }, [location.pathname, visibleItems]);

  // Navigate to a path with analytics
  const navigateTo = useCallback((path: string, item?: NavigationItem) => {
    const startTime = performance.now();

    navigate(path);

    const endTime = performance.now();
    setMetrics(prev => ({
      ...prev,
      clickToRoute: endTime - startTime,
    }));

    if (item) {
      trackNavigation({
        type: 'click',
        item: item.id,
        path,
        timestamp: Date.now(),
        sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      });
    }
  }, [navigate]);

  // Keyboard navigation handler
  useEffect(() => {
    if (!manifest.settings?.enableKeyboardShortcuts) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Check for command palette (Cmd+K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // TODO: Open command palette
        return;
      }

      // Check for navigation shortcuts (g + key)
      if (e.key === 'g') {
        let nextKey = '';

        const handleNextKey = (e2: KeyboardEvent) => {
          nextKey = e2.key;

          const item = visibleItems.find(i =>
            i.keyboard === `g ${nextKey}`
          );

          if (item) {
            e2.preventDefault();
            navigateTo(item.path, item);
            trackNavigation({
              type: 'keyboard',
              item: item.id,
              path: item.path,
              timestamp: Date.now(),
              sessionId: sessionStorage.getItem('sessionId') || 'unknown',
            });
          }

          window.removeEventListener('keydown', handleNextKey);
        };

        window.addEventListener('keydown', handleNextKey);
        setTimeout(() => {
          window.removeEventListener('keydown', handleNextKey);
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [visibleItems, navigateTo, manifest.settings]);

  // Toggle legacy mode
  const toggleLegacyMode = useCallback(() => {
    setIsLegacyMode(prev => !prev);
    localStorage.setItem('navigationLegacyMode', String(!isLegacyMode));
  }, [isLegacyMode]);

  // Load legacy mode preference
  useEffect(() => {
    const stored = localStorage.getItem('navigationLegacyMode');
    if (stored === 'true') {
      setIsLegacyMode(true);
    }
  }, []);

  return {
    manifest,
    visibleItems,
    searchTerm,
    setSearchTerm,
    searchResults,
    breadcrumbs,
    contextualActions,
    navigateTo,
    metrics,
    isLegacyMode,
    toggleLegacyMode,
  };
};

// Hook for navigation context (breadcrumbs and actions)
export const useNavigationContext = (): NavigationContext => {
  const { breadcrumbs, contextualActions } = useNavigation();
  const location = useLocation();

  return {
    path: location.pathname.split('/').filter(Boolean),
    params: new URLSearchParams(location.search).entries() as any,
    breadcrumbs,
    actions: contextualActions,
  };
};

// Hook for navigation search
export const useNavigationSearch = () => {
  const { searchTerm, setSearchTerm, searchResults } = useNavigation();

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
  };
};

// Hook for navigation metrics
export const useNavigationMetrics = () => {
  const { metrics } = useNavigation();

  return metrics;
};