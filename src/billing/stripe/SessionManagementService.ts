/**
 * Session Management Service - extracted from stripe.ts
 * Handles checkout sessions and customer portal sessions
 */

import Stripe from 'stripe';
import { log } from '../../lib/logger';
import { CustomerManagementService } from './CustomerManagementService';

export class SessionManagementService {
  constructor(
    private readonly stripe: Stripe,
    private readonly customerService: CustomerManagementService
  ) {}

  /**
   * Create Stripe Checkout session
   */
  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string | null> {
    try {
      const customerId = await this.customerService.createOrRetrieveCustomer(userId);
      if (!customerId) {
        log.error({ userId }, 'Failed to create/retrieve customer');
        return null;
      }

      const session = await this.stripe.checkout.sessions.create({
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
  async createPortalSession(userId: string, returnUrl: string): Promise<string | null> {
    try {
      const { createServiceClient } = require('../../auth/supabase');
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

      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerData.stripe_customer_id,
        return_url: returnUrl
      });

      return session.url;
    } catch (error) {
      log.error({ error, userId }, 'Error creating portal session');
      return null;
    }
  }
}