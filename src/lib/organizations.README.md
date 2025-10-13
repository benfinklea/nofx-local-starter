# Organization Types for Multi-Tenancy

Comprehensive TypeScript types and interfaces for organization-based multi-tenancy in the NOFX Control Plane.

## Overview

This module provides type-safe data structures for:

- **Organization management** - Core organization entities with settings and metadata
- **User roles & permissions** - Hierarchical role system with granular permissions
- **Resource quotas** - Configurable limits and usage tracking
- **Billing integration** - Stripe subscription management
- **Project isolation** - Organization-scoped projects and resources
- **Workspace isolation** - Secure multi-tenant artifact storage

## Files

- `organizations.types.ts` - Type definitions, enums, and utility functions
- `organizations.example.ts` - Usage examples and patterns
- `organizations.README.md` - This documentation

## Core Types

### Organization

The primary entity representing a tenant in the multi-tenancy system.

```typescript
interface Organization {
  id: string;                      // Unique identifier (org_abc123)
  name: string;                    // Display name
  slug: string;                    // URL-safe identifier
  owner_id: string;                // User ID of owner
  settings: OrganizationSettings;  // Configuration
  quotas: ResourceQuotas;          // Usage limits
  usage: ResourceUsage;            // Current consumption
  billing: BillingInfo;            // Subscription data
  metadata?: JsonValue;            // Custom data
  created_at: string;              // ISO 8601 timestamp
  updated_at: string;              // ISO 8601 timestamp
}
```

### OrganizationRole

Hierarchical role system with predefined permission sets.

```typescript
enum OrganizationRole {
  OWNER = 'owner',     // Full control including deletion
  ADMIN = 'admin',     // Management permissions
  MEMBER = 'member',   // Resource creation rights
  VIEWER = 'viewer',   // Read-only access
}
```

**Role Hierarchy:** OWNER > ADMIN > MEMBER > VIEWER

### OrganizationPermission

Granular permissions for fine-grained access control.

```typescript
enum OrganizationPermission {
  // Organization
  ORG_READ = 'org:read',
  ORG_WRITE = 'org:write',
  ORG_DELETE = 'org:delete',

  // Members
  MEMBERS_READ = 'members:read',
  MEMBERS_WRITE = 'members:write',
  MEMBERS_DELETE = 'members:delete',

  // Projects
  PROJECTS_READ = 'projects:read',
  PROJECTS_WRITE = 'projects:write',
  PROJECTS_DELETE = 'projects:delete',

  // Runs
  RUNS_READ = 'runs:read',
  RUNS_WRITE = 'runs:write',
  RUNS_DELETE = 'runs:delete',

  // Artifacts
  ARTIFACTS_READ = 'artifacts:read',
  ARTIFACTS_WRITE = 'artifacts:write',
  ARTIFACTS_DELETE = 'artifacts:delete',

  // Billing
  BILLING_READ = 'billing:read',
  BILLING_MANAGE = 'billing:manage',

  // Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',
}
```

### SubscriptionPlan

Plan tiers with different quotas and features.

```typescript
enum SubscriptionPlan {
  FREE = 'free',              // Basic features, limited quotas
  PROFESSIONAL = 'professional',  // Small teams
  TEAM = 'team',              // Growing organizations
  ENTERPRISE = 'enterprise',  // Custom quotas, all features
}
```

## Usage Examples

### Creating an Organization

```typescript
import {
  OrganizationRole,
  SubscriptionPlan,
  SubscriptionStatus,
  IsolationLevel,
  getDefaultQuotas,
} from './organizations.types';

const org: Organization = {
  id: 'org_abc123',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  owner_id: 'user_xyz789',
  settings: {
    isolation_level: IsolationLevel.STRICT,
    features: {
      advanced_analytics: true,
      api_access: true,
    },
  },
  quotas: getDefaultQuotas(SubscriptionPlan.PROFESSIONAL),
  usage: {
    projects_count: 0,
    runs_this_month: 0,
    storage_used_gb: 0,
    members_count: 1,
    // ... other usage fields
    last_calculated_at: new Date().toISOString(),
  },
  billing: {
    plan: SubscriptionPlan.PROFESSIONAL,
    status: SubscriptionStatus.ACTIVE,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

### Managing Members

```typescript
import { OrganizationRole, getDefaultPermissions } from './organizations.types';

