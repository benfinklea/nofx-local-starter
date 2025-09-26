/**
 * Authentication Middleware for NOFX Express API
 * Handles JWT tokens, API keys, and session management
 */

import { Request, Response, NextFunction } from 'express';
import { getUserFromRequest, verifyApiKey, hasActiveSubscription, checkUsageLimits, createAuditLog, getUserTier } from './supabase';
import { log } from '../lib/logger';
import { User } from '@supabase/supabase-js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
      userTier?: string;
      apiKeyId?: string;
    }
  }
}

/**
 * Authentication middleware - verifies JWT or API key
 * Adds user to request object if authenticated
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for API key first (faster)
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const result = await verifyApiKey(apiKey);
      if (result) {
        req.userId = result.userId;
        req.apiKeyId = apiKey.substring(0, 8); // Store prefix for logging

        // Get user tier
        req.userTier = await getUserTier(result.userId);

        // Log API access
        await createAuditLog(result.userId, 'api.access', 'api_key', req.apiKeyId, {
          endpoint: req.path,
          method: req.method
        }, req);

        return next();
      }
    }

    // Check for JWT token (cookie or header)
    const user = await getUserFromRequest(req, res);
    if (user) {
      req.user = user;
      req.userId = user.id;
      req.userTier = await getUserTier(user.id);
      return next();
    }

    // No valid authentication found
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid JWT token or API key'
    });
  } catch (error) {
    log.error({ error }, 'Authentication error');
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Require authentication - blocks unauthenticated requests
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  await authenticate(req, res, () => {
    if (!req.userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }
    next();
  });
}

/**
 * Optional authentication - adds user if present but doesn't block
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  await authenticate(req, res, () => next());
}

/**
 * Require active subscription
 */
export async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasSubscription = await hasActiveSubscription(req.userId);
  if (!hasSubscription) {
    return res.status(403).json({
      error: 'Subscription required',
      message: 'Please upgrade to a paid plan to access this feature',
      upgradeUrl: '/billing/upgrade'
    });
  }

  next();
}

/**
 * Check usage limits for a specific metric
 */
export function checkUsage(metric: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const withinLimits = await checkUsageLimits(req.userId, metric);
    if (!withinLimits) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        message: `You have exceeded your monthly ${metric} limit`,
        metric,
        upgradeUrl: '/billing/upgrade'
      });
    }

    next();
  };
}

/**
 * Rate limiting middleware based on user tier
 */
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(windowMs: number = 60000, maxRequests?: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    // Get tier-based rate limits
    const tierLimits: Record<string, number> = {
      free: maxRequests || 10,
      starter: maxRequests || 30,
      pro: maxRequests || 60,
      enterprise: maxRequests || 200
    };

    const userTier = req.userTier || 'free';
    const limit = tierLimits[userTier] || tierLimits.free;

    const key = `${req.userId}:${req.path}`;
    const now = Date.now();

    // Check cache
    const cached = rateLimitCache.get(key);
    if (cached && cached.resetTime > now) {
      cached.count++;

      if (cached.count > limit) {
        const retryAfter = Math.ceil((cached.resetTime - now) / 1000);
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(cached.resetTime).toISOString());
        res.setHeader('Retry-After', retryAfter.toString());

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please retry after ${retryAfter} seconds`,
          limit,
          tier: userTier,
          retryAfter
        });
      }

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', (limit - cached.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(cached.resetTime).toISOString());
    } else {
      // Create new rate limit window
      rateLimitCache.set(key, {
        count: 1,
        resetTime: now + windowMs
      });

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', (limit - 1).toString());
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of rateLimitCache.entries()) {
        if (v.resetTime < now) {
          rateLimitCache.delete(k);
        }
      }
    }

    next();
  };
}

/**
 * Require admin role
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user has admin role in users table
  const { createServiceClient } = require('./supabase');
  const supabase = createServiceClient();

  if (!supabase) {
    return res.status(500).json({ error: 'Service unavailable' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'This action requires administrator privileges'
      });
    }

    next();
  } catch (error) {
    log.error({ error }, 'Error checking admin status');
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Track API usage for billing
 */
export async function trackApiUsage(metric: string = 'api_calls', quantity: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Track usage after successful response
    res.on('finish', async () => {
      if (req.userId && res.statusCode < 400) {
        const { trackUsage } = require('./supabase');
        await trackUsage(req.userId, metric, quantity, {
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode
        });
      }
    });
    next();
  };
}

/**
 * Validate request belongs to user (for resource access)
 */
export function validateOwnership(getResourceUserId: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const resourceUserId = await getResourceUserId(req);

      if (!resourceUserId) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      if (resourceUserId !== req.userId) {
        // Check if user is admin
        if (req.user) {
          const { createServiceClient } = require('./supabase');
          const supabase = createServiceClient();
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', req.userId)
            .single();

          if (data?.role === 'admin') {
            return next(); // Admins can access any resource
          }
        }

        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access this resource'
        });
      }

      next();
    } catch (error) {
      log.error({ error }, 'Error validating ownership');
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}