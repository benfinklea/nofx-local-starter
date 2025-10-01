/**
 * Tenant-Scoped Authentication
 * Provides user and tenant context for multi-tenant APIs
 */

import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface TenantContext {
  userId: string;
  email?: string;
  tenantId: string;
  isAuthenticated: boolean;
}

/**
 * Extract tenant context from request
 * Validates Supabase JWT and extracts user + tenant info
 */
export async function getTenantContext(req: VercelRequest): Promise<TenantContext | null> {
  // Get auth token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    // No auth token - return null (unauthenticated)
    return null;
  }

  try {
    // Create Supabase client with service role key to verify JWT
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Auth token validation failed:', error?.message);
      return null;
    }

    // Get tenant_id from user metadata or default to 'local'
    // In production, this would come from a users->tenants mapping table
    const tenantId = user.user_metadata?.tenant_id ||
                     user.app_metadata?.tenant_id ||
                     'local';

    return {
      userId: user.id,
      email: user.email,
      tenantId,
      isAuthenticated: true
    };
  } catch (error) {
    console.error('Failed to get tenant context:', error);
    return null;
  }
}

/**
 * Require authentication - returns tenant context or throws 401
 */
export async function requireAuth(req: VercelRequest): Promise<TenantContext> {
  const context = await getTenantContext(req);

  if (!context) {
    throw new Error('Authentication required');
  }

  return context;
}

/**
 * Check if user is platform admin (can manage all tenants)
 */
export function isPlatformAdmin(context: TenantContext): boolean {
  // Platform admins have special role in metadata
  // For now, hardcode based on email or add to user metadata
  const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',');
  return adminEmails.includes(context.email || '');
}

/**
 * Set tenant context in database connection
 * This is used by RLS policies
 */
export function setTenantContext(tenantId: string): string {
  // Returns SQL to set session variable for RLS
  return `SET LOCAL app.tenant_id = '${tenantId.replace(/'/g, "''")}'`;
}
