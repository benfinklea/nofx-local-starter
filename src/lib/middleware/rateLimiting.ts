/**
 * Rate limiting middleware to prevent abuse and DDoS attacks
 * Implements tiered rate limits based on user tier and endpoint sensitivity
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { log } from '../logger';

/**
 * Custom key generator that uses user ID if available, otherwise IP
 */
const keyGenerator = (req: Request): string => {
  // Use userId if authenticated, otherwise fall back to IP
  if (req.userId) {
    return `user:${req.userId}`;
  }

  // Get real IP from X-Forwarded-For or socket
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || 'unknown';

  return `ip:${ip}`;
};

/**
 * Custom handler for rate limit exceeded
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  const key = keyGenerator(req);

  log.warn({
    key,
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent']
  }, 'Rate limit exceeded');

  res.status(429).json({
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: res.getHeader('Retry-After')
  });
};

/**
 * General API rate limit (applies to all routes)
 * 1000 requests per 15 minutes per user/IP
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Too many requests from this user/IP, please try again later.',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator,
  handler: rateLimitHandler,
  skip: (_req: Request) => {
    // Skip rate limiting in test mode
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Strict rate limit for authentication endpoints
 * 10 attempts per 15 minutes to prevent brute force
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (_req: Request) => process.env.NODE_ENV === 'test'
});

/**
 * Moderate rate limit for expensive operations
 * 100 requests per 15 minutes for run creation, billing, etc.
 */
export const expensiveOperationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests for this operation, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (_req: Request) => process.env.NODE_ENV === 'test'
});

/**
 * Very strict rate limit for admin operations
 * 50 requests per 15 minutes
 */
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (_req: Request) => process.env.NODE_ENV === 'test'
});

/**
 * Per-second rate limit for webhooks to prevent flood
 * 10 requests per second
 */
export const webhookRateLimit = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // 10 requests per second
  message: 'Too many webhook requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // For webhooks, use a combination of IP and webhook source
    const ip = req.socket.remoteAddress || 'unknown';
    const source = req.headers['x-webhook-source'] || 'unknown';
    return `webhook:${ip}:${source}`;
  },
  handler: rateLimitHandler,
  skip: (req: Request) => process.env.NODE_ENV === 'test'
});

/**
 * Tiered rate limiting based on user subscription tier
 */
export const createTieredRateLimit = (
  freeTierMax: number,
  paidTierMax: number,
  enterpriseMax: number,
  windowMs = 15 * 60 * 1000
) => {
  return rateLimit({
    windowMs,
    max: async (req: Request): Promise<number> => {
      // Check user tier from request (set by auth middleware)
      const tier = req.userTier || 'free';

      switch (tier) {
        case 'enterprise':
          return enterpriseMax;
        case 'pro':
        case 'team':
          return paidTierMax;
        case 'free':
        default:
          return freeTierMax;
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimitHandler,
    skip: (req: Request) => process.env.NODE_ENV === 'test'
  });
};

/**
 * Create custom rate limit with specific settings
 */
export const createCustomRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimitHandler,
    skip: (req: Request) => process.env.NODE_ENV === 'test'
  });
};
