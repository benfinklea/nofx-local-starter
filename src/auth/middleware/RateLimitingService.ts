/**
 * Rate Limiting Service - extracted from middleware.ts
 * Handles rate limiting based on user tier
 */

import { Request, Response, NextFunction } from 'express';

export class RateLimitingService {
  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();

  /**
   * Rate limiting middleware based on user tier
   */
  rateLimit(windowMs: number = 60000, maxRequests?: number) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.userId) {
        next(); // Skip rate limiting for unauthenticated requests
        return;
      }

      const limit = this.getTierLimit(req.userTier, maxRequests);
      const key = `${req.userId}:${req.path}`;
      const now = Date.now();

      // Check cache
      const cached = this.rateLimitCache.get(key);
      if (cached && cached.resetTime > now) {
        cached.count++;

        if (cached.count > limit) {
          this.sendRateLimitExceededResponse(res, cached, limit, req.userTier);
          return;
        }

        this.setRateLimitHeaders(res, limit, cached.count, cached.resetTime);
      } else {
        // Create new rate limit window
        this.createNewRateLimitWindow(key, now, windowMs);
        this.setRateLimitHeaders(res, limit, 1, now + windowMs);
      }

      // Clean up old entries periodically
      this.cleanupOldEntries(now);

      next();
    };
  }

  /**
   * Get rate limit based on user tier
   */
  private getTierLimit(userTier: string | undefined, maxRequests?: number): number {
    const defaultLimit = maxRequests || 10;
    const tierLimits: Record<string, number> = {
      free: defaultLimit,
      starter: maxRequests || 30,
      pro: maxRequests || 60,
      enterprise: maxRequests || 200
    };

    const tier = userTier || 'free';
    const limit = tierLimits[tier];
    return limit !== undefined ? limit : defaultLimit;
  }

  /**
   * Send rate limit exceeded response
   */
  private sendRateLimitExceededResponse(
    res: Response,
    cached: { count: number; resetTime: number },
    limit: number,
    userTier: string | undefined
  ): void {
    const retryAfter = Math.ceil((cached.resetTime - Date.now()) / 1000);

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', new Date(cached.resetTime).toISOString());
    res.setHeader('Retry-After', retryAfter.toString());

    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please retry after ${retryAfter} seconds`,
      limit,
      tier: userTier || 'free',
      retryAfter
    });
  }

  /**
   * Set rate limit headers
   */
  private setRateLimitHeaders(res: Response, limit: number, count: number, resetTime: number): void {
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', (limit - count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
  }

  /**
   * Create new rate limit window
   */
  private createNewRateLimitWindow(key: string, now: number, windowMs: number): void {
    this.rateLimitCache.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
  }

  /**
   * Clean up old entries periodically (1% chance)
   */
  private cleanupOldEntries(now: number): void {
    if (Math.random() < 0.01) {
      for (const [k, v] of this.rateLimitCache.entries()) {
        if (v.resetTime < now) {
          this.rateLimitCache.delete(k);
        }
      }
    }
  }
}
