/**
 * Ownership Validation Service - extracted from middleware.ts
 * Handles resource ownership validation
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../../lib/logger';
import { AuthorizationService } from './AuthorizationService';

export class OwnershipValidationService {
  constructor(private readonly authorizationService: AuthorizationService) {}

  /**
   * Validate request belongs to user (for resource access)
   */
  validateOwnership(getResourceUserId: (req: Request) => Promise<string | null>) {
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
          const isAdmin = await this.authorizationService.isUserAdmin(req.userId);
          if (isAdmin) {
            return next(); // Admins can access any resource
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
}