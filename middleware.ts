/**
 * Vercel Edge Middleware for Authentication
 * Protects all routes except login and auth endpoints
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/signup-page',
  '/api/auth/reset-password',
  '/api/auth/update-password',
  '/api/auth/reset-password-confirm',
  '/api/health',
  '/login',
  '/signup',
  '/reset-password',
  '/_next',
  '/favicon',
];

// List of static file extensions to skip
const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files
  if (STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
    return NextResponse.next();
  }

  // Check if the route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    pathname.startsWith(route) || pathname === route
  );

  // Always allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for authentication
  const accessToken = request.cookies.get('sb-access-token');
  const refreshToken = request.cookies.get('sb-refresh-token');

  // Check for API key in headers for API routes
  const isApiRoute = pathname.startsWith('/api/');
  if (isApiRoute) {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      // API key authentication is handled by the API endpoint itself
      return NextResponse.next();
    }
  }

  // If no authentication tokens, redirect to login
  if (!accessToken && !refreshToken) {
    // For API routes, return 401 instead of redirecting
    if (isApiRoute) {
      return new NextResponse(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required'
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    // For web routes, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Optional: Validate token with Supabase
  // This would require making an async call to Supabase
  // For now, we'll just check if the token exists

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};