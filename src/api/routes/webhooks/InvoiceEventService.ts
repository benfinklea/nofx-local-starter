/**
 * Invoice Event Service - extracted from webhooks.ts
 * Handles invoice payment success and failure events
 */

import Stripe from 'stripe';
import { log } from '../../../lib/logger';
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

export class InvoiceEventService {
  constructor(
    private readonly stripe: Stripe,
    private readonly emailService: EmailNotificationService
  ) {}

  /**
   * Handle invoice payment succeeded events
   */
  async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as InvoiceWithLegacyFields;
    const subscriptionRef = invoice.subscription;
    const subscriptionId = typeof subscriptionRef === 'string'
      ? subscriptionRef
      : subscriptionRef?.id;

    if (subscriptionId) {
      await manageSubscriptionStatusChange(
        subscriptionId,
        invoice.customer as string
      );
    }

    await this.trackSuccessfulPayment(invoice);
  }

  /**
   * Handle invoice payment failed events
   */
  async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as InvoiceWithLegacyFields;

    // Log the failure
    log.warn({
      customerId: invoice.customer,
      invoiceId: invoice.id,
      amount: invoice.amount_due
    }, 'Invoice payment failed');

    await this.sendPaymentFailedNotification(invoice);
  }

  /**
   * Track successful payment for usage metrics
   */
  private async trackSuccessfulPayment(invoice: InvoiceWithLegacyFields): Promise<void> {
    const { createServiceClient } = require('../../../auth/supabase');
    const client = createServiceClient();

    if (client && invoice.metadata?.supabase_user_id) {
      const { trackUsage } = require('../../../auth/supabase');
      await trackUsage(
        invoice.metadata.supabase_user_id,
        'payment_succeeded',
        invoice.amount_paid / 100, // Convert from cents
        {
          invoiceId: invoice.id,
          currency: invoice.currency
        }
      );
    }
  }

  /**
   * Send payment failed email notification
   */
  private async sendPaymentFailedNotification(invoice: InvoiceWithLegacyFields): Promise<void> {
    const { createServiceClient } = require('../../../auth/supabase');
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (!customer) return;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', customer.id)
      .single();

    if (!user?.email) return;

    const paymentFailureDetails = await this.getPaymentFailureDetails(invoice);
    await this.emailService.sendPaymentFailedNotification(customer.id, user.email, paymentFailureDetails);
  }

  /**
   * Get payment failure details for email
   */
  private async getPaymentFailureDetails(invoice: InvoiceWithLegacyFields): Promise<any> {
    // Calculate retry date (3 days from now)
    const retryDate = new Date();
    retryDate.setDate(retryDate.getDate() + 3);

    let lastFourDigits: string | undefined;

    if (typeof invoice.payment_intent === 'string') {
      try {
        const paymentIntentResponse = await this.stripe.paymentIntents.retrieve(
          invoice.payment_intent,
          { expand: ['payment_method'] }
        );
        const paymentIntent = unwrapStripe(paymentIntentResponse);
        const paymentMethod = paymentIntent.payment_method;
        if (paymentMethod && typeof paymentMethod !== 'string' && paymentMethod.card) {
          lastFourDigits = paymentMethod.card.last4;
        }
      } catch (error) {
        // Silently handle payment intent retrieval errors
        console.error('Error retrieving payment intent:', error);
      }
    }

    return {
      amount: `$${(invoice.amount_due / 100).toFixed(2)}`,
      lastFourDigits,
      failureReason: invoice.last_finalization_error?.message,
      retryDate: retryDate.toLocaleDateString(),
    };
  }
}