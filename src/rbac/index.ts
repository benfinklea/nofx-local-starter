/**
 * RBAC Module - Role-Based Access Control for NOFX Control Plane
 *
 * Comprehensive organization-aware RBAC system with permission validation,
 * role hierarchy checking, Express middleware, and BackplaneStore integration.
 *
 * @module rbac
 *
 * @example
 * ```typescript
 * import { RBACService, createRBACMiddleware, OrganizationRole, OrganizationPermission } from './rbac';
 * import { BackplaneStore } from './storage/backplane/store';
 *
 * // Initialize RBAC
 * const store = new BackplaneStore();
 * const rbac = new RBACService({ store });
 * const middleware = createRBACMiddleware({ rbacService: rbac });
 *
 * // Use in routes
 * app.post('/orgs/:orgId/projects',
 *   middleware.requirePermission(OrganizationPermission.PROJECTS_WRITE),
 *   createProject
 * );
 *
 * app.delete('/orgs/:orgId',
 *   middleware.requireRole(OrganizationRole.ADMIN),
 *   deleteOrganization
 * );
 *
 * // Check in handlers
 * async function updateProject(req, res) {
 *   const canUpdate = await rbac.checkPermission(
 *     req.user.id,
 *     req.params.orgId,
 *     OrganizationPermission.PROJECTS_WRITE
 *   );
 *   if (!canUpdate) {
 *     return res.status(403).json({ error: 'Forbidden' });
 *   }
 *   // ... update logic
 * }
 * ```
 */

// Core RBAC service
export { RBACService } from './RBACService';
export type {
  RBACServiceOptions,
  OrganizationContext,
} from './RBACService';

// Express middleware
export {
  createRBACMiddleware,
  hasPermissionInContext,
  hasRoleInContext,
} from './middleware';
export type {
  RBACMiddlewareOptions,
} from './middleware';

// Permission validation functions
export {
  hasRequiredRole,
  getRoleLevel,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getEffectivePermissions,
  validatePermission,
  validateRole,
  isReadOnlyPermission,
  isWritePermission,
  isDeletePermission,
  getResourcePermissions,
  canPerformAction,
} from './permissions';
export type {
  PermissionCheckResult,
} from './permissions';

// Re-export organization types for convenience
export {
  OrganizationRole,
  OrganizationPermission,
  hasMinimumRole,
  getDefaultPermissions,
  isOrganizationRole,
  isOrganizationPermission,
} from '../lib/organizations.types';
