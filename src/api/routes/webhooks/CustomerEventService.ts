/**
 * Customer Event Service - extracted from webhooks.ts
 * Handles customer update events from Stripe
 */

import Stripe from 'stripe';

export class CustomerEventService {
  /**
   * Handle customer updated events
   */
  async handleCustomerUpdated(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    // Update user's billing info if customer has associated user
    if (customer.metadata?.supabase_user_id) {
      await this.updateUserBillingInfo(customer);
    }
  }

  /**
   * Update user billing information in database
   */
  private async updateUserBillingInfo(customer: Stripe.Customer): Promise<void> {
    const { createServiceClient } = require('../../../auth/supabase');
    const supabase = createServiceClient();

    if (supabase && customer.metadata?.supabase_user_id) {
      await supabase
        .from('users')
        .update({
          billing_address: customer.address
        })
        .eq('id', customer.metadata.supabase_user_id);
    }
  }
}