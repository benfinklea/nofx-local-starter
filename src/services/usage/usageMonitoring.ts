/**
 * Usage Monitoring Service
 * Monitors usage against limits and triggers warning emails
 */

import { createServiceClient } from '../../auth/supabase';
import { sendUsageLimitWarningEmail } from '../email/emailService';
import { log } from '../../lib/logger';

// Warning thresholds (percentage of limit)
const WARNING_THRESHOLDS = {
  INFO: 80,      // First warning at 80%
  WARNING: 90,   // Second warning at 90%
  CRITICAL: 100, // Critical alert at 100% (exceeded)
} as const;

interface UsageData {
  userId: string;
  email: string;
  metric: 'runs' | 'api_calls';
  current: number;
  limit: number;
  percentage: number;
  resetDate: string;
}

interface WarningRecord {
  user_id: string;
  metric: 'runs' | 'api_calls';
  threshold: number;
  sent_at: string;
}

/**
 * Check if a warning has been sent for this threshold in the current billing period
 */
async function hasWarningSentRecently(
  userId: string,
  metric: 'runs' | 'api_calls',
  threshold: number,
  resetDate: Date
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from('usage_warnings')
      .select('*')
      .eq('user_id', userId)
      .eq('metric', metric)
      .eq('threshold', threshold)
      .gte('sent_at', resetDate.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" - expected
      log.error({ error, userId, metric, threshold }, 'Error checking warning history');
    }

    return !!data;
  } catch (error) {
    log.error({ error, userId, metric }, 'Error checking warning history');
    return false;
  }
}

/**
 * Record that a warning was sent
 */
async function recordWarningSent(
  userId: string,
  metric: 'runs' | 'api_calls',
  threshold: number
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('usage_warnings')
      .insert({
        user_id: userId,
        metric,
        threshold,
        sent_at: new Date().toISOString(),
      });

    if (error) {
      log.error({ error, userId, metric, threshold }, 'Failed to record warning');
    }
  } catch (error) {
    log.error({ error, userId, metric }, 'Error recording warning');
  }
}

/**
 * Determine which threshold (if any) should trigger a warning
 */
function getApplicableThreshold(percentage: number): number | null {
  if (percentage >= WARNING_THRESHOLDS.CRITICAL) {
    return WARNING_THRESHOLDS.CRITICAL;
  } else if (percentage >= WARNING_THRESHOLDS.WARNING) {
    return WARNING_THRESHOLDS.WARNING;
  } else if (percentage >= WARNING_THRESHOLDS.INFO) {
    return WARNING_THRESHOLDS.INFO;
  }
  return null;
}

/**
 * Check usage and send warning email if threshold is reached
 */
export async function checkUsageAndWarn(usageData: UsageData): Promise<boolean> {
  try {
    const { userId, email, metric, current, limit, percentage, resetDate } = usageData;

    // Validate input data
    if (!userId || typeof userId !== 'string') {
      log.error({ userId }, 'Invalid userId for usage warning');
      return false;
    }

    if (!email || typeof email !== 'string') {
      log.error({ userId, email }, 'Invalid email for usage warning');
      return false;
    }

    if (!['runs', 'api_calls'].includes(metric)) {
      log.error({ userId, metric }, 'Invalid metric for usage warning');
      return false;
    }

    if (typeof current !== 'number' || current < 0) {
      log.error({ userId, current }, 'Invalid current usage value');
      return false;
    }

    if (typeof limit !== 'number' || limit <= 0) {
      log.error({ userId, limit }, 'Invalid limit value');
      return false;
    }

    if (typeof percentage !== 'number' || percentage < 0) {
      log.error({ userId, percentage }, 'Invalid percentage value');
      return false;
    }

    // Determine if we should send a warning
    const threshold = getApplicableThreshold(percentage);
    if (threshold === null) {
      // Usage is below all warning thresholds
      return false;
    }

    // Validate reset date
    const resetDateObj = new Date(resetDate);
    if (isNaN(resetDateObj.getTime())) {
      log.error({ userId, resetDate }, 'Invalid reset date');
      return false;
    }

    // Check if we've already sent this warning in the current billing period with timeout
    let alreadySent = false;
    try {
      alreadySent = await Promise.race([
        hasWarningSentRecently(userId, metric, threshold, resetDateObj),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Warning check timeout')), 5000)
        )
      ]);
    } catch (error) {
      log.warn({ error, userId, metric }, 'Warning check timeout, proceeding with caution');
      // If check fails, assume not sent to avoid missing critical warnings
      alreadySent = false;
    }

    if (alreadySent) {
      log.debug(
        { userId, metric, threshold, percentage },
        'Warning already sent for this threshold in current period'
      );
      return false;
    }

    // Send the warning email with timeout
    let emailSent = false;
    try {
      emailSent = await Promise.race([
        sendUsageLimitWarningEmail(userId, email, {
          metric,
          current,
          limit,
          percentage,
          resetDate,
        }),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Email send timeout')), 10000)
        )
      ]);
    } catch (error) {
      log.error({ error, userId, metric }, 'Email send operation timed out or failed');
      return false;
    }

    if (emailSent) {
      // Record that we sent this warning (don't block on this)
      recordWarningSent(userId, metric, threshold).catch(err => {
        log.warn({ error: err, userId, metric }, 'Failed to record warning, but email was sent');
      });
      log.info(
        { userId, metric, threshold, percentage },
        'Usage warning email sent successfully'
      );
      return true;
    } else {
      log.error(
        { userId, metric, threshold, percentage },
        'Failed to send usage warning email'
      );
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error, errorMessage, usageData }, 'Error in checkUsageAndWarn');
    return false;
  }
}

