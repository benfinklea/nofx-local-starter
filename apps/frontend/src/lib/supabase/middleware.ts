/**
 * Supabase Client for Middleware
 * Handles automatic token refresh for all requests
 *
 * This should be used in middleware.ts to ensure tokens are always fresh
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

interface MiddlewareRequest {
  headers: Headers;
  cookies: Map<string, string>;
}

interface MiddlewareResponse {
  headers: Headers;
}

/**
 * Create a Supabase client for middleware
 * This client automatically refreshes expired tokens
 */
export function createMiddlewareClient(
  request: MiddlewareRequest,
  response: MiddlewareResponse
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name);
      },
      set(name: string, value: string, options: CookieOptions) {
        // Set in both request (for current request) and response (for browser)
        request.cookies.set(name, value);
        response.headers.set('Set-Cookie', formatSetCookie(name, value, options));
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.delete(name);
        response.headers.set('Set-Cookie', formatSetCookie(name, '', { ...options, maxAge: 0 }));
      }
    }
  });
}

/**
 * Format a Set-Cookie header value
 */
function formatSetCookie(name: string, value: string, options: CookieOptions): string {
  let cookie = `${name}=${value}`;

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }
  if (options.path) {
    cookie += `; Path=${options.path}`;
  }
  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }
  if (options.secure) {
    cookie += '; Secure';
  }
  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }

  return cookie;
}