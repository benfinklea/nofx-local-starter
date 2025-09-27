/**
 * Global middleware for all API routes
 * Handles authentication for protected endpoints
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, isPublicPath } from './auth-middleware';

export default async function middleware(req: VercelRequest, res: VercelResponse) {
  // Get the path from the URL
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  // Allow CORS for all API endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check if this is a public path
  if (isPublicPath(path)) {
    // Continue to the endpoint handler
    return;
  }

  // Verify authentication for protected paths
  const authResult = await verifyAuth(req);

  if ('error' in authResult) {
    return res.status(401).json({
      error: authResult.error,
      redirect: '/login.html'
    });
  }

  // Attach user to request for use in endpoint handlers
  (req as any).user = authResult.user;

  // Continue to the endpoint handler
}

export const config = {
  matcher: '/api/:path*',
};