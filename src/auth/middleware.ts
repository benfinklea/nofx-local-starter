/**
 * Authentication Middleware for NOFX Express API
 * Refactored into service-based architecture
 */

import { Request, Response, NextFunction } from 'express';
import { User } from '@supabase/supabase-js';

// Import extracted services
import { AuthenticationService } from './middleware/AuthenticationService';
import { AuthorizationService } from './middleware/AuthorizationService';
import { RateLimitingService } from './middleware/RateLimitingService';
import { UsageTrackingService } from './middleware/UsageTrackingService';
import { OwnershipValidationService } from './middleware/OwnershipValidationService';

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

// Initialize services with error handling
let authenticationService: AuthenticationService;
let authorizationService: AuthorizationService;
let rateLimitingService: RateLimitingService;
let usageTrackingService: UsageTrackingService;
let ownershipValidationService: OwnershipValidationService;

try {
  authenticationService = new AuthenticationService();
  authorizationService = new AuthorizationService();
  rateLimitingService = new RateLimitingService();
  usageTrackingService = new UsageTrackingService();
  ownershipValidationService = new OwnershipValidationService(authorizationService);
} catch (error) {
  console.error('❌ Failed to initialize authentication services:', error);
  throw new Error('Authentication services initialization failed');
}

/**
 * Authentication middleware - verifies JWT or API key
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  return authenticationService.authenticate(req, res, next);
}

/**
 * Require authentication - blocks unauthenticated requests
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  return authenticationService.requireAuth(req, res, next);
}

/**
 * Optional authentication - adds user if present but doesn't block
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  return authenticationService.optionalAuth(req, res, next);
}

/**
 * Require active subscription
 */
export async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  return authorizationService.requireSubscription(req, res, next);
}

/**
 * Check usage limits for a specific metric
 */
export function checkUsage(metric: string) {
  return usageTrackingService.checkUsage(metric);
}

/**
 * Rate limiting middleware based on user tier
 */
export function rateLimit(windowMs: number = 60000, maxRequests?: number) {
  return rateLimitingService.rateLimit(windowMs, maxRequests);
}

/**
 * Require admin role
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return authorizationService.requireAdmin(req, res, next);
}

/**
 * Track API usage for billing
 */
export function trackApiUsage(metric: string = 'api_calls', quantity: number = 1) {
  return usageTrackingService.trackApiUsage(metric, quantity);
}

/**
 * Validate request belongs to user (for resource access)
 */
export function validateOwnership(getResourceUserId: (req: Request) => Promise<string | null>) {
  return ownershipValidationService.validateOwnership(getResourceUserId);
}

/**
 * Require team access with optional role requirements
 */
export function requireTeamAccess(requiredRole?: 'owner' | 'admin' | 'member' | 'viewer') {
  return authorizationService.requireTeamAccess(requiredRole);
}

// Extend Express Request type to include team info
declare global {
  namespace Express {
    interface Request {
      teamRole?: string;
      teamId?: string;
    }
  }
}