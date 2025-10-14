/**
 * Supabase Client Configuration for NOFX
 * Handles both server-side and client-side authentication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request, Response } from 'express';
import { log } from '../lib/logger';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  log.warn('Supabase credentials not configured. Authentication will be disabled.');
}

/**
 * Create a Supabase client for server-side operations with service role
 * This bypasses RLS and should only be used for admin operations
 */
export function createServiceClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Create a Supabase client for server-side operations with user context
 * This respects RLS policies
 */
export function createServerClient(req: Request, _res: Response): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  // Get auth token from cookie or Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  });

  // Handle cookie-based sessions
  const refreshToken = req.cookies?.['sb-refresh-token'];
  const accessToken = req.cookies?.['sb-access-token'];

  if (accessToken && refreshToken) {
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  return supabase;
}

/**
 * Extract user from request
 */
export async function getUserFromRequest(req: Request, res: Response) {
  const supabase = createServerClient(req, res);
  if (!supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      log.debug({ error }, 'Failed to get user from request');
      return null;
    }
    return user;
  } catch (error) {
    log.error({ error }, 'Error getting user from request');
    return null;
  }
}

/**
 * Verify API key for programmatic access
 */
interface VerifyApiKeyContext {
  ip?: string;
}

export async function verifyApiKey(apiKey: string, context: VerifyApiKeyContext = {}): Promise<{ userId: string } | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  try {
    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { data, error } = await supabase
      .from('api_keys')
      .select('user_id, expires_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    const expiresAt = (data as { expires_at?: string | null }).expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return null;
    }

    const updatePayload: Record<string, unknown> = {
      last_used_at: new Date().toISOString()
    };

    if (context.ip) {
      updatePayload.last_used_ip = context.ip;
    }

    await supabase
      .from('api_keys')
      .update(updatePayload)
      .eq('key_hash', keyHash);

    return { userId: data.user_id };
  } catch (error) {
    log.error({ error }, 'Error verifying API key');
    return null;
  }
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !data || !data.current_period_end) {
      return false;
    }

    // Check if subscription is still valid
    const periodEndMs = new Date(data.current_period_end).getTime();
    if (Number.isNaN(periodEndMs)) {
      return false;
    }

    return periodEndMs > Date.now();
  } catch (error) {
    log.error({ error }, 'Error checking subscription status');
    return false;
  }
}

/**
 * Get user's subscription tier
 */
export async function getUserTier(userId: string): Promise<string> {
  const supabase = createServiceClient();
  if (!supabase) return 'free';

  try {
    const { data } = await supabase
      .from('subscriptions')
      .select(`
        status,
        price:prices(
          metadata,
          product:products(
            metadata
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!data || !data.price) {
      return 'free';
    }

    const price = Array.isArray(data.price) ? data.price[0] : data.price;
    const product = price && Array.isArray(price.product) ? price.product[0] : price?.product;
    const normalizedProduct = Array.isArray(product) ? product[0] : product;
    const tier = normalizedProduct?.metadata?.tier || 'free';
    return tier;
  } catch (error) {
    log.error({ error }, 'Error getting user tier');
    return 'free';
  }
}

/**
 * Track usage for billing
 */
export async function trackUsage(
  userId: string,
  metric: string,
  quantity: number,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await supabase.from('usage_records').insert({
      user_id: userId,
      metric_name: metric,
      quantity,
      period_start: startOfMonth.toISOString(),
      period_end: endOfMonth.toISOString(),
      metadata: metadata || {}
    });
  } catch (error) {
    log.error({ error, userId, metric }, 'Error tracking usage');
  }
}

/**
 * Check if user has exceeded usage limits
 */
export async function checkUsageLimits(userId: string, metric: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) return true; // Allow if we can't check

  try {
    // Get user's tier limits
    const tier = await getUserTier(userId);

    // Get tier limits from pricing_tiers table
    const { data: tierData } = await supabase
      .from('pricing_tiers')
      .select('*')
      .eq('tier', tier)
      .single();

    if (!tierData) return true;

    // Get current month usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: usageData } = await supabase
      .from('usage_records')
      .select('quantity')
      .eq('user_id', userId)
      .eq('metric_name', metric)
      .gte('period_start', startOfMonth.toISOString());

    const currentUsage = usageData?.reduce((sum, record) => sum + Number(record.quantity), 0) || 0;

    // Check against limits based on metric type
    switch (metric) {
      case 'runs':
        return currentUsage < (tierData.max_runs_per_month || Infinity);
      case 'api_calls':
        return currentUsage < (tierData.max_api_calls_per_month || Infinity);
      case 'compute_minutes':
        return currentUsage < (tierData.max_compute_minutes_per_month || Infinity);
      default:
        return true;
    }
  } catch (error) {
    log.error({ error, userId, metric }, 'Error checking usage limits');
    return true; // Allow on error to prevent blocking
  }
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
  userId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, any>,
  req?: Request
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      ip_address: req?.ip,
      user_agent: req?.headers['user-agent'],
      request_id: (req as any)?.id,
      metadata: metadata || {}
    });
  } catch (error) {
    log.error({ error, userId, action }, 'Error creating audit log');
  }
}