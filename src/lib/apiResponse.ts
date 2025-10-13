/**
 * Standardized API Response Utilities
 * Following RFC 9457 Problem Details and 2025 best practices
 */

import { Response } from 'express';
import { getContext, log } from './observability';
import {
  ApiError,
  isApiError,
  getHttpStatusFromApiError,
  type ValidationErrorDetail,
} from './errors';

// Standard response envelope for successful operations
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    correlationId?: string;
    timestamp: string;
    version?: string;
  };
}

// RFC 9457 Problem Details format for errors
export interface ProblemDetails {
  type?: string;          // URI that identifies the error type
  title: string;          // Short, human-readable summary
  status: number;         // HTTP status code
  detail?: string;        // Detailed explanation
  instance?: string;      // URI reference to specific occurrence
  correlationId?: string; // For request tracking
  errors?: ValidationError[]; // For validation errors
}

// Validation error structure
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Response utility class
export class ApiResponse {
  /**
   * Send successful response with data
   */
  static success<T>(res: Response, data: T, status: number = 200): Response {
    const ctx = getContext();
    const response: SuccessResponse<T> = {
      success: true,
      data,
      meta: {
        correlationId: ctx?.correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    log.debug({
      event: 'api.response.success',
      status,
      correlationId: ctx?.correlationId
    }, 'Sending success response');

    return res.status(status).json(response);
  }

  /**
   * Send error response using RFC 9457 Problem Details
   */
  static error(
    res: Response,
    status: number,
    title: string,
    detail?: string,
    type?: string,
    errors?: ValidationError[]
  ): Response {
    const ctx = getContext();
    const correlationId = ctx?.correlationId;

    const problem: ProblemDetails = {
      type: type || `https://httpstatuses.com/${status}`,
      title,
      status,
      detail,
      instance: ctx?.requestId ? `/requests/${ctx.requestId}` : undefined,
      correlationId,
      errors
    };

    // Remove undefined fields
    Object.keys(problem).forEach(key => {
      if (problem[key as keyof ProblemDetails] === undefined) {
        delete problem[key as keyof ProblemDetails];
      }
    });

    log.warn({
      event: 'api.response.error',
      status,
      title,
      detail,
      correlationId,
      errorCount: errors?.length
    }, 'Sending error response');

    return res.status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problem);
  }

  /**
   * Common error responses
   */
  static badRequest(res: Response, detail?: string, errors?: ValidationError[]): Response {
    return this.error(
      res,
      400,
      'Bad Request',
      detail || 'The request could not be processed due to invalid input',
      'urn:nofx:error:bad-request',
      errors
    );
  }

  static unauthorized(res: Response, detail?: string): Response {
    return this.error(
      res,
      401,
      'Unauthorized',
      detail || 'Authentication is required to access this resource',
      'urn:nofx:error:unauthorized'
    );
  }

  static forbidden(res: Response, detail?: string): Response {
    return this.error(
      res,
      403,
      'Forbidden',
      detail || 'Access to this resource is forbidden',
      'urn:nofx:error:forbidden'
    );
  }

  static notFound(res: Response, resource: string = 'Resource'): Response {
    return this.error(
      res,
      404,
      'Not Found',
      `${resource} not found`,
      'urn:nofx:error:not-found'
    );
  }

  static conflict(res: Response, detail?: string): Response {
    return this.error(
      res,
      409,
      'Conflict',
      detail || 'The request could not be completed due to a conflict',
      'urn:nofx:error:conflict'
    );
  }

  static unprocessableEntity(res: Response, errors: ValidationError[]): Response {
    return this.error(
      res,
      422,
      'Validation Failed',
      'The request was well-formed but contains semantic errors',
      'urn:nofx:error:validation-failed',
      errors
    );
  }

  static internalError(res: Response, detail?: string): Response {
    // Never expose internal details in production
    const safeDetail = process.env.NODE_ENV === 'development'
      ? detail
      : 'An internal server error occurred';

    return this.error(
      res,
      500,
      'Internal Server Error',
      safeDetail,
      'urn:nofx:error:internal'
    );
  }

  static serviceUnavailable(res: Response, detail?: string): Response {
    return this.error(
      res,
      503,
      'Service Unavailable',
      detail || 'The service is temporarily unavailable',
      'urn:nofx:error:service-unavailable'
    );
  }

  /**
   * Validation error helper
   */
  static validationError(field: string, message: string, code?: string): ValidationError {
    return { field, message, code };
  }

  /**
   * Send error response from ApiError discriminated union
   * This provides type-safe error handling across the application
   */
  static fromApiError(res: Response, error: ApiError): Response {
    const status = getHttpStatusFromApiError(error);
    const ctx = getContext();

    // Map ApiError to ProblemDetails format
    const problem: ProblemDetails = {
      type: `urn:nofx:error:${error.type}`,
      title: this.getTitleForErrorType(error.type),
      status,
      detail: error.message,
      instance: ctx?.requestId ? `/requests/${ctx.requestId}` : undefined,
      correlationId: ctx?.correlationId,
    };

    // Add type-specific fields
    if (error.type === 'validation') {
      problem.errors = [{ field: error.field, message: error.message, code: error.code }];
    } else if (error.type === 'validation_multiple') {
      problem.errors = error.errors;
    } else if (error.type === 'rate_limit' && error.retryAfter) {
      res.header('Retry-After', String(error.retryAfter));
    }

    // Remove undefined fields
    Object.keys(problem).forEach(key => {
      if (problem[key as keyof ProblemDetails] === undefined) {
        delete problem[key as keyof ProblemDetails];
      }
    });

    log.warn({
      event: 'api.response.error.typed',
      status,
      errorType: error.type,
      correlationId: ctx?.correlationId,
    }, 'Sending typed error response');

    return res.status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problem);
  }

  /**
   * Get human-readable title for error type
   */
  private static getTitleForErrorType(type: ApiError['type']): string {
    const titles: Record<ApiError['type'], string> = {
      validation: 'Validation Error',
      validation_multiple: 'Validation Failed',
      authentication: 'Authentication Required',
      authorization: 'Access Denied',
      not_found: 'Resource Not Found',
      conflict: 'Conflict',
      rate_limit: 'Rate Limit Exceeded',
      internal: 'Internal Server Error',
      external: 'External Service Error',
      timeout: 'Request Timeout',
      bad_request: 'Bad Request',
    };
    return titles[type];
  }

  /**
   * Helper for paginated responses
   */
  static paginated<T>(
    res: Response,
    items: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }
  ): Response {
    return this.success(res, {
      items,
      pagination
    });
  }
}

/**
 * Middleware to handle async route errors
 * Automatically converts ApiError to proper HTTP response
 */
export function asyncHandler(fn: (req: any, res: any, next: any) => Promise<void>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      log.error({
        event: 'api.unhandled.error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        correlationId: getContext()?.correlationId
      }, 'Unhandled error in route handler');

      if (!res.headersSent) {
        // Check if it's a typed ApiError
        if (isApiError(error)) {
          ApiResponse.fromApiError(res, error);
        } else if (error instanceof Error) {
          ApiResponse.internalError(res, error.message);
        } else {
          ApiResponse.internalError(res, String(error));
        }
      }
    });
  };
}