# RBAC System for NOFX Control Plane

Comprehensive Role-Based Access Control system with organization multi-tenancy support.

## Overview

The RBAC system provides:

- **Type-safe permission checking** - Full TypeScript support with strict types
- **Role hierarchy** - OWNER > ADMIN > MEMBER > VIEWER
- **Custom permission overrides** - Extend role permissions per user
- **Express middleware** - Easy route protection
- **Caching** - High-performance permission checks
- **Organization isolation** - Multi-tenant aware
- **Comprehensive error messages** - Clear feedback for denied access

## Architecture

```
src/rbac/
├── permissions.ts        # Permission validation functions
├── RBACService.ts        # Core RBAC service class
├── middleware.ts         # Express middleware
├── index.ts             # Clean exports
└── README.md            # This file
```

## Quick Start

### 1. Initialize RBAC Service

```typescript
import { BackplaneStore } from '../storage/backplane/store';
import { RBACService, createRBACMiddleware } from '../rbac';

// Initialize store and RBAC service
const store = new BackplaneStore({ path: './data/backplane.db' });
const rbac = new RBACService({
  store,
  enableCache: true,
  cacheTtl: 60000 // 1 minute
});

// Create middleware
const rbacMiddleware = createRBACMiddleware({ rbacService: rbac });
```

### 2. Protect Routes with Middleware

```typescript
import { OrganizationRole, OrganizationPermission } from '../lib/organizations.types';

// Require specific permission
app.post('/api/orgs/:orgId/projects',
  rbacMiddleware.requirePermission(OrganizationPermission.PROJECTS_WRITE),
  createProject
);

// Require minimum role
app.delete('/api/orgs/:orgId',
  rbacMiddleware.requireRole(OrganizationRole.ADMIN),
  deleteOrganization
);

// Require organization membership only
app.get('/api/orgs/:orgId',
  rbacMiddleware.requireOrganizationAccess(),
  getOrganization
);

// Optional organization context (doesn't block)
app.get('/api/projects',
  rbacMiddleware.optionalOrganizationAccess(),
  listProjects
);
```

### 3. Check Permissions in Handlers

```typescript
import { hasPermissionInContext, hasRoleInContext } from '../rbac';

async function updateProject(req: Request, res: Response) {
  // Check permission dynamically
  if (!hasPermissionInContext(req, OrganizationPermission.PROJECTS_WRITE)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Or check role
  if (!hasRoleInContext(req, OrganizationRole.MEMBER)) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  // Access organization context
  const { organizationId, organizationRole, organizationPermissions } = req;

  // ... update logic
}
```

### 4. Programmatic Permission Checks

```typescript
// Check permission
const canCreate = await rbac.checkPermission(
  userId,
  organizationId,
  OrganizationPermission.PROJECTS_CREATE
);

// Check role
const isAdmin = await rbac.checkRole(
  userId,
  organizationId,
  OrganizationRole.ADMIN
);

// Get all permissions
const permissions = await rbac.getUserPermissions(userId, organizationId);

// Get user's role
const role = await rbac.getUserRole(userId, organizationId);

// Check membership
const isMember = await rbac.isMember(userId, organizationId);
```

## Roles and Permissions

### Role Hierarchy

1. **OWNER** - Full control, including deletion and billing
2. **ADMIN** - Can manage members, settings, and resources
3. **MEMBER** - Can create and manage own resources
4. **VIEWER** - Read-only access

### Permission Categories

**Organization**
- `org:read` - View organization details
- `org:write` - Update organization settings
- `org:delete` - Delete organization (owner only)

**Members**
- `members:read` - View organization members
- `members:write` - Invite and manage members
- `members:delete` - Remove members (admin+)

**Projects**
- `projects:read` - View projects
- `projects:write` - Create and update projects
- `projects:delete` - Delete projects

**Runs**
- `runs:read` - View runs and their status
- `runs:write` - Create and execute runs
- `runs:delete` - Cancel and delete runs

**Artifacts**
- `artifacts:read` - View artifacts
- `artifacts:write` - Upload artifacts
- `artifacts:delete` - Delete artifacts

**Billing**
- `billing:read` - View billing information
- `billing:manage` - Manage billing and subscriptions (owner only)

**Settings**
- `settings:read` - View organization settings
- `settings:write` - Modify organization settings

