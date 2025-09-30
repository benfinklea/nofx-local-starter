/**
 * Middleware for automatic token refresh
 * Runs on every request to ensure auth tokens are always fresh
 *
 * This is critical for preventing "session expired" errors in production
 */

import { createMiddlewareClient } from './src/lib/supabase/middleware';

interface MiddlewareRequest {
  url: string;
  headers: Headers;
  cookies: Map<string, string>;
}

interface MiddlewareResponse {
  headers: Headers;
}

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name) {
      cookies.set(name, valueParts.join('='));
    }
  });

  return cookies;
}

/**
 * Middleware function for Vercel edge runtime
 */
export async function middleware(request: MiddlewareRequest) {
  // Parse cookies from request
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);

  // Create response with headers
  const response: MiddlewareResponse = {
    headers: new Headers()
  };

  // Create Supabase client for middleware
  const supabase = createMiddlewareClient(
    { headers: request.headers, cookies },
    response
  );

  // Trigger token refresh by calling getUser()
  // This will automatically refresh expired tokens
  await supabase.auth.getUser();

  // Return response with updated cookies
  return response;
}

/**
 * Configure which routes should run through middleware
 * Exclude static files and images for performance
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - images and other static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};