import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import express, { Response } from 'express';
import request from 'supertest';
import { ApiResponse, asyncHandler } from '../../src/lib/apiResponse';

// Mock observability
jest.mock('../../src/lib/observability', () => ({
  getContext: jest.fn(() => ({
    correlationId: 'test-correlation-123',
    requestId: 'test-request-456'
  })),
  log: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('ApiResponse', () => {
  let app: express.Application;
  let mockRes: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis()
    } as any;

    jest.clearAllMocks();
  });

  describe('Success Responses', () => {
    it('should return standardized success response', () => {
      const testData = { message: 'Hello World' };

      ApiResponse.success(mockRes, testData);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: testData,
        meta: {
          correlationId: 'test-correlation-123',
          timestamp: expect.any(String),
          version: '1.0'
        }
      });
    });

    it('should accept custom status code', () => {
      const testData = { id: '123' };

      ApiResponse.success(mockRes, testData, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should handle paginated responses', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const pagination = {
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5
      };

      ApiResponse.paginated(mockRes, items, pagination);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          items,
          pagination
        },
        meta: expect.any(Object)
      });
    });
  });

  describe('Error Responses', () => {
    it('should return RFC 9457 compliant error response', () => {
      ApiResponse.error(
        mockRes,
        404,
        'Resource Not Found',
        'The requested user was not found',
        'urn:nofx:error:not-found'
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
      expect(mockRes.json).toHaveBeenCalledWith({
        type: 'urn:nofx:error:not-found',
        title: 'Resource Not Found',
        status: 404,
        detail: 'The requested user was not found',
        instance: '/requests/test-request-456',
        correlationId: 'test-correlation-123'
      });
    });

    it('should handle validation errors', () => {
      const validationErrors = [
        ApiResponse.validationError('email', 'Email is required'),
        ApiResponse.validationError('password', 'Password must be at least 8 characters', 'MIN_LENGTH')
      ];

      ApiResponse.unprocessableEntity(mockRes, validationErrors);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Failed',
          status: 422,
          errors: validationErrors
        })
      );
    });

    it('should remove undefined fields from error response', () => {
      ApiResponse.error(mockRes, 400, 'Bad Request');

      const firstCall = (mockRes.json as jest.Mock).mock.calls[0];
      expect(firstCall).toBeDefined();
      const jsonCall = firstCall![0];
      expect(jsonCall).not.toHaveProperty('detail');
      expect(jsonCall).not.toHaveProperty('errors');
    });
  });

  describe('Convenience Methods', () => {
    it('should handle badRequest', () => {
      ApiResponse.badRequest(mockRes, 'Invalid input provided');

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid input provided'
        })
      );
    });

    it('should handle unauthorized', () => {
      ApiResponse.unauthorized(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Unauthorized',
          status: 401
        })
      );
    });

    it('should handle forbidden', () => {
      ApiResponse.forbidden(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle notFound with custom resource', () => {
      ApiResponse.notFound(mockRes, 'User');

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Not Found',
          detail: 'User not found'
        })
      );
    });

    it('should handle conflict', () => {
      ApiResponse.conflict(mockRes, 'Email already exists');

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('should handle serviceUnavailable', () => {
      ApiResponse.serviceUnavailable(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });
  });

  describe('Security Considerations', () => {
    it('should hide internal error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      ApiResponse.internalError(mockRes, 'Database connection failed: secret details');

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'An internal server error occurred'
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should show internal error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const errorDetail = 'Database connection failed: localhost:5432';
      ApiResponse.internalError(mockRes, errorDetail);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: errorDetail
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('asyncHandler', () => {
    it('should handle async route errors', async () => {
      app.get('/test-error', asyncHandler(async (req: any, res: any) => {
        throw new Error('Test async error');
      }));

      const response = await request(app)
        .get('/test-error')
        .expect(500);

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(JSON.parse(response.text)).toMatchObject({
        title: 'Internal Server Error',
        status: 500
      });
    });

    it('should handle successful async routes', async () => {
      app.get('/test-success', asyncHandler(async (req: any, res: any) => {
        ApiResponse.success(res, { message: 'Success!' });
      }));

      const response = await request(app)
        .get('/test-success')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: { message: 'Success!' }
      });
    });

    it('should not send response if headers already sent', async () => {
      app.get('/test-headers-sent', asyncHandler(async (req: any, res: any) => {
        res.json({ partial: 'response' });
        throw new Error('Error after response sent');
      }));

      await request(app)
        .get('/test-headers-sent')
        .expect(200);

      // Should not throw or cause issues
    });
  });

  describe('Content-Type Headers', () => {
    it('should set correct content-type for error responses', () => {
      ApiResponse.badRequest(mockRes);

      expect(mockRes.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    });

    it('should use default content-type for success responses', () => {
      ApiResponse.success(mockRes, { test: 'data' });

      expect(mockRes.header).not.toHaveBeenCalled();
    });
  });

  describe('Validation Error Helper', () => {
    it('should create validation error objects', () => {
      const error = ApiResponse.validationError('email', 'Invalid format', 'INVALID_FORMAT');

      expect(error).toEqual({
        field: 'email',
        message: 'Invalid format',
        code: 'INVALID_FORMAT'
      });
    });

    it('should create validation error without code', () => {
      const error = ApiResponse.validationError('name', 'Required field');

      expect(error).toEqual({
        field: 'name',
        message: 'Required field'
      });
    });
  });
});