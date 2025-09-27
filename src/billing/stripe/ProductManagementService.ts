/**
 * Product Management Service - extracted from stripe.ts
 * Handles product synchronization and deletion
 */

import Stripe from 'stripe';
import { log } from '../../lib/logger';

export class ProductManagementService {
  /**
   * Sync product from Stripe to database
   */
  async upsertProduct(product: Stripe.Product): Promise<void> {
    try {
      const { createServiceClient } = require('../../auth/supabase');
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
   * Delete product from database
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      const { createServiceClient } = require('../../auth/supabase');
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
}