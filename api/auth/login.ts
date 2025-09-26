/**
 * Login API Route - Vercel Function
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog } from '../../src/auth/supabase';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.warn('Login failed:', error.message);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!data.user || !data.session) {
      return res.status(401).json({ error: 'Login failed' });
    }

    // Create audit log
    await createAuditLog(
      data.user.id,
      'auth.login',
      'session',
      data.session.access_token.substring(0, 8),
      { email }
    );

    // Set secure cookies
    res.setHeader('Set-Cookie', [
      `sb-access-token=${data.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`,
      `sb-refresh-token=${data.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
    ]);

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: data.user.confirmed_at != null
      },
      session: {
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}