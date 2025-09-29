/**
 * Navigation Telemetry component for tracking navigation metrics
 * Phase 1.5 - Track C implementation
 */

import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationMetrics, useNavigation } from '../hooks/useNavigation';
import {
  NavigationAnalyticsEvent,
  NavigationMetrics,
} from '@shared/navigation';

// Performance observer for navigation timing
const observeNavigationTiming = (callback: (metrics: NavigationMetrics) => void) => {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          callback({
            renderTime: navEntry.loadEventEnd - navEntry.loadEventStart,
            manifestLoadTime: navEntry.responseEnd - navEntry.requestStart,
            clickToRoute: navEntry.domContentLoadedEventEnd - navEntry.navigationStart,
          });
        }
      });
    });

    observer.observe({ type: 'navigation', buffered: true });
    return () => observer.disconnect();
  }
  return () => {};
};

// Track page view duration
const trackPageDuration = (page: string): (() => void) => {
  const startTime = Date.now();

  return () => {
    const duration = Date.now() - startTime;
    const metrics = {
      page,
      duration,
      timestamp: startTime,
    };

    // Store locally for analytics
    const stored = localStorage.getItem('navigationMetrics') || '[]';
    try {
      const existing = JSON.parse(stored);
      existing.push(metrics);
      // Keep only last 100 entries
      const trimmed = existing.slice(-100);
      localStorage.setItem('navigationMetrics', JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to store navigation metrics:', e);
    }

    // Send to analytics service if available
    if (window.analytics?.track) {
      window.analytics.track('page_duration', metrics);
    }
  };
};

// Calculate bounce rate
const calculateBounceRate = (): number => {
  const stored = localStorage.getItem('navigationMetrics');
  if (!stored) return 0;

  try {
    const metrics = JSON.parse(stored);
    if (metrics.length === 0) return 0;

    // A bounce is defined as a single page view with duration < 10 seconds
    const bounces = metrics.filter((m: any) => m.duration < 10000).length;
    return (bounces / metrics.length) * 100;
  } catch (e) {
    console.error('Failed to calculate bounce rate:', e);
    return 0;
  }
};

// Calculate average time to feature
const calculateTimeToFeature = (): Record<string, number> => {
  const stored = localStorage.getItem('navigationMetrics');
  if (!stored) return {};

  try {
    const metrics = JSON.parse(stored);
    const featureTimes: Record<string, number[]> = {};

    metrics.forEach((m: any) => {
      const feature = m.page.split('/')[1] || 'dashboard';
      if (!featureTimes[feature]) {
        featureTimes[feature] = [];
      }
      featureTimes[feature].push(m.duration);
    });

    const averages: Record<string, number> = {};
    Object.entries(featureTimes).forEach(([feature, times]) => {
      averages[feature] = times.reduce((a, b) => a + b, 0) / times.length;
    });

    return averages;
  } catch (e) {
    console.error('Failed to calculate time to feature:', e);
    return {};
  }
};

export default function NavigationTelemetry() {
  const location = useLocation();
  const metrics = useNavigationMetrics();
  const { manifest } = useNavigation();
  const [sessionId] = React.useState(() =>
    sessionStorage.getItem('sessionId') ||
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Store session ID
  React.useEffect(() => {
    sessionStorage.setItem('sessionId', sessionId);
  }, [sessionId]);

  // Track page views and duration
  React.useEffect(() => {
    const stopTracking = trackPageDuration(location.pathname);

    // Track page view event
    const event: NavigationAnalyticsEvent = {
      type: 'click',
      item: location.pathname,
      path: location.pathname,
      timestamp: Date.now(),
      sessionId,
      metadata: {
        referrer: document.referrer,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
    };

    // Send to analytics
    if (window.analytics?.track) {
      window.analytics.track('page_view', event);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      // console.log('[Navigation Telemetry] Page View:', event);
    }

    return stopTracking;
  }, [location.pathname, sessionId]);

  // Track performance metrics
  React.useEffect(() => {
    const unsubscribe = observeNavigationTiming((navMetrics) => {
      const fullMetrics: NavigationMetrics = {
        ...navMetrics,
        ...metrics,
        bounceRate: calculateBounceRate(),
        timeToFeature: calculateTimeToFeature(),
      };

      // Send to monitoring service
      if (window.analytics?.track) {
        window.analytics.track('navigation_performance', fullMetrics);
      }

      // Log in development
      if (process.env.NODE_ENV === 'development') {
        // console.log('[Navigation Telemetry] Performance:', fullMetrics);
      }

      // Check SLIs/SLOs
      if (manifest?.settings?.enableTelemetry) {
        // Navigation render time SLO: < 150ms
        if (fullMetrics.renderTime > 150) {
          console.warn('[Navigation SLO Violation] Render time exceeded 150ms:', fullMetrics.renderTime);
        }

        // Manifest load time SLO: < 1000ms
        if (fullMetrics.manifestLoadTime > 1000) {
          console.warn('[Navigation SLO Violation] Manifest load time exceeded 1s:', fullMetrics.manifestLoadTime);
        }
      }
    });

    return unsubscribe;
  }, [metrics, manifest]);

  // Track errors
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.filename?.includes('navigation') || event.filename?.includes('Navigation')) {
        const errorEvent = {
          type: 'error',
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack,
          timestamp: Date.now(),
          sessionId,
          page: location.pathname,
        };

        // Send to error tracking
        if (window.analytics?.track) {
          window.analytics.track('navigation_error', errorEvent);
        }

        console.error('[Navigation Telemetry] Error:', errorEvent);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [sessionId, location.pathname]);

  // This component doesn't render anything
  return null;
}

// Export analytics utilities for use in other components
export const navigationAnalytics = {
  trackEvent: (event: Partial<NavigationAnalyticsEvent>) => {
    const fullEvent: NavigationAnalyticsEvent = {
      type: event.type || 'click',
      item: event.item || '',
      path: event.path || window.location.pathname,
      timestamp: event.timestamp || Date.now(),
      sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      metadata: event.metadata,
    };

    if (window.analytics?.track) {
      window.analytics.track('navigation_event', fullEvent);
    }

    if (process.env.NODE_ENV === 'development') {
      // console.log('[Navigation Analytics]', fullEvent);
    }
  },

  getMetrics: (): NavigationMetrics => {
    const stored = localStorage.getItem('navigationMetrics');
    const metrics = stored ? JSON.parse(stored) : [];

    return {
      renderTime: 0, // Would be calculated from real performance data
      manifestLoadTime: 0, // Would be calculated from real performance data
      bounceRate: calculateBounceRate(),
      timeToFeature: calculateTimeToFeature(),
    };
  },

  clearMetrics: () => {
    localStorage.removeItem('navigationMetrics');
  },
};