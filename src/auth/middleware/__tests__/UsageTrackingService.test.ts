/**
 * UsageTrackingService Unit Tests
 * Coverage Target: 90%+
 */

import { Request, Response, NextFunction } from 'express';
import { UsageTrackingService } from '../UsageTrackingService';
import * as supabase from '../../supabase';
import { MockFactory } from '../../__tests__/test-helpers';

jest.mock('../../supabase');

describe('UsageTrackingService', () => {
  let usageService: UsageTrackingService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let resMocks: any;

  beforeEach(() => {
    usageService = new UsageTrackingService();
    const { res, mocks } = MockFactory.createResponse();
    mockRes = res;
    resMocks = mocks;
    mockReq = MockFactory.createRequest({ userId: 'user123', path: '/api/test' });
    mockNext = MockFactory.createNext();
    jest.clearAllMocks();
  });

  describe('checkUsage()', () => {
    it('should allow requests within usage limits', async () => {
      (supabase.checkUsageLimits as jest.Mock).mockResolvedValue(true);
      const middleware = usageService.checkUsage('api_calls');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(supabase.checkUsageLimits).toHaveBeenCalledWith('user123', 'api_calls');
      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding usage limits', async () => {
      (supabase.checkUsageLimits as jest.Mock).mockResolvedValue(false);
      const middleware = usageService.checkUsage('api_calls');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.status).toHaveBeenCalledWith(429);
      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Usage limit exceeded',
        message: 'You have exceeded your monthly api_calls limit',
        metric: 'api_calls',
        upgradeUrl: '/billing/upgrade'
      });
    });

    it('should require authentication', async () => {
      mockReq.userId = undefined;
      const middleware = usageService.checkUsage('api_calls');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.status).toHaveBeenCalledWith(401);
      expect(supabase.checkUsageLimits).not.toHaveBeenCalled();
    });

    it('should handle different metrics', async () => {
      const metrics = ['api_calls', 'storage', 'bandwidth', 'compute_time'];
      (supabase.checkUsageLimits as jest.Mock).mockResolvedValue(true);

      for (const metric of metrics) {
        jest.clearAllMocks();
        const middleware = usageService.checkUsage(metric);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(supabase.checkUsageLimits).toHaveBeenCalledWith('user123', metric);
      }
    });
  });

  describe('trackApiUsage()', () => {
    beforeEach(() => {
      require('../../supabase').trackUsage = jest.fn().mockResolvedValue(undefined);
    });

    it('should track successful API usage', async () => {
      const middleware = usageService.trackApiUsage('api_calls', 1);
      mockRes.statusCode = 200;

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate response finish
      const finishCallback = (resMocks.on as jest.Mock).mock.calls[0][1];
      await finishCallback();

      expect(require('../../supabase').trackUsage).toHaveBeenCalledWith(
        'user123',
        'api_calls',
        1,
        expect.objectContaining({
          endpoint: '/api/test',
          method: 'GET'
        })
      );
    });

    it('should not track failed requests (4xx/5xx)', async () => {
      const middleware = usageService.trackApiUsage('api_calls', 1);
      mockRes.statusCode = 400;

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      const finishCallback = (resMocks.on as jest.Mock).mock.calls[0][1];
      await finishCallback();

      expect(require('../../supabase').trackUsage).not.toHaveBeenCalled();
    });

    it('should not track unauthenticated requests', async () => {
      mockReq.userId = undefined;
      const middleware = usageService.trackApiUsage('api_calls', 1);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      const finishCallback = (resMocks.on as jest.Mock).mock.calls[0][1];
      await finishCallback();

      expect(require('../../supabase').trackUsage).not.toHaveBeenCalled();
    });

    it('should handle tracking failures gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      require('../../supabase').trackUsage = jest.fn().mockRejectedValue(
        new Error('Tracking failed')
      );

      const middleware = usageService.trackApiUsage('api_calls', 1);
      mockRes.statusCode = 200;

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      const finishCallback = (resMocks.on as jest.Mock).mock.calls[0][1];
      await finishCallback();

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to track usage:',
        expect.any(Error)
      );
      consoleError.mockRestore();
    });

    it('should track custom quantities', async () => {
      const middleware = usageService.trackApiUsage('storage', 1024);
      mockRes.statusCode = 200;

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      const finishCallback = (resMocks.on as jest.Mock).mock.calls[0][1];
      await finishCallback();

      expect(require('../../supabase').trackUsage).toHaveBeenCalledWith(
        'user123',
        'storage',
        1024,
        expect.any(Object)
      );
    });
  });
});
