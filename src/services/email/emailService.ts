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

      if (subscription?.price?.product?.metadata?.tier) {
        tier = subscription.price.product.metadata.tier;
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
  }
): Promise<boolean> {
  try {
    const subject = `Usage Warning: ${usageData.percentage}% of ${usageData.metric} limit reached`;

    const html = `
      <h2>Usage Limit Warning</h2>
      <p>You've used ${usageData.percentage}% of your monthly ${usageData.metric.replace('_', ' ')} limit.</p>
      <p>Current: ${usageData.current} / ${usageData.limit}</p>
      <p><a href="${EMAIL_SETTINGS.company.website}/billing">Upgrade your plan</a> to increase your limits.</p>
    `;

    const result = await sendEmail({
      to: email,
      subject,
      html,
      tags: [
        { name: 'type', value: 'usage_warning' },
        { name: 'userId', value: userId },
        { name: 'metric', value: usageData.metric },
      ],
    });

    if (result.success) {
      log.info({ userId, email, usageData }, 'Usage warning email sent');
      await logEmailEvent(userId, 'usage_warning_email_sent', usageData);
    }

    return result.success;
  } catch (error) {
    log.error({ error, userId, email }, 'Error sending usage warning email');
    return false;
  }
}

/**
 * Log email event to audit log
 */
async function logEmailEvent(
  userId: string,
  eventType: string,
  metadata: Record<string, any>
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