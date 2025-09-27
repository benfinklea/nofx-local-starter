/**
 * OAuth Callback Route - completes Supabase social login.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog } from '../../src/auth/supabase';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const DEFAULT_NEXT = '/#/runs';

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

  // Check for Supabase hash fragments (they come as hash, not query params)
  // In production, these are usually handled client-side
  const code = req.query.code as string | undefined;
  const access_token = req.query.access_token as string | undefined;
  const refresh_token = req.query.refresh_token as string | undefined;

  if (!code && !access_token) {
    // If we don't have a code or tokens, this might be the first redirect from oauth-start
    // We should show a page that handles the hash fragments client-side
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Completing sign in...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f9fc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 12px 30px rgba(31, 41, 55, 0.08); text-align: center; max-width: 400px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #1a202c; }
    p { color: #4a5568; font-size: 0.95rem; }
    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <h1>Completing sign in...</h1>
    <div class="spinner"></div>
    <p id="status">Processing authentication...</p>
  </div>
  <script>
    // Extract hash parameters and convert to query string
    const hash = window.location.hash.substring(1);
    const statusEl = document.getElementById('status');

    console.log('OAuth callback - Hash detected:', hash ? 'Yes' : 'No');
    console.log('Current search params:', window.location.search);

    if (hash) {
      statusEl.textContent = 'Validating credentials...';
      const params = new URLSearchParams(hash);
      const queryString = window.location.search;
      const existingParams = new URLSearchParams(queryString);

      // Add hash params to query
      for (const [key, value] of params) {
        existingParams.set(key, value);
      }

      // Redirect with hash params as query params
      const newUrl = window.location.pathname + '?' + existingParams.toString();
      console.log('Redirecting to:', newUrl);
      setTimeout(() => {
        window.location.replace(newUrl);
      }, 100); // Small delay to show status
    } else {
      // If no hash, it might already be in query params
      if (window.location.search.includes('access_token')) {
        statusEl.textContent = 'Finalizing sign in...';
      } else {
        statusEl.textContent = 'Missing authorization data. Please try signing in again.';
        document.querySelector('.spinner').style.display = 'none';
      }
    }
  </script>
</body>
</html>`;
    return res.status(200).send(html);
  }

  const next = sanitizeNextParam(req.query.next);

  try {
    let session, user;

    if (access_token && refresh_token) {
      // Tokens were provided directly (from hash fragment conversion)
      const { data: userData, error: userError } = await supabase.auth.getUser(access_token);

      if (userError || !userData?.user) {
        console.error('Failed to get user with token:', userError);
        return res.status(500).send('<p>Failed to complete Google sign-in.</p>');
      }

      session = {
        access_token,
        refresh_token,
        // Set a default expiry (Supabase tokens typically last 1 hour)
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      user = userData.user;
    } else if (code) {
      // Exchange code for session (traditional OAuth flow)
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data?.session || !data.user) {
        console.error('OAuth exchange error:', error?.message || 'Unknown error');
        return res.status(500).send('<p>Failed to complete Google sign-in.</p>');
      }

      session = data.session;
      user = data.user;
    } else {
      return res.status(400).send('<p>No authentication data provided.</p>');
    }

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
          // Store in the format the frontend auth service expects
          const authSession = {
            session: {
              access_token: data.accessToken,
              refresh_token: '${session.refresh_token || ''}',
              expires_at: ${session.expires_at || 'null'}
            },
            user: ${JSON.stringify(user)}
          };

          // Store for auth service
          localStorage.setItem('auth_session', JSON.stringify(authSession));

          // Also store legacy format for compatibility
          localStorage.setItem('sb-access-token', data.accessToken);
          localStorage.setItem('authenticated', 'true');

          console.log('OAuth complete - stored auth session');
        }
      } catch (err) {
        console.warn('Unable to write auth session to localStorage', err);
      }

      // Redirect to the app
      // Fix the redirect URL if it's the old format
      let redirectUrl = data.next || '${DEFAULT_NEXT}';
      if (redirectUrl.includes('/ui/app/#')) {
        redirectUrl = redirectUrl.replace('/ui/app/#', '/#');
      }
      console.log('Redirecting to:', redirectUrl);
      window.location.replace(redirectUrl);
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
