#!/usr/bin/env ts-node
/**
 * Stripe Webhooks Setup Script
 * Automates the configuration of Stripe webhooks
 *
 * Usage:
 *   npm run stripe:setup-webhooks
 *   or
 *   ts-node src/scripts/setup-stripe-webhooks.ts
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import { log } from '../lib/logger';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

// Required webhook events
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  // Customer events
  'customer.created',
  'customer.updated',
  'customer.deleted',

  // Subscription events
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',

  // Payment events
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.finalized',
  'invoice.upcoming',

  // Checkout events
  'checkout.session.completed',
  'checkout.session.expired',

  // Payment method events
  'payment_method.attached',
  'payment_method.detached',
  'payment_method.updated',
];

interface WebhookConfig {
  url: string;
  description: string;
  enabled_events: Stripe.WebhookEndpointCreateParams.EnabledEvent[];
  api_version?: Stripe.LatestApiVersion;
}

async function getExistingWebhooks(): Promise<Stripe.WebhookEndpoint[]> {
  const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });
  return webhooks.data;
}

async function createWebhook(config: WebhookConfig): Promise<Stripe.WebhookEndpoint> {
  log.info({ url: config.url }, 'Creating webhook endpoint...');

  const webhook = await stripe.webhookEndpoints.create({
    url: config.url,
    description: config.description,
    enabled_events: config.enabled_events,
    api_version: config.api_version || '2025-08-27.basil',
  });

  log.info({ webhookId: webhook.id, url: webhook.url }, 'Webhook endpoint created');

  return webhook;
}

async function deleteWebhook(webhookId: string): Promise<void> {
  await stripe.webhookEndpoints.del(webhookId);
  log.info({ webhookId }, 'Webhook endpoint deleted');
}

async function setupWebhooks() {
  console.log('🔗 Setting up Stripe webhooks...\n');

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Error: STRIPE_SECRET_KEY not found in environment variables');
    process.exit(1);
  }

  // Determine webhook URL based on environment
  const isDev = process.env.NODE_ENV !== 'production';
  const baseUrl = isDev
    ? process.env.NGROK_URL || process.env.DEV_WEBHOOK_URL || 'http://localhost:3002'
    : process.env.STRIPE_WEBHOOK_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://your-production-domain.com';

  const webhookUrl = `${baseUrl}/webhooks/stripe`;

  console.log(`📍 Webhook URL: ${webhookUrl}`);
  console.log(`🌍 Environment: ${isDev ? 'Development' : 'Production'}\n`);

  if (isDev && !process.env.NGROK_URL && !process.env.DEV_WEBHOOK_URL) {
    console.log('⚠️  Warning: For local development, you need to expose your localhost');
    console.log('   Option 1: Use ngrok (recommended)');
    console.log('     - Install: brew install ngrok');
    console.log('     - Run: ngrok http 3002');
    console.log('     - Add to .env: NGROK_URL=https://your-id.ngrok.io\n');
    console.log('   Option 2: Use Stripe CLI (alternative)');
    console.log('     - stripe listen --forward-to localhost:3002/webhooks/stripe\n');
  }

  try {
    // Check for existing webhooks
    const existingWebhooks = await getExistingWebhooks();
    const matchingWebhooks = existingWebhooks.filter((w) => w.url === webhookUrl);

    if (matchingWebhooks.length > 0) {
      console.log(`⚠️  Found ${matchingWebhooks.length} existing webhook(s) with this URL:`);
      matchingWebhooks.forEach((w) => {
        console.log(`   - ${w.id}: ${w.description || 'No description'}`);
      });

      console.log('\nOptions:');
      console.log('1. Delete existing and create new (recommended)');
      console.log('2. Keep existing (manual configuration required)');
      console.log('3. Exit');
      console.log('\nTo delete and recreate: npm run stripe:setup-webhooks -- --force\n');

      if (process.argv.includes('--force')) {
        for (const webhook of matchingWebhooks) {
          await deleteWebhook(webhook.id);
        }
        console.log('✅ Deleted existing webhooks\n');
      } else {
        console.log('ℹ️  Keeping existing webhooks. Run with --force to delete and recreate.');
        process.exit(0);
      }
    }

    // Create webhook
    const webhook = await createWebhook({
      url: webhookUrl,
      description: `NOFX ${isDev ? 'Development' : 'Production'} Webhooks`,
      enabled_events: WEBHOOK_EVENTS,
      api_version: '2025-08-27.basil',
    });

    console.log('\n✅ Webhook setup complete!\n');
    console.log('📋 Add these to your .env file:\n');
    console.log(`STRIPE_WEBHOOK_URL=${webhookUrl}`);
    console.log(`STRIPE_WEBHOOK_SECRET=${webhook.secret}\n`);

    console.log('📝 Webhook Details:');
    console.log(`   ID: ${webhook.id}`);
    console.log(`   URL: ${webhook.url}`);
    console.log(`   Events: ${webhook.enabled_events.length} events configured`);
    console.log(`   Status: ${webhook.status}\n`);

    console.log('🔔 Enabled Events:');
    webhook.enabled_events.forEach((event) => {
      console.log(`   • ${event}`);
    });

    console.log('\n✨ Next steps:');
    console.log('1. Copy the environment variables above to your .env file');
    console.log('2. Test webhook: stripe trigger customer.created');
    console.log('3. Monitor webhooks in Stripe Dashboard');
    console.log('4. Check logs: tail -f logs/stripe-webhooks.log');

    if (isDev) {
      console.log('\n💡 Development Tips:');
      console.log('- Use Stripe CLI for local testing: stripe listen --forward-to localhost:3002/webhooks/stripe');
      console.log('- Trigger test events: stripe trigger customer.subscription.created');
      console.log('- View webhook logs in Stripe Dashboard > Developers > Webhooks');
    }
  } catch (error) {
    console.error('\n❌ Error setting up webhooks:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupWebhooks();
}

export { setupWebhooks, WEBHOOK_EVENTS };
