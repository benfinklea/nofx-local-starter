/**
 * Price Management Service - extracted from stripe.ts
 * Handles price synchronization and deletion
 */

import Stripe from 'stripe';
import { log } from '../../lib/logger';

export class PriceManagementService {
  /**
   * Sync price from Stripe to database
   */
  async upsertPrice(price: Stripe.Price): Promise<void> {
    try {
      const { createServiceClient } = require('../../auth/supabase');
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
   * Delete price from database
   */
  async deletePrice(priceId: string): Promise<void> {
    try {
      const { createServiceClient } = require('../../auth/supabase');
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
}