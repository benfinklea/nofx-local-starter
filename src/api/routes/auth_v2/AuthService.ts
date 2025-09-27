/**
 * Authentication service - extracted authentication business logic
 */

import { Request, Response } from 'express';
import { createServerClient, createServiceClient, createAuditLog } from '../../../auth/supabase';
import { log } from '../../../lib/logger';
import { sendWelcomeEmail } from '../../../services/email/emailService';
import type { SignUpData, LoginData, ResetPasswordData, UpdatePasswordData, AuthResponse } from './types';

export class AuthService {
  private async getSupabaseClient(req: Request, res: Response) {
    const supabase = createServerClient(req, res);
    if (!supabase) {
      throw new Error('Authentication service unavailable');
    }
    return supabase;
  }

  private async getServiceClient() {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable');
    }
    return supabase;
  }

  private setCookies(res: Response, session: { access_token: string; refresh_token: string } | null) {
    if (!session) return;

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

  private clearCookies(res: Response) {
    res.clearCookie('sb-access-token');
    res.clearCookie('sb-refresh-token');
  }

  private formatAuthResponse(user: { id: string; email?: string; confirmed_at?: string } | null, session: { access_token: string; expires_at?: number } | null): AuthResponse {
    return {
      success: true,
      user: user ? {
        id: user.id,
        email: user.email || '',
        emailConfirmed: user.confirmed_at != null
      } : undefined,
      session: session ? {
        accessToken: session.access_token,
        expiresAt: session.expires_at || 0
      } : null
    };
  }

  async signUp(signUpData: SignUpData, req: Request, res: Response): Promise<AuthResponse> {
    const supabase = await this.getSupabaseClient(req, res);
    const { email, password, fullName, companyName, metadata } = signUpData;

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
      throw new Error(error.message);
    }

    const user = data.user;
    if (!user) {
      throw new Error('Signup failed');
    }

    // Update user profile with additional data
    if (companyName) {
      try {
        const serviceClient = await this.getServiceClient();
        await serviceClient
          .from('users')
          .update({ company_name: companyName })
          .eq('id', user.id);
      } catch (err) {
        log.error({ err, userId: user.id }, 'Failed to update company name');
      }
    }

    // Create audit log
    await createAuditLog(user.id, 'auth.signup', 'user', user.id, { email }, req);

    // Send welcome email (async, don't block response)
    sendWelcomeEmail(user.id, email, fullName).catch(err => {
      log.error({ err, userId: user.id }, 'Failed to send welcome email');
    });

    // Set session cookies
    this.setCookies(res, data.session);

    return this.formatAuthResponse(user, data.session);
  }

  async signIn(loginData: LoginData, req: Request, res: Response): Promise<AuthResponse> {
    const supabase = await this.getSupabaseClient(req, res);
    const { email, password } = loginData;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      log.error({ error, email }, 'Login failed');
      throw new Error(error.message);
    }

    const user = data.user;
    if (!user) {
      throw new Error('Login failed');
    }

    // Create audit log
    await createAuditLog(user.id, 'auth.login', 'user', user.id, { email }, req);

    // Update last login
    try {
      const serviceClient = await this.getServiceClient();
      await serviceClient
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (err) {
      log.error({ err, userId: user.id }, 'Failed to update last login');
    }

    // Set session cookies
    this.setCookies(res, data.session);

    return this.formatAuthResponse(user, data.session);
  }

  async signOut(req: Request, res: Response): Promise<void> {
    const supabase = await this.getSupabaseClient(req, res);

    const { error } = await supabase.auth.signOut();
    if (error) {
      log.error({ error }, 'Logout failed');
      throw new Error('Logout failed');
    }

    // Clear cookies
    this.clearCookies(res);

    // Create audit log if user is available
    if (req.userId) {
      await createAuditLog(req.userId, 'auth.logout', 'user', req.userId, {}, req);
    }
  }

  async refreshSession(refreshToken: string, req: Request, res: Response): Promise<AuthResponse> {
    const supabase = await this.getSupabaseClient(req, res);

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      log.error({ error }, 'Token refresh failed');
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      throw new Error('Token refresh failed');
    }

    // Set new session cookies
    this.setCookies(res, data.session);

    return this.formatAuthResponse(data.user, data.session);
  }

  async resetPassword(resetData: ResetPasswordData): Promise<void> {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable');
    }

    const { email } = resetData;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) {
      log.error({ error, email }, 'Password reset failed');
      throw new Error(error.message);
    }
  }

  async updatePassword(passwordData: UpdatePasswordData, req: Request, res: Response): Promise<void> {
    const supabase = await this.getSupabaseClient(req, res);
    const { password } = passwordData;

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      log.error({ error, userId: req.userId }, 'Password update failed');
      throw new Error(error.message);
    }

    // Create audit log
    if (req.userId) {
      await createAuditLog(req.userId, 'auth.password_updated', 'user', req.userId, {}, req);
    }
  }

  async getUserProfile(userId: string) {
    const supabase = await this.getServiceClient();

    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        company_name,
        avatar_url,
        last_login_at,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single();

    if (error) {
      log.error({ error, userId }, 'Failed to get user profile');
      throw new Error('User not found');
    }

    return data;
  }
}