/**
 * Monitor all users' usage and send warnings as needed
 * This should be called periodically (e.g., hourly or daily)
 */
export async function monitorAllUsersUsage(): Promise<{
  checked: number;
  warned: number;
  errors: number;
}> {
  const supabase = createServiceClient();
  if (!supabase) {
    log.error('Supabase client unavailable for usage monitoring');
    return { checked: 0, warned: 0, errors: 0 };
  }

  let checked = 0;
  let warned = 0;
  let errors = 0;

  try {
    // Get all active subscriptions with their usage limits
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select(`
        user_id,
        users!inner(email, full_name),
        price:prices!inner(
          product:products!inner(
            metadata
          )
        ),
        current_period_end
      `)
      .eq('status', 'active');

    if (subsError) {
      log.error({ error: subsError }, 'Failed to fetch subscriptions');
      return { checked, warned, errors: errors + 1 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      log.info('No active subscriptions to monitor');
      return { checked, warned, errors };
    }

    // Check each subscription
    for (const subscription of subscriptions) {
      try {
        checked++;

        const userId = subscription.user_id;
        const user = Array.isArray(subscription.users)
          ? subscription.users[0]
          : subscription.users;
        const email = user?.email;

        if (!email) {
          log.warn({ userId }, 'User has no email address');
          continue;
        }

        const price = Array.isArray(subscription.price)
          ? subscription.price[0]
          : subscription.price;
        const product = Array.isArray(price?.product)
          ? price.product[0]
          : price?.product;

        const metadata = product?.metadata || {};
        const runsLimit = parseInt(metadata.runs_limit || '0', 10);
        const apiCallsLimit = parseInt(metadata.api_calls_limit || '0', 10);
        const resetDate = subscription.current_period_end;

        // Get current usage from usage_tracking table
        const { data: usage } = await supabase
          .from('usage_tracking')
          .select('runs_count, api_calls_count')
          .eq('user_id', userId)
          .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          .single();

        const currentRuns = usage?.runs_count || 0;
        const currentApiCalls = usage?.api_calls_count || 0;

        // Check runs usage
        if (runsLimit > 0) {
          const runsPercentage = Math.round((currentRuns / runsLimit) * 100);
          const runsWarned = await checkUsageAndWarn({
            userId,
            email,
            metric: 'runs',
            current: currentRuns,
            limit: runsLimit,
            percentage: runsPercentage,
            resetDate,
          });
          if (runsWarned) warned++;
        }

        // Check API calls usage
        if (apiCallsLimit > 0) {
          const apiCallsPercentage = Math.round((currentApiCalls / apiCallsLimit) * 100);
          const apiCallsWarned = await checkUsageAndWarn({
            userId,
            email,
            metric: 'api_calls',
            current: currentApiCalls,
            limit: apiCallsLimit,
            percentage: apiCallsPercentage,
            resetDate,
          });
          if (apiCallsWarned) warned++;
        }
      } catch (error) {
        errors++;
        log.error({ error, subscription }, 'Error checking usage for subscription');
      }
    }

    log.info(
      { checked, warned, errors },
      'Completed usage monitoring cycle'
    );
  } catch (error) {
    errors++;
    log.error({ error }, 'Error in usage monitoring');
  }

  return { checked, warned, errors };
}

/**
 * Check usage for a specific user (call after incrementing usage)
 */
export async function checkUserUsageAfterIncrement(
  userId: string
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    // Get user's subscription and limits
    const { data: subscription, error: subsError } = await supabase
      .from('subscriptions')
      .select(`
        user_id,
        users!inner(email, full_name),
        price:prices!inner(
          product:products!inner(
            metadata
          )
        ),
        current_period_end
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subsError || !subscription) {
      log.debug({ userId }, 'No active subscription found for usage check');
      return;
    }

    const user = Array.isArray(subscription.users)
      ? subscription.users[0]
      : subscription.users;
    const email = user?.email;

    if (!email) {
      log.warn({ userId }, 'User has no email address');
      return;
    }

    const price = Array.isArray(subscription.price)
      ? subscription.price[0]
      : subscription.price;
    const product = Array.isArray(price?.product)
      ? price.product[0]
      : price?.product;

    const metadata = product?.metadata || {};
    const runsLimit = parseInt(metadata.runs_limit || '0', 10);
    const apiCallsLimit = parseInt(metadata.api_calls_limit || '0', 10);
    const resetDate = subscription.current_period_end;

    // Get current usage
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('runs_count, api_calls_count')
      .eq('user_id', userId)
      .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .single();

    const currentRuns = usage?.runs_count || 0;
    const currentApiCalls = usage?.api_calls_count || 0;

    // Check both metrics
    if (runsLimit > 0) {
      const percentage = Math.round((currentRuns / runsLimit) * 100);
      await checkUsageAndWarn({
        userId,
        email,
        metric: 'runs',
        current: currentRuns,
        limit: runsLimit,
        percentage,
        resetDate,
      });
    }

    if (apiCallsLimit > 0) {
      const percentage = Math.round((currentApiCalls / apiCallsLimit) * 100);
      await checkUsageAndWarn({
        userId,
        email,
        metric: 'api_calls',
        current: currentApiCalls,
        limit: apiCallsLimit,
        percentage,
        resetDate,
      });
    }
  } catch (error) {
    log.error({ error, userId }, 'Error checking user usage');
  }
}
