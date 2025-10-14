/**
 * Stripe Webhook Handler - Vercel API Route
 * Processes Stripe webhooks for billing and subscription management
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { withCors } from '../_lib/cors';
import {
  upsertProduct,
  upsertPrice,
  manageSubscriptionStatusChange,
  deleteProduct,
  deletePrice
} from '../../src/billing/stripe';
import { createAuditLog, createServiceClient } from '../../src/auth/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil'
});

// Disable body parser to get raw body for signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

// Events we care about
const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'product.deleted',
  'price.created',
  'price.updated',
  'price.deleted',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.updated'
]);

export default withCors(async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.warn('Stripe webhook called without signature');
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig as string,
      webhookSecret
    );
  } catch (err) {
    const error = err as Error;
    console.error('Webhook signature verification failed:', error.message);
    res.status(400).json({ error: `Webhook Error: ${error.message}` });
    return;
  }

  // Log the event
  console.log(`Stripe webhook received: ${event.type} (${event.id})`);

  // Filter out events we don't care about
  if (!relevantEvents.has(event.type)) {
    console.log(`Ignoring irrelevant webhook event: ${event.type}`);
    res.json({ received: true });
    return;
  }

  try {
    switch (event.type) {
      // Product events
      case 'product.created':
      case 'product.updated':
        await upsertProduct(event.data.object as Stripe.Product);
        break;

      case 'product.deleted':
        await deleteProduct((event.data.object as Stripe.Product).id);
        break;

      // Price events
      case 'price.created':
      case 'price.updated':
        await upsertPrice(event.data.object as Stripe.Price);
        break;

      case 'price.deleted':
        await deletePrice((event.data.object as Stripe.Price).id);
        break;

      // Checkout completed
      case 'checkout.session.completed':
        const checkoutSession = event.data.object as Stripe.Checkout.Session;

        if (checkoutSession.mode === 'subscription') {
          const subscriptionId = checkoutSession.subscription as string;
          await manageSubscriptionStatusChange(
            subscriptionId,
            checkoutSession.customer as string,
            true
          );

          // Track the signup
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
        break;

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(
          subscription.id,
          subscription.customer as string
        );
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(
          deletedSubscription.id,
          deletedSubscription.customer as string
        );

        // Track the cancellation
        const supabase = createServiceClient();
        if (supabase) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('stripe_customer_id', deletedSubscription.customer)
            .single();

          if (customer) {
            await createAuditLog(
              customer.id,
              'billing.subscription_cancelled',
              'subscription',
              deletedSubscription.id
            );
          }
        }
        break;

      // Invoice events
      case 'invoice.payment_succeeded':
        const successInvoice = event.data.object as Stripe.Invoice;

        // Update subscription if this is a subscription invoice
        const subscriptionId = (successInvoice as any).subscription;

        if (subscriptionId) {
          const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId?.id;
          if (subId) {
            await manageSubscriptionStatusChange(
              subId,
              successInvoice.customer as string
            );
          }
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;

        // Log the failure
        console.warn('Invoice payment failed:', {
          customerId: failedInvoice.customer,
          invoiceId: failedInvoice.id,
          amount: failedInvoice.amount_due
        });
        // Could trigger an email notification here
        break;

      // Customer updated (billing info changes)
      case 'customer.updated':
        const customer = event.data.object as Stripe.Customer;

        // Update user's billing info
        const svc = createServiceClient();
        if (svc && customer.metadata?.supabase_user_id) {
          await svc
            .from('users')
            .update({
              billing_address: customer.address
            })
            .eq('id', customer.metadata.supabase_user_id);
        }
        break;

      default:
        console.warn(`Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', {
      error,
      eventType: event.type,
      eventId: event.id
    });

    // Return 200 to prevent Stripe from retrying
    // We log the error but don't want infinite retries
    res.json({ received: true, error: 'Processing error' });
  }
});
