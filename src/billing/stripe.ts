/**
 * Stripe Configuration and Utilities for NOFX
 * Handles billing, subscriptions, and payment processing
 */

import Stripe from 'stripe';
import { log } from '../lib/logger';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
  typescript: true
});

export { stripe };

/**
 * Convert Unix timestamp to ISO date string
 */
export function toDateTime(secs: number): string {
  const date = new Date(secs * 1000);
  return date.toISOString();
}

/**
 * Calculate trial end date for Stripe
 */
export function getTrialEnd(trialDays: number): number | null {
  if (!trialDays || trialDays <= 0) return null;
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  return Math.floor(trialEnd.getTime() / 1000); // Convert to Unix timestamp
}

/**
 * Create or retrieve Stripe customer
 */
export async function createOrRetrieveCustomer(userId: string, email?: string): Promise<string | null> {
  try {
    const { createServiceClient } = require('../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return null;

    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (existingCustomer?.stripe_customer_id) {
      return existingCustomer.stripe_customer_id;
    }

    // Get user details
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: email || userData?.email,
      metadata: {
        supabase_user_id: userId
      },
      name: userData?.full_name,
      // @ts-ignore - Stripe types might not include this yet
      address: userData?.billing_address
    });

    // Store customer ID
    await supabase
      .from('customers')
      .upsert({
        id: userId,
        stripe_customer_id: customer.id
      });

    return customer.id;
  } catch (error) {
    log.error({ error, userId }, 'Error creating/retrieving customer');
    return null;
  }
}

/**
 * Sync product from Stripe to database
 */
export async function upsertProduct(product: Stripe.Product): Promise<void> {
  try {
    const { createServiceClient } = require('../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return;

    const productData = {
      id: product.id,
      active: product.active,
      name: product.name,
      description: product.description,
      image: product.images?.[0] || null,
      metadata: product.metadata
    };

    const { error } = await supabase
      .from('products')
      .upsert(productData);

    if (error) {
      log.error({ error, productId: product.id }, 'Error upserting product');
    }
  } catch (error) {
    log.error({ error, productId: product.id }, 'Error syncing product');
  }
}

/**
 * Sync price from Stripe to database
 */
export async function upsertPrice(price: Stripe.Price): Promise<void> {
  try {
    const { createServiceClient } = require('../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return;

    const priceData = {
      id: price.id,
      product_id: typeof price.product === 'string' ? price.product : price.product.id,
      active: price.active,
      description: price.nickname || null,
      unit_amount: price.unit_amount || 0,
      currency: price.currency,
      type: price.type === 'recurring' ? 'recurring' : 'one_time',
      interval: price.recurring?.interval || null,
      interval_count: price.recurring?.interval_count || null,
      trial_period_days: price.recurring?.trial_period_days || null,
      metadata: price.metadata
    };

    const { error } = await supabase
      .from('prices')
      .upsert(priceData);

    if (error) {
      log.error({ error, priceId: price.id }, 'Error upserting price');
    }
  } catch (error) {
    log.error({ error, priceId: price.id }, 'Error syncing price');
  }
}

/**
 * Sync subscription from Stripe to database
 */
export async function manageSubscriptionStatusChange(
  subscriptionId: string,
  customerId: string,
  createAction = false
): Promise<void> {
  try {
    const { createServiceClient } = require('../auth/supabase');
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
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'items.data.price.product']
    });

    const priceId = subscription.items.data[0]?.price.id;

    const subscriptionData = {
      id: subscription.id,
      user_id: customerData.id,
      status: subscription.status,
      metadata: subscription.metadata,
      price_id: priceId,
      quantity: subscription.items.data[0]?.quantity || 1,
      cancel_at_period_end: subscription.cancel_at_period_end,
      created: toDateTime(subscription.created),
      current_period_start: toDateTime(subscription.current_period_start),
      current_period_end: toDateTime(subscription.current_period_end),
      ended_at: subscription.ended_at ? toDateTime(subscription.ended_at) : null,
      cancel_at: subscription.cancel_at ? toDateTime(subscription.cancel_at) : null,
      canceled_at: subscription.canceled_at ? toDateTime(subscription.canceled_at) : null,
      trial_start: subscription.trial_start ? toDateTime(subscription.trial_start) : null,
      trial_end: subscription.trial_end ? toDateTime(subscription.trial_end) : null
    };

    const { error } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData);

    if (error) {
      log.error({ error, subscriptionId }, 'Error upserting subscription');
    }

    // Update user's billing info if payment method changed
    if (subscription.default_payment_method) {
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
 * Delete product from database
 */
export async function deleteProduct(productId: string): Promise<void> {
  try {
    const { createServiceClient } = require('../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      log.error({ error, productId }, 'Error deleting product');
    }
  } catch (error) {
    log.error({ error, productId }, 'Error deleting product');
  }
}

/**
 * Delete price from database
 */
export async function deletePrice(priceId: string): Promise<void> {
  try {
    const { createServiceClient } = require('../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('prices')
      .delete()
      .eq('id', priceId);

    if (error) {
      log.error({ error, priceId }, 'Error deleting price');
    }
  } catch (error) {
    log.error({ error, priceId }, 'Error deleting price');
  }
}

/**
 * Create Stripe Checkout session
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  try {
    const customerId = await createOrRetrieveCustomer(userId);
    if (!customerId) {
      log.error({ userId }, 'Failed to create/retrieve customer');
      return null;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          supabase_user_id: userId
        },
        trial_period_days: 14 // Default trial period
      }
    });

    return session.url;
  } catch (error) {
    log.error({ error, userId, priceId }, 'Error creating checkout session');
    return null;
  }
}

/**
 * Create Stripe Customer Portal session
 */
export async function createPortalSession(userId: string, returnUrl: string): Promise<string | null> {
  try {
    const { createServiceClient } = require('../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return null;

    // Get customer ID
    const { data: customerData } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!customerData?.stripe_customer_id) {
      log.error({ userId }, 'Customer not found');
      return null;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerData.stripe_customer_id,
      return_url: returnUrl
    });

    return session.url;
  } catch (error) {
    log.error({ error, userId }, 'Error creating portal session');
    return null;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: string, immediately = false): Promise<boolean> {
  try {
    if (immediately) {
      await stripe.subscriptions.cancel(subscriptionId);
    } else {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }
    return true;
  } catch (error) {
    log.error({ error, subscriptionId }, 'Error cancelling subscription');
    return false;
  }
}

/**
 * Resume cancelled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<boolean> {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
    return true;
  } catch (error) {
    log.error({ error, subscriptionId }, 'Error resuming subscription');
    return false;
  }
}