/**
 * Auth Callback Handler for PKCE Flow
 * Handles OAuth and magic link callbacks
 *
 * This endpoint exchanges the authorization code for a session
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Extract code from query parameters
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Store cookies to be set
    const cookiesToSet: string[] = [];

    // Create Supabase client
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

    // Exchange code for session (PKCE flow)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Code exchange error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data.session) {
      return res.status(400).json({ error: 'Failed to create session' });
    }

    // Set cookies in response
    if (cookiesToSet.length > 0) {
      res.setHeader('Set-Cookie', cookiesToSet);
    }

    // Redirect to dashboard or return to app
    const redirectTo = Array.isArray(req.query.redirectTo)
      ? req.query.redirectTo[0]
      : req.query.redirectTo || '/';

    // Return success with redirect
    return res.status(200).json({
      success: true,
      redirectTo,
      user: data.user,
      session: {
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Auth callback error:', error);
    return res.status(500).json({
      error: 'Internal server error during authentication'
    });
  }
}