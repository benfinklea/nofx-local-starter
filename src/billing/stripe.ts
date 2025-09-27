/**
 * Stripe Configuration and Utilities for NOFX
 * Handles billing, subscriptions, and payment processing
 */

import Stripe from 'stripe';

// Import extracted services
import { DateUtilityService } from './stripe/DateUtilityService';
import { CustomerManagementService } from './stripe/CustomerManagementService';
import { ProductManagementService } from './stripe/ProductManagementService';
import { PriceManagementService } from './stripe/PriceManagementService';
import { SubscriptionManagementService } from './stripe/SubscriptionManagementService';
import { SessionManagementService } from './stripe/SessionManagementService';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || (process.env.NODE_ENV === 'test' ? 'sk_test_dummy' : ''), {
  apiVersion: '2025-08-27.basil',
  typescript: true
});

export { stripe };

// Initialize services
const dateUtilityService = new DateUtilityService();
const customerManagementService = new CustomerManagementService(stripe);
const productManagementService = new ProductManagementService();
const priceManagementService = new PriceManagementService();
const subscriptionManagementService = new SubscriptionManagementService(stripe);
const sessionManagementService = new SessionManagementService(stripe, customerManagementService);

/**
 * Convert Unix timestamp to ISO date string
 */
export function toDateTime(secs: number): string {
  return dateUtilityService.toDateTime(secs);
}

/**
 * Calculate trial end date for Stripe
 */
export function getTrialEnd(trialDays: number): number | null {
  return dateUtilityService.getTrialEnd(trialDays);
}

/**
 * Create or retrieve Stripe customer
 */
export async function createOrRetrieveCustomer(userId: string, email?: string): Promise<string | null> {
  return customerManagementService.createOrRetrieveCustomer(userId, email);
}

/**
 * Sync product from Stripe to database
 */
export async function upsertProduct(product: Stripe.Product): Promise<void> {
  return productManagementService.upsertProduct(product);
}

/**
 * Sync price from Stripe to database
 */
export async function upsertPrice(price: Stripe.Price): Promise<void> {
  return priceManagementService.upsertPrice(price);
}

/**
 * Sync subscription from Stripe to database
 */
export async function manageSubscriptionStatusChange(
  subscriptionId: string,
  customerId: string,
  createAction = false
): Promise<void> {
  return subscriptionManagementService.manageSubscriptionStatusChange(subscriptionId, customerId, createAction);
}

/**
 * Delete product from database
 */
export async function deleteProduct(productId: string): Promise<void> {
  return productManagementService.deleteProduct(productId);
}

/**
 * Delete price from database
 */
export async function deletePrice(priceId: string): Promise<void> {
  return priceManagementService.deletePrice(priceId);
}

/**
 * Create Stripe Checkout session
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  return sessionManagementService.createCheckoutSession(userId, priceId, successUrl, cancelUrl);
}

/**
 * Create Stripe Customer Portal session
 */
export async function createPortalSession(userId: string, returnUrl: string): Promise<string | null> {
  return sessionManagementService.createPortalSession(userId, returnUrl);
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: string, immediately = false): Promise<boolean> {
  return subscriptionManagementService.cancelSubscription(subscriptionId, immediately);
}

/**
 * Resume cancelled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<boolean> {
  return subscriptionManagementService.resumeSubscription(subscriptionId);
}