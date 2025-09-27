/**
 * OAuth Callback Route - completes Supabase social login.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog } from '../../src/auth/supabase';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const DEFAULT_NEXT = '/ui/app/#/runs';

const COOKIE_ACCESS_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const COOKIE_REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const errorDescription = req.query.error_description as string | undefined;
  if (errorDescription) {
    res.status(400).send(`<p>Google sign-in failed: ${errorDescription}</p>`);
    return;
  }

  const code = req.query.code as string | undefined;
  if (!code) {
    return res.status(400).send('<p>Missing authorization code.</p>');
  }

  const next = sanitizeNextParam(req.query.next);

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session || !data.user) {
      console.error('OAuth exchange error:', error?.message || 'Unknown error');
      return res.status(500).send('<p>Failed to complete Google sign-in.</p>');
    }

    const { session, user } = data;

    res.setHeader('Set-Cookie', [
      `sb-access-token=${session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_ACCESS_MAX_AGE}`,
      `sb-refresh-token=${session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_REFRESH_MAX_AGE}`
    ]);

    await createAuditLog(
      user.id,
      'auth.login',
      'session',
      session.access_token.substring(0, 8),
      { provider: 'google' },
      req as any
    );

    const scriptData = JSON.stringify({
      accessToken: session.access_token,
      next
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Signing in...</title>
  <meta http-equiv="refresh" content="5;url=${next}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f9fc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 12px 30px rgba(31, 41, 55, 0.08); text-align: center; max-width: 360px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #1a202c; }
    p { color: #4a5568; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Signing you in...</h1>
    <p>Hang tight, redirecting to your workspace.</p>
  </div>
  <script>
    (function() {
      var data = ${scriptData};
      try {
        if (data.accessToken) {
          localStorage.setItem('sb-access-token', data.accessToken);
          localStorage.setItem('authenticated', 'true');
        }
      } catch (err) {
        console.warn('Unable to write auth token to localStorage', err);
      }
      window.location.replace(data.next || '${DEFAULT_NEXT}');
    })();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('OAuth callback exception:', error);
    res.status(500).send('<p>Failed to complete Google sign-in.</p>');
  }
}
