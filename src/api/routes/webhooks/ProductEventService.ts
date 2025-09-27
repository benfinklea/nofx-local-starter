/**
 * Product Event Service - extracted from webhooks.ts
 * Handles product and price events from Stripe
 */

import Stripe from 'stripe';
import {
  upsertProduct,
  upsertPrice,
  deleteProduct,
  deletePrice
} from '../../../billing/stripe';

export class ProductEventService {
  /**
   * Handle product events (created, updated, deleted)
   */
  async handleProductEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'product.created':
      case 'product.updated':
        await upsertProduct(event.data.object as Stripe.Product);
        break;

      case 'product.deleted':
        await deleteProduct((event.data.object as Stripe.Product).id);
        break;

      default:
        throw new Error(`Unhandled product event type: ${event.type}`);
    }
  }

  /**
   * Handle price events (created, updated, deleted)
   */
  async handlePriceEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'price.created':
      case 'price.updated':
        await upsertPrice(event.data.object as Stripe.Price);
        break;

      case 'price.deleted':
        await deletePrice((event.data.object as Stripe.Price).id);
        break;

      default:
        throw new Error(`Unhandled price event type: ${event.type}`);
    }
  }
}