/**
 * Subscription Management Service - extracted from stripe.ts
 * Handles subscription status changes, cancellation, and resumption
 */

import Stripe from 'stripe';
import { log } from '../../lib/logger';

const unwrapStripe = <T>(resource: T | Stripe.Response<T>): T => {
  const maybeResponse = resource as Stripe.Response<T> & { data?: T };
  return typeof maybeResponse.data !== 'undefined' ? maybeResponse.data : resource as T;
};

export class SubscriptionManagementService {
  constructor(private readonly stripe: Stripe) {}

  /**
   * Sync subscription from Stripe to database
   */
  async manageSubscriptionStatusChange(
    subscriptionId: string,
    customerId: string,
    _createAction = false
  ): Promise<void> {
    try {
      const { createServiceClient } = require('../../auth/supabase');
      const supabase = createServiceClient();
      if (!supabase) return;

      // Get customer's user ID
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (!customerData) {
        log.error({ customerId }, 'Customer not found in database');
        return;
      }

      // Retrieve subscription from Stripe
      const subscriptionResponse = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'items.data.price.product']
      });

      const subscription = unwrapStripe(subscriptionResponse);
      const subscriptionItem = subscription.items.data[0];
      const priceId = subscriptionItem?.price?.id;

      const subscriptionWithPeriods = subscription as Stripe.Subscription & {
        current_period_start?: number | null;
        current_period_end?: number | null;
        created?: number;
      };

      const toOptionalDateTime = (value?: number | null) => (typeof value === 'number' ? this.toDateTime(value) : null);

      const subscriptionData = {
        id: subscription.id,
        user_id: customerData.id,
        status: subscription.status,
        metadata: subscription.metadata,
        price_id: priceId,
        quantity: subscriptionItem?.quantity || 1,
        cancel_at_period_end: subscription.cancel_at_period_end,
        created: toOptionalDateTime(subscriptionWithPeriods.created),
        current_period_start: toOptionalDateTime(subscriptionWithPeriods.current_period_start),
        current_period_end: toOptionalDateTime(subscriptionWithPeriods.current_period_end),
        ended_at: toOptionalDateTime(subscription.ended_at),
        cancel_at: toOptionalDateTime(subscription.cancel_at),
        canceled_at: toOptionalDateTime(subscription.canceled_at),
        trial_start: toOptionalDateTime(subscription.trial_start),
        trial_end: toOptionalDateTime(subscription.trial_end)
      };

      const { error } = await supabase
        .from('subscriptions')
        .upsert(subscriptionData);

      if (error) {
        log.error({ error, subscriptionId }, 'Error upserting subscription');
      }

      // Update user's billing info if payment method changed
      if (subscription.default_payment_method && typeof subscription.default_payment_method !== 'string') {
        const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod;
        await supabase
          .from('users')
          .update({
            payment_method: {
              type: paymentMethod.type,
              card: paymentMethod.card ? {
                brand: paymentMethod.card.brand,
                last4: paymentMethod.card.last4,
                exp_month: paymentMethod.card.exp_month,
                exp_year: paymentMethod.card.exp_year
              } : null
            }
          })
          .eq('id', customerData.id);
      }
    } catch (error) {
      log.error({ error, subscriptionId }, 'Error managing subscription');
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, immediately = false): Promise<boolean> {
    try {
      if (immediately) {
        await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      }
      return true;
    } catch (error) {
      log.error({ error, subscriptionId }, 'Error canceling subscription');
      return false;
    }
  }

  /**
   * Resume a subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      });
      return true;
    } catch (error) {
      log.error({ error, subscriptionId }, 'Error resuming subscription');
      return false;
    }
  }

  private toDateTime(secs: number): string {
    const date = new Date(secs * 1000);
    return date.toISOString();
  }
}