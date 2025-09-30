/**
 * Supabase Client for Server-Side Rendering
 * Used in API routes and server-side operations
 *
 * IMPORTANT: Always use getUser() for authentication checks on the server
 * Never use getSession() - it doesn't validate the JWT authenticity
 */

import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

interface RequestLike {
  headers: Headers | Record<string, string>;
  cookies?: Map<string, string> | Record<string, string>;
}

interface ResponseLike {
  headers?: Headers;
  cookies?: Map<string, { value: string; options?: CookieOptions }>;
}

/**
 * Create a Supabase client for server-side operations
 * Handles cookies from request/response objects
 */
export function createServerSupabaseClient(req: RequestLike, res: ResponseLike) {
  // Extract cookies from request
  const getCookie = (name: string): string | undefined => {
    // Try from cookie header
    const cookieHeader = req.headers instanceof Headers
      ? req.headers.get('cookie')
      : req.headers['cookie'];

    if (cookieHeader) {
      const cookies = cookieHeader.split('; ');
      const cookie = cookies.find(c => c.startsWith(`${name}=`));
      if (cookie) {
        return cookie.split('=')[1];
      }
    }

    // Try from req.cookies if available
    if (req.cookies) {
      if (req.cookies instanceof Map) {
        return req.cookies.get(name);
      }
      return (req.cookies as Record<string, string>)[name];
    }

    return undefined;
  };

  // Store cookies to be set in response
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return getCookie(name);
      },
      set(name: string, value: string, options: CookieOptions) {
        cookiesToSet.push({ name, value, options });
      },
      remove(name: string, options: CookieOptions) {
        cookiesToSet.push({ name, value: '', options: { ...options, maxAge: 0 } });
      }
    }
  });

  // Function to apply cookies to response
  const applyCookies = () => {
    if (cookiesToSet.length === 0) return;

    // Store in response object for later retrieval
    if (!res.cookies) {
      res.cookies = new Map();
    }

    cookiesToSet.forEach(({ name, value, options }) => {
      if (res.cookies instanceof Map) {
        res.cookies.set(name, { value, options });
      }
    });
  };

  return { supabase, applyCookies };
}

/**
 * Helper to format cookies for Set-Cookie header
 */
export function formatCookieHeader(cookies: Map<string, { value: string; options?: CookieOptions }>): string[] {
  const headers: string[] = [];

  cookies.forEach(({ value, options }, name) => {
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

    headers.push(cookie);
  });

  return headers;
}

/**
 * Verify user authentication
 * ALWAYS use this in API routes and server-side code
 *
 * @returns User object if authenticated, null otherwise
 */
export async function getAuthenticatedUser(req: RequestLike, res: ResponseLike) {
  const { supabase, applyCookies } = createServerSupabaseClient(req, res);

  try {
    // IMPORTANT: Use getUser() not getSession()
    // getUser() validates the JWT with Supabase Auth server
    const { data: { user }, error } = await supabase.auth.getUser();

    // Apply any cookie updates
    applyCookies();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}