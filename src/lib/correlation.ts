/**
 * Correlation ID Management
 * Provides request tracking across the entire system
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { log as rootLogger } from './observability';

// AsyncLocalStorage maintains context across async operations
const asyncLocalStorage = new AsyncLocalStorage<{ correlationId: string; logger: any }>();

/**
 * Express middleware to add correlation IDs to all requests
 */
export function correlationMiddleware(req: Request & { correlationId?: string }, res: Response, next: NextFunction) {
  // Check for existing correlation ID from headers (useful for distributed systems)
  const correlationId =
    req.headers['x-correlation-id'] as string ||
    req.headers['x-request-id'] as string ||
    `req_${randomUUID()}`;

  // Attach to request object
  req.correlationId = correlationId;

  // Add to response headers for client tracking
  res.setHeader('X-Correlation-ID', correlationId);

  // Create a child logger with correlation ID
  const logger = rootLogger.child({
    correlationId,
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  // Store in AsyncLocalStorage for access anywhere in the request lifecycle
  asyncLocalStorage.run({ correlationId, logger }, () => {
    logger.info({
      event: 'request.started',
      userAgent: req.headers['user-agent']
    }, 'Request started');

    // Log when response finishes
    res.on('finish', () => {
      logger.info({
        event: 'request.completed',
        statusCode: res.statusCode,
        duration: Date.now() - Date.parse(new Date().toISOString())
      }, 'Request completed');
    });

    next();
  });
}

/**
 * Get current correlation ID from async context
 */
export function getCorrelationId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.correlationId;
}

/**
 * Get logger with correlation ID attached
 */
export function getLogger() {
  const store = asyncLocalStorage.getStore();
  return store?.logger || rootLogger;
}

/**
 * Run function with a specific correlation ID context
 * Useful for background jobs and workers
 */
export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  const logger = rootLogger.child({ correlationId });
  return asyncLocalStorage.run({ correlationId, logger }, fn);
}

/**
 * Decorator for class methods to automatically include correlation ID
 */
export function withCorrelation(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const logger = getLogger();
    logger.debug({
      event: 'method.called',
      class: target.constructor.name,
      method: propertyKey,
      args: args.length
    }, `Calling ${target.constructor.name}.${propertyKey}`);

    try {
      const result = await originalMethod.apply(this, args);
      logger.debug({
        event: 'method.completed',
        class: target.constructor.name,
        method: propertyKey
      }, `Completed ${target.constructor.name}.${propertyKey}`);
      return result;
    } catch (error) {
      logger.error({
        event: 'method.failed',
        class: target.constructor.name,
        method: propertyKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, `Failed ${target.constructor.name}.${propertyKey}`);
      throw error;
    }
  };

  return descriptor;
}