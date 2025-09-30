/**
 * Comprehensive Unit Tests for Modern Authentication System
 * Tests the new @supabase/ssr-based authentication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auth } from '../src/lib/auth';

// Mock Supabase client
vi.mock('../src/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
    }
  })
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signup', () => {
    it('should sign up a new user successfully', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token123', expires_at: Date.now() + 3600000 };

      vi.mocked(auth['supabase'].auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      } as any);

      const result = await auth.signup('test@example.com', 'password123', 'Test User');

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid signup', async () => {
      vi.mocked(auth['supabase'].auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered', status: 400 }
      } as any);

      const result = await auth.signup('test@example.com', 'password123');

      expect(result.error).toBe('Email already registered');
      expect(result.user).toBeUndefined();
    });

    it('should handle email confirmation required', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };

      vi.mocked(auth['supabase'].auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null
      } as any);

      const result = await auth.signup('test@example.com', 'password123');

      expect(result.message).toContain('check your email');
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token123', expires_at: Date.now() + 3600000 };

      vi.mocked(auth['supabase'].auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      } as any);

      const result = await auth.login('test@example.com', 'password123');

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid credentials', async () => {
      vi.mocked(auth['supabase'].auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 }
      } as any);

      const result = await auth.login('test@example.com', 'wrongpassword');

      expect(result.error).toBe('Invalid login credentials');
      expect(result.user).toBeUndefined();
    });

    it('should handle network errors', async () => {
      vi.mocked(auth['supabase'].auth.signInWithPassword).mockRejectedValue(
        new Error('Network error')
      );

      const result = await auth.login('test@example.com', 'password123');

      expect(result.error).toBe('Network error during login');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      vi.mocked(auth['supabase'].auth.signOut).mockResolvedValue({
        error: null
      });

      await expect(auth.logout()).resolves.not.toThrow();
    });

    it('should handle logout errors gracefully', async () => {
      vi.mocked(auth['supabase'].auth.signOut).mockRejectedValue(
        new Error('Logout failed')
      );

      await expect(auth.logout()).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      vi.mocked(auth['supabase'].auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null
      } as any);

      const result = await auth.resetPassword('test@example.com');

      expect(result.message).toContain('Password reset email sent');
      expect(result.error).toBeUndefined();
    });

    it('should handle reset password errors', async () => {
      vi.mocked(auth['supabase'].auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: { message: 'User not found', status: 404 }
      } as any);

      const result = await auth.resetPassword('nonexistent@example.com');

      expect(result.error).toBe('User not found');
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };

      vi.mocked(auth['supabase'].auth.updateUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      } as any);

      const result = await auth.updatePassword('newpassword123');

      expect(result.message).toBe('Password updated successfully');
      expect(result.user).toEqual(mockUser);
    });

    it('should handle update password errors', async () => {
      vi.mocked(auth['supabase'].auth.updateUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 }
      } as any);

      const result = await auth.updatePassword('newpassword123');

      expect(result.error).toBe('Not authenticated');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { user: mockUser, access_token: 'token123' };

      vi.mocked(auth['supabase'].auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      } as any);

      const result = await auth.getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('should return null for unauthenticated user', async () => {
      vi.mocked(auth['supabase'].auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      } as any);

      const result = await auth.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for authenticated user', async () => {
      vi.mocked(auth['supabase'].auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'token123' } },
        error: null
      } as any);

      const result = await auth.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false for unauthenticated user', async () => {
      vi.mocked(auth['supabase'].auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      } as any);

      const result = await auth.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('OAuth', () => {
    it('should initiate OAuth flow', async () => {
      vi.mocked(auth['supabase'].auth.signInWithOAuth).mockResolvedValue({
        data: { url: 'https://oauth.provider.com/authorize' },
        error: null
      } as any);

      const result = await auth.signInWithOAuth('google');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://oauth.provider.com/authorize');
    });

    it('should handle OAuth errors', async () => {
      vi.mocked(auth['supabase'].auth.signInWithOAuth).mockResolvedValue({
        data: { url: null },
        error: { message: 'OAuth provider not configured', status: 400 }
      } as any);

      const result = await auth.signInWithOAuth('google');

      expect(result.error).toBe('OAuth provider not configured');
    });
  });

  describe('Magic Link', () => {
    it('should send magic link', async () => {
      vi.mocked(auth['supabase'].auth.signInWithOtp).mockResolvedValue({
        data: {},
        error: null
      } as any);

      const result = await auth.signInWithMagicLink('test@example.com');

      expect(result.message).toContain('Magic link sent');
    });

    it('should handle magic link errors', async () => {
      vi.mocked(auth['supabase'].auth.signInWithOtp).mockResolvedValue({
        data: {},
        error: { message: 'Rate limit exceeded', status: 429 }
      } as any);

      const result = await auth.signInWithMagicLink('test@example.com');

      expect(result.error).toBe('Rate limit exceeded');
    });
  });
});