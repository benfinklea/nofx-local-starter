/**
 * Update Password API Route - Vercel Function
 * Used to update password after receiving reset token
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog } from '../../src/auth/supabase';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Need service role for admin operations
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, newPassword, refreshToken } = req.body;

  // Check if we have the required fields
  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  // Validate password strength
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // Check for at least one number and one letter
  const hasNumber = /\d/.test(newPassword);
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  if (!hasNumber || !hasLetter) {
    return res.status(400).json({
      error: 'Password must contain at least one letter and one number'
    });
  }

  try {
    // First, try to use the access token if provided (from reset link)
    if (accessToken) {
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || ''
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        return res.status(401).json({
          error: 'Invalid or expired reset token. Please request a new password reset.'
        });
      }

      // Update the password using the session
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        return res.status(500).json({
          error: 'Failed to update password. Please try again.'
        });
      }

      // Create audit log
      if (data.user) {
        await createAuditLog(
          data.user.id,
          'auth.password_updated',
          'password',
          'reset_token',
          { timestamp: new Date().toISOString() }
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully',
        user: data.user ? {
          id: data.user.id,
          email: data.user.email
        } : null
      });
    }

    // If no access token, check for authenticated user (changing password while logged in)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Set the session with the bearer token
      const { data: sessionData, error: sessionError } = await supabase.auth.getUser(token);

      if (sessionError || !sessionData.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Update password for authenticated user
      const { data, error } = await supabase.auth.admin.updateUserById(
        sessionData.user.id,
        { password: newPassword }
      );

      if (error) {
        console.error('Password update error:', error);
        return res.status(500).json({
          error: 'Failed to update password. Please try again.'
        });
      }

      // Create audit log
      await createAuditLog(
        sessionData.user.id,
        'auth.password_updated',
        'password',
        'authenticated',
        { timestamp: new Date().toISOString() }
      );

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully'
      });
    }

    // No valid authentication method provided
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid reset token or login.'
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      error: 'An error occurred while updating your password. Please try again later.'
    });
  }
}