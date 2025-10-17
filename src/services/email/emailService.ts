/**
 * Email Service
 * Handles all email sending operations with templates and logging
 */

import { sendEmail, sendBatchEmails, isValidEmail } from '../../lib/email/resend-client';
import WelcomeEmail from '../../features/emails/WelcomeEmail';
import SubscriptionConfirmationEmail from '../../features/emails/SubscriptionConfirmationEmail';
import PaymentFailedEmail from '../../features/emails/PaymentFailedEmail';
import { log } from '../../lib/logger';
import { EMAIL_SETTINGS, getEmailSubject } from '../../config/email';
import { createServiceClient } from '../../auth/supabase';

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  userId: string,
  email: string,
  fullName?: string
): Promise<boolean> {
  try {
    if (!isValidEmail(email)) {
      log.error({ email }, 'Invalid email address');
      return false;
    }

    // Get user's subscription tier
    const supabase = createServiceClient();
    let tier: 'free' | 'starter' | 'pro' | 'enterprise' = 'free';

    if (supabase) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('price:prices(product:products(metadata))')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      const price = Array.isArray(subscription?.price)
        ? subscription?.price[0]
        : subscription?.price;

      const product = Array.isArray(price?.product)
        ? price?.product[0]
        : price?.product;

      if (product?.metadata?.tier) {
        tier = product.metadata.tier;
      }
    }

    const result = await sendEmail({
      to: email,
      subject: getEmailSubject('transactional', 'welcome'),
      react: WelcomeEmail({
        userEmail: email,
        userName: fullName || email.split('@')[0],
        loginUrl: `${EMAIL_SETTINGS.company.website}/login`,
        tier,
      }),
      tags: [
        { name: 'type', value: 'welcome' },
        { name: 'userId', value: userId },
      ],
    });

    if (result.success) {
      log.info({ userId, email }, 'Welcome email sent');
      await logEmailEvent(userId, 'welcome_email_sent', { emailId: result.id });
    } else {
      log.error({ userId, email, error: result.error }, 'Failed to send welcome email');
    }

    return result.success;
  } catch (error) {
    log.error({ error, userId, email }, 'Error sending welcome email');
    return false;
  }
}

/**
 * Send password reset email with custom branded template
 */
export async function sendPasswordResetEmail(
  userId: string,
  email: string,
  resetUrl: string,
  fullName?: string
): Promise<boolean> {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      log.error({ userId }, 'Invalid userId for password reset email');
      return false;
    }

    if (!isValidEmail(email)) {
      log.error({ email }, 'Invalid email address for password reset');
      return false;
    }

    // Validate reset URL format
    if (!resetUrl || typeof resetUrl !== 'string') {
      log.error({ userId, email }, 'Invalid or missing reset URL');
      return false;
    }

    try {
      new URL(resetUrl); // Validate URL format
    } catch {
      log.error({ userId, email, resetUrl }, 'Malformed reset URL');
      return false;
    }

    // Import PasswordResetEmail dynamically to avoid circular dependencies
    let PasswordResetEmail;
    try {
      const module = await Promise.race<typeof import('../../features/emails/PasswordResetEmail')>([
        import('../../features/emails/PasswordResetEmail'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Template import timeout')), 5000)
        )
      ]);
      PasswordResetEmail = module.default;
    } catch (importError) {
      log.error({ error: importError, userId, email }, 'Failed to load password reset email template');
      return false;
    }

    const result = await sendEmail({
      to: email,
      subject: getEmailSubject('transactional', 'passwordReset'),
      react: PasswordResetEmail({
        userEmail: email,
        userName: fullName || email.split('@')[0],
        resetUrl,
        expiryMinutes: 60,
      }),
      tags: [
        { name: 'type', value: 'password_reset' },
        { name: 'userId', value: userId },
      ],
    });

    if (result.success) {
      log.info({ userId, email }, 'Password reset email sent successfully');
      await logEmailEvent(userId, 'password_reset_email_sent', { emailId: result.id }).catch(err => {
        log.warn({ error: err, userId }, 'Failed to log email event, but email was sent');
      });
    } else {
      log.error({ userId, email, error: result.error }, 'Failed to send password reset email');
    }

    return result.success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error, errorMessage, userId, email }, 'Error sending password reset email');
    return false;
  }
}

