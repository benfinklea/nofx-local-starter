/**
 * Signup API Route - Vercel Function
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog, createServiceClient } from '../../src/auth/supabase';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, fullName, companyName, metadata } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Sign up user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
          ...metadata
        }
      }
    });

    if (error) {
      console.error('Signup failed:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data.user) {
      return res.status(400).json({ error: 'Signup failed' });
    }

    // Update user profile with additional data
    if (companyName) {
      const serviceClient = createServiceClient();
      if (serviceClient) {
        await serviceClient
          .from('users')
          .update({ company_name: companyName })
          .eq('id', data.user.id);
      }
    }

    // Create audit log
    await createAuditLog(
      data.user.id,
      'auth.signup',
      'user',
      data.user.id,
      { email }
    );

    // Set secure cookies if session created
    if (data.session) {
      res.setHeader('Set-Cookie', [
        `sb-access-token=${data.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`,
        `sb-refresh-token=${data.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
      ]);
    }

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: data.user.confirmed_at != null
      },
      session: data.session ? {
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at
      } : null,
      message: data.user.confirmed_at ? 'Account created successfully' : 'Please check your email to verify your account'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
}