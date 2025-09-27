/**
 * Webhook Handlers for NOFX
 * Processes Stripe webhooks for billing and subscription management
 */

import { Express, Request, Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { log } from '../../lib/logger';
import { ApiResponse } from '../../lib/apiResponse';
import {
  upsertProduct,
  upsertPrice,
  manageSubscriptionStatusChange,
  deleteProduct,
  deletePrice
} from '../../billing/stripe';
import {
  sendSubscriptionConfirmationEmail,
  sendPaymentFailedEmail
} from '../../services/email/emailService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil'
});

type InvoiceWithLegacyFields = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription;
  payment_intent?: string | Stripe.PaymentIntent;
};

const unwrapStripe = <T>(resource: T | Stripe.Response<T>): T => {
  const maybeResponse = resource as Stripe.Response<T> & { data?: T };
  return typeof maybeResponse.data !== 'undefined' ? maybeResponse.data : resource as T;
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

export default function mount(app: Express) {
  /**
   * Stripe Webhook Endpoint
   * IMPORTANT: This must use express.raw() middleware for body parsing
   */
  app.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        log.warn('Stripe webhook called without signature');
        return ApiResponse.badRequest(res, 'Missing signature header');
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        log.error('STRIPE_WEBHOOK_SECRET not configured');
        return ApiResponse.internalError(res, 'Webhook secret not configured');
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecret
        );
      } catch (err) {
        const error = err as Error;
        log.error({ error: error.message }, 'Webhook signature verification failed');
        return ApiResponse.badRequest(res, `Webhook signature verification failed: ${error.message}`);
      }

      // Log the event
      log.info({
        eventType: event.type,
        eventId: event.id
      }, 'Stripe webhook received');

      // Filter out events we don't care about
      if (!relevantEvents.has(event.type)) {
        log.debug({ eventType: event.type }, 'Ignoring irrelevant webhook event');
        return ApiResponse.success(res, { received: true, event: event.type });
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
              const { createAuditLog } = require('../../auth/supabase');
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

                // Send subscription confirmation email
                const { createServiceClient } = require('../../auth/supabase');
                const supabase = createServiceClient();
                if (supabase && userId) {
                  const { data: user } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();

                  if (user?.email) {
                    // Get subscription details
                    const subscriptionResponse = await stripe.subscriptions.retrieve(
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

                    sendSubscriptionConfirmationEmail(userId, user.email, {
                      planName: product?.name || 'Subscription',
                      amount: `$${(unitAmount / 100).toFixed(2)}`,
                      interval,
                      nextBillingDate: nextBillingDate || 'TBD',
                      features: (product?.metadata?.features || '').split(',').filter(Boolean),
                    }).catch(err => {
                      log.error({ err, userId }, 'Failed to send subscription confirmation email');
                    });
                  }
                }
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
            const { createServiceClient } = require('../../auth/supabase');
            const supabase = createServiceClient();
            if (supabase) {
              const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('stripe_customer_id', deletedSubscription.customer)
                .single();

              if (customer) {
                const { createAuditLog } = require('../../auth/supabase');
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
            const successInvoice = event.data.object as InvoiceWithLegacyFields;
            const subscriptionRef = successInvoice.subscription;
            const subscriptionId = typeof subscriptionRef === 'string'
              ? subscriptionRef
              : subscriptionRef?.id;

            if (subscriptionId) {
              await manageSubscriptionStatusChange(
                subscriptionId,
                successInvoice.customer as string
              );
            }

            // Track the payment
            const { createServiceClient: getClient } = require('../../auth/supabase');
            const client = getClient();
            if (client && successInvoice.metadata?.supabase_user_id) {
              const { trackUsage } = require('../../auth/supabase');
              await trackUsage(
                successInvoice.metadata.supabase_user_id,
                'payment_succeeded',
                successInvoice.amount_paid / 100, // Convert from cents
                {
                  invoiceId: successInvoice.id,
                  currency: successInvoice.currency
                }
              );
            }
            break;

          case 'invoice.payment_failed':
            const failedInvoice = event.data.object as InvoiceWithLegacyFields;

            // Log the failure
            log.warn({
              customerId: failedInvoice.customer,
              invoiceId: failedInvoice.id,
              amount: failedInvoice.amount_due
            }, 'Invoice payment failed');

            // Send payment failed email
            const { createServiceClient: getFailedSvc } = require('../../auth/supabase');
            const failedSvc = getFailedSvc();
            if (failedSvc) {
              const { data: customer } = await failedSvc
                .from('customers')
                .select('id')
                .eq('stripe_customer_id', failedInvoice.customer)
                .single();

              if (customer) {
                const { data: user } = await failedSvc
                  .from('users')
                  .select('*')
                  .eq('id', customer.id)
                  .single();

                if (user?.email) {
                  // Calculate retry date (3 days from now)
                  const retryDate = new Date();
                  retryDate.setDate(retryDate.getDate() + 3);

                  let lastFourDigits: string | undefined;

                  if (typeof failedInvoice.payment_intent === 'string') {
                    const paymentIntentResponse = await stripe.paymentIntents.retrieve(
                      failedInvoice.payment_intent,
                      { expand: ['payment_method'] }
                    );
                    const paymentIntent = unwrapStripe(paymentIntentResponse);
                    const paymentMethod = paymentIntent.payment_method;
                    if (paymentMethod && typeof paymentMethod !== 'string' && paymentMethod.card) {
                      lastFourDigits = paymentMethod.card.last4;
                    }
                  }

                  sendPaymentFailedEmail(customer.id, user.email, {
                    amount: `$${(failedInvoice.amount_due / 100).toFixed(2)}`,
                    lastFourDigits,
                    failureReason: failedInvoice.last_finalization_error?.message,
                    retryDate: retryDate.toLocaleDateString(),
                  }).catch(err => {
                    log.error({ err, userId: customer.id }, 'Failed to send payment failed email');
                  });
                }
              }
            }
            break;

          // Customer updated (billing info changes)
          case 'customer.updated':
            const customer = event.data.object as Stripe.Customer;

            // Update user's billing info
            const { createServiceClient: getSvc } = require('../../auth/supabase');
            const svc = getSvc();
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
            log.warn({ eventType: event.type }, 'Unhandled webhook event');
        }

        res.json({ received: true });
      } catch (error) {
        log.error({
          error,
          eventType: event.type,
          eventId: event.id
        }, 'Error processing webhook');

        // Return 200 to prevent Stripe from retrying
        // We log the error but don't want infinite retries
        res.json({ received: true, error: 'Processing error' });
      }
    }
  );

  /**
   * Test endpoint for webhook (development only)
   */
  if (process.env.NODE_ENV !== 'production') {
    app.post('/webhooks/test', async (req: Request, res: Response) => {
      log.info({ body: req.body }, 'Test webhook received');
      res.json({ received: true, test: true });
    });
  }

  /**
   * Health check for webhooks
   */
  app.get('/webhooks/health', (_req: Request, res: Response) => {
    const configured = !!(
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET
    );

    res.json({
      ok: configured,
      stripe: configured ? 'configured' : 'not configured',
      timestamp: new Date().toISOString()
    });
  });
}