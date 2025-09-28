/**
 * OAuth Start Route - initiates Supabase social login.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { withCors } from '../_lib/cors';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const DEFAULT_APP_URL = 'https://nofx-control-plane.vercel.app';
const DEFAULT_NEXT = '/#/runs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

function getAppUrl(): string {
  return process.env.APP_URL || DEFAULT_APP_URL;
}

function sanitizeNextParam(nextParam?: string | string[]): string {
  if (!nextParam) {
    return DEFAULT_NEXT;
  }

  const value = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  if (!value) {
    return DEFAULT_NEXT;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return DEFAULT_NEXT;
  }

  if (!value.startsWith('/')) {
    return DEFAULT_NEXT;
  }

  return value;
}

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const provider = (req.query.provider as string) || 'google';
  if (provider !== 'google') {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  const next = sanitizeNextParam(req.query.next);
  const appUrl = getAppUrl();

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${appUrl.replace(/\/$/, '')}/api/auth/oauth-callback?provider=google&next=${encodeURIComponent(next)}`,
        scopes: 'openid email profile'
      }
    });

    if (error || !data?.url) {
      console.error('OAuth start error:', error?.message || 'No redirect URL');
      return res.status(500).json({ error: 'Failed to initiate Google sign-in' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: data.url });
    res.end();
  } catch (error) {
    console.error('OAuth start exception:', error);
    res.status(500).json({ error: 'Failed to initiate Google sign-in' });
  }
});
