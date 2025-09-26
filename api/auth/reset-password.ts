/**
 * Password Reset API Route - Vercel Function
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog } from '../../src/auth/supabase';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, redirectTo } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Use the production URL for password reset
    // APP_URL should be set in Vercel environment variables
    const baseUrl = process.env.APP_URL || 'https://nofx-control-plane.vercel.app';

    console.log('[Reset Password] Using base URL:', baseUrl);
    console.log('[Reset Password] APP_URL:', process.env.APP_URL);
    console.log('[Reset Password] VERCEL_URL:', process.env.VERCEL_URL);

    // Don't use hash routing for reset password to avoid conflicts with Supabase's hash parameters
    const resetRedirectTo = redirectTo || `${baseUrl}/reset-password`;

    // Send password reset email via Supabase Auth
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectTo
    });

    if (error) {
      console.error('Password reset error:', error);

      // Don't expose whether email exists in the system
      // Always return success to prevent email enumeration
      if (error.message?.includes('User not found')) {
        return res.status(200).json({
          success: true,
          message: 'If an account exists with that email, a password reset link has been sent.'
        });
      }

      return res.status(500).json({
        error: 'Failed to send password reset email. Please try again later.'
      });
    }

    // Log the password reset request (but don't log the email for privacy)
    try {
      // Only log if we can get user info (optional)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createAuditLog(
          user.id,
          'auth.password_reset_requested',
          'password_reset',
          'email_sent',
          { timestamp: new Date().toISOString() }
        );
      }
    } catch (auditError) {
      // Audit logging is non-critical, don't fail the request
      console.error('Audit log error:', auditError);
    }

    // Success response - don't reveal if email exists
    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
      data: { email }
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request. Please try again later.'
    });
  }
}