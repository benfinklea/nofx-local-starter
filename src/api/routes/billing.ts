/**
 * Billing Routes for NOFX SaaS
 * Handles subscriptions, checkout, and customer portal
 */

import { Express, Request, Response } from 'express';
import { requireAuth } from '../../auth/middleware';
import { createCheckoutSession, createPortalSession, cancelSubscription, resumeSubscription } from '../../billing/stripe';
import { createServiceClient, getUserTier, trackUsage } from '../../auth/supabase';
import { log } from '../../lib/logger';

export default function mount(app: Express) {
  /**
   * Get available pricing plans
   */
  app.get('/billing/plans', async (_req: Request, res: Response) => {
    try {
      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      const { data: products } = await supabase
        .from('products')
        .select(`
          *,
          prices(*)
        `)
        .eq('active', true)
        .order('metadata->sort_order');

      res.json({ plans: products || [] });
    } catch (error) {
      log.error({ error }, 'Error fetching plans');
      res.status(500).json({ error: 'Failed to fetch plans' });
    }
  });

  /**
   * Get user's current subscription
   */
  app.get('/billing/subscription', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select(`
          *,
          price:prices(
            *,
            product:products(*)
          )
        `)
        .eq('user_id', req.userId)
        .eq('status', 'active')
        .single();

      const tier = await getUserTier(req.userId);

      res.json({
        subscription: subscription || null,
        tier,
        hasActiveSubscription: !!subscription
      });
    } catch (error) {
      log.error({ error }, 'Error fetching subscription');
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  /**
   * Create Stripe Checkout session
   */
  app.post('/billing/checkout', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ error: 'Price ID required' });
      }

      const successUrl = `${process.env.APP_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${process.env.APP_URL || 'http://localhost:3000'}/billing/plans`;

      const checkoutUrl = await createCheckoutSession(req.userId, priceId, successUrl, cancelUrl);

      if (!checkoutUrl) {
        return res.status(500).json({ error: 'Failed to create checkout session' });
      }

      // Track checkout initiation
      await trackUsage(req.userId, 'checkout_initiated', 1, { priceId });

      res.json({ url: checkoutUrl });
    } catch (error) {
      log.error({ error }, 'Error creating checkout session');
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  /**
   * Create Stripe Customer Portal session
   */
  app.post('/billing/portal', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const returnUrl = `${process.env.APP_URL || 'http://localhost:3000'}/billing`;

      const portalUrl = await createPortalSession(req.userId, returnUrl);

      if (!portalUrl) {
        return res.status(500).json({ error: 'Failed to create portal session' });
      }

      res.json({ url: portalUrl });
    } catch (error) {
      log.error({ error }, 'Error creating portal session');
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  });

  /**
   * Get usage statistics for current billing period
   */
  app.get('/billing/usage', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Get current month's start
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get usage records
      const { data: usage } = await supabase
        .from('usage_records')
        .select('metric_name, quantity')
        .eq('user_id', req.userId)
        .gte('period_start', startOfMonth.toISOString());

      // Aggregate by metric
      const aggregated = (usage || []).reduce((acc, record) => {
        acc[record.metric_name] = (acc[record.metric_name] || 0) + Number(record.quantity);
        return acc;
      }, {} as Record<string, number>);

      // Get tier limits
      const tier = await getUserTier(req.userId);
      const { data: tierData } = await supabase
        .from('pricing_tiers')
        .select('*')
        .eq('tier', tier)
        .single();

      res.json({
        usage: aggregated,
        limits: {
          runs: tierData?.max_runs_per_month || 0,
          api_calls: tierData?.max_api_calls_per_month || 0,
          compute_minutes: tierData?.max_compute_minutes_per_month || 0
        },
        period: {
          start: startOfMonth.toISOString(),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
        },
        tier
      });
    } catch (error) {
      log.error({ error }, 'Error fetching usage');
      res.status(500).json({ error: 'Failed to fetch usage' });
    }
  });

  /**
   * Cancel subscription
   */
  app.post('/billing/cancel', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { immediately = false } = req.body;

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Get active subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', req.userId)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      const success = await cancelSubscription(subscription.id, immediately);

      if (!success) {
        return res.status(500).json({ error: 'Failed to cancel subscription' });
      }

      res.json({
        success: true,
        message: immediately
          ? 'Subscription cancelled immediately'
          : 'Subscription will be cancelled at the end of the billing period'
      });
    } catch (error) {
      log.error({ error }, 'Error cancelling subscription');
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  /**
   * Resume cancelled subscription
   */
  app.post('/billing/resume', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const supabase = createServiceClient();
      if (!supabase) {
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // Get cancelled subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', req.userId)
        .eq('cancel_at_period_end', true)
        .single();

      if (!subscription) {
        return res.status(404).json({ error: 'No cancelled subscription found' });
      }

      const success = await resumeSubscription(subscription.id);

      if (!success) {
        return res.status(500).json({ error: 'Failed to resume subscription' });
      }

      res.json({
        success: true,
        message: 'Subscription resumed successfully'
      });
    } catch (error) {
      log.error({ error }, 'Error resuming subscription');
      res.status(500).json({ error: 'Failed to resume subscription' });
    }
  });
}