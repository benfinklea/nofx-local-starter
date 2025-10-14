/**
 * Express Request type extensions
 * Augments the Express Request interface with custom properties
 */

import { User } from '@supabase/supabase-js';
import type { TeamRole } from './teams';
import type { OrganizationRole, OrganizationPermission } from '../lib/organizations.types';

declare global {
  namespace Express {
    interface Request {
      // Authentication properties
      user?: User;
      userId?: string;
      userTier?: 'free' | 'pro' | 'enterprise';
      apiKeyId?: string;

      // Team management properties (legacy)
      teamRole?: TeamRole;
      teamId?: string;

      // Organization RBAC properties
      /** Current organization ID from request context */
      organizationId?: string;
      /** User's role in the current organization */
      organizationRole?: OrganizationRole;
      /** User's effective permissions in the current organization */
      organizationPermissions?: readonly OrganizationPermission[];
    }
  }
}

export {};
