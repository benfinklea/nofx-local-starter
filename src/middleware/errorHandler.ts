/**
 * Comprehensive error handling middleware
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../lib/logger';
import { ZodError } from 'zod';

/**
 * Custom error classes for better error handling
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    if (details) {
      (this as any).details = details;
    }
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_ERROR');
    if (retryAfter) {
      (this as any).retryAfter = retryAfter;
    }
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR', false);
    if (originalError) {
      (this as any).originalError = originalError;
    }
  }
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Parse error to determine appropriate response
 */
function parseError(err: unknown): {
  statusCode: number;
  message: string;
  code: string;
  details?: unknown;
  stack?: string;
} {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.format()
    };
  }

  // Handle custom AppError instances
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code || 'APP_ERROR',
      details: (err as any).details,
      stack: err.stack
    };
  }

  // Handle Postgres errors
  if (err && typeof err === 'object' && 'code' in err) {
    const pgError = err as any;
    switch (pgError.code) {
      case '23505': // Unique violation
        return {
          statusCode: 409,
          message: 'Duplicate entry',
          code: 'DUPLICATE_ERROR',
          details: { field: pgError.detail }
        };
      case '23503': // Foreign key violation
        return {
          statusCode: 400,
          message: 'Referenced resource does not exist',
          code: 'FOREIGN_KEY_ERROR'
        };
      case '22P02': // Invalid text representation
        return {
          statusCode: 400,
          message: 'Invalid input format',
          code: 'INVALID_INPUT'
        };
      default:
        return {
          statusCode: 500,
          message: 'Database error',
          code: 'DATABASE_ERROR'
        };
    }
  }

  // Handle standard errors
  if (err instanceof Error) {
    // Check for specific error types
    if (err.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      };
    }

    if (err.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      };
    }

    if (err.name === 'SyntaxError' && 'body' in err) {
      return {
        statusCode: 400,
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      };
    }

    return {
      statusCode: 500,
      message: err.message || 'Internal server error',
      code: 'INTERNAL_ERROR',
      stack: err.stack
    };
  }

  // Unknown error type
  return {
    statusCode: 500,
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR'
  };
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorInfo = parseError(err);

  // Log error with context
  const logContext = {
    statusCode: errorInfo.statusCode,
    code: errorInfo.code,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).userId,
    requestId: (req as any).requestId,
    ...(errorInfo.statusCode >= 500 ? { stack: errorInfo.stack } : {})
  };

  if (errorInfo.statusCode >= 500) {
    log.error(logContext, errorInfo.message);
  } else {
    log.warn(logContext, errorInfo.message);
  }

  // Send error response
  const response: any = {
    error: errorInfo.message,
    code: errorInfo.code
  };

  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    if (errorInfo.details) {
      response.details = errorInfo.details;
    }
    if (errorInfo.stack && errorInfo.statusCode >= 500) {
      response.stack = errorInfo.stack;
    }
  }

  // Add retry-after header for rate limiting
  if (errorInfo.code === 'RATE_LIMIT_ERROR' && (errorInfo as any).retryAfter) {
    res.setHeader('Retry-After', (errorInfo as any).retryAfter);
  }

  // Ensure response hasn't been sent already
  if (!res.headersSent) {
    res.status(errorInfo.statusCode).json(response);
  }
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  log.warn({
    path: req.path,
    method: req.method,
    ip: req.ip
  }, 'Route not found');

  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path
  });
}

/**
 * Unhandled rejection handler
 */
export function setupProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason: Error | unknown, _promise: Promise<any>) => {
    log.error({
      type: 'unhandledRejection',
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined
    }, 'Unhandled Promise Rejection');

    // In production, we should exit gracefully
    if (process.env.NODE_ENV === 'production') {
      // Give time for logs to be written
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    log.fatal({
      type: 'uncaughtException',
      message: error.message,
      stack: error.stack
    }, 'Uncaught Exception');

    // Exit immediately - the app is in an undefined state
    process.exit(1);
  });

  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', () => {
    log.info('SIGTERM received. Starting graceful shutdown...');

    // Give time for ongoing requests to complete
    setTimeout(() => {
      process.exit(0);
    }, 10000); // 10 seconds
  });
}