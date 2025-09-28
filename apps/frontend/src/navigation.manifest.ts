/**
 * Navigation manifest for the NOFX Control Plane
 * Phase 1.5 - Track C implementation
 */

import { NavigationManifest } from '@nofx/shared/navigation/types';

export const navigationManifest: NavigationManifest = {
  version: '1.0.0',
  items: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: 'Dashboard',
      metadata: {
        owner: 'platform-team',
        stability: 'stable',
        docs: '/docs/dashboard.md',
        tests: ['dashboard.test.ts', 'dashboard.e2e.ts'],
      },
      telemetry: {
        eventName: 'nav_dashboard_click',
        category: 'navigation',
      },
      keyboard: 'g d',
      searchTerms: ['home', 'overview', 'dashboard'],
      order: 1,
    },
    {
      id: 'runs',
      label: 'Runs',
      path: '/runs',
      icon: 'PlayArrow',
      group: 'operations',
      metadata: {
        owner: 'platform-team',
        stability: 'stable',
        docs: '/docs/runs.md',
        tests: ['runs.test.ts', 'runs.e2e.ts'],
        envVars: ['VITE_RUNS_API_URL'],
      },
      telemetry: {
        eventName: 'nav_runs_click',
        category: 'navigation',
      },
      keyboard: 'g r',
      searchTerms: ['runs', 'executions', 'jobs', 'tasks'],
      order: 2,
      children: [
        {
          id: 'runs-new',
          label: 'New Run',
          path: '/runs/new',
          metadata: {
            owner: 'platform-team',
            stability: 'stable',
          },
          contextual: true,
          keyboard: 'g n',
          searchTerms: ['new run', 'create run', 'start run'],
        },
      ],
    },
    {
      id: 'builder',
      label: 'Builder',
      path: '/builder',
      icon: 'Build',
      group: 'development',
      metadata: {
        owner: 'platform-team',
        stability: 'beta',
        docs: '/docs/builder.md',
        tests: ['builder.test.ts'],
      },
      telemetry: {
        eventName: 'nav_builder_click',
        category: 'navigation',
      },
      keyboard: 'g b',
      searchTerms: ['builder', 'create', 'develop', 'construct'],
      badge: {
        text: 'Beta',
        type: 'beta',
      },
      order: 3,
    },
    {
      id: 'responses',
      label: 'Responses',
      path: '/responses',
      icon: 'Chat',
      group: 'operations',
      metadata: {
        owner: 'ai-team',
        stability: 'alpha',
        docs: '/docs/responses.md',
        tests: ['responses.test.tsx'],
      },
      telemetry: {
        eventName: 'nav_responses_click',
        category: 'navigation',
      },
      rolloutFlag: 'responses',
      keyboard: 'g p',
      searchTerms: ['responses', 'messages', 'chat', 'conversations'],
      badge: {
        text: 'Alpha',
        type: 'alpha',
      },
      order: 4,
    },
    {
      id: 'observability',
      label: 'Observability',
      path: '/observability',
      icon: 'Analytics',
      group: 'monitoring',
      metadata: {
        owner: 'platform-team',
        stability: 'stable',
        docs: '/docs/observability.md',
        tests: ['observability.test.ts'],
        envVars: ['VITE_METRICS_API_URL', 'VITE_LOGS_API_URL'],
      },
      telemetry: {
        eventName: 'nav_observability_click',
        category: 'navigation',
      },
      keyboard: 'g o',
      searchTerms: ['observability', 'monitoring', 'metrics', 'logs', 'traces'],
      order: 5,
      children: [
        {
          id: 'observability-metrics',
          label: 'Metrics',
          path: '/observability/metrics',
          metadata: {
            owner: 'platform-team',
            stability: 'stable',
          },
          contextual: true,
        },
        {
          id: 'observability-logs',
          label: 'Logs',
          path: '/observability/logs',
          metadata: {
            owner: 'platform-team',
            stability: 'stable',
          },
          contextual: true,
        },
        {
          id: 'observability-traces',
          label: 'Traces',
          path: '/observability/traces',
          metadata: {
            owner: 'platform-team',
            stability: 'beta',
          },
          contextual: true,
          badge: {
            text: 'Beta',
            type: 'beta',
          },
        },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      path: '/projects',
      icon: 'Storage',
      group: 'resources',
      metadata: {
        owner: 'platform-team',
        stability: 'stable',
        docs: '/docs/projects.md',
        tests: ['projects.test.ts'],
      },
      telemetry: {
        eventName: 'nav_projects_click',
        category: 'navigation',
      },
      keyboard: 'g j',
      searchTerms: ['projects', 'repositories', 'workspaces'],
      order: 6,
    },
    {
      id: 'models',
      label: 'Models',
      path: '/models',
      icon: 'Storage',
      group: 'resources',
      metadata: {
        owner: 'ai-team',
        stability: 'stable',
        docs: '/docs/models.md',
        tests: ['models.test.ts'],
      },
      telemetry: {
        eventName: 'nav_models_click',
        category: 'navigation',
      },
      keyboard: 'g m',
      searchTerms: ['models', 'ai', 'ml', 'machine learning'],
      order: 7,
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/settings',
      icon: 'Settings',
      group: 'system',
      metadata: {
        owner: 'platform-team',
        stability: 'stable',
        docs: '/docs/settings.md',
        tests: ['settings.test.ts'],
      },
      telemetry: {
        eventName: 'nav_settings_click',
        category: 'navigation',
      },
      keyboard: 'g s',
      searchTerms: ['settings', 'configuration', 'preferences', 'options'],
      order: 8,
    },
    {
      id: 'dlq',
      label: 'Dead Letter Queue',
      path: '/dlq',
      icon: 'Warning',
      group: 'monitoring',
      metadata: {
        owner: 'platform-team',
        stability: 'stable',
        docs: '/docs/dlq.md',
        tests: ['dlq.test.ts'],
      },
      telemetry: {
        eventName: 'nav_dlq_click',
        category: 'navigation',
      },
      keyboard: 'g q',
      searchTerms: ['dlq', 'dead letter queue', 'errors', 'failed'],
      order: 9,
    },
    {
      id: 'dev',
      label: 'Developer',
      path: '/dev',
      icon: 'Code',
      group: 'development',
      permissions: {
        role: 'admin',
      },
      metadata: {
        owner: 'platform-team',
        stability: 'experimental',
        docs: '/docs/dev-tools.md',
      },
      telemetry: {
        eventName: 'nav_dev_click',
        category: 'navigation',
      },
      keyboard: 'g v',
      searchTerms: ['developer', 'dev', 'tools', 'debug'],
      order: 10,
      children: [
        {
          id: 'dev-tools',
          label: 'Dev Tools',
          path: '/dev/tools',
          metadata: {
            owner: 'platform-team',
            stability: 'experimental',
          },
          contextual: true,
        },
      ],
    },
  ],
  groups: [
    {
      id: 'operations',
      label: 'Operations',
      order: 1,
    },
    {
      id: 'development',
      label: 'Development',
      order: 2,
    },
    {
      id: 'resources',
      label: 'Resources',
      order: 3,
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      order: 4,
    },
    {
      id: 'system',
      label: 'System',
      order: 5,
    },
  ],
  settings: {
    enableKeyboardShortcuts: true,
    enableSearch: true,
    enableTelemetry: true,
    enableFeedback: true,
    legacyMode: false,
  },
};