const membership: OrganizationMembership = {
  id: 'mem_123',
  organization_id: 'org_abc',
  user_id: 'user_xyz',
  role: OrganizationRole.MEMBER,
  permissions: getDefaultPermissions(OrganizationRole.MEMBER),
  joined_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

### Checking Permissions

```typescript
import {
  hasMinimumRole,
  OrganizationRole,
  OrganizationPermission,
} from './organizations.types';

// Check role hierarchy
if (hasMinimumRole(userRole, OrganizationRole.ADMIN)) {
  // User has admin or owner role
  performAdminAction();
}

// Check specific permission
function canUserPerformAction(
  membership: OrganizationMembership,
  permission: OrganizationPermission
): boolean {
  const userPermissions = membership.permissions ||
                          getDefaultPermissions(membership.role);
  return userPermissions.includes(permission);
}

if (canUserPerformAction(membership, OrganizationPermission.PROJECTS_WRITE)) {
  createProject();
}
```

### Quota Management

```typescript
import { hasExceededQuota, hasActiveSubscription } from './organizations.types';

// Check if organization can create a project
function canCreateProject(org: Organization): boolean {
  if (!hasActiveSubscription(org)) {
    return false;
  }

  if (hasExceededQuota(org, 'max_projects')) {
    return false;
  }

  return true;
}

// Check multiple quotas
function canStartRun(org: Organization): boolean {
  return (
    hasActiveSubscription(org) &&
    !hasExceededQuota(org, 'max_runs_per_month') &&
    !hasExceededQuota(org, 'max_concurrent_runs')
  );
}
```

### Project Isolation

```typescript
const project: ProjectWithOrganization = {
  id: 'proj_123',
  organization_id: 'org_abc',  // Organization ownership
  name: 'Mobile App',
  repo_url: 'https://github.com/acme/mobile-app',
  workspace_mode: 'clone',
  default_branch: 'main',
  git_mode: 'advanced',
  initialized: true,
  created_by: 'user_xyz',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

## Default Quotas by Plan

### Free Tier
- Projects: 3
- Concurrent runs: 1
- Runs per month: 100
- API calls per month: 1,000
- Storage: 5 GB
- Members: 1
- Artifacts per run: 10

### Professional Tier
- Projects: 10
- Concurrent runs: 3
- Runs per month: 1,000
- API calls per month: 10,000
- Storage: 50 GB
- Members: 5
- Artifacts per run: 50

### Team Tier
- Projects: 50
- Concurrent runs: 10
- Runs per month: 10,000
- API calls per month: 100,000
- Storage: 200 GB
- Members: 20
- Artifacts per run: 200

### Enterprise Tier
- Projects: Unlimited
- Concurrent runs: 50
- Runs per month: Unlimited
- API calls per month: Unlimited
- Storage: 1000 GB
- Members: Unlimited
- Artifacts per run: 1000

## Permission Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View organization | ✓ | ✓ | ✓ | ✓ |
| Update settings | ✓ | ✓ | ✗ | ✗ |
| Delete organization | ✓ | ✗ | ✗ | ✗ |
| Invite members | ✓ | ✓ | ✗ | ✗ |
| Remove members | ✓ | ✓ | ✗ | ✗ |
| Create projects | ✓ | ✓ | ✓ | ✗ |
| Delete projects | ✓ | ✓ | ✗ | ✗ |
| Create runs | ✓ | ✓ | ✓ | ✗ |
| View runs | ✓ | ✓ | ✓ | ✓ |
| Manage billing | ✓ | ✗ | ✗ | ✗ |

## Type Guards

Use type guards to validate data at runtime:

```typescript
import {
  isOrganizationRole,
  isOrganizationPermission,
  isSubscriptionStatus,
  isOrganization,
} from './organizations.types';

// Validate user input
if (isOrganizationRole(userInput)) {
  assignRole(userInput);  // TypeScript knows this is valid
}

// Validate API response
const response = await fetchOrganization(id);
if (isOrganization(response)) {
  processOrganization(response);  // Type-safe
}
```

## Integration with Existing Types

### Project Type

The existing `Project` type is extended with `organization_id`:

```typescript
// Existing type (from shared/types.ts)
type Project = {
  id: string;
  name: string;
  repo_url?: string | null;
  local_path?: string | null;
  workspace_mode?: 'local_path'|'clone'|'worktree';
  default_branch?: string | null;
  git_mode?: 'hidden' | 'basic' | 'advanced';
  initialized?: boolean;
};

// Extended for organizations
interface ProjectWithOrganization extends Project {
  organization_id: string;  // New field
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}
```

### Authentication Integration

Works with the existing authentication system:

```typescript
// src/lib/auth.ts
import { isAdmin } from '../lib/auth';

// Check if user is admin (existing)
if (isAdmin(req)) {
  // Allow access
}

// Check organization membership (new)
if (hasMinimumRole(membership.role, OrganizationRole.ADMIN)) {
  // Allow organization-level access
}
```

## Database Schema

These types map to the following database tables:

### `public.teams` (Organizations)
```sql
CREATE TABLE public.teams (
  id uuid PRIMARY KEY,
  name varchar(255) NOT NULL,
  slug varchar(255) UNIQUE,
  owner_id uuid REFERENCES auth.users(id),
  settings jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### `public.team_members` (Memberships)
```sql
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY,
  team_id uuid REFERENCES public.teams(id),
  user_id uuid REFERENCES auth.users(id),
  role varchar(50) NOT NULL,
  permissions jsonb DEFAULT '["read"]',
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);
```

### `public.team_invites` (Invitations)
```sql
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY,
  team_id uuid REFERENCES public.teams(id),
  inviter_id uuid REFERENCES auth.users(id),
  email varchar(255) NOT NULL,
  role varchar(50) DEFAULT 'member',
  token varchar(255) UNIQUE NOT NULL,
  status varchar(50) DEFAULT 'pending',
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Best Practices

### 1. Always Check Subscriptions

```typescript
if (!hasActiveSubscription(org)) {
  throw new Error('Organization subscription is not active');
}
```

### 2. Validate Quotas Before Operations

```typescript
if (hasExceededQuota(org, 'max_projects')) {
  throw new Error('Project quota exceeded');
}
```

### 3. Use Type Guards for User Input

```typescript
const role = parseUserInput(req.body.role);
if (!isOrganizationRole(role)) {
  return res.status(400).json({ error: 'Invalid role' });
}
```

### 4. Default to Least Privilege

```typescript
// Default new members to MEMBER role, not ADMIN
const membership = addMember(userId, OrganizationRole.MEMBER);
```

### 5. Audit Permission Changes

```typescript
if (oldRole !== newRole) {
  await recordEvent(orgId, 'member.role_changed', {
    user_id: userId,
    old_role: oldRole,
    new_role: newRole,
    changed_by: adminUserId,
  });
}
```

## Error Handling

```typescript
// Quota exceeded
if (hasExceededQuota(org, 'max_runs_per_month')) {
  throw new ApiError(429, 'Monthly run quota exceeded', {
    quota: org.quotas.max_runs_per_month,
    current: org.usage.runs_this_month,
    plan: org.billing.plan,
  });
}

// Insufficient permissions
if (!hasMinimumRole(membership.role, OrganizationRole.ADMIN)) {
  throw new ApiError(403, 'Admin role required', {
    required_role: OrganizationRole.ADMIN,
    user_role: membership.role,
  });
}

// Subscription inactive
if (!hasActiveSubscription(org)) {
  throw new ApiError(402, 'Subscription required', {
    status: org.billing.status,
    plan: org.billing.plan,
  });
}
```

## Testing

```typescript
import {
  OrganizationRole,
  SubscriptionPlan,
  getDefaultQuotas,
  hasMinimumRole,
} from './organizations.types';

describe('Organization Types', () => {
  it('should enforce role hierarchy', () => {
    expect(hasMinimumRole(OrganizationRole.OWNER, OrganizationRole.ADMIN)).toBe(true);
    expect(hasMinimumRole(OrganizationRole.MEMBER, OrganizationRole.ADMIN)).toBe(false);
  });

  it('should provide correct quotas for plans', () => {
    const freeQuotas = getDefaultQuotas(SubscriptionPlan.FREE);
    const proQuotas = getDefaultQuotas(SubscriptionPlan.PROFESSIONAL);

    expect(proQuotas.max_projects).toBeGreaterThan(freeQuotas.max_projects);
  });
});
```

## Migration Guide

To integrate these types into existing code:

1. **Update Project Type**
   ```typescript
   // Add organization_id to project records
   ALTER TABLE project ADD COLUMN organization_id UUID REFERENCES teams(id);
   ```

2. **Update Run Creation**
   ```typescript
   // Include organization context
   const run = await createRun(plan, projectId, userId, organizationId);
   ```

3. **Add Permission Checks**
   ```typescript
   // Before allowing operations
   const membership = await getMembership(userId, organizationId);
   if (!canUserPerformAction(membership, OrganizationPermission.RUNS_WRITE)) {
     throw new Error('Insufficient permissions');
   }
   ```

## Future Enhancements

- [ ] Custom role creation with permission builder
- [ ] Audit log query interface
- [ ] Usage analytics and forecasting
- [ ] Quota notification system
- [ ] Multi-factor authentication enforcement
- [ ] SSO integration types
- [ ] Workspace encryption settings

## References

- `src/shared/types.ts` - Core type definitions
- `src/lib/store/types.ts` - Store interface
- `supabase/migrations/20241227_team_management.sql` - Database schema
- `src/lib/auth.ts` - Authentication system

## License

Part of the NOFX Control Plane project.
