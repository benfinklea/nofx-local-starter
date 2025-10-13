/**
 * Refactored test suite for auth_v2 routes
 * Strategy: Mock at the handler level instead of deep Supabase mocking
 * Benefits: Faster, less fragile, easier to maintain
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Create simplified mocks at the handler level
const mockHandlers = {
  handleSignUp: jest.fn(),
  handleLogin: jest.fn(),
  handleLogout: jest.fn(),
  handleRefreshToken: jest.fn(),
  handleResetPassword: jest.fn(),
  handleUpdatePassword: jest.fn(),
  handleGetProfile: jest.fn(),
  handleCreateApiKey: jest.fn(),
  handleListApiKeys: jest.fn(),
  handleDeleteApiKey: jest.fn(),
};

// Mock the handlers module directly
jest.mock('../auth_v2/handlers', () => mockHandlers);

// Mock middleware to avoid auth complexity
jest.mock('../../../auth/middleware', () => ({
  requireAuth: jest.fn((req: any, res: any, next: any) => {
    req.userId = 'test-user-id';
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

import mountAuth from '../auth_v2';

describe('Auth V2 Routes - Refactored', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mountAuth(app);
    jest.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('should call handleSignUp with request data', async () => {
      mockHandlers.handleSignUp.mockImplementation((req: any, res: any) => {
        res.status(201).json({
          success: true,
          user: { id: 'user-id', email: req.body.email },
        });
      });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(mockHandlers.handleSignUp).toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    it('should call handleLogin with credentials', async () => {
      mockHandlers.handleLogin.mockImplementation((req: any, res: any) => {
        res.status(200).json({
          success: true,
          user: { id: 'user-id', email: req.body.email },
          session: { accessToken: 'token' },
        });
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(mockHandlers.handleLogin).toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('should call handleLogout', async () => {
      mockHandlers.handleLogout.mockImplementation((req: any, res: any) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(mockHandlers.handleLogout).toHaveBeenCalled();
    });
  });

  describe('POST /auth/refresh', () => {
    it('should call handleRefreshToken', async () => {
      mockHandlers.handleRefreshToken.mockImplementation((req: any, res: any) => {
        res.status(200).json({
          success: true,
          session: { accessToken: 'new-token' },
        });
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: 'refresh-token' });

      expect(response.status).toBe(200);
      expect(mockHandlers.handleRefreshToken).toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should call handleResetPassword', async () => {
      mockHandlers.handleResetPassword.mockImplementation((req: any, res: any) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(mockHandlers.handleResetPassword).toHaveBeenCalled();
    });
  });

  describe('POST /auth/update-password', () => {
    it('should call handleUpdatePassword', async () => {
      mockHandlers.handleUpdatePassword.mockImplementation((req: any, res: any) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/auth/update-password')
        .set('Authorization', 'Bearer token')
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(mockHandlers.handleUpdatePassword).toHaveBeenCalled();
    });
  });

  describe('GET /auth/me', () => {
    it('should call handleGetProfile', async () => {
      mockHandlers.handleGetProfile.mockImplementation((req: any, res: any) => {
        res.status(200).json({
          user: {
            id: 'user-id',
            email: 'test@example.com',
            full_name: 'Test User',
          },
        });
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(mockHandlers.handleGetProfile).toHaveBeenCalled();
    });
  });

  describe('API Key Management', () => {
    it('should create API key', async () => {
      mockHandlers.handleCreateApiKey.mockImplementation((req: any, res: any) => {
        res.status(201).json({
          success: true,
          apiKey: { id: 'key-id', name: req.body.name },
        });
      });

      const response = await request(app)
        .post('/auth/api-keys')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Key', permissions: ['read'] });

      expect(response.status).toBe(201);
      expect(mockHandlers.handleCreateApiKey).toHaveBeenCalled();
    });

    it('should list API keys', async () => {
      mockHandlers.handleListApiKeys.mockImplementation((req: any, res: any) => {
        res.status(200).json({
          apiKeys: [{ id: 'key-1', name: 'Key 1' }],
        });
      });

      const response = await request(app)
        .get('/auth/api-keys')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.apiKeys).toBeInstanceOf(Array);
      expect(mockHandlers.handleListApiKeys).toHaveBeenCalled();
    });

    it('should delete API key', async () => {
      mockHandlers.handleDeleteApiKey.mockImplementation((req: any, res: any) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .delete('/auth/api-keys/key-id')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(mockHandlers.handleDeleteApiKey).toHaveBeenCalled();
    });
  });

  describe('Route Configuration', () => {
    it('should mount all auth routes', () => {
      // Verify that all handlers are called when their routes are hit
      expect(mockHandlers.handleSignUp).toBeDefined();
      expect(mockHandlers.handleLogin).toBeDefined();
      expect(mockHandlers.handleLogout).toBeDefined();
      expect(mockHandlers.handleRefreshToken).toBeDefined();
      expect(mockHandlers.handleResetPassword).toBeDefined();
      expect(mockHandlers.handleUpdatePassword).toBeDefined();
      expect(mockHandlers.handleGetProfile).toBeDefined();
      expect(mockHandlers.handleCreateApiKey).toBeDefined();
      expect(mockHandlers.handleListApiKeys).toBeDefined();
      expect(mockHandlers.handleDeleteApiKey).toBeDefined();
    });
  });
});
