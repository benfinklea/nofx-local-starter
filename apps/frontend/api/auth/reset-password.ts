import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    // Request password reset
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.VITE_APP_URL || 'https://nofx-local-starter.vercel.app'}/reset-password`,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        message: 'Password reset link sent to your email',
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // Update password with token
    const { password, access_token } = req.body;

    if (!password || !access_token) {
      return res.status(400).json({ error: 'Password and access token are required' });
    }

    try {
      // Set the session with the access token
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token: '', // Not needed for password update
      });

      if (sessionError) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Update the password
      const { data, error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Clear any existing session cookies and set new ones
      if (sessionData.session) {
        res.setHeader('Set-Cookie', [
          `sb-access-token=${sessionData.session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
          `sb-refresh-token=${sessionData.session.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
        ]);
      }

      return res.status(200).json({
        message: 'Password updated successfully',
        user: data.user,
      });
    } catch (error) {
      console.error('Password update error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}