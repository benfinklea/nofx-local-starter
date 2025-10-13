/**
 * Fixed test suite for auth_v2 routes
 * Properly mocks dependencies to avoid timeouts
 */

// CRITICAL: Set up ALL mocks BEFORE any imports
// Jest hoists jest.mock() calls, but we need to ensure mocks are fully configured

const mockAuthService = {
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  getUserProfile: jest.fn(),
};

const mockApiKeyService = {
  createApiKey: jest.fn(),
  listApiKeys: jest.fn(),
  deleteApiKey: jest.fn(),
};

// Mock the service modules FIRST before they're imported
jest.mock('../auth_v2/AuthService', () => ({
  AuthService: jest.fn().mockImplementation(() => mockAuthService),
}));

jest.mock('../auth_v2/ApiKeyService', () => ({
  ApiKeyService: jest.fn().mockImplementation(() => mockApiKeyService),
}));

// Mock Supabase
jest.mock('../../../auth/supabase', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  })),
  createServiceClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  })),
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Mock middleware
jest.mock('../../../auth/middleware', () => ({
  requireAuth: jest.fn((req: any, res: any, next: any) => {
    req.userId = 'test-user-id';
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

// Mock logger
jest.mock('../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock email service
jest.mock('../../../services/email/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

// NOW we can safely import
import request from 'supertest';
import express from 'express';
import mountAuth from '../auth_v2';

describe('Auth V2 Routes - Fixed Tests', () => {
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
      expect(mockAuthService.signUp).toHaveBeenCalled();
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
      expect(mockAuthService.signIn).toHaveBeenCalled();
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
    }, 5000);
  });

  describe('POST /auth/logout', () => {
    it('should logout authenticated user', async () => {
      mockAuthService.signOut.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(mockAuthService.signOut).toHaveBeenCalled();
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
      expect(mockAuthService.refreshSession).toHaveBeenCalled();
    }, 5000);
  });

  describe('GET /auth/me', () => {
    it('should return user profile', async () => {
      mockAuthService.getUserProfile.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        full_name: 'Test User',
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith('test-user-id');
    }, 5000);
  });

  describe('POST /auth/api-keys', () => {
    it('should create API key', async () => {
      mockApiKeyService.createApiKey.mockResolvedValue({
        id: 'key-id',
        key: 'api-key',
        name: 'Test Key',
      });

      const response = await request(app)
        .post('/auth/api-keys')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Key', permissions: ['read'] });

      expect(response.status).toBe(201);
      expect(mockApiKeyService.createApiKey).toHaveBeenCalled();
    }, 5000);
  });
});
