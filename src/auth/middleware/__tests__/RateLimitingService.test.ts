/**
 * RateLimitingService Unit Tests
 * Coverage Target: 95%+
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitingService } from '../RateLimitingService';
import { MockFactory, TimeTestUtils, RateLimitTestUtils } from '../../__tests__/test-helpers';

describe('RateLimitingService', () => {
  let rateLimitService: RateLimitingService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let resMocks: any;

  beforeEach(() => {
    rateLimitService = new RateLimitingService();
    const { res, mocks } = MockFactory.createResponse();
    mockRes = res;
    resMocks = mocks;
    mockReq = MockFactory.createRequest({
      userId: 'user123',
      userTier: 'free',
      path: '/api/test'
    });
    mockNext = MockFactory.createNext();
    jest.clearAllMocks();
  });

  describe('rateLimit()', () => {
    it('should allow requests within limit', async () => {
      const middleware = rateLimitService.rateLimit(60000, 10);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(resMocks.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
    });

    it('should block requests exceeding limit', async () => {
      const middleware = rateLimitService.rateLimit(60000, 5);

      // Make 6 requests
      for (let i = 0; i < 6; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(resMocks.status).toHaveBeenCalledWith(429);
      expect(resMocks.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
          limit: 5
        })
      );
    });

    it('should apply tier-based limits', async () => {
      const tiers = [
        { tier: 'free', limit: 10 },
        { tier: 'starter', limit: 30 },
        { tier: 'pro', limit: 60 },
        { tier: 'enterprise', limit: 200 }
      ];

      for (const { tier, limit } of tiers) {
        jest.clearAllMocks();
        const testReq = MockFactory.createRequest({
          userTier: tier,
          userId: `user-${tier}`,
          path: `/api/test-${tier}`
        });

        const middleware = rateLimitService.rateLimit();
        await middleware(testReq as Request, mockRes as Response, mockNext);

        expect(resMocks.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Limit',
          limit.toString()
        );
      }
    });

    it('should reset after window expires', async () => {
      const windowMs = 1000;
      const middleware = rateLimitService.rateLimit(windowMs, 2);

      // Use up limit
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      jest.clearAllMocks();

      // Third request should be blocked
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(resMocks.status).toHaveBeenCalledWith(429);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, windowMs + 100));
      jest.clearAllMocks();

      // Should work again
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for unauthenticated requests', async () => {
      mockReq.userId = undefined;
      const middleware = rateLimitService.rateLimit(60000, 1);

      // Should allow multiple requests
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should set correct rate limit headers', async () => {
      const middleware = rateLimitService.rateLimit(60000, 10);

      await middleware(mockReq as Request, mockRes as Response, mockNext);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(resMocks.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '8');
      expect(resMocks.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should include Retry-After header when rate limited', async () => {
      const middleware = rateLimitService.rateLimit(60000, 1);

      await middleware(mockReq as Request, mockRes as Response, mockNext);
      jest.clearAllMocks();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(String)
      );
    });

    it('should handle different paths independently', async () => {
      const middleware = rateLimitService.rateLimit(60000, 2);

      const req1 = MockFactory.createRequest({ userId: 'user123', userTier: 'free', path: '/api/path1' });
      await middleware(req1 as Request, mockRes as Response, mockNext);
      await middleware(req1 as Request, mockRes as Response, mockNext);

      const req2 = MockFactory.createRequest({ userId: 'user123', userTier: 'free', path: '/api/path2' });
      jest.clearAllMocks();
      await middleware(req2 as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should cleanup old entries', async () => {
      const middleware = rateLimitService.rateLimit(1000, 10);

      // Make many requests to trigger cleanup
      for (let i = 0; i < 100; i++) {
        mockReq.userId = `user${i}`;
        await middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // Should not throw or have memory issues
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle concurrent requests correctly', async () => {
      const middleware = rateLimitService.rateLimit(60000, 10);

      const promises = Array(15).fill(null).map((_, i) =>
        middleware(
          { ...mockReq, userId: 'user123' } as Request,
          { ...mockRes } as Response,
          MockFactory.createNext()
        )
      );

      await Promise.all(promises);

      // Should rate limit some requests
      expect(resMocks.status).toHaveBeenCalled();
    });
  });
});
