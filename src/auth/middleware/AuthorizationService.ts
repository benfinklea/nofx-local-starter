/**
 * Authorization Service - extracted from middleware.ts
 * Handles role checks, admin checks, and team access
 */

import { Request, Response, NextFunction } from 'express';
import { hasActiveSubscription } from '../supabase';
import { log } from '../../lib/logger';

export class AuthorizationService {
  /**
   * Require active subscription
   */
  async requireSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasSubscription = await hasActiveSubscription(req.userId);
    if (!hasSubscription) {
      res.status(403).json({
        error: 'Subscription required',
        message: 'Please upgrade to a paid plan to access this feature',
        upgradeUrl: '/billing/upgrade'
      });
      return;
    }

    next();
  }

  /**
   * Require admin role
   */
  async requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const isAdmin = await this.checkAdminRole(req.user.id);
      if (!isAdmin) {
        res.status(403).json({
          error: 'Admin access required',
          message: 'This action requires administrator privileges'
        });
        return;
      }

      next();
    } catch (error) {
      log.error({ error }, 'Error checking admin status');
      res.status(500).json({ error: 'Authorization check failed' });
      return;
    }
  }

  /**
   * Require team access with optional role requirements
   */
  requireTeamAccess(requiredRole?: 'owner' | 'admin' | 'member' | 'viewer') {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const teamId = req.params.teamId || req.body.teamId;
      if (!teamId) {
        return res.status(400).json({ error: 'Team ID required' });
      }

      try {
        const memberRole = await this.getTeamMemberRole(req.userId, teamId);
        if (!memberRole) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'You are not a member of this team'
          });
        }

        // Check role hierarchy if required role specified
        if (requiredRole && !this.hasRequiredTeamRole(memberRole, requiredRole)) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: `This action requires ${requiredRole} role or higher`
          });
        }

        // Add team info to request
        req.teamRole = memberRole;
        req.teamId = teamId;

        next();
      } catch (error) {
        log.error({ error }, 'Error checking team access');
        res.status(500).json({ error: 'Authorization check failed' });
        return;
      }
    };
  }

  /**
   * Check if user has admin role
   */
  private async checkAdminRole(userId: string): Promise<boolean> {
    const { createServiceClient } = require('../supabase');
    const supabase = createServiceClient();

    if (!supabase) {
      throw new Error('Service unavailable');
    }

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    return !error && data && data.role === 'admin';
  }

  /**
   * Get team member role
   */
  private async getTeamMemberRole(userId: string, teamId: string): Promise<string | null> {
    const { createServiceClient } = require('../supabase');
    const supabase = createServiceClient();

    if (!supabase) {
      throw new Error('Service unavailable');
    }

    const { data: member, error } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    return error || !member ? null : member.role;
  }

  /**
   * Check if user has required team role
   */
  private hasRequiredTeamRole(userRole: string, requiredRole: string): boolean {
    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1
    };

    const userRoleLevel = roleHierarchy[userRole] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }

  /**
   * Check if user is admin for ownership validation
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      return await this.checkAdminRole(userId);
    } catch {
      return false;
    }
  }
}