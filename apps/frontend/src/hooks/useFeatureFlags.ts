/**
 * Feature flags hook for navigation system
 */

import { useState, useEffect } from 'react';

interface FeatureFlags {
  [key: string]: boolean;
}

interface UseFeatureFlagsReturn {
  flags: FeatureFlags;
  loading: boolean;
  error: string | null;
  isEnabled: (flag: string) => boolean;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate feature flags loading
    setTimeout(() => {
      setFlags({
        responsesEnabled: true,
        betaFeatures: false,
        navigation: true
      });
      setLoading(false);
    }, 100);
  }, []);

  const isEnabled = (flag: string): boolean => {
    return flags[flag] ?? false;
  };

  return {
    flags,
    loading,
    error,
    isEnabled
  };
}