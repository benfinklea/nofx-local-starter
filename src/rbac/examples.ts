/**
 * RBAC Usage Examples
 *
 * Comprehensive examples demonstrating how to use the RBAC system
 * in various scenarios within the NOFX Control Plane.
 *
 * @module rbac/examples
 */

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, no-console -- Examples file with any types and console for demonstration */

import type { Request, Response, NextFunction } from 'express';
import { BackplaneStore } from '../storage/backplane/store';
import {
  RBACService,
  createRBACMiddleware,
  hasPermissionInContext,
  hasRoleInContext,
  OrganizationRole,
  OrganizationPermission,
} from './index';

// ============================================================================
// Example 1: Basic Setup
// ============================================================================

/**
 * Initialize RBAC system with BackplaneStore
 */
export function setupRBAC() {
  const store = new BackplaneStore({ path: './data/backplane.db' });

  const rbac = new RBACService({
    store,
    enableCache: true,
    cacheTtl: 60000, // 1 minute
  });

  const middleware = createRBACMiddleware({
    rbacService: rbac,
    errorMessages: {
      unauthenticated: 'Please log in to continue',
      notMember: 'You do not have access to this organization',
      insufficientPermission: 'You do not have permission to perform this action',
      insufficientRole: 'Your role is insufficient for this action',
    },
  });

  return { store, rbac, middleware };
}

// ============================================================================
// Example 2: Route Protection with Middleware
// ============================================================================

/**
 * Protect routes with permission-based middleware
 */
export function setupProtectedRoutes(app: any, middleware: ReturnType<typeof createRBACMiddleware>) {
  // Require specific permission
  app.post(
    '/api/orgs/:orgId/projects',
    middleware.requirePermission(OrganizationPermission.PROJECTS_WRITE),
    async (req: Request, res: Response) => {
      // req.organizationId is now available
      // req.organizationRole is now available
      // req.organizationPermissions is now available

      const project = await createProject(req.body);
      res.json(project);
    }
  );

  // Require minimum role level
  app.delete(
    '/api/orgs/:orgId',
    middleware.requireRole(OrganizationRole.ADMIN),
    async (req: Request, res: Response) => {
      await deleteOrganization(req.params.orgId);
      res.json({ success: true });
    }
  );

  // Require organization membership only
  app.get(
    '/api/orgs/:orgId',
    middleware.requireOrganizationAccess(),
    async (req: Request, res: Response) => {
      const org = await getOrganization(req.params.orgId);
      res.json(org);
    }
  );

  // Optional organization context (doesn't block request)
  app.get(
    '/api/projects',
    middleware.optionalOrganizationAccess(),
    async (req: Request, res: Response) => {
      // If organizationId is present, filter by org
      // Otherwise, show all projects user has access to
      const projects = req.organizationId
        ? await getOrgProjects(req.organizationId)
        : await getUserProjects(req.userId!);
      res.json(projects);
    }
  );
}

// ============================================================================
// Example 3: Programmatic Permission Checks
// ============================================================================

/**
 * Check permissions programmatically in handlers
 */
export async function programmaticChecks(rbac: RBACService) {
  const userId = 'user_123';
  const organizationId = 'org_abc';

  // Check if user has specific permission
  const canCreateProjects = await rbac.checkPermission(
    userId,
    organizationId,
    OrganizationPermission.PROJECTS_WRITE
  );

  if (canCreateProjects) {
    console.log('User can create projects');
  }

  // Check if user has minimum role
  const isAdmin = await rbac.checkRole(userId, organizationId, OrganizationRole.ADMIN);

  if (isAdmin) {
    console.log('User is admin or owner');
  }

  // Get all user permissions
  const permissions = await rbac.getUserPermissions(userId, organizationId);
  console.log('User permissions:', permissions);

  // Get user's role
  const role = await rbac.getUserRole(userId, organizationId);
  console.log('User role:', role);

  // Check if user is member
  const isMember = await rbac.isMember(userId, organizationId);
  console.log('Is member:', isMember);

  // Get all user organizations
  const orgs = await rbac.getUserOrganizations(userId);
  console.log('User organizations:', orgs);
}

// ============================================================================
// Example 4: Dynamic Permission Checks in Handlers
// ============================================================================

/**
 * Combine middleware and dynamic checks for complex authorization logic
 */
export async function complexAuthorizationHandler(req: Request, res: Response) {
  const { projectId } = req.params;
  const { organizationId, userId } = req;

  // Get project details
  const project = await getProject(projectId);

  // Check if user is the project creator
  const isCreator = project.created_by === userId;

  // Allow project creators to update their own projects
  // Or require PROJECTS_WRITE permission
  if (!isCreator && !hasPermissionInContext(req, OrganizationPermission.PROJECTS_WRITE)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update your own projects or need projects:write permission',
    });
  }

  // Only admins can change certain sensitive fields
  if (req.body.organization_id && !hasRoleInContext(req, OrganizationRole.ADMIN)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only admins can change project organization',
    });
  }

  // Perform update
  const updated = await updateProject(projectId, req.body);
  res.json(updated);
}

