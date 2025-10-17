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
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const withinLimits = await checkUsageLimits(req.userId, metric);
      if (!withinLimits) {
        res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You have exceeded your monthly ${metric} limit`,
          metric,
          upgradeUrl: '/billing/upgrade'
        });
        return;
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

      // Check if usage warning should be sent (async, don't block)
      if (req.userId) {
        this.checkUsageWarnings(req.userId).catch(error => {
          console.error('Failed to check usage warnings:', error);
        });
      }
    } catch (error) {
      // Silently fail usage tracking - don't break user requests
      console.error('Failed to track usage:', error);
    }
  }

  /**
   * Check if usage warnings should be sent for a user
   */
  private async checkUsageWarnings(userId: string): Promise<void> {
    try {
      const { checkUserUsageAfterIncrement } = require('../../services/usage/usageMonitoring');
      await checkUserUsageAfterIncrement(userId);
    } catch (error) {
      // Silently fail - don't break user requests
      console.error('Failed to check usage warnings:', error);
    }
  }
}