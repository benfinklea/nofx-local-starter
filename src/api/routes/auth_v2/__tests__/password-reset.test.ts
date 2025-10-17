/**
 * Password Reset Flow Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../AuthService';
import { createServiceClient } from '../../../../auth/supabase';
import { sendPasswordResetEmail } from '../../../../services/email/emailService';

// Mock dependencies
vi.mock('../../../../auth/supabase');
vi.mock('../../../../services/email/emailService');
vi.mock('../../../../lib/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('Password Reset Email Integration', () => {
  let authService: AuthService;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      auth: {
        admin: {
          generateLink: vi.fn(),
        }
      }
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase);
  });

  describe('resetPassword', () => {
    it('should generate reset token and send custom email', async () => {
      const email = 'test@example.com';
      const userId = 'user-123';
      const fullName = 'Test User';
      const resetUrl = 'http://localhost:3000/reset-password#access_token=abc123&type=recovery';

      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: userId, full_name: fullName },
        error: null
      });

      // Mock token generation
      mockSupabase.auth.admin.generateLink.mockResolvedValueOnce({
        data: {
          properties: {
            action_link: resetUrl
          }
        },
        error: null
      });

      // Mock email sending
      vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(true);

      // Execute
      await authService.resetPassword({ email });

      // Verify user lookup
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.select).toHaveBeenCalledWith('id, full_name');
      expect(mockSupabase.eq).toHaveBeenCalledWith('email', email);

      // Verify token generation
      expect(mockSupabase.auth.admin.generateLink).toHaveBeenCalledWith({
        type: 'recovery',
        email,
        options: {
          redirectTo: expect.stringContaining('/reset-password')
        }
      });

      // Verify custom email was sent
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        userId,
        email,
        resetUrl,
        fullName
      );
    });

    it('should handle non-existent user gracefully', async () => {
      const email = 'nonexistent@example.com';

      // Mock user lookup failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' }
      });

      // Execute - should not throw
      await expect(authService.resetPassword({ email })).resolves.toBeUndefined();

      // Verify no email was sent
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should throw error if token generation fails', async () => {
      const email = 'test@example.com';

      // Mock user lookup success
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-123', full_name: 'Test User' },
        error: null
      });

      // Mock token generation failure
      mockSupabase.auth.admin.generateLink.mockResolvedValueOnce({
        data: null,
        error: { message: 'Token generation failed' }
      });

      // Execute - should throw
      await expect(authService.resetPassword({ email })).rejects.toThrow(
        'Failed to generate password reset token'
      );

      // Verify no email was sent
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should throw error if email sending fails', async () => {
      const email = 'test@example.com';
      const resetUrl = 'http://localhost:3000/reset-password#access_token=abc123';

      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-123', full_name: 'Test User' },
        error: null
      });

      // Mock token generation
      mockSupabase.auth.admin.generateLink.mockResolvedValueOnce({
        data: {
          properties: {
            action_link: resetUrl
          }
        },
        error: null
      });

      // Mock email sending failure
      vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(false);

      // Execute - should throw
      await expect(authService.resetPassword({ email })).rejects.toThrow(
        'Failed to send password reset email'
      );
    });

    it('should handle missing full name gracefully', async () => {
      const email = 'test@example.com';
      const userId = 'user-123';
      const resetUrl = 'http://localhost:3000/reset-password#access_token=abc123';

      // Mock user lookup without full name
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: userId, full_name: null },
        error: null
      });

      // Mock token generation
      mockSupabase.auth.admin.generateLink.mockResolvedValueOnce({
        data: {
          properties: {
            action_link: resetUrl
          }
        },
        error: null
      });

      // Mock email sending
      vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(true);

      // Execute
      await authService.resetPassword({ email });

      // Verify email was sent with null name (service will use email)
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        userId,
        email,
        resetUrl,
        null
      );
    });
  });

  describe('Email Template', () => {
    it('should use custom PasswordResetEmail template', async () => {
      const email = 'test@example.com';
      const resetUrl = 'http://localhost:3000/reset-password#access_token=abc123';

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-123', full_name: 'Test User' },
        error: null
      });

      mockSupabase.auth.admin.generateLink.mockResolvedValueOnce({
        data: {
          properties: {
            action_link: resetUrl
          }
        },
        error: null
      });

      vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(true);

      await authService.resetPassword({ email });

      // Verify the custom email function was called
      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });
  });
});