// ============================================================================
// Example 5: Detailed Permission Validation
// ============================================================================

/**
 * Get detailed information about why permission check failed
 */
export async function detailedValidation(rbac: RBACService) {
  const userId = 'user_123';
  const organizationId = 'org_abc';

  // Get detailed permission validation result
  const permissionResult = await rbac.validatePermissionCheck(
    userId,
    organizationId,
    OrganizationPermission.MEMBERS_DELETE
  );

  if (!permissionResult.granted) {
    console.log('Permission denied!');
    console.log('Reason:', permissionResult.reason);
    console.log('User has permissions:', permissionResult.effectivePermissions);
  }

  // Get detailed role validation result
  const roleResult = await rbac.validateRoleCheck(
    userId,
    organizationId,
    OrganizationRole.ADMIN
  );

  if (!roleResult.granted) {
    console.log('Role check failed!');
    console.log('Reason:', roleResult.reason);
  }
}

// ============================================================================
// Example 6: Cache Management
// ============================================================================

/**
 * Manage RBAC cache for performance and accuracy
 */
export function cacheManagement(rbac: RBACService) {
  // Clear all cache (e.g., after bulk permission changes)
  rbac.clearCache();

  // Clear cache for specific user (e.g., after role change)
  rbac.clearUserCache('user_123');

  // Clear cache for organization (e.g., after org settings change)
  rbac.clearOrganizationCache('org_abc');
}

// ============================================================================
// Example 7: Custom Permission Overrides
// ============================================================================

/**
 * Add custom permissions to members beyond their role defaults
 */
export function customPermissions(store: BackplaneStore) {
  // Add member with custom permissions
  store.addOrganizationMember({
    organization_id: 'org_abc',
    user_id: 'user_123',
    role: OrganizationRole.MEMBER,
    // Member gets default member permissions + additional admin permission
    permissions: [
      ...Array.from(
        require('../lib/organizations.types').getDefaultPermissions(OrganizationRole.MEMBER)
      ),
      OrganizationPermission.MEMBERS_WRITE,
    ],
  });
}

// ============================================================================
// Example 8: Integration with AuthorizationService
// ============================================================================

/**
 * Use RBAC with AuthorizationService for unified authorization
 */
export function authorizationServiceIntegration(rbac: RBACService) {
  const { AuthorizationService } = require('../auth/middleware/AuthorizationService');

  const authService = new AuthorizationService({ rbacService: rbac });

  // Use authorization service methods
  return {
    requireMembership: authService.requireOrganizationMembership.bind(authService),
    requirePermission: authService.requireOrganizationPermission.bind(authService),
    requireRole: authService.requireOrganizationRole.bind(authService),
  };
}

// ============================================================================
// Example 9: Multi-Organization Access
// ============================================================================

/**
 * Handle users with access to multiple organizations
 */
export async function multiOrgAccess(rbac: RBACService, req: Request, res: Response) {
  const { userId } = req;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  // Get all organizations user belongs to
  const organizations = await rbac.getUserOrganizations(userId);

  // For each organization, get user's role and permissions
  const orgDetails = await Promise.all(
    organizations.map(async (org) => ({
      id: org.id,
      name: org.name,
      role: org.user_role,
      permissions: await rbac.getUserPermissions(userId, org.id),
    }))
  );

  res.json(orgDetails);
}

// ============================================================================
// Example 10: Resource Ownership Checks
// ============================================================================

/**
 * Combine RBAC with resource ownership for fine-grained control
 */
export async function resourceOwnershipCheck(req: Request, res: Response) {
  const { projectId } = req.params;
  const { userId, organizationId } = req;

  // Get project
  const project = await getProject(projectId);

  // Check if user is the owner
  const isOwner = project.created_by === userId;

  // Allow project owners to delete their own projects
  // Or require PROJECTS_DELETE permission
  if (isOwner || hasPermissionInContext(req, OrganizationPermission.PROJECTS_DELETE)) {
    await deleteProject(projectId);
    return res.json({ success: true });
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'You can only delete your own projects or need projects:delete permission',
  });
}

// ============================================================================
// Helper Functions (Mock implementations for examples)
// ============================================================================

async function createProject(_data: any): Promise<any> {
  return { id: 'proj_123', name: 'Test Project' };
}

async function deleteOrganization(_orgId: string): Promise<void> {
  // Implementation
}

async function getOrganization(_orgId: string): Promise<any> {
  return { id: 'org_abc', name: 'Test Org' };
}

async function getOrgProjects(_orgId: string): Promise<any[]> {
  return [];
}

async function getUserProjects(_userId: string): Promise<any[]> {
  return [];
}

async function getProject(_projectId: string): Promise<any> {
  return { id: 'proj_123', created_by: 'user_123', organization_id: 'org_abc' };
}

async function updateProject(_projectId: string, _data: any): Promise<any> {
  return { id: 'proj_123', name: 'Updated Project' };
}

async function deleteProject(_projectId: string): Promise<void> {
  // Implementation
}