/**
 * Send subscription confirmation email
 */
export async function sendSubscriptionConfirmationEmail(
  userId: string,
  email: string,
  subscriptionData: {
    planName: string;
    amount: string;
    interval: 'monthly' | 'yearly';
    nextBillingDate: string;
    features: string[];
    invoiceUrl?: string;
  }
): Promise<boolean> {
  try {
    if (!isValidEmail(email)) {
      log.error({ email }, 'Invalid email address');
      return false;
    }

    // Get user's name
    const supabase = createServiceClient();
    let userName = email.split('@')[0];

    if (supabase) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (user?.full_name) {
        userName = user.full_name;
      }
    }

    const result = await sendEmail({
      to: email,
      subject: getEmailSubject('billing', 'subscriptionConfirmed'),
      react: SubscriptionConfirmationEmail({
        userName,
        ...subscriptionData,
        manageUrl: `${EMAIL_SETTINGS.company.website}/billing`,
      }),
      tags: [
        { name: 'type', value: 'subscription_confirmation' },
        { name: 'userId', value: userId },
        { name: 'plan', value: subscriptionData.planName },
      ],
    });

    if (result.success) {
      log.info({ userId, email, plan: subscriptionData.planName }, 'Subscription confirmation email sent');
      await logEmailEvent(userId, 'subscription_email_sent', {
        emailId: result.id,
        plan: subscriptionData.planName
      });
    }

    return result.success;
  } catch (error) {
    log.error({ error, userId, email }, 'Error sending subscription confirmation email');
    return false;
  }
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(
  userId: string,
  email: string,
  paymentData: {
    amount: string;
    lastFourDigits?: string;
    failureReason?: string;
    retryDate?: string;
  }
): Promise<boolean> {
  try {
    if (!isValidEmail(email)) {
      log.error({ email }, 'Invalid email address');
      return false;
    }

    // Get user's name
    const supabase = createServiceClient();
    let userName = email.split('@')[0];

    if (supabase) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (user?.full_name) {
        userName = user.full_name;
      }
    }

    const result = await sendEmail({
      to: email,
      subject: getEmailSubject('billing', 'paymentFailed'),
      react: PaymentFailedEmail({
        userName,
        ...paymentData,
        updatePaymentUrl: `${EMAIL_SETTINGS.company.website}/billing/payment-methods`,
      }),
      tags: [
        { name: 'type', value: 'payment_failed' },
        { name: 'userId', value: userId },
      ],
    });

    if (result.success) {
      log.info({ userId, email }, 'Payment failed email sent');
      await logEmailEvent(userId, 'payment_failed_email_sent', {
        emailId: result.id,
        amount: paymentData.amount
      });
    }

    return result.success;
  } catch (error) {
    log.error({ error, userId, email }, 'Error sending payment failed email');
    return false;
  }
}

/**
 * Send usage limit warning email
 */
