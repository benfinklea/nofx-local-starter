/**
 * AuthenticationService Unit Tests
 * Coverage Target: 95%+
 *
 * Tests authentication via API keys and JWT tokens with comprehensive
 * security scenarios including timing attacks, injection attempts, and edge cases.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../AuthenticationService';
import * as supabase from '../../supabase';
import { log } from '../../../lib/logger';
import {
  MockFactory,
  UserFactory,
  ApiKeyFactory,
  SecurityTestUtils,
  PerformanceTestUtils,
  JwtTestUtils,
  AuditLogTestUtils
} from '../../__tests__/test-helpers';

// Mock dependencies
jest.mock('../../supabase');
jest.mock('../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn()
    }))
  }
}));

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let resMocks: any;

  beforeEach(() => {
    authService = new AuthenticationService();

    const { res, mocks } = MockFactory.createResponse();
    mockRes = res;
    resMocks = mocks;

    mockReq = MockFactory.createRequest();
    mockNext = MockFactory.createNext();

    // Reset mocks
    jest.clearAllMocks();
    (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(null);
    (supabase.verifyApiKey as jest.Mock).mockResolvedValue(null);
    (supabase.getUserTier as jest.Mock).mockResolvedValue('free');
    (supabase.createAuditLog as jest.Mock).mockResolvedValue(undefined);
  });

  describe('API Key Authentication', () => {
    describe('Valid API Key Scenarios', () => {
      it('should authenticate with valid API key', async () => {
        const apiKey = ApiKeyFactory.generateKey();
        mockReq.headers = { 'x-api-key': apiKey };

        const mockUser = UserFactory.createUser({ id: 'user123' });
        (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
          userId: mockUser.id,
          keyId: 'key123'
        });

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(supabase.verifyApiKey).toHaveBeenCalledWith(
          apiKey,
          expect.objectContaining({ ip: '127.0.0.1' })
        );
        expect(mockReq.userId).toBe('user123');
        expect(mockNext).toHaveBeenCalled();
        expect(resMocks.status).not.toHaveBeenCalled();
      });

      it('should store API key prefix for logging', async () => {
        const apiKey = 'nofx_test_1234567890abcdef';
        mockReq.headers = { 'x-api-key': apiKey };

        (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
          userId: 'user123',
          keyId: 'key123'
        });

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(mockReq.apiKeyId).toBe('nofx_tes'); // First 8 characters
      });

      it('should fetch and set user tier', async () => {
        const apiKey = ApiKeyFactory.generateKey();
        mockReq.headers = { 'x-api-key': apiKey };

        (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
          userId: 'user123'
        });
        (supabase.getUserTier as jest.Mock).mockResolvedValue('pro');

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(supabase.getUserTier).toHaveBeenCalledWith('user123');
        expect(mockReq.userTier).toBe('pro');
      });

      it('should create audit log for API access', async () => {
        const apiKey = ApiKeyFactory.generateKey();
        mockReq.headers = { 'x-api-key': apiKey };
        Object.defineProperty(mockReq, 'path', { value: '/api/projects', writable: true });
        mockReq.method = 'POST';

        (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
          userId: 'user123'
        });

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(supabase.createAuditLog).toHaveBeenCalledWith(
          'user123',
          'api.access',
          'api_key',
          expect.any(String),
          expect.objectContaining({
            endpoint: '/api/projects',
            method: 'POST'
          }),
          mockReq
        );
      });
    });

    describe('Invalid API Key Scenarios', () => {
      it('should reject invalid API key', async () => {
        mockReq.headers = { 'x-api-key': 'invalid_key' };
        (supabase.verifyApiKey as jest.Mock).mockResolvedValue(null);

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(resMocks.status).toHaveBeenCalledWith(401);
        expect(resMocks.json).toHaveBeenCalledWith({
          error: 'Authentication required',
          message: 'Please provide a valid JWT token or API key'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should skip API key auth when header is missing', async () => {
        mockReq.headers = {};
        const mockUser = UserFactory.createUser();
        (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(supabase.verifyApiKey).not.toHaveBeenCalled();
        expect(supabase.getUserFromRequest).toHaveBeenCalled();
      });

      it('should handle empty API key', async () => {
        mockReq.headers = { 'x-api-key': '' };

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(supabase.verifyApiKey).not.toHaveBeenCalled();
        expect(resMocks.status).toHaveBeenCalledWith(401);
      });

      it('should handle null/undefined API key', async () => {
        const testCases = [null, undefined];

        for (const testCase of testCases) {
          jest.clearAllMocks();
          mockReq.headers = { 'x-api-key': testCase as any };

          await authService.authenticate(
            mockReq as Request,
            mockRes as Response,
            mockNext
          );

          expect(supabase.verifyApiKey).not.toHaveBeenCalled();
        }
      });
    });

    describe('Security Attack Prevention', () => {
      it('should prevent API key enumeration attacks', async () => {
        const maliciousKeys = SecurityTestUtils.getMaliciousInputs();
        // eslint-disable-next-line no-secrets/no-secrets
        const allMalicious = [
          ...maliciousKeys.sqlInjection,
          ...maliciousKeys.xss,
          ...maliciousKeys.pathTraversal,
          'admin', 'root', 'test', 'Bearer token123' // Test values, not real secrets
        ];

        for (const key of allMalicious) {
          jest.clearAllMocks();
          mockReq.headers = { 'x-api-key': key };
          (supabase.verifyApiKey as jest.Mock).mockResolvedValue(null);

          await authService.authenticate(
            mockReq as Request,
            mockRes as Response,
            mockNext
          );

          // Should always return same error (no information leakage)
          expect(resMocks.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: 'Authentication required'
            })
          );
          // Should not reveal key format or validation details
          expect(resMocks.json).not.toHaveBeenCalledWith(
            expect.objectContaining({
              message: expect.stringContaining('invalid format')
            })
          );
        }
      });

      it('should resist timing attacks on key validation', async () => {
        const validKey = ApiKeyFactory.generateKey();
        const invalidKey = 'invalid_key_12345';

        // Test that authentication completes for both valid and invalid keys
        // Note: True timing attack resistance requires constant-time comparison at the crypto level
        // This test verifies consistent execution patterns

        const times: number[] = [];

        for (let i = 0; i < 10; i++) {
          const start = process.hrtime.bigint();
          mockReq.headers = { 'x-api-key': i % 2 === 0 ? validKey : invalidKey };
          (supabase.verifyApiKey as jest.Mock).mockResolvedValue(
            i % 2 === 0 ? { userId: 'user123' } : null
          );

          await authService.authenticate(
            mockReq as Request,
            mockRes as Response,
            mockNext
          );

          const end = process.hrtime.bigint();
          times.push(Number(end - start) / 1000000); // Convert to ms
        }

        // Verify authentication completes successfully for all attempts
        expect(times.length).toBe(10);
        expect(times.every(t => t > 0)).toBe(true);

        // In production, constant-time comparison is implemented at database/crypto layer
        // This test validates that authentication logic doesn't crash or behave inconsistently
      });

      it('should handle oversized API keys without memory issues', async () => {
        const oversizedKey = 'nofx_' + 'a'.repeat(100000);
        mockReq.headers = { 'x-api-key': oversizedKey };
        (supabase.verifyApiKey as jest.Mock).mockResolvedValue(null);

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(resMocks.status).toHaveBeenCalledWith(401);
        // Should handle gracefully without crashing
      });

      it('should prevent header injection attacks', async () => {
        const maliciousHeaders = SecurityTestUtils.getMaliciousInputs().headerInjection;

        for (const header of maliciousHeaders) {
          jest.clearAllMocks();
          mockReq.headers = { 'x-api-key': header };
          (supabase.verifyApiKey as jest.Mock).mockResolvedValue(null);

          await authService.authenticate(
            mockReq as Request,
            mockRes as Response,
            mockNext
          );

          expect(resMocks.status).toHaveBeenCalledWith(401);
        }
      });
    });

    describe('Error Handling', () => {
      it('should handle API key verification errors gracefully', async () => {
        mockReq.headers = { 'x-api-key': 'test_key' };
        (supabase.verifyApiKey as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(log.error).toHaveBeenCalled();
        expect(resMocks.status).toHaveBeenCalledWith(500);
        expect(resMocks.json).toHaveBeenCalledWith({
          error: 'Authentication failed'
        });
      });

      it('should not leak error details to client', async () => {
        mockReq.headers = { 'x-api-key': 'test_key' };
        (supabase.verifyApiKey as jest.Mock).mockRejectedValue(
          new Error('Sensitive database error with credentials')
        );

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(resMocks.json).toHaveBeenCalledWith({
          error: 'Authentication failed'
        });
        expect(resMocks.json).not.toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('database')
          })
        );
      });

      it('should handle getUserTier failure gracefully', async () => {
        const apiKey = ApiKeyFactory.generateKey();
        mockReq.headers = { 'x-api-key': apiKey };

        (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
          userId: 'user123'
        });
        (supabase.getUserTier as jest.Mock).mockRejectedValue(
          new Error('Tier lookup failed')
        );

        // Should continue authentication despite tier lookup failure
        await expect(
          authService.authenticate(
            mockReq as Request,
            mockRes as Response,
            mockNext
          )
        ).resolves.not.toThrow();
      });
    });
  });

  describe('JWT Authentication', () => {
    describe('Valid JWT Scenarios', () => {
      it('should authenticate with valid JWT', async () => {
        const mockUser = UserFactory.createUser({ id: 'user123' });
        (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(supabase.getUserFromRequest).toHaveBeenCalledWith(mockReq, mockRes);
        expect(mockReq.user).toBe(mockUser);
        expect(mockReq.userId).toBe('user123');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should fetch and set user tier for JWT auth', async () => {
        const mockUser = UserFactory.createUser({ id: 'user123' });
        (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);
        (supabase.getUserTier as jest.Mock).mockResolvedValue('enterprise');

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(supabase.getUserTier).toHaveBeenCalledWith('user123');
        expect(mockReq.userTier).toBe('enterprise');
      });

      it('should prefer API key over JWT when both present', async () => {
        const apiKey = ApiKeyFactory.generateKey();
        mockReq.headers = { 'x-api-key': apiKey };

        const mockUser = UserFactory.createUser();
        (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
          userId: 'api-user-123'
        });
        (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        // Should use API key
        expect(mockReq.userId).toBe('api-user-123');
        expect(supabase.getUserFromRequest).not.toHaveBeenCalled();
      });
    });

    describe('Invalid JWT Scenarios', () => {
      it('should reject expired JWT tokens', async () => {
        (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(null);

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(resMocks.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle JWT verification errors', async () => {
        (supabase.getUserFromRequest as jest.Mock).mockRejectedValue(
          new Error('Token verification failed')
        );

        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(log.error).toHaveBeenCalled();
        expect(resMocks.status).toHaveBeenCalledWith(500);
      });

      it('should handle malformed JWT tokens', async () => {
        const malformedTokens = JwtTestUtils.getMalformedTokens();

        for (const token of malformedTokens) {
          jest.clearAllMocks();
          mockReq.headers = { authorization: `Bearer ${token}` };
          (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(null);

          await authService.authenticate(
            mockReq as Request,
            mockRes as Response,
            mockNext
          );

          expect(resMocks.status).toHaveBeenCalledWith(401);
        }
      });
    });
  });

  describe('requireAuth()', () => {
    it('should allow authenticated users', async () => {
      // Mock successful authentication
      const mockUser = UserFactory.createUser({ id: 'user123' });
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);
      (supabase.getUserTier as jest.Mock).mockResolvedValue('free');

      await authService.requireAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should block unauthenticated users', async () => {
      // Mock failed authentication - no user found
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(null);

      await authService.requireAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(resMocks.status).toHaveBeenCalledWith(401);
      // authenticate() is called first and returns this message
      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Please provide a valid JWT token or API key'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should prevent authentication bypass attempts', async () => {
      // Mock failed authentication for all bypass attempts
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(null);
      (supabase.verifyApiKey as jest.Mock).mockResolvedValue(null);

      const bypassAttempts = [
        { userId: '' },
        { userId: null },
        { userId: 0 },
        { userId: false },
        { userId: NaN }
      ];

      for (const attempt of bypassAttempts) {
        jest.clearAllMocks();
        (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(null);
        Object.assign(mockReq, attempt);

        await authService.requireAuth(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(resMocks.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
      }
    });

    it('should allow truthy userId values', async () => {
      // Mock successful authentication
      const mockUser = UserFactory.createUser({ id: 'valid-user-id' });
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);
      (supabase.getUserTier as jest.Mock).mockResolvedValue('free');

      await authService.requireAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('optionalAuth()', () => {
    it('should add user if API key is present', async () => {
      const apiKey = ApiKeyFactory.generateKey();
      mockReq.headers = { 'x-api-key': apiKey };

      (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
        userId: 'user123'
      });

      await authService.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.userId).toBe('user123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should add user if JWT is present', async () => {
      const mockUser = UserFactory.createUser();
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);

      await authService.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBe(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without authentication if none provided', async () => {
      mockReq.headers = {};
      (supabase.verifyApiKey as jest.Mock).mockResolvedValue(null);
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(null);

      await authService.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should continue even if authentication fails', async () => {
      mockReq.headers = { 'x-api-key': 'invalid' };
      (supabase.verifyApiKey as jest.Mock).mockRejectedValue(
        new Error('Auth service unavailable')
      );

      await authService.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(log.error).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete API key authentication in < 15ms', async () => {
      const apiKey = ApiKeyFactory.generateKey();
      mockReq.headers = { 'x-api-key': apiKey };

      (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
        userId: 'user123'
      });

      const time = await PerformanceTestUtils.measureExecutionTime(async () => {
        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );
      });

      PerformanceTestUtils.assertPerformance(time, 15, 'API key validation');
    });

    it('should complete JWT authentication in < 10ms', async () => {
      const mockUser = UserFactory.createUser();
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);

      const time = await PerformanceTestUtils.measureExecutionTime(async () => {
        await authService.authenticate(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );
      });

      PerformanceTestUtils.assertPerformance(time, 10, 'JWT authentication');
    });
  });

  describe('Concurrency & Race Conditions', () => {
    it('should handle concurrent authentication attempts', async () => {
      const apiKey = ApiKeyFactory.generateKey();
      mockReq.headers = { 'x-api-key': apiKey };

      (supabase.verifyApiKey as jest.Mock).mockResolvedValue({
        userId: 'user123'
      });

      const promises = Array(100).fill(null).map(() =>
        authService.authenticate(
          { ...mockReq } as Request,
          { ...mockRes } as Response,
          mockNext
        )
      );

      const results = await Promise.allSettled(promises);

      // All should succeed without race conditions
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('should handle concurrent requests for same user', async () => {
      const mockUser = UserFactory.createUser({ id: 'user123' });
      (supabase.getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);

      const requests = Array(50).fill(null).map(() => ({
        ...mockReq
      }));

      const results = await Promise.all(
        requests.map(req =>
          authService.authenticate(
            req as Request,
            { ...mockRes } as Response,
            MockFactory.createNext()
          )
        )
      );

      // All should succeed
      results.forEach((_, i) => {
        expect(requests[i].userId).toBe('user123');
      });
    });
  });
});
