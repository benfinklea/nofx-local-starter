/**
 * Modern Authentication Service for Frontend
 * Uses @supabase/ssr with cookie-based sessions (no localStorage)
 *
 * This replaces the old auth service with production-grade patterns
 */

import { createBrowserClient } from './supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthResponse {
  user?: User;
  session?: Session;
  message?: string;
  error?: string;
}

class AuthService {
  private supabase = createBrowserClient();

  /**
   * Sign up a new user
   */
  async signup(email: string, password: string, fullName?: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'Signup failed' };
      }

      // Check if email confirmation is required
      if (!data.session) {
        return {
          message: 'Please check your email to confirm your account',
          user: data.user
        };
      }

      return {
        user: data.user,
        session: data.session
      };
    } catch (error) {
      console.error('Signup error:', error);
      return { error: 'Network error during signup' };
    }
  }

  /**
   * Sign in with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.user || !data.session) {
        return { error: 'Login failed' };
      }

      return {
        user: data.user,
        session: data.session
      };
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Network error during login' };
    }
  }

  /**
   * Sign out the current user
   */
  async logout(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Request password reset email
   */
  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        return { error: error.message };
      }

      return {
        message: 'Password reset email sent. Please check your inbox.'
      };
    } catch (error) {
      console.error('Password reset error:', error);
      return { error: 'Network error during password reset' };
    }
  }

  /**
   * Update user password (must be authenticated)
   */
  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { error: error.message };
      }

      return {
        message: 'Password updated successfully',
        user: data.user
      };
    } catch (error) {
      console.error('Password update error:', error);
      return { error: 'Network error during password update' };
    }
  }

  /**
   * Get current user from session
   * Fast read from cookies, doesn't validate with server
   * Use this for UI display only
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session?.user || null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session?.access_token;
  }

  /**
   * Listen to auth state changes
   * Use this in React components to stay in sync
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session);
      }
    );

    // Return unsubscribe function
    return () => subscription.unsubscribe();
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'github' | 'azure') {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        return { error: error.message };
      }

      // Browser will redirect to OAuth provider
      return { success: true, url: data.url };
    } catch (error) {
      console.error('OAuth error:', error);
      return { error: 'Failed to initiate OAuth login' };
    }
  }

  /**
   * Sign in with magic link (passwordless)
   */
  async signInWithMagicLink(email: string): Promise<AuthResponse> {
    try {
      const { error } = await this.supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        return { error: error.message };
      }

      return {
        message: 'Magic link sent! Please check your email.'
      };
    } catch (error) {
      console.error('Magic link error:', error);
      return { error: 'Failed to send magic link' };
    }
  }
}

// Export singleton instance
export const auth = new AuthService();