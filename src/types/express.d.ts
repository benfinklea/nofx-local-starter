/**
 * Express Request type extensions
 * Augments the Express Request interface with custom properties
 */

import { User } from '@supabase/supabase-js';
import type { TeamRole } from './teams';

declare global {
  namespace Express {
    interface Request {
      // Authentication properties
      user?: User;
      userId?: string;
      userTier?: 'free' | 'pro' | 'enterprise';
      apiKeyId?: string;

      // Team management properties
      teamRole?: TeamRole;
      teamId?: string;
    }
  }
}

export {};
