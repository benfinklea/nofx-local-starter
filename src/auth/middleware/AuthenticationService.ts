/**
 * Authentication Service - extracted from middleware.ts
 * Handles API key and JWT authentication
 */

import { Request, Response, NextFunction } from 'express';
import { getUserFromRequest, verifyApiKey, createAuditLog, getUserTier } from '../supabase';
import { log } from '../../lib/logger';
import { getErrorMessage } from '../../lib/errors';
import { isApiKeyVerificationResult, isUserProfile } from '../../lib/typeGuards';

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
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      log.error({ error, message: errorMessage }, 'Authentication error');
      res.status(500).json({
        error: 'Authentication failed'
        // Note: Do not include errorMessage here to avoid leaking sensitive details
      });
    }
  }

  /**
   * Authenticate using API key
   */
  private async authenticateWithApiKey(req: Request): Promise<boolean> {
    const apiKey = req.headers['x-api-key'];

    // Type guard: ensure API key is a string
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      return false;
    }

    const result = await verifyApiKey(apiKey, { ip: req.ip });

    // Type guard: validate the result structure
    if (!isApiKeyVerificationResult(result)) {
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

    // Type guard: validate user profile structure
    if (!isUserProfile(user)) {
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
    // In test mode, authenticate through the mocked supabase functions
    // This allows tests to control authentication behavior
    if (process.env.NODE_ENV === 'test') {
      // Try to authenticate using mocked functions
      const apiKeyResult = await this.authenticateWithApiKey(req);
      if (apiKeyResult) {
        return next();
      }

      const jwtResult = await this.authenticateWithJWT(req, res);
      if (jwtResult) {
        return next();
      }

      // If no authentication succeeded, return 401
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid JWT token or API key'
      });
      return;
    }

    await this.authenticate(req, res, () => {
      if (!req.userId) {
        res.status(401).json({
          error: 'Authentication required. You must be logged in to access this resource'
        });
        return;
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
    } catch (error: unknown) {
      log.error({ error, message: getErrorMessage(error) }, 'Optional authentication error');
      // Continue even if auth fails since it's optional
      next();
    }
  }
}
