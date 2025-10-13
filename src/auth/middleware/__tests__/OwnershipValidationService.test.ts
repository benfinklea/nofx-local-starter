/**
 * OwnershipValidationService Unit Tests
 * Coverage Target: 95%+
 */

import { Request, Response, NextFunction } from 'express';
import { OwnershipValidationService } from '../OwnershipValidationService';
import { AuthorizationService } from '../AuthorizationService';
import { log } from '../../../lib/logger';
import { MockFactory } from '../../__tests__/test-helpers';

jest.mock('../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('OwnershipValidationService', () => {
  let ownershipService: OwnershipValidationService;
  let mockAuthzService: jest.Mocked<AuthorizationService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let resMocks: any;

  beforeEach(() => {
    mockAuthzService = {
      isUserAdmin: jest.fn(),
      requireAdmin: jest.fn(),
      requireSubscription: jest.fn(),
      requireTeamAccess: jest.fn()
    } as any;

    ownershipService = new OwnershipValidationService(mockAuthzService);

    const { res, mocks } = MockFactory.createResponse();
    mockRes = res;
    resMocks = mocks;
    mockReq = MockFactory.createRequest({ userId: 'user123' });
    mockNext = MockFactory.createNext();
    jest.clearAllMocks();
  });

  describe('validateOwnership()', () => {
    it('should allow owner to access resource', async () => {
      const getResourceUserId = jest.fn().mockResolvedValue('user123');
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(getResourceUserId).toHaveBeenCalledWith(mockReq);
      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should block non-owner from accessing resource', async () => {
      const getResourceUserId = jest.fn().mockResolvedValue('other-user');
      mockAuthzService.isUserAdmin.mockResolvedValue(false);
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.status).toHaveBeenCalledWith(403);
      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You do not have permission to access this resource'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow admin to access any resource', async () => {
      const getResourceUserId = jest.fn().mockResolvedValue('other-user');
      mockAuthzService.isUserAdmin.mockResolvedValue(true);
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuthzService.isUserAdmin).toHaveBeenCalledWith('user123');
      expect(mockNext).toHaveBeenCalled();
      expect(resMocks.status).not.toHaveBeenCalled();
    });

    it('should return 404 when resource not found', async () => {
      const getResourceUserId = jest.fn().mockResolvedValue(null);
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.status).toHaveBeenCalledWith(404);
      expect(resMocks.json).toHaveBeenCalledWith({ error: 'Resource not found' });
    });

    it('should require authentication', async () => {
      mockReq.userId = undefined;
      const getResourceUserId = jest.fn();
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.status).toHaveBeenCalledWith(401);
      expect(getResourceUserId).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const getResourceUserId = jest.fn().mockRejectedValue(new Error('DB error'));
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(log.error).toHaveBeenCalled();
      expect(resMocks.status).toHaveBeenCalledWith(500);
      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Authorization check failed'
      });
    });

    it('should not leak error details', async () => {
      const getResourceUserId = jest.fn().mockRejectedValue(
        new Error('Sensitive database connection string exposed')
      );
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(resMocks.json).toHaveBeenCalledWith({
        error: 'Authorization check failed'
      });
      expect(resMocks.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('database')
        })
      );
    });

    it('should handle concurrent ownership checks', async () => {
      const getResourceUserId = jest.fn().mockResolvedValue('user123');
      const middleware = ownershipService.validateOwnership(getResourceUserId);

      const promises = Array(10).fill(null).map(() =>
        middleware(
          { ...mockReq } as Request,
          { ...mockRes } as Response,
          MockFactory.createNext()
        )
      );

      await Promise.all(promises);

      expect(getResourceUserId).toHaveBeenCalledTimes(10);
    });
  });
});
