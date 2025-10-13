/**
 * Webhook Handlers for NOFX
 * Refactored into service-based architecture
 */

import { Express, Request, Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { log } from '../../lib/logger';

// Import extracted services
import { WebhookValidationService } from './webhooks/WebhookValidationService';
import { ProductEventService } from './webhooks/ProductEventService';
import { SubscriptionEventService } from './webhooks/SubscriptionEventService';
import { InvoiceEventService } from './webhooks/InvoiceEventService';
import { CustomerEventService } from './webhooks/CustomerEventService';
import { EmailNotificationService } from './webhooks/EmailNotificationService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || (process.env.NODE_ENV === 'test' ? 'sk_test_dummy' : ''), {
  apiVersion: '2025-08-27.basil'
});

// Initialize services
const emailNotificationService = new EmailNotificationService();
const webhookValidationService = new WebhookValidationService(stripe);
const productEventService = new ProductEventService();
const subscriptionEventService = new SubscriptionEventService(stripe, emailNotificationService);
const invoiceEventService = new InvoiceEventService(stripe, emailNotificationService);
const customerEventService = new CustomerEventService();

export default function mount(app: Express) {
  /**
   * Stripe Webhook Endpoint
   * IMPORTANT: This must use express.raw() middleware for body parsing
   */
  app.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response): Promise<void> => {
      // Validate webhook signature
      const validation = webhookValidationService.validateWebhook(req, res);
      if (validation.error || !validation.event) {
        return; // Response already sent by validation service
      }

      const event = validation.event;

      // Filter out events we don't care about
      if (!webhookValidationService.isRelevantEvent(event.type)) {
        log.debug({ eventType: event.type }, 'Ignoring irrelevant webhook event');
        return res.json({ received: true, event: event.type });
      }

      try {
        await processWebhookEvent(event);

        return res.json({ received: true });
      } catch (error) {
        log.error({
          error,
          eventType: event.type,
          eventId: event.id
        }, 'Error processing webhook');

        // Return 200 to prevent Stripe from retrying
        // We log the error but don't want infinite retries
        return res.json({ received: true, error: 'Processing error' });
      }
    }
  );

  /**
   * Process webhook event using appropriate service
   */
  async function processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      // Product events
      case 'product.created':
      case 'product.updated':
      case 'product.deleted':
        await productEventService.handleProductEvent(event);
        break;

      // Price events
      case 'price.created':
      case 'price.updated':
      case 'price.deleted':
        await productEventService.handlePriceEvent(event);
        break;

      // Checkout completed
      case 'checkout.session.completed':
        await subscriptionEventService.handleCheckoutCompleted(event);
        break;

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await subscriptionEventService.handleSubscriptionEvent(event);
        break;

      // Invoice events
      case 'invoice.payment_succeeded':
        await invoiceEventService.handlePaymentSucceeded(event);
        break;

      case 'invoice.payment_failed':
        await invoiceEventService.handlePaymentFailed(event);
        break;

      // Customer events
      case 'customer.updated':
        await customerEventService.handleCustomerUpdated(event);
        break;

      default:
        log.warn({ eventType: event.type }, 'Unhandled webhook event');
    }
  }

  /**
   * Test endpoint for webhook (development only)
   */
  app.post('/webhooks/test', async (req: Request, res: Response): Promise<void> => {
    // Runtime check for production
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    log.info({ body: req.body }, 'Test webhook received');
    return res.json({ received: true, test: true });
  });

  /**
   * Health check for webhooks
   */
  app.get('/webhooks/health', (_req: Request, res: Response): Promise<void> => {
    const configured = !!(
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET
    );

    return res.json({
      ok: configured,
      stripe: configured ? 'configured' : 'not configured',
      timestamp: new Date().toISOString()
    });
  });
}