export async function sendUsageLimitWarningEmail(
  userId: string,
  email: string,
  usageData: {
    metric: 'runs' | 'api_calls';
    current: number;
    limit: number;
    percentage: number;
    resetDate?: string;
  }
): Promise<boolean> {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      log.error({ userId }, 'Invalid userId for usage warning email');
      return false;
    }

    if (!isValidEmail(email)) {
      log.error({ email }, 'Invalid email address for usage warning');
      return false;
    }

    // Validate usage data
    if (!usageData.metric || !['runs', 'api_calls'].includes(usageData.metric)) {
      log.error({ userId, metric: usageData.metric }, 'Invalid usage metric');
      return false;
    }

    if (typeof usageData.current !== 'number' || usageData.current < 0) {
      log.error({ userId, current: usageData.current }, 'Invalid current usage value');
      return false;
    }

    if (typeof usageData.limit !== 'number' || usageData.limit <= 0) {
      log.error({ userId, limit: usageData.limit }, 'Invalid usage limit value');
      return false;
    }

    if (typeof usageData.percentage !== 'number' || usageData.percentage < 0 || usageData.percentage > 200) {
      log.error({ userId, percentage: usageData.percentage }, 'Invalid percentage value');
      return false;
    }

    // Get user's name and current plan with error handling
    const supabase = createServiceClient();
    let userName = email.split('@')[0];
    let currentPlan: 'free' | 'starter' | 'pro' | 'enterprise' = 'free';

    if (supabase) {
      try {
        const { data: user, error: userError } = await Promise.race([
          supabase.from('users').select('full_name').eq('id', userId).single(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('User query timeout')), 3000)
          )
        ]);

        if (userError) {
          log.warn({ error: userError, userId }, 'Failed to fetch user name, using email');
        } else if (user?.full_name) {
          userName = user.full_name;
        }

        // Get subscription tier from product metadata
        const { data: subscription, error: subError } = await Promise.race([
          supabase
            .from('subscriptions')
            .select('price:prices(product:products(metadata))')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Subscription query timeout')), 3000)
          )
        ]);

        if (subError) {
          log.warn({ error: subError, userId }, 'Failed to fetch subscription tier, using free plan');
        } else {
          const price = Array.isArray(subscription?.price)
            ? subscription?.price[0]
            : subscription?.price;

          const product = Array.isArray(price?.product)
            ? price?.product[0]
            : price?.product;

          if (product?.metadata?.tier) {
            currentPlan = product.metadata.tier;
          }
        }
      } catch (dbError) {
        log.warn({ error: dbError, userId }, 'Database query failed, using default values');
      }
    }

    // Import UsageLimitWarningEmail dynamically with timeout
    let UsageLimitWarningEmail;
    try {
      const module = await Promise.race<typeof import('../../features/emails/UsageLimitWarningEmail')>([
        import('../../features/emails/UsageLimitWarningEmail'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Template import timeout')), 5000)
        )
      ]);
      UsageLimitWarningEmail = module.default;
    } catch (importError) {
      log.error({ error: importError, userId, email }, 'Failed to load usage warning email template');
      return false;
    }

    const result = await sendEmail({
      to: email,
      subject: getEmailSubject('usage', 'limitWarning'),
      react: UsageLimitWarningEmail({
        userName,
        metric: usageData.metric,
        current: usageData.current,
        limit: usageData.limit,
        percentage: usageData.percentage,
        currentPlan,
        upgradeUrl: `${EMAIL_SETTINGS.company.website}/billing`,
        resetDate: usageData.resetDate,
      }),
      tags: [
        { name: 'type', value: 'usage_warning' },
        { name: 'userId', value: userId },
        { name: 'metric', value: usageData.metric },
        { name: 'percentage', value: usageData.percentage.toString() },
      ],
    });

    if (result.success) {
      log.info({ userId, email, usageData }, 'Usage warning email sent successfully');
      await logEmailEvent(userId, 'usage_warning_email_sent', usageData).catch(err => {
        log.warn({ error: err, userId }, 'Failed to log email event, but email was sent');
      });
    } else {
      log.error({ userId, email, error: result.error }, 'Failed to send usage warning email');
    }

    return result.success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error, errorMessage, userId, email, usageData }, 'Error sending usage warning email');
    return false;
  }
}

/**
 * Log email event to audit log
 */
async function logEmailEvent(
  userId: string,
  eventType: string,
  metadata: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return;

    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: eventType,
        resource_type: 'email',
        metadata,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    log.error({ error, userId, eventType }, 'Failed to log email event');
  }
}

/**
 * Send batch welcome emails (for migrations)
 */
export async function sendBatchWelcomeEmails(
  users: Array<{ id: string; email: string; fullName?: string }>
): Promise<{ sent: number; failed: number }> {
  const emails = users.map(user => ({
    to: user.email,
    subject: getEmailSubject('transactional', 'welcome'),
    react: WelcomeEmail({
      userEmail: user.email,
      userName: user.fullName || user.email.split('@')[0],
      loginUrl: `${EMAIL_SETTINGS.company.website}/login`,
      tier: 'free' as const,
    }),
    tags: [
      { name: 'type', value: 'welcome' },
      { name: 'userId', value: user.id },
      { name: 'batch', value: 'true' },
    ],
  }));

  const results = await sendBatchEmails(emails);

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  log.info({ sent, failed, total: users.length }, 'Batch welcome emails processed');

  return { sent, failed };
}
