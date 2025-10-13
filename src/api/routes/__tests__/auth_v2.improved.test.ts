/**
 * Improved test suite for auth_v2 routes
 * Strategy: Mock at the service level (AuthService, ApiKeyService)
 * Benefits: Tests actual handlers, faster than Supabase mocking, more maintainable
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Create mock service instances with proper typing
const mockAuthService = {
  signUp: jest.fn() as any,
  signIn: jest.fn() as any,
  signOut: jest.fn() as any,
  refreshSession: jest.fn() as any,
  resetPassword: jest.fn() as any,
  updatePassword: jest.fn() as any,
  getUserProfile: jest.fn() as any,
};

const mockApiKeyService = {
  createApiKey: jest.fn() as any,
  listApiKeys: jest.fn() as any,
  deleteApiKey: jest.fn() as any,
};

// Mock the service classes to return our mock instances
jest.mock('../auth_v2/AuthService', () => ({
  AuthService: jest.fn(() => mockAuthService),
}));

jest.mock('../auth_v2/ApiKeyService', () => ({
  ApiKeyService: jest.fn(() => mockApiKeyService),
}));

// Mock auth middleware
jest.mock('../../../auth/middleware', () => ({
  requireAuth: jest.fn((req: any, res: any, next: any) => {
    req.userId = 'test-user-id';
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

// Mock logger to reduce noise
jest.mock('../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import mountAuth from '../auth_v2';

describe('Auth V2 Routes - Improved (Service-Level Mocking)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mountAuth(app);
    jest.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('should create new user with valid data', async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: true,
        user: { id: 'user-id', email: 'test@example.com', emailConfirmed: false },
        session: { accessToken: 'token', expiresAt: Date.now() + 3600000 },
      });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
          companyName: 'Test Company',
        });

      expect(response.status).toBe(201);
      expect(mockAuthService.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
          companyName: 'Test Company',
        }),
        expect.any(Object),
        expect.any(Object)
      );
    }, 5000);

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'password123',
          fullName: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(mockAuthService.signUp).not.toHaveBeenCalled();
    }, 5000);

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: '123',
          fullName: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(mockAuthService.signUp).not.toHaveBeenCalled();
    }, 5000);

    it('should handle signup errors', async () => {
      mockAuthService.signUp.mockRejectedValue(new Error('Email already registered'));

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email already registered');
    }, 5000);
  });

  describe('POST /auth/login', () => {
    it('should authenticate valid credentials', async () => {
      mockAuthService.signIn.mockResolvedValue({
        success: true,
        user: { id: 'user-id', email: 'test@example.com', emailConfirmed: true },
        session: { accessToken: 'token', expiresAt: Date.now() + 3600000 },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(mockAuthService.signIn).toHaveBeenCalledWith(
        { email: 'test@example.com', password: 'password123' },
        expect.any(Object),
        expect.any(Object)
      );
    }, 5000);

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(mockAuthService.signIn).not.toHaveBeenCalled();
    }, 5000);

    it('should handle authentication errors', async () => {
      mockAuthService.signIn.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    }, 5000);
  });

  describe('POST /auth/logout', () => {
    it('should logout authenticated user', async () => {
      mockAuthService.signOut.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.signOut).toHaveBeenCalled();
    }, 5000);

    it('should handle logout errors', async () => {
      mockAuthService.signOut.mockRejectedValue(new Error('Logout failed'));

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Logout failed');
    }, 5000);
  });

  describe('POST /auth/refresh', () => {
    it('should refresh valid session', async () => {
      mockAuthService.refreshSession.mockResolvedValue({
        success: true,
        user: { id: 'user-id', email: 'test@example.com', emailConfirmed: true },
        session: { accessToken: 'new-token', expiresAt: Date.now() + 3600000 },
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: 'refresh-token' });

      expect(response.status).toBe(200);
      expect(mockAuthService.refreshSession).toHaveBeenCalledWith(
        'refresh-token',
        expect.any(Object),
        expect.any(Object)
      );
    }, 5000);

    it('should handle invalid refresh token', async () => {
      mockAuthService.refreshSession.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' });

      expect(response.status).toBe(401);
    }, 5000);
  });

  describe('POST /auth/reset-password', () => {
    it('should send reset email for valid email', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    }, 5000);

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    }, 5000);
  });

  describe('POST /auth/update-password', () => {
    it('should update password for authenticated user', async () => {
      mockAuthService.updatePassword.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/update-password')
        .set('Authorization', 'Bearer token')
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.updatePassword).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'newpassword123' }),
        expect.any(Object),
        expect.any(Object)
      );
    }, 5000);

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/auth/update-password')
        .set('Authorization', 'Bearer token')
        .send({ password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(mockAuthService.updatePassword).not.toHaveBeenCalled();
    }, 5000);
  });

  describe('GET /auth/me', () => {
    it('should return user profile for authenticated user', async () => {
      mockAuthService.getUserProfile.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        full_name: 'Test User',
        company_name: 'Test Company',
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'user-id',
        email: 'test@example.com',
      });
      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith('test-user-id');
    }, 5000);

    it('should handle user not found', async () => {
      mockAuthService.getUserProfile.mockRejectedValue(new Error('User not found'));

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    }, 5000);
  });

  describe('API Key Management', () => {
    describe('POST /auth/api-keys', () => {
      it('should create API key for authenticated user', async () => {
        mockApiKeyService.createApiKey.mockResolvedValue({
          id: 'key-id',
          name: 'Test Key',
          key: 'nofx_abc123',
          permissions: ['read'],
          created_at: new Date().toISOString(),
        });

        const response = await request(app)
          .post('/auth/api-keys')
          .set('Authorization', 'Bearer token')
          .send({ name: 'Test Key', permissions: ['read'] });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.apiKey.name).toBe('Test Key');
        expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith(
          { name: 'Test Key', permissions: ['read'] },
          'test-user-id',
          expect.any(Object)
        );
      }, 5000);

      it('should validate API key name', async () => {
        const response = await request(app)
          .post('/auth/api-keys')
          .set('Authorization', 'Bearer token')
          .send({ permissions: ['read'] });

        expect(response.status).toBe(400);
        expect(mockApiKeyService.createApiKey).not.toHaveBeenCalled();
      }, 5000);
    });

    describe('GET /auth/api-keys', () => {
      it('should list user API keys', async () => {
        mockApiKeyService.listApiKeys.mockResolvedValue([
          { id: 'key-1', name: 'Key 1', permissions: ['read'] },
          { id: 'key-2', name: 'Key 2', permissions: ['write'] },
        ]);

        const response = await request(app)
          .get('/auth/api-keys')
          .set('Authorization', 'Bearer token');

        expect(response.status).toBe(200);
        expect(response.body.apiKeys).toHaveLength(2);
        expect(mockApiKeyService.listApiKeys).toHaveBeenCalledWith('test-user-id');
      }, 5000);
    });

    describe('DELETE /auth/api-keys/:id', () => {
      it('should delete API key', async () => {
        mockApiKeyService.deleteApiKey.mockResolvedValue(undefined);

        const response = await request(app)
          .delete('/auth/api-keys/key-id')
          .set('Authorization', 'Bearer token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockApiKeyService.deleteApiKey).toHaveBeenCalledWith(
          'key-id',
          'test-user-id',
          expect.any(Object)
        );
      }, 5000);
    });
  });

  describe('Security & Error Handling', () => {
    it('should prevent SQL injection in email field', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: "'; DROP TABLE users; --",
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(mockAuthService.signIn).not.toHaveBeenCalled();
    }, 5000);

    it('should handle service errors gracefully', async () => {
      mockAuthService.signIn.mockRejectedValue(new Error('Authentication service unavailable'));

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('service unavailable');
    }, 5000);
  });
});
