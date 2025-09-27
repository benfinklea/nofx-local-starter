/**
 * Subscription Event Service - extracted from webhooks.ts
 * Handles subscription lifecycle events and checkout completion
 */

import Stripe from 'stripe';
import { manageSubscriptionStatusChange } from '../../../billing/stripe';
import { EmailNotificationService } from './EmailNotificationService';

type InvoiceWithLegacyFields = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription;
  payment_intent?: string | Stripe.PaymentIntent;
};

const unwrapStripe = <T>(resource: T | Stripe.Response<T>): T => {
  const maybeResponse = resource as Stripe.Response<T> & { data?: T };
  return typeof maybeResponse.data !== 'undefined' ? maybeResponse.data : resource as T;
};

export class SubscriptionEventService {
  constructor(
    private readonly stripe: Stripe,
    private readonly emailService: EmailNotificationService
  ) {}

  /**
   * Handle checkout session completed events
   */
  async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;

    if (checkoutSession.mode === 'subscription') {
      const subscriptionId = checkoutSession.subscription as string;
      await manageSubscriptionStatusChange(
        subscriptionId,
        checkoutSession.customer as string,
        true
      );

      await this.trackSubscriptionSignup(checkoutSession, subscriptionId);
      await this.sendSubscriptionConfirmationEmail(checkoutSession, subscriptionId);
    }
  }

  /**
   * Handle subscription lifecycle events
   */
  async handleSubscriptionEvent(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await manageSubscriptionStatusChange(
          subscription.id,
          subscription.customer as string
        );
        break;

      case 'customer.subscription.deleted':
        await manageSubscriptionStatusChange(
          subscription.id,
          subscription.customer as string
        );
        await this.trackSubscriptionCancellation(subscription);
        break;

      default:
        throw new Error(`Unhandled subscription event type: ${event.type}`);
    }
  }

  /**
   * Track subscription signup for audit purposes
   */
  private async trackSubscriptionSignup(
    checkoutSession: Stripe.Checkout.Session,
    subscriptionId: string
  ): Promise<void> {
    const { createAuditLog } = require('../../../auth/supabase');
    const userId = checkoutSession.metadata?.supabase_user_id;

    if (userId) {
      await createAuditLog(
        userId,
        'billing.subscription_created',
        'subscription',
        subscriptionId,
        {
          amount: checkoutSession.amount_total,
          currency: checkoutSession.currency
        }
      );
    }
  }

  /**
   * Send subscription confirmation email
   */
  private async sendSubscriptionConfirmationEmail(
    checkoutSession: Stripe.Checkout.Session,
    subscriptionId: string
  ): Promise<void> {
    const userId = checkoutSession.metadata?.supabase_user_id;
    if (!userId) return;

    const { createServiceClient } = require('../../../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user?.email) return;

    // Get subscription details
    const subscriptionDetails = await this.getSubscriptionDetails(subscriptionId);
    if (subscriptionDetails) {
      await this.emailService.sendSubscriptionConfirmation(userId, user.email, subscriptionDetails);
    }
  }

  /**
   * Get subscription details for email
   */
  private async getSubscriptionDetails(subscriptionId: string): Promise<any> {
    try {
      const subscriptionResponse = await this.stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ['items.data.price.product'] }
      );

      const subscription = unwrapStripe(subscriptionResponse);
      const subscriptionItem = subscription.items.data[0];
      const price = subscriptionItem?.price;
      const product = typeof price?.product === 'string' ? null : (price?.product as Stripe.Product | null);
      const unitAmount = price?.unit_amount ?? 0;
      const interval = price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
      const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number };
      const nextBillingDate = typeof subscriptionWithPeriod.current_period_end === 'number'
        ? new Date(subscriptionWithPeriod.current_period_end * 1000).toLocaleDateString()
        : undefined;

      return {
        planName: product?.name || 'Subscription',
        amount: `$${(unitAmount / 100).toFixed(2)}`,
        interval,
        nextBillingDate: nextBillingDate || 'TBD',
        features: (product?.metadata?.features || '').split(',').filter(Boolean),
      };
    } catch (error) {
      console.error('Error getting subscription details:', error);
      return null;
    }
  }

  /**
   * Track subscription cancellation
   */
  private async trackSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    const { createServiceClient } = require('../../../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (customer) {
      const { createAuditLog } = require('../../../auth/supabase');
      await createAuditLog(
        customer.id,
        'billing.subscription_cancelled',
        'subscription',
        subscription.id
      );
    }
  }
}