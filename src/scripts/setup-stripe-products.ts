#!/usr/bin/env ts-node
/**
 * Stripe Products & Prices Setup Script
 * Automates the creation of subscription products and prices
 *
 * Usage:
 *   npm run stripe:setup
 *   or
 *   ts-node src/scripts/setup-stripe-products.ts
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import { log } from '../lib/logger';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

// Product definitions
const PRODUCTS = [
  {
    name: 'NOFX Free',
    tier: 'free',
    description: 'Perfect for getting started with AI workflow automation',
    prices: [
      {
        amount: 0,
        interval: 'month' as const,
        nickname: 'Free Plan - Monthly',
      },
    ],
    metadata: {
      tier: 'free',
      runs_limit: '10',
      api_calls_limit: '100',
      rate_limit: '10', // requests per minute
      features: JSON.stringify([
        '10 runs per month',
        '100 API calls per month',
        'Community support',
        'Basic features',
      ]),
    },
  },
  {
    name: 'NOFX Starter',
    tier: 'starter',
    description: 'For individuals and small teams building AI workflows',
    prices: [
      {
        amount: 2900, // $29.00
        interval: 'month' as const,
        nickname: 'Starter Plan - Monthly',
      },
      {
        amount: 29000, // $290.00 (save ~17%)
        interval: 'year' as const,
        nickname: 'Starter Plan - Annual',
      },
    ],
    metadata: {
      tier: 'starter',
      runs_limit: '100',
      api_calls_limit: '5000',
      rate_limit: '30',
      features: JSON.stringify([
        '100 runs per month',
        '5,000 API calls per month',
        'Email support',
        'Advanced features',
        'Priority queue',
      ]),
    },
  },
  {
    name: 'NOFX Pro',
    tier: 'pro',
    description: 'For growing teams with serious automation needs',
    prices: [
      {
        amount: 9900, // $99.00
        interval: 'month' as const,
        nickname: 'Pro Plan - Monthly',
      },
      {
        amount: 99000, // $990.00 (save ~17%)
        interval: 'year' as const,
        nickname: 'Pro Plan - Annual',
      },
    ],
    metadata: {
      tier: 'pro',
      runs_limit: '1000',
      api_calls_limit: '50000',
      rate_limit: '60',
      features: JSON.stringify([
        '1,000 runs per month',
        '50,000 API calls per month',
        'Priority support',
        'All features',
        'Advanced analytics',
        'Team collaboration',
      ]),
    },
  },
  {
    name: 'NOFX Enterprise',
    tier: 'enterprise',
    description: 'Custom solutions for large organizations',
    prices: [], // Contact sales for pricing
    metadata: {
      tier: 'enterprise',
      runs_limit: 'unlimited',
      api_calls_limit: 'unlimited',
      rate_limit: '200',
      features: JSON.stringify([
        'Unlimited runs',
        'Unlimited API calls',
        'Dedicated support',
        'Custom SLA',
        'On-premise deployment',
        'Custom integrations',
        'Training & onboarding',
      ]),
    },
  },
];

interface CreatedProduct {
  product: Stripe.Product;
  prices: Stripe.Price[];
}

async function createProduct(productDef: typeof PRODUCTS[0]): Promise<CreatedProduct> {
  log.info({ name: productDef.name }, 'Creating product...');

  // Create product
  const product = await stripe.products.create({
    name: productDef.name,
    description: productDef.description,
    metadata: productDef.metadata,
  });

  log.info({ productId: product.id, name: product.name }, 'Product created');

  // Create prices
  const prices: Stripe.Price[] = [];
  for (const priceDef of productDef.prices) {
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: priceDef.amount,
      recurring: priceDef.amount > 0 ? { interval: priceDef.interval } : undefined,
      nickname: priceDef.nickname,
      metadata: {
        tier: productDef.tier,
        billing_interval: priceDef.interval,
      },
    });

    prices.push(price);
    log.info(
      {
        priceId: price.id,
        amount: priceDef.amount / 100,
        interval: priceDef.interval,
      },
      'Price created'
    );
  }

  return { product, prices };
}

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n');

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Error: STRIPE_SECRET_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    const results: CreatedProduct[] = [];

    // Create each product with its prices
    for (const productDef of PRODUCTS) {
      const result = await createProduct(productDef);
      results.push(result);
      console.log(); // Empty line for readability
    }

    // Display summary
    console.log('✅ Setup complete! Created:');
    console.log(`   ${results.length} products`);
    console.log(`   ${results.reduce((sum, r) => sum + r.prices.length, 0)} prices`);
    console.log();

    // Display details for copying to .env
    console.log('📋 Add these to your .env file:\n');
    console.log('# Stripe Product IDs');

    results.forEach(({ product, prices }) => {
      const tier = product.metadata?.tier || 'unknown';
      console.log(`STRIPE_PRODUCT_${tier.toUpperCase()}_ID=${product.id}`);

      prices.forEach((price) => {
        const interval = price.recurring?.interval || 'one_time';
        console.log(
          `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}_ID=${price.id}`
        );
      });

      console.log();
    });

    // Display products in JSON format for reference
    console.log('📄 Products (JSON format):\n');
    console.log(
      JSON.stringify(
        results.map((r) => ({
          product_id: r.product.id,
          name: r.product.name,
          tier: r.product.metadata?.tier,
          prices: r.prices.map((p) => ({
            price_id: p.id,
            amount: p.unit_amount ? p.unit_amount / 100 : 0,
            interval: p.recurring?.interval || 'one_time',
          })),
        })),
        null,
        2
      )
    );

    console.log('\n✨ Next steps:');
    console.log('1. Copy the environment variables above to your .env file');
    console.log('2. Update Supabase database with product IDs');
    console.log('3. Configure webhooks: npm run stripe:setup-webhooks');
    console.log('4. Test subscription flow in development');
  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupStripeProducts();
}

export { setupStripeProducts, PRODUCTS };
