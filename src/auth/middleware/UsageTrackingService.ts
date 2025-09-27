/**
 * Usage Tracking Service - extracted from middleware.ts
 * Handles usage limits and tracking for billing
 */

import { Request, Response, NextFunction } from 'express';
import { checkUsageLimits } from '../supabase';

export class UsageTrackingService {
  /**
   * Check usage limits for a specific metric
   */
  checkUsage(metric: string) {
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
   * Track API usage for billing
   */
  trackApiUsage(metric: string = 'api_calls', quantity: number = 1) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Track usage after successful response
      res.on('finish', async () => {
        if (req.userId && res.statusCode < 400) {
          await this.recordUsage(req, metric, quantity);
        }
      });
      next();
    };
  }

  /**
   * Record usage in database
   */
  private async recordUsage(req: Request, metric: string, quantity: number): Promise<void> {
    try {
      const { trackUsage } = require('../supabase');
      await trackUsage(req.userId, metric, quantity, {
        endpoint: req.path,
        method: req.method,
        statusCode: req.res?.statusCode
      });
    } catch (error) {
      // Silently fail usage tracking - don't break user requests
      console.error('Failed to track usage:', error);
    }
  }
}