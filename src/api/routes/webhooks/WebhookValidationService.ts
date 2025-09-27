/**
 * Webhook Validation Service - extracted from webhooks.ts
 * Handles signature validation and webhook security
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { log } from '../../../lib/logger';

export class WebhookValidationService {
  constructor(private readonly stripe: Stripe) {}

  /**
   * Validate webhook signature and parse event
   */
  validateWebhook(req: Request, res: Response): { event: Stripe.Event | null; error: boolean } {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      log.warn('Stripe webhook called without signature');
      res.status(400).json({ error: 'Missing signature' });
      return { event: null, error: true };
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log.error('STRIPE_WEBHOOK_SECRET not configured');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return { event: null, error: true };
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );

      // Log the event
      log.info({
        eventType: event.type,
        eventId: event.id
      }, 'Stripe webhook received');

      return { event, error: false };
    } catch (err) {
      const error = err as Error;
      log.error({ error: error.message }, 'Webhook signature verification failed');
      res.status(400).json({ error: `Webhook Error: ${error.message}` });
      return { event: null, error: true };
    }
  }

  /**
   * Check if event is relevant for processing
   */
  isRelevantEvent(eventType: string): boolean {
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

    return relevantEvents.has(eventType);
  }
}