### Default Role Permissions

```typescript
// OWNER: All permissions
// ADMIN: All except org:delete and billing:manage
// MEMBER: Read + write on own resources
// VIEWER: Read only
```

## Advanced Usage

### Custom Permission Overrides

```typescript
// Add custom permissions to a member
store.addOrganizationMember({
  organization_id: 'org_abc',
  user_id: 'user_123',
  role: OrganizationRole.MEMBER,
  permissions: [
    // Member permissions + additional admin permission
    OrganizationPermission.MEMBERS_WRITE
  ]
});
```

### Detailed Permission Validation

```typescript
// Get detailed validation result
const result = await rbac.validatePermissionCheck(
  userId,
  organizationId,
  OrganizationPermission.MEMBERS_DELETE
);

if (!result.granted) {
  console.log('Reason:', result.reason);
  console.log('Effective permissions:', result.effectivePermissions);
}
```

### Cache Management

```typescript
// Clear all cache
rbac.clearCache();

// Clear cache for specific user
rbac.clearUserCache('user_123');

// Clear cache for specific organization
rbac.clearOrganizationCache('org_abc');
```

### Integration with AuthorizationService

```typescript
import { AuthorizationService } from '../auth/middleware/AuthorizationService';

// Create authorization service with RBAC
const authService = new AuthorizationService({ rbacService: rbac });

// Use in routes
app.post('/api/orgs/:orgId/projects',
  authService.requireOrganizationPermission(OrganizationPermission.PROJECTS_WRITE),
  createProject
);

app.delete('/api/orgs/:orgId',
  authService.requireOrganizationRole(OrganizationRole.ADMIN),
  deleteOrganization
);
```

## Request Context

After successful authentication and authorization, the request object is enhanced with:

```typescript
interface Request {
  // Organization RBAC properties
  organizationId?: string;
  organizationRole?: OrganizationRole;
  organizationPermissions?: readonly OrganizationPermission[];
}
```

## Error Handling

### Error Responses

**401 Unauthorized**
```json
{
  "error": "Authentication required",
  "message": "Please authenticate to access this resource"
}
```

**403 Forbidden - Not a member**
```json
{
  "error": "Access denied: not a member of this organization",
  "message": "You are not a member of organization org_abc"
}
```

**403 Forbidden - Insufficient permission**
```json
{
  "error": "Insufficient permissions for this action",
  "message": "Permission denied: projects:delete is not granted to role member",
  "requiredPermission": "projects:delete"
}
```

**403 Forbidden - Insufficient role**
```json
{
  "error": "Insufficient role level for this action",
  "message": "Role level insufficient: member (level 2) < admin (level 3)",
  "requiredRole": "admin"
}
```

## Performance Considerations

### Caching

The RBAC service includes a built-in cache to optimize repeated permission checks:

- Default TTL: 60 seconds
- Configurable per instance
- Automatic expiration
- Manual cache clearing

### Best Practices

1. **Use middleware for route protection** - More efficient than handler checks
2. **Enable caching in production** - Significant performance improvement
3. **Clear cache on permission changes** - Keep authorization accurate
4. **Batch permission checks** - Use middleware to check once per request

## Testing

```typescript
import { RBACService } from '../rbac';
import { BackplaneStore } from '../storage/backplane/store';
import { OrganizationRole, OrganizationPermission } from '../lib/organizations.types';

describe('RBAC System', () => {
  let store: BackplaneStore;
  let rbac: RBACService;

  beforeEach(() => {
    store = new BackplaneStore({ path: ':memory:' });
    rbac = new RBACService({ store });

    // Create test organization
    const org = store.createOrganization({
      name: 'Test Org',
      owner_id: 'user_owner',
    });

    // Add members
    store.addOrganizationMember({
      organization_id: org.id,
      user_id: 'user_admin',
      role: OrganizationRole.ADMIN,
    });
  });

  it('should grant owner all permissions', async () => {
    const canDelete = await rbac.checkPermission(
      'user_owner',
      org.id,
      OrganizationPermission.ORG_DELETE
    );
    expect(canDelete).toBe(true);
  });

  it('should deny member admin permissions', async () => {
    const canDelete = await rbac.checkPermission(
      'user_member',
      org.id,
      OrganizationPermission.MEMBERS_DELETE
    );
    expect(canDelete).toBe(false);
  });

  it('should respect role hierarchy', async () => {
    const isAdmin = await rbac.checkRole(
      'user_admin',
      org.id,
      OrganizationRole.MEMBER
    );
    expect(isAdmin).toBe(true); // Admin >= Member
  });
});
```

