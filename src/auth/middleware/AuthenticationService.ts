/**
 * Authentication Service - extracted from middleware.ts
 * Handles API key and JWT authentication
 */

import { Request, Response, NextFunction } from 'express';
import { getUserFromRequest, verifyApiKey, createAuditLog, getUserTier } from '../supabase';
import { log } from '../../lib/logger';

export class AuthenticationService {
  /**
   * Authenticate using API key or JWT
   */
  async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check for API key first (faster)
      const apiKeyResult = await this.authenticateWithApiKey(req);
      if (apiKeyResult) {
        return next();
      }

      // Check for JWT token (cookie or header)
      const jwtResult = await this.authenticateWithJWT(req, res);
      if (jwtResult) {
        return next();
      }

      // No valid authentication found
      this.sendAuthenticationError(res);
    } catch (error) {
      log.error({ error }, 'Authentication error');
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  /**
   * Authenticate using API key
   */
  private async authenticateWithApiKey(req: Request): Promise<boolean> {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return false;
    }

    const result = await verifyApiKey(apiKey, { ip: req.ip });
    if (!result) {
      return false;
    }

    req.userId = result.userId;
    req.apiKeyId = apiKey.substring(0, 8); // Store prefix for logging

    // Get user tier
    req.userTier = await getUserTier(result.userId);

    // Log API access
    await createAuditLog(result.userId, 'api.access', 'api_key', req.apiKeyId, {
      endpoint: req.path,
      method: req.method
    }, req);

    return true;
  }

  /**
   * Authenticate using JWT
   */
  private async authenticateWithJWT(req: Request, res: Response): Promise<boolean> {
    const user = await getUserFromRequest(req, res);
    if (!user) {
      return false;
    }

    req.user = user;
    req.userId = user.id;
    req.userTier = await getUserTier(user.id);

    return true;
  }

  /**
   * Send authentication error response
   */
  private sendAuthenticationError(res: Response): void {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid JWT token or API key'
    });
  }

  /**
   * Require authentication - blocks unauthenticated requests
   */
  async requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Bypass auth in test/integration mode
    if (process.env.NODE_ENV === 'test' || process.env.BYPASS_AUTH === 'true') {
      req.userId = req.headers['x-test-user-id'] as string || 'test-user-123';
      req.userTier = 'free';
      return next();
    }

    await this.authenticate(req, res, () => {
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
  async optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check for API key first (faster)
      const apiKeyResult = await this.authenticateWithApiKey(req);
      if (apiKeyResult) {
        return next();
      }

      // Check for JWT token (cookie or header)
      const jwtResult = await this.authenticateWithJWT(req, res);
      if (jwtResult) {
        return next();
      }

      // No authentication found, but that's OK for optional auth
      next();
    } catch (error) {
      log.error({ error }, 'Optional authentication error');
      // Continue even if auth fails since it's optional
      next();
    }
  }
}