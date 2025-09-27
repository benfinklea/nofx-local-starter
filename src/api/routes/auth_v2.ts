/**
 * Authentication Routes for NOFX SaaS
 * Handles login, signup, logout, password reset, and session management
 */

import { Express, Request, Response } from 'express';
import { createServerClient, createServiceClient, createAuditLog } from '../../auth/supabase';
import { requireAuth } from '../../auth/middleware';
import { log } from '../../lib/logger';
import { z } from 'zod';
import crypto from 'crypto';
import { sendWelcomeEmail } from '../../services/email/emailService';

// Validation schemas
const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  companyName: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const ResetPasswordSchema = z.object({
  email: z.string().email()
});

const UpdatePasswordSchema = z.object({
  password: z.string().min(8)
});

export default function mount(app: Express) {
  /**
   * Sign up new user
   */
  app.post('/auth/signup', async (req: Request, res: Response) => {
    try {
      const parsed = SignUpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { email, password, fullName, companyName, metadata } = parsed.data;

      const supabase = createServerClient(req, res);
      if (!supabase) {
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }

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
        log.error({ error, email }, 'Signup failed');
        return res.status(400).json({ error: error.message });
      }

      const user = data.user;

      if (!user) {
        return res.status(400).json({ error: 'Signup failed' });
      }

      // Update user profile with additional data
      if (companyName) {
        const serviceClient = createServiceClient();
        if (serviceClient) {
          await serviceClient
            .from('users')
            .update({ company_name: companyName })
            .eq('id', user.id);
        }
      }

      // Create audit log
      await createAuditLog(user.id, 'auth.signup', 'user', user.id, { email }, req);

      // Send welcome email (async, don't block response)
      sendWelcomeEmail(user.id, email, fullName).catch(err => {
        log.error({ err, userId: user.id }, 'Failed to send welcome email');
      });

      // Set session cookies
      const session = data.session;

      if (session) {
        res.cookie('sb-access-token', session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
        });

        res.cookie('sb-refresh-token', session.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30 * 1000 // 30 days
        });
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
        } : null
      });
    } catch (error) {
      log.error({ error }, 'Signup error');
      res.status(500).json({ error: 'Signup failed' });
    }
  });

  /**
   * Login user
   */
  app.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { email, password } = parsed.data;

      const supabase = createServerClient(req, res);
      if (!supabase) {
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }

      // Sign in with email/password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        log.warn({ error, email }, 'Login failed');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!data.user || !data.session) {
        return res.status(401).json({ error: 'Login failed' });
      }

      // Create audit log
      await createAuditLog(data.user.id, 'auth.login', 'session', data.session.access_token.substring(0, 8), { email }, req);

      // Set session cookies
      res.cookie('sb-access-token', session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
      });

      res.cookie('sb-refresh-token', session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 * 1000 // 30 days
      });

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
      log.error({ error }, 'Login error');
      res.status(500).json({ error: 'Login failed' });
    }
  });

  /**
   * Logout user
   */
  app.post('/auth/logout', requireAuth, async (req: Request, res: Response) => {
    try {
      const supabase = createServerClient(req, res);
      if (!supabase) {
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Create audit log
      if (req.userId) {
        await createAuditLog(req.userId, 'auth.logout', undefined, undefined, {}, req);
      }

      // Clear cookies
      res.clearCookie('sb-access-token');
      res.clearCookie('sb-refresh-token');

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Logout error');
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  /**
   * Refresh access token
   */
  app.post('/auth/refresh', async (req: Request, res: Response) => {
    try {
      const supabase = createServerClient(req, res);
      if (!supabase) {
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }

      // Refresh session
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        return res.status(401).json({ error: 'Session expired' });
      }

      // Update cookies
      res.cookie('sb-access-token', session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
      });

      res.cookie('sb-refresh-token', session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 * 1000 // 30 days
      });

      res.json({
        success: true,
        session: {
          accessToken: data.session.access_token,
          expiresAt: data.session.expires_at
        }
      });
    } catch (error) {
      log.error({ error }, 'Token refresh error');
      res.status(500).json({ error: 'Token refresh failed' });
    }
  });

  /**
   * Request password reset
   */
  app.post('/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const parsed = ResetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { email } = parsed.data;

      const supabase = createServerClient(req, res);
      if (!supabase) {
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }

      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth/update-password`
      });

      if (error) {
        log.error({ error, email }, 'Password reset failed');
        // Don't reveal if email exists
        return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
      }

      res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      log.error({ error }, 'Password reset error');
      res.status(500).json({ error: 'Password reset failed' });
    }
  });

  /**
   * Update password (after reset or for authenticated user)
   */
  app.post('/auth/update-password', async (req: Request, res: Response) => {
    try {
      const parsed = UpdatePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }

      const { password } = parsed.data;

      const supabase = createServerClient(req, res);
      if (!supabase) {
        return res.status(500).json({ error: 'Authentication service unavailable' });
      }

      // Update password
      const { data, error } = await supabase.auth.updateUser({ password });

      if (error) {
        log.error({ error }, 'Password update failed');
        return res.status(400).json({ error: error.message });
      }

      if (data.user) {
        await createAuditLog(data.user.id, 'auth.password_updated', 'user', data.user.id, {}, req);
      }

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Password update error');
      res.status(500).json({ error: 'Password update failed' });
    }
  });

  /**
   * Get current user
   */
  app.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const serviceClient = createServiceClient();
      if (!serviceClient) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Get user details from database
      const { data: userData } = await serviceClient
        .from('users')
        .select('*, subscriptions(*)')
        .eq('id', req.user.id)
        .single();

      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          emailConfirmed: req.user.confirmed_at != null,
          fullName: userData?.full_name,
          companyName: userData?.company_name,
          avatarUrl: userData?.avatar_url,
          tier: req.userTier || 'free',
          subscription: userData?.subscriptions?.[0] || null
        }
      });
    } catch (error) {
      log.error({ error }, 'Get user error');
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  /**
   * Generate API key for user
   */
  app.post('/auth/api-keys', requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, scopes = ['read', 'write'], expiresInDays = 90 } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'API key name is required' });
      }

      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Generate secure API key
      const apiKey = `nofx_${process.env.NODE_ENV === 'production' ? 'live' : 'test'}_${crypto.randomBytes(32).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const keyPrefix = apiKey.substring(0, 12);

      const serviceClient = createServiceClient();
      if (!serviceClient) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Calculate expiration
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

      // Store API key
      const { data, error } = await serviceClient
        .from('api_keys')
        .insert({
          user_id: req.userId,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          scopes,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) {
        log.error({ error }, 'API key creation failed');
        return res.status(500).json({ error: 'Failed to create API key' });
      }

      // Create audit log
      await createAuditLog(req.userId, 'auth.api_key_created', 'api_key', data.id, { name, scopes }, req);

      res.json({
        success: true,
        apiKey: {
          id: data.id,
          name: data.name,
          key: apiKey, // Only returned once!
          prefix: keyPrefix,
          scopes: data.scopes,
          expiresAt: data.expires_at,
          createdAt: data.created_at
        }
      });
    } catch (error) {
      log.error({ error }, 'API key creation error');
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  /**
   * List user's API keys
   */
  app.get('/auth/api-keys', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const serviceClient = createServiceClient();
      if (!serviceClient) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      const { data, error } = await serviceClient
        .from('api_keys')
        .select('id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
        .eq('user_id', req.userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        log.error({ error }, 'Failed to list API keys');
        return res.status(500).json({ error: 'Failed to list API keys' });
      }

      res.json({ apiKeys: data || [] });
    } catch (error) {
      log.error({ error }, 'List API keys error');
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  });

  /**
   * Revoke API key
   */
  app.delete('/auth/api-keys/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const serviceClient = createServiceClient();
      if (!serviceClient) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Soft delete API key
      const { error } = await serviceClient
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', req.params.id)
        .eq('user_id', req.userId);

      if (error) {
        log.error({ error }, 'Failed to revoke API key');
        return res.status(500).json({ error: 'Failed to revoke API key' });
      }

      // Create audit log
      await createAuditLog(req.userId, 'auth.api_key_revoked', 'api_key', req.params.id, {}, req);

      res.json({ success: true });
    } catch (error) {
      log.error({ error }, 'Revoke API key error');
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });
}