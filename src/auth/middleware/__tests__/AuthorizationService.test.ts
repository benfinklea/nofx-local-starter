/**
 * AuthorizationService Unit Tests
 * Coverage Target: 95%+
 */

import { Request, Response, NextFunction } from 'express';
import { AuthorizationService } from '../AuthorizationService';
import * as supabase from '../../supabase';
import { log } from '../../../lib/logger';
import { MockFactory, UserFactory, SupabaseMockFactory } from '../../__tests__/test-helpers';

jest.mock('../../supabase');
jest.mock('../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('AuthorizationService', () => {
  let authzService: AuthorizationService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let resMocks: any;

  beforeEach(() => {
    authzService = new AuthorizationService();
    const { res, mocks } = MockFactory.createResponse();
    mockRes = res;
    resMocks = mocks;
    mockReq = MockFactory.createRequest();
    mockNext = MockFactory.createNext();
    jest.clearAllMocks();
  });

  describe('requireSubscription()', () => {
    beforeEach(() => {
      mockReq.userId = 'user123';
    });

    it('should allow users with active subscription', async () => {
      (supabase.hasActiveSubscription as jest.Mock).mockResolvedValue(true);

      await authzService.requireSubscription(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(supabase.hasActiveSubscription).toHaveBeenCalledWith('user123');
      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should block users without subscription', async () => {
      (supabase.hasActiveSubscription as jest.Mock).mockResolvedValue(false);

      await authzService.requireSubscription(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(resMocks.status).toHaveBeenCalledWith(403);
      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Subscription required',
        message: 'Please upgrade to a paid plan to access this feature',
        upgradeUrl: '/billing/upgrade'
      });
    });

    it('should block unauthenticated users', async () => {
      mockReq.userId = undefined;

      await authzService.requireSubscription(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(resMocks.status).toHaveBeenCalledWith(401);
      expect(supabase.hasActiveSubscription).not.toHaveBeenCalled();
    });

    it('should handle subscription check errors', async () => {
      (supabase.hasActiveSubscription as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        authzService.requireSubscription(
          mockReq as Request,
          mockRes as Response,
          mockNext
        )
      ).rejects.toThrow();
    });
  });

  describe('requireAdmin()', () => {
    beforeEach(() => {
      mockReq.user = UserFactory.createUser({ id: 'user123' }) as any;
    });

    it('should allow admin users', async () => {
      const mockSupabase = SupabaseMockFactory.createMockClient(
        { role: 'admin' },
        null
      );
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      await authzService.requireAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should block non-admin users', async () => {
      const mockSupabase = SupabaseMockFactory.createMockClient(
        { role: 'user' },
        null
      );
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      await authzService.requireAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(resMocks.status).toHaveBeenCalledWith(403);
      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Admin access required',
        message: 'This action requires administrator privileges'
      });
    });

    it('should block unauthenticated users', async () => {
      mockReq.user = undefined;

      await authzService.requireAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(resMocks.status).toHaveBeenCalledWith(401);
    });

    it('should handle database errors gracefully', async () => {
      // Mock a failing database query that throws an error
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      await authzService.requireAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(log.error).toHaveBeenCalled();
      expect(resMocks.status).toHaveBeenCalledWith(500);
    });

    it('should handle null service client', async () => {
      (supabase.createServiceClient as jest.Mock).mockReturnValue(null);

      await authzService.requireAdmin(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(resMocks.status).toHaveBeenCalledWith(500);
    });
  });

  describe('requireTeamAccess()', () => {
    beforeEach(() => {
      mockReq.userId = 'user123';
      mockReq.params = { teamId: 'team123' };
    });

    it('should allow team members without role requirement', async () => {
      const middleware = authzService.requireTeamAccess();
      const mockSupabase = SupabaseMockFactory.createMockClient(
        { role: 'member' },
        null
      );
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.teamRole).toBe('member');
      expect(mockReq.teamId).toBe('team123');
    });

    it('should enforce role hierarchy correctly', async () => {
      const roleTests = [
        { userRole: 'owner', required: 'admin', shouldPass: true },
        { userRole: 'admin', required: 'admin', shouldPass: true },
        { userRole: 'member', required: 'admin', shouldPass: false },
        { userRole: 'viewer', required: 'member', shouldPass: false },
        { userRole: 'owner', required: 'viewer', shouldPass: true }
      ];

      for (const test of roleTests) {
        jest.clearAllMocks();
        const middleware = authzService.requireTeamAccess(test.required as any);
        const mockSupabase = SupabaseMockFactory.createMockClient(
          { role: test.userRole },
          null
        );
        (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

        await middleware(mockReq as Request, mockRes as Response, mockNext);

        if (test.shouldPass) {
          expect(mockNext).toHaveBeenCalled();
        } else {
          expect(resMocks.status).toHaveBeenCalledWith(403);
        }
      }
    });

    it('should block non-team members', async () => {
      const middleware = authzService.requireTeamAccess();
      const mockSupabase = SupabaseMockFactory.createMockClient(
        null,
        { message: 'Not found' }
      );
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.status).toHaveBeenCalledWith(403);
      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You are not a member of this team'
      });
    });

    it('should require teamId parameter', async () => {
      mockReq.params = {};
      mockReq.body = {};
      const middleware = authzService.requireTeamAccess();

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.status).toHaveBeenCalledWith(400);
      expect(resMocks.json).toHaveBeenCalledWith({ error: 'Team ID required' });
    });

    it('should accept teamId from body', async () => {
      mockReq.params = {};
      mockReq.body = { teamId: 'team456' };
      const middleware = authzService.requireTeamAccess();
      const mockSupabase = SupabaseMockFactory.createMockClient(
        { role: 'member' },
        null
      );
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.teamId).toBe('team456');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const middleware = authzService.requireTeamAccess();
      (supabase.createServiceClient as jest.Mock).mockReturnValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(log.error).toHaveBeenCalled();
      expect(resMocks.status).toHaveBeenCalledWith(500);
    });
  });

  describe('isUserAdmin()', () => {
    it('should return true for admin users', async () => {
      const mockSupabase = SupabaseMockFactory.createMockClient(
        { role: 'admin' },
        null
      );
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await authzService.isUserAdmin('user123');

      expect(result).toBe(true);
    });

    it('should return false for non-admin users', async () => {
      const mockSupabase = SupabaseMockFactory.createMockClient(
        { role: 'user' },
        null
      );
      (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await authzService.isUserAdmin('user123');

      expect(result).toBe(false);
    });

    it('should return false on errors', async () => {
      (supabase.createServiceClient as jest.Mock).mockReturnValue(null);

      const result = await authzService.isUserAdmin('user123');

      expect(result).toBe(false);
    });
  });
});
