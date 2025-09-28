/**
 * React hook for loading and managing navigation manifest
 * Phase 1.5 - Track A: Navigation Framework & Layout Shell
 */

import { useState, useEffect, useCallback } from 'react';
import { NavigationManifest, validateManifest } from '@nofx/shared';

interface UseNavigationManifestReturn {
  manifest: NavigationManifest | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  updateManifest: (manifest: NavigationManifest) => void;
}

// Cache for the manifest
let manifestCache: {
  data: NavigationManifest | null;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to load and manage the navigation manifest
 */
export function useNavigationManifest(): UseNavigationManifestReturn {
  const [manifest, setManifest] = useState<NavigationManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load manifest from server or cache
   */
  const loadManifest = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      if (manifestCache && Date.now() - manifestCache.timestamp < CACHE_TTL) {
        setManifest(manifestCache.data);
        setLoading(false);
        return;
      }

      // Fetch from server
      const response = await fetch('/api/navigation/manifest');
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate manifest
      const validation = validateManifest(data);
      if (!validation.valid) {
        console.error('Manifest validation errors:', validation.errors);
        throw new Error('Invalid manifest format');
      }

      if (validation.warnings) {
        console.warn('Manifest validation warnings:', validation.warnings);
      }

      // Update cache
      manifestCache = {
        data,
        timestamp: Date.now(),
      };

      setManifest(data);
    } catch (err) {
      console.error('Failed to load navigation manifest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // Fall back to default manifest in development
      if (process.env.NODE_ENV === 'development') {
        try {
          // Try to load from local file
          const response = await fetch('/config/navigation.manifest.json');
          const data = await response.json();
          setManifest(data);
        } catch {
          // Use a minimal fallback
          setManifest({
            version: '1.0.0',
            updatedAt: new Date().toISOString(),
            groups: [],
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
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reload manifest from server (bypass cache)
   */
  const reload = useCallback(async () => {
    manifestCache = null;
    await loadManifest();
  }, [loadManifest]);

  /**
   * Update manifest locally (useful for dev tools)
   */
  const updateManifest = useCallback((newManifest: NavigationManifest) => {
    const validation = validateManifest(newManifest);
    if (!validation.valid) {
      console.error('Invalid manifest:', validation.errors);
      return;
    }

    manifestCache = {
      data: newManifest,
      timestamp: Date.now(),
    };
    setManifest(newManifest);
  }, []);

  // Load manifest on mount
  useEffect(() => {
    loadManifest();

    // Set up hot reload in development
    if (process.env.NODE_ENV === 'development') {
      const ws = new WebSocket('ws://localhost:3001/nav-hot-reload');

      ws.onmessage = (event) => {
        if (event.data === 'reload') {
          // console.log('Navigation manifest changed, reloading...');
          reload();
        }
      };

      ws.onerror = (err) => {
        console.debug('Navigation hot reload not available:', err);
      };

      return () => {
        ws.close();
      };
    }
  }, [loadManifest, reload]);

  // Listen for manual reload events
  useEffect(() => {
    const handleReload = () => reload();
    window.addEventListener('nofx:nav:reload', handleReload);
    return () => window.removeEventListener('nofx:nav:reload', handleReload);
  }, [reload]);

  return {
    manifest,
    loading,
    error,
    reload,
    updateManifest,
  };
}