# 📋 Navigation Framework Documentation
**Phase 1.5 - Track A: Navigation Framework & Layout Shell**

## Overview

The NOFX Control Plane Navigation Framework provides a manifest-driven approach to navigation management. This system replaces the legacy hard-coded navigation with a flexible, permission-aware, and dynamically configurable solution.

## Architecture

### Core Components

1. **Navigation Manifest** (`config/navigation.manifest.json`)
   - JSON configuration defining all navigation items, groups, and settings
   - Environment-specific overrides
   - Permission and feature flag definitions

2. **Nav Composer Library** (`packages/shared/src/nav-composer.ts`)
   - Runtime manifest processing
   - Permission resolution
   - Search and filtering
   - Event tracking and metrics

3. **Manifest Shell Component** (`apps/frontend/src/components/ManifestShell.tsx`)
   - React component rendering the navigation UI
   - Responsive design with mobile, tablet, and desktop breakpoints
   - Keyboard shortcut support
   - Breadcrumb navigation

4. **Validation Pipeline** (`scripts/validate-navigation.ts`)
   - CI/CD integration for manifest validation
   - Best practice enforcement
   - Duplicate detection

## Quick Start

### 1. Add a New Navigation Item

Edit `config/navigation.manifest.json`:

```json
{
  "items": [
    {
      "id": "my-feature",
      "label": "My Feature",
      "path": "/my-feature",
      "icon": "Star",
      "type": "route",
      "status": "stable",
      "groupId": "main",
      "order": 10,
      "telemetryId": "nav.my-feature",
      "owner": "my-team",
      "permissions": {
        "featureFlag": "myFeatureEnabled"
      }
    }
  ]
}
```

### 2. Validate the Manifest

```bash
npm run nav:validate
```

### 3. Use in Frontend

```tsx
import ManifestShell from '@/components/ManifestShell';

function App() {
  return (
    <ManifestShell>
      <YourPageContent />
    </ManifestShell>
  );
}
```

## Navigation Manifest Schema

### Item Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier |
| `label` | string | ✅ | Display text |
| `path` | string | ⚪ | Route path or external URL |
| `icon` | string | ⚪ | Material UI icon name |
| `type` | enum | ⚪ | `route`, `external`, `action`, `divider`, `group` |
| `status` | enum | ⚪ | `stable`, `beta`, `alpha`, `deprecated`, `coming_soon` |
| `groupId` | string | ⚪ | Parent group ID |
| `order` | number | ⚪ | Sort order within group |
| `permissions` | object | ⚪ | Access control configuration |
| `owner` | string | ⚪ | Team or individual responsible |
| `docsUrl` | string | ⚪ | Documentation link |
| `telemetryId` | string | ⚪ | Analytics tracking ID |
| `badge` | object | ⚪ | Notification badge configuration |
| `shortcut` | string | ⚪ | Keyboard shortcut |
| `children` | array | ⚪ | Nested navigation items |

### Permission Configuration

```json
{
  "permissions": {
    "roles": ["admin", "operator"],        // Required roles (OR)
    "permissions": ["read", "write"],       // Required permissions (OR)
    "featureFlag": "betaFeatures",         // Required feature flag
    "customCheck": "canAccessFeature"      // Custom permission function
  }
}
```

### Badge Types

```json
{
  "badge": {
    "type": "count",     // count, dot, or text
    "value": 5,          // Number, string, or boolean
    "color": "primary"   // MUI color name
  }
}
```

## Permission System

### Context Provider

The navigation system requires a context with user information:

```tsx
const context: NavigationContext = {
  userRoles: ['admin', 'user'],
  userPermissions: ['read', 'write'],
  featureFlags: {
    betaFeatures: true,
    responsesEnabled: false
  },
  environment: 'production'
};
```

### Resolution Logic

1. **Feature Flags**: Checked first, item hidden if flag is false
2. **Roles**: User must have at least one of the specified roles
3. **Permissions**: User must have at least one of the specified permissions
4. **Custom Checks**: Custom functions for complex logic

## Keyboard Shortcuts

Define shortcuts in the manifest:

```json
{
  "shortcut": "g d"  // Press 'g' then 'd' to navigate
}
```

Common patterns:
- `g X` - Go to X (navigation)
- `cmd+X` - Command actions
- `/` - Focus search
- `?` - Show help

## Environment Overrides

Apply different configurations per environment:

```json
{
  "overrides": [
    {
      "environment": "production",
      "itemId": "dev-tools",
      "overrides": {
        "permissions": {
          "roles": ["super-admin"]
        }
      }
    }
  ]
}
```

## Search Integration

The navigation framework includes built-in search:

```tsx
const composer = new NavigationComposer(manifest, context);
const results = composer.searchItems('dashboard');
```

Search matches against:
- Item labels
- Item paths
- Item metadata

## Telemetry & Analytics

### Event Types

- `nav.item.clicked` - Navigation item clicked
- `nav.search.performed` - Search executed
- `nav.shortcut.used` - Keyboard shortcut used
- `nav.breadcrumb.clicked` - Breadcrumb navigation
- `nav.sidebar.toggled` - Sidebar opened/closed