## Migration Guide

### From Legacy Team-Based Authorization

```typescript
// OLD - Team-based
app.get('/teams/:teamId/projects',
  authService.requireTeamAccess('member'),
  getProjects
);

// NEW - Organization-based
app.get('/orgs/:orgId/projects',
  rbacMiddleware.requirePermission(OrganizationPermission.PROJECTS_READ),
  getProjects
);
```

## Security Considerations

1. **Always authenticate first** - RBAC checks require req.userId
2. **Validate organization IDs** - Ensure user has access to the org
3. **Use role hierarchy** - Don't check individual permissions when role check suffices
4. **Clear cache on changes** - Keep authorization decisions fresh
5. **Log authorization failures** - Monitor for security issues
6. **Use strict TypeScript** - Catch permission errors at compile time

## API Reference

See individual file JSDoc comments for detailed API documentation:

- [permissions.ts](./permissions.ts) - Permission validation functions
- [RBACService.ts](./RBACService.ts) - Core RBAC service
- [middleware.ts](./middleware.ts) - Express middleware

## Examples

### Complete Route Protection

```typescript
import express from 'express';
import { BackplaneStore } from '../storage/backplane/store';
import { RBACService, createRBACMiddleware, OrganizationRole, OrganizationPermission } from '../rbac';
import { AuthenticationService } from '../auth/middleware/AuthenticationService';

const app = express();
const store = new BackplaneStore();
const rbac = new RBACService({ store });
const rbacMiddleware = createRBACMiddleware({ rbacService: rbac });
const authService = new AuthenticationService();

// Organization management
app.get('/api/orgs/:orgId',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requireOrganizationAccess(),
  getOrganization
);

app.patch('/api/orgs/:orgId',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requireRole(OrganizationRole.ADMIN),
  updateOrganization
);

app.delete('/api/orgs/:orgId',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requireRole(OrganizationRole.OWNER),
  deleteOrganization
);

// Project management
app.post('/api/orgs/:orgId/projects',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requirePermission(OrganizationPermission.PROJECTS_WRITE),
  createProject
);

app.delete('/api/orgs/:orgId/projects/:projectId',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requirePermission(OrganizationPermission.PROJECTS_DELETE),
  deleteProject
);

// Member management
app.get('/api/orgs/:orgId/members',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requirePermission(OrganizationPermission.MEMBERS_READ),
  listMembers
);

app.post('/api/orgs/:orgId/members',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requirePermission(OrganizationPermission.MEMBERS_WRITE),
  inviteMember
);

app.delete('/api/orgs/:orgId/members/:userId',
  authService.requireAuth.bind(authService),
  rbacMiddleware.requirePermission(OrganizationPermission.MEMBERS_DELETE),
  removeMember
);
```

### Handler with Dynamic Checks

```typescript
import { Request, Response } from 'express';
import { hasPermissionInContext, hasRoleInContext } from '../rbac';
import { OrganizationRole, OrganizationPermission } from '../lib/organizations.types';

async function updateProject(req: Request, res: Response) {
  const { projectId } = req.params;
  const { organizationId, userId } = req;

  // Check if user owns the project
  const project = await getProject(projectId);
  const isOwner = project.created_by === userId;

  // Project owners can update their own projects
  // Or user needs PROJECTS_WRITE permission
  if (!isOwner && !hasPermissionInContext(req, OrganizationPermission.PROJECTS_WRITE)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update your own projects or need projects:write permission'
    });
  }

  // Only admins can change certain fields
  if (req.body.organization_id && !hasRoleInContext(req, OrganizationRole.ADMIN)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only admins can change project organization'
    });
  }

  // Perform update
  const updated = await updateProjectData(projectId, req.body);
  res.json(updated);
}
```

## Support

For questions or issues with the RBAC system:

1. Check this README for examples
2. Review JSDoc comments in source files
3. Check test files for usage patterns
4. Consult the NOFX Control Plane documentation

## License

Part of the NOFX Control Plane project.
