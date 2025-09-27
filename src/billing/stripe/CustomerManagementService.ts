/**
 * Customer Management Service - extracted from stripe.ts
 * Handles customer creation and retrieval
 */

import Stripe from 'stripe';
import { log } from '../../lib/logger';

export class CustomerManagementService {
  constructor(private readonly stripe: Stripe) {}

  /**
   * Create or retrieve Stripe customer
   */
  async createOrRetrieveCustomer(userId: string, email?: string): Promise<string | null> {
    try {
      const { createServiceClient } = require('../../auth/supabase');
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
      const customer = await this.stripe.customers.create({
        email: email || userData?.email,
        metadata: {
          supabase_user_id: userId
        },
        name: userData?.full_name,
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
}