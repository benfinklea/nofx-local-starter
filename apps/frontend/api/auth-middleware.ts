/**
 * Modern Authentication Middleware for Vercel Serverless Functions
 * Uses @supabase/ssr patterns for secure authentication
 *
 * This replaces the old manual JWT verification with modern patterns
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

/**
 * Parse cookies from request
 */
function getCookieFromRequest(req: VercelRequest, name: string): string | undefined {
  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split('; ');
  const cookie = cookies.find(c => c.startsWith(`${name}=`));
  return cookie?.split('=')[1];
}

/**
 * Format Set-Cookie header
 */
function formatSetCookie(name: string, value: string, options: any): string {
  let cookie = `${name}=${value}`;

  if (options?.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }
  if (options?.path) {
    cookie += `; Path=${options.path}`;
  }
  if (options?.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  if (options?.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }
  if (options?.secure) {
    cookie += '; Secure';
  }
  if (options?.httpOnly) {
    cookie += '; HttpOnly';
  }

  return cookie;
}

/**
 * Verify authentication and get user
 * ALWAYS use getUser() not getSession() for server-side auth
 *
 * @returns User object if authenticated, null otherwise
 */
export async function verifyAuth(req: VercelRequest): Promise<{ user: User } | { error: string }> {
  try {
    // Store cookies to be set
    const cookiesToSet: string[] = [];

    // Create Supabase client with cookie handling
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return getCookieFromRequest(req, name);
        },
        set(name: string, value: string, options: any) {
          cookiesToSet.push(formatSetCookie(name, value, options));
        },
        remove(name: string, options: any) {
          cookiesToSet.push(formatSetCookie(name, '', { ...options, maxAge: 0 }));
        }
      }
    });

    // CRITICAL: Use getUser() not getSession()
    // getUser() validates the JWT with Supabase Auth server
    const { data: { user }, error } = await supabase.auth.getUser();

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
 * Use this to wrap API handlers that require authentication
 */
export function withAuth(
  handler: (req: VercelRequest, res: VercelResponse, user: User) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authResult = await verifyAuth(req);

    if ('error' in authResult) {
      return res.status(401).json({
        error: authResult.error,
        login: '/login'
      });
    }

    // Add user to request for convenience
    (req as any).user = authResult.user;

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