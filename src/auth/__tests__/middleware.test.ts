/**
 * Auth Middleware Security Tests - 90%+ Coverage Target
 * Critical security layer - must be bulletproof
 */

import { Request, Response, NextFunction } from 'express';
import {
  authenticate,
  requireAuth,
  optionalAuth,
  requireSubscription,
  requireAdmin,
  requireTeamAccess,
  rateLimit,
  trackApiUsage,
  checkUsage,
  validateOwnership
} from '../middleware';
import { getUserFromRequest, verifyApiKey, hasActiveSubscription, checkUsageLimits } from '../supabase';

// Mock dependencies
jest.mock('../supabase');
jest.mock('../../lib/logger', () => ({
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

describe('Auth Middleware - Security Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;
  let mockSetHeader: jest.Mock;

  beforeEach(() => {
    mockStatus = jest.fn().mockReturnThis();
    mockJson = jest.fn().mockReturnThis();
    mockSetHeader = jest.fn().mockReturnThis();

    mockReq = {
      headers: {},
      cookies: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      params: {},
      body: {},
      userId: undefined,
      user: undefined,
      userTier: undefined
    };

    mockRes = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
      on: jest.fn()
    };

    mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

    // Reset all mocks
    jest.clearAllMocks();
    mockNext.mockClear();
    mockStatus.mockClear();
    mockJson.mockClear();
    (getUserFromRequest as jest.Mock).mockImplementation(async (req: Partial<Request>) => {
      const id = req?.userId;
      return id ? { id } : null;
    });
    (verifyApiKey as jest.Mock).mockResolvedValue(null);
    (hasActiveSubscription as jest.Mock).mockResolvedValue(false);
    (checkUsageLimits as jest.Mock).mockResolvedValue(true);
  });

  describe('authenticate()', () => {
    describe('API Key Authentication', () => {
      it('authenticates valid API key', async () => {
        const apiKey = 'nofx_test_validkey123';
        mockReq.headers = { 'x-api-key': apiKey };

        (verifyApiKey as jest.Mock).mockResolvedValue({
          userId: 'user123',
          keyId: 'key123'
        });

        await authenticate(mockReq as Request, mockRes as Response, mockNext);

        expect(verifyApiKey).toHaveBeenCalledWith(apiKey, expect.objectContaining({ ip: '127.0.0.1' }));
        expect(mockReq.userId).toBe('user123');
        expect(mockNext).toHaveBeenCalled();
        expect(mockStatus).not.toHaveBeenCalled();
      });

      it('rejects invalid API key', async () => {
        mockReq.headers = { 'x-api-key': 'invalid_key' };
        (verifyApiKey as jest.Mock).mockResolvedValue(null);

        await authenticate(mockReq as Request, mockRes as Response, mockNext);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({
          error: 'Authentication required',
          message: 'Please provide a valid JWT token or API key'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('prevents API key enumeration attacks', async () => {
        const maliciousKeys = [
          '', null, undefined, 'admin', 'root', 'test',
          '../../etc/passwd', '<script>alert(1)</script>',
          'nofx_test_' + 'a'.repeat(1000),
          'Bearer token123'
        ];

        for (const key of maliciousKeys) {
          mockReq.headers = { 'x-api-key': key };
          (verifyApiKey as jest.Mock).mockResolvedValue(null);

          await authenticate(mockReq as Request, mockRes as Response, mockNext);

          expect(mockStatus).toHaveBeenCalledWith(401);
          // Should not leak information about key format
          expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Authentication required'
          }));
        }
      });

      it('handles API key verification errors gracefully', async () => {
        mockReq.headers = { 'x-api-key': 'test_key' };
        (verifyApiKey as jest.Mock).mockRejectedValue(new Error('Database error'));

        await authenticate(mockReq as Request, mockRes as Response, mockNext);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication failed' });
      });
    });

    describe('JWT Authentication', () => {
      it('authenticates valid JWT user', async () => {
        const mockUser = {
          id: 'user123',
          email: 'test@example.com',
          aud: 'authenticated'
        };

        (getUserFromRequest as jest.Mock).mockResolvedValue(mockUser);

        await authenticate(mockReq as Request, mockRes as Response, mockNext);

        expect(getUserFromRequest).toHaveBeenCalledWith(mockReq, mockRes);
        expect(mockReq.user).toBe(mockUser);
        expect(mockReq.userId).toBe('user123');
        expect(mockNext).toHaveBeenCalled();
      });

      it('rejects expired JWT tokens', async () => {
        (getUserFromRequest as jest.Mock).mockResolvedValue(null);

        await authenticate(mockReq as Request, mockRes as Response, mockNext);

        expect(mockStatus).toHaveBeenCalledWith(401);
      });

      it('handles JWT verification errors', async () => {
        (getUserFromRequest as jest.Mock).mockRejectedValue(new Error('Token verification failed'));

        await authenticate(mockReq as Request, mockRes as Response, mockNext);

        expect(mockStatus).toHaveBeenCalledWith(500);
      });
    });

    describe('Security Edge Cases', () => {
      it('prevents header injection attacks', async () => {
        const maliciousHeaders = [
          'test\r\nX-Admin: true',
          'test\nAuthorization: Bearer admin',
          'test%0AX-Bypass: true'
        ];

        for (const header of maliciousHeaders) {
          mockReq.headers = { 'x-api-key': header };
          (verifyApiKey as jest.Mock).mockResolvedValue(null);

          await authenticate(mockReq as Request, mockRes as Response, mockNext);

          expect(mockStatus).toHaveBeenCalledWith(401);
        }
      });

      it('handles concurrent authentication attempts', async () => {
        const promises = Array(10).fill(null).map(() =>
          authenticate(mockReq as Request, mockRes as Response, mockNext)
        );

        await Promise.all(promises);

        // Should handle all requests without race conditions
        expect(mockStatus).toHaveBeenCalledTimes(10);
      });
    });
  });

  describe('requireAuth()', () => {
    it('allows authenticated users', async () => {
      mockReq.userId = 'user123';
      mockNext.mockClear();
      mockStatus.mockClear();

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('blocks unauthenticated users', async () => {
      mockReq.userId = undefined;
      mockStatus.mockClear();
      mockJson.mockClear();
      mockNext.mockClear();

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Please provide a valid JWT token or API key'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('prevents authentication bypass attempts', async () => {
      const bypassAttempts = [
        { userId: '' },
        { userId: null },
        { userId: 0 },
        { userId: false },
        { userId: 'admin' }
      ];

      for (const attempt of bypassAttempts) {
        mockNext.mockClear();
        mockStatus.mockClear();
        Object.assign(mockReq, attempt);

        await requireAuth(mockReq as Request, mockRes as Response, mockNext);

        if (attempt.userId === 'admin') {
          expect(mockNext).toHaveBeenCalled();
        } else {
          expect(mockStatus).toHaveBeenCalledWith(401);
        }
      }
    });
  });

  describe('requireSubscription()', () => {
    beforeEach(() => {
      mockReq.userId = 'user123';
    });

    it('allows users with active subscription', async () => {
      (hasActiveSubscription as jest.Mock).mockResolvedValue(true);

      await requireSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(hasActiveSubscription).toHaveBeenCalledWith('user123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('blocks users without subscription', async () => {
      (hasActiveSubscription as jest.Mock).mockResolvedValue(false);

      await requireSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Subscription required',
        message: 'Please upgrade to a paid plan to access this feature',
        upgradeUrl: '/billing/upgrade'
      });
    });

    it('blocks unauthenticated users', async () => {
      mockReq.userId = undefined;

      await requireSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });
  });

  describe('requireTeamAccess()', () => {
    const middleware = requireTeamAccess('admin');

    beforeEach(() => {
      mockReq.userId = 'user123';
      mockReq.params = { teamId: 'team123' };
    });

    it('allows team members with sufficient role', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { role: 'admin' },
          error: null
        })
      };

      require('../supabase').createServiceClient = jest.fn().mockReturnValue(mockSupabase);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.teamRole).toBe('admin');
    });

    it('blocks non-team members', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      };

      require('../supabase').createServiceClient = jest.fn().mockReturnValue(mockSupabase);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You are not a member of this team'
      });
    });

    it('enforces role hierarchy', async () => {
      const roleTests = [
        { userRole: 'owner', required: 'admin', allowed: true },
        { userRole: 'admin', required: 'admin', allowed: true },
        { userRole: 'member', required: 'admin', allowed: false },
        { userRole: 'viewer', required: 'member', allowed: false }
      ];

      for (const test of roleTests) {
        const testMiddleware = requireTeamAccess(test.required as any);
        const mockSupabase = {
          from: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { role: test.userRole },
            error: null
          })
        };

        require('../supabase').createServiceClient = jest.fn().mockReturnValue(mockSupabase);

        await testMiddleware(mockReq as Request, mockRes as Response, mockNext);

        if (test.allowed) {
          expect(mockNext).toHaveBeenCalled();
        } else {
          expect(mockStatus).toHaveBeenCalledWith(403);
        }

        jest.clearAllMocks();
      }
    });
  });

  describe('rateLimit()', () => {
    const middleware = rateLimit(60000, 10); // 10 requests per minute

    beforeEach(() => {
      mockReq.userId = 'user123';
      mockReq.userTier = 'free';
      Object.defineProperty(mockReq, 'path', { value: '/api/test', writable: true });
    });

    it('allows requests within limit', async () => {
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
    });

    it('blocks requests exceeding limit', async () => {
      // Make 11 requests rapidly
      for (let i = 0; i < 11; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Rate limit exceeded'
      }));
    });

    it('applies different limits for different tiers', async () => {
      const tierMiddleware = rateLimit();
      const tiers = ['free', 'starter', 'pro', 'enterprise'];
      const expectedLimits = [10, 30, 60, 200];

      for (let i = 0; i < tiers.length; i++) {
        mockReq.userTier = tiers[i];
        mockReq.userId = `user-${tiers[i]}`;
        Object.defineProperty(mockReq, 'path', { value: `/api/test-${tiers[i]}`, writable: true });
        mockSetHeader.mockClear();
        mockNext.mockClear();

        await tierMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expectedLimits[i].toString());
      }
    });

    it('handles unauthenticated requests', async () => {
      mockReq.userId = undefined;

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should skip rate limiting
    });
  });

  describe('checkUsage()', () => {
    const middleware = checkUsage('api_calls');

    beforeEach(() => {
      mockReq.userId = 'user123';
    });

    it('allows requests within usage limits', async () => {
      (checkUsageLimits as jest.Mock).mockResolvedValue(true);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(checkUsageLimits).toHaveBeenCalledWith('user123', 'api_calls');
      expect(mockNext).toHaveBeenCalled();
    });

    it('blocks requests exceeding usage limits', async () => {
      (checkUsageLimits as jest.Mock).mockResolvedValue(false);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Usage limit exceeded',
        message: 'You have exceeded your monthly api_calls limit',
        metric: 'api_calls',
        upgradeUrl: '/billing/upgrade'
      });
    });
  });

  describe('trackApiUsage()', () => {
    const middleware = trackApiUsage('api_calls', 1);

    beforeEach(() => {
      mockReq.userId = 'user123';
      Object.defineProperty(mockReq, 'path', { value: '/api/test', writable: true });
      mockReq.method = 'GET';
    });

    it('tracks successful API usage', async () => {
      const mockOn = jest.fn();
      mockRes.on = mockOn;

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('does not track failed requests', async () => {
      mockRes.statusCode = 400;
      const finishCallback = jest.fn();
      mockRes.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback.mockImplementation(callback);
        }
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response finish with error status
      await finishCallback();

      // trackUsage should not be called for error responses
      expect(require('../supabase').trackUsage).not.toHaveBeenCalled();
    });
  });

  describe('Security Stress Tests', () => {
    it('handles high concurrent authentication load', async () => {
      const concurrentRequests = 100;
      const promises = Array(concurrentRequests).fill(null).map((_, i) => {
        const req = { ...mockReq, headers: { 'x-api-key': `key_${i}` } };
        return authenticate(req as Request, mockRes as Response, mockNext);
      });

      await Promise.allSettled(promises);

      // Should handle all requests without crashes
      expect(mockStatus).toHaveBeenCalledTimes(concurrentRequests);
    });

    it('prevents memory exhaustion attacks', async () => {
      const largeData = {
        headers: {
          'x-api-key': 'a'.repeat(100000),
          'user-agent': 'b'.repeat(100000)
        }
      };

      Object.assign(mockReq, largeData);

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Should handle gracefully
      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    it('handles malformed request objects', async () => {
      const malformedRequests = [
        { headers: null },
        { headers: undefined },
        { cookies: null },
        { params: null },
        { body: null }
      ];

      for (const malformed of malformedRequests) {
        Object.assign(mockReq, malformed);

        await authenticate(mockReq as Request, mockRes as Response, mockNext);

        // Should not crash
        expect(mockStatus).toHaveBeenCalled();
      }
    });
  });
});