### Metrics Collection

```tsx
const metrics = composer.getMetrics();
console.log({
  renderTime: metrics.renderTime,
  visibleItems: metrics.visibleItems,
  topItems: metrics.topItems,
  searchStats: metrics.searchStats
});
```

## Developer Tools

### Navigation Console

Access the developer console at `/dev/navigation` to:
- View manifest validation status
- Check permission resolution
- Test navigation flows
- Monitor performance metrics

### Validation CLI

```bash
# Validate manifest
npm run nav:validate

# Export validation report
npm run nav:validate -- --output=report.json

# CI mode (fail on warnings)
CI=true npm run nav:validate
```

## Migration Guide

### From Legacy Shell to Manifest Shell

#### 1. Update Component Import

**Before:**
```tsx
import Shell from '@/components/Shell';
```

**After:**
```tsx
import ManifestShell from '@/components/ManifestShell';
```

#### 2. Update Navigation Items

**Before (Shell.tsx):**
```tsx
const items = [
  { text: 'Dashboard', icon: <DashboardIcon/>, to: '/' },
  { text: 'Runs', icon: <PlayArrowIcon/>, to: '/runs' }
];
```

**After (navigation.manifest.json):**
```json
{
  "items": [
    {
      "id": "dashboard",
      "label": "Dashboard",
      "path": "/",
      "icon": "Dashboard"
    },
    {
      "id": "runs",
      "label": "Runs",
      "path": "/runs",
      "icon": "PlayArrow"
    }
  ]
}
```

#### 3. Add Permission Checks

**Before:**
```tsx
{uiFlags.responses ? { text: 'Responses', ... } : null}
```

**After:**
```json
{
  "id": "responses",
  "label": "Responses",
  "permissions": {
    "featureFlag": "responsesEnabled"
  }
}
```

#### 4. Hook Integration

```tsx
// Add required hooks
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useNavigationManifest } from '@/hooks/useNavigationManifest';

// These provide context to the navigation system
```

### Rollback Strategy

Enable the legacy navigation toggle:

```tsx
// In App.tsx
const useLegacyNav = process.env.REACT_APP_USE_LEGACY_NAV === 'true';

return useLegacyNav ? (
  <Shell>{children}</Shell>
) : (
  <ManifestShell>{children}</ManifestShell>
);
```

## Best Practices

### 1. Naming Conventions

- **IDs**: Use kebab-case (`my-feature`)
- **Telemetry IDs**: Use dot notation (`nav.my-feature`)
- **Groups**: Use semantic names (`main`, `operations`, `admin`)

### 2. Icon Selection

Use Material UI icon names consistently:
- Navigation: `Dashboard`, `PlayArrow`, `Storage`
- Actions: `Add`, `Edit`, `Delete`
- Status: `Warning`, `Error`, `Success`

### 3. Permission Design

- Use feature flags for beta/experimental features
- Use roles for access levels (admin, operator, viewer)
- Use permissions for specific actions (read, write, delete)

### 4. Performance

- Keep manifest size under 50KB
- Limit nesting to 3 levels
- Use lazy loading for heavy features
- Enable caching in production

### 5. Testing

```tsx
// Test navigation visibility
const composer = new NavigationComposer(manifest, {
  userRoles: ['admin'],
  featureFlags: { beta: true }
});

const items = composer.getResolvedItems();
expect(items.find(i => i.id === 'admin-panel')).toBeDefined();
```

## Troubleshooting

### Items Not Visible

1. Check permissions in manifest
2. Verify user context (roles, flags)
3. Check environment overrides
4. Validate manifest structure

### Shortcuts Not Working

1. Ensure `enableShortcuts: true` in settings
2. Check for conflicts
3. Verify focus is not in input field

### Performance Issues

1. Enable caching
2. Reduce manifest complexity
3. Use production build
4. Check render metrics

## API Reference

### NavigationComposer

```typescript
class NavigationComposer {
  constructor(manifest?: NavigationManifest, context?: NavigationContext);

  // Core methods
  getResolvedItems(): ResolvedNavigationItem[];
  getResolvedGroups(): NavigationGroup[];
  searchItems(query: string): ResolvedNavigationItem[];
  getBreadcrumbs(path: string): Breadcrumb[];

  // State management
  setManifest(manifest: NavigationManifest): void;
  setContext(context: NavigationContext): void;

  // Events
  on(type: NavigationEventType, handler: Function): () => void;
  handleItemClick(itemId: string): void;

  // Utilities
  getShortcuts(): Map<string, NavigationItem>;
  getMetrics(): NavigationMetrics;
}
```

## Support

- **Documentation**: [docs.nofx.ai/navigation](https://docs.nofx.ai/navigation)
- **Issues**: [github.com/nofx/control-plane/issues](https://github.com/nofx/control-plane/issues)
- **Slack**: #nofx-nav-revamp

## Changelog

### v1.0.0 (Phase 1.5)
- Initial manifest-driven navigation framework
- Permission and feature flag support
- Keyboard shortcuts
- Search integration
- Breadcrumb navigation
- Developer console
- Validation pipeline