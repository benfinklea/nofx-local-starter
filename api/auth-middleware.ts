/**
 * Authentication middleware for Vercel serverless functions
 * Validates JWT tokens from Supabase Auth
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create service client for server-side auth
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

/**
 * Extract JWT token from request
 */
function getTokenFromRequest(req: VercelRequest): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  const cookies = req.headers.cookie?.split('; ') || [];
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === 'sb-access-token' || name === 'supabase-auth-token') {
      return value || null;
    }
  }

  return null;
}

/**
 * Verify JWT token and get user
 */
export async function verifyAuth(req: VercelRequest): Promise<{ user: any } | { error: string }> {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return { error: 'No authentication token provided' };
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { error: 'Invalid or expired token' };
    }

    return { user };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { error: 'Authentication failed' };
  }
}

/**
 * Middleware wrapper for protected endpoints
 */
export function withAuth(
  handler: (req: VercelRequest, res: VercelResponse, user: any) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authResult = await verifyAuth(req);

    if ('error' in authResult) {
      return res.status(401).json({ error: authResult.error });
    }

    return handler(req, res, authResult.user);
  };
}

/**
 * Check if a path should be public (no auth required)
 */
export function isPublicPath(path: string): boolean {
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/callback',
    '/api/auth/reset-password',
    '/api/auth/verify',
    '/api/health',
    '/login.html',
    '/signup.html',
    '/reset-password.html',
    '/reset-password',
  ];

  return publicPaths.some(publicPath =>
    path === publicPath || path.startsWith(publicPath)
  );
}