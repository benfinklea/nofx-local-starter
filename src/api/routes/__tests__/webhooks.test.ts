/**
 * Webhook Handling Tests - 90%+ Coverage Target
 * Critical payment processing - must be bulletproof
 */

import request from 'supertest';
import { app } from '../../main';
import Stripe from 'stripe';
import { upsertProduct, upsertPrice, manageSubscriptionStatusChange, deleteProduct, deletePrice } from '../../../billing/stripe';
import { sendSubscriptionConfirmationEmail, sendPaymentFailedEmail } from '../../../services/email/emailService';

// Mock dependencies
jest.mock('stripe');
jest.mock('../../../billing/stripe');
jest.mock('../../../services/email/emailService');
jest.mock('../../../auth/supabase');
jest.mock('../../../lib/logger');

describe('Webhook Handling - Security & Reliability Tests', () => {
  let mockStripe: jest.Mocked<Stripe>;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Stripe
    mockStripe = {
      webhooks: {
        constructEvent: jest.fn()
      },
      subscriptions: {
        retrieve: jest.fn()
      },
      paymentIntents: {
        retrieve: jest.fn()
      }
    } as any;

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe);

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis()
    };

    require('../../../auth/supabase').createServiceClient = jest.fn().mockReturnValue(mockSupabase);
    require('../../../auth/supabase').createAuditLog = jest.fn().mockResolvedValue(true);

    // Mock environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  });

  describe('Webhook Security', () => {
    it('validates webhook signature', async () => {
      const validEvent = {
        id: 'evt_test_123',
        type: 'product.created',
        data: { object: { id: 'prod_123', name: 'Test Product' } }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(validEvent as any);

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        expect.any(Buffer),
        'valid_signature',
        'whsec_test_123'
      );
      expect(response.status).toBe(200);
    });

    it('rejects requests without signature', async () => {
      const response = await request(app)
        .post('/webhooks/stripe')
        .send({ test: 'data' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing signature');
    });

    it('rejects invalid signatures', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send({ test: 'data' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Webhook Error');
    });

    it('requires webhook secret configuration', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send({ test: 'data' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Webhook secret not configured');

      // Restore
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    });

    it('prevents signature enumeration attacks', async () => {
      const maliciousSignatures = [
        '',
        null,
        undefined,
        'fake_signature',
        'whsec_' + 'a'.repeat(1000),
        'v1=' + 'b'.repeat(100),
        '../../../etc/passwd',
        '<script>alert(1)</script>'
      ];

      for (const signature of maliciousSignatures) {
        mockStripe.webhooks.constructEvent.mockImplementation(() => {
          throw new Error('Invalid signature');
        });

        const response = await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', signature as string)
          .send({ test: 'data' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Webhook Error');
      }
    });
  });

  describe('Event Processing', () => {
    beforeEach(() => {
      mockStripe.webhooks.constructEvent.mockImplementation((body, sig, secret) => ({
        id: 'evt_test_123',
        type: 'product.created',
        data: { object: { id: 'prod_123', name: 'Test Product' } }
      } as any));
    });

    describe('Product Events', () => {
      it('handles product.created events', async () => {
        const productEvent = {
          id: 'evt_123',
          type: 'product.created',
          data: {
            object: {
              id: 'prod_123',
              name: 'Test Product',
              description: 'A test product'
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(productEvent as any);
        (upsertProduct as jest.Mock).mockResolvedValue(true);

        const response = await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(upsertProduct).toHaveBeenCalledWith(productEvent.data.object);
        expect(response.status).toBe(200);
      });

      it('handles product.updated events', async () => {
        const productEvent = {
          id: 'evt_123',
          type: 'product.updated',
          data: { object: { id: 'prod_123', name: 'Updated Product' } }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(productEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(upsertProduct).toHaveBeenCalledWith(productEvent.data.object);
      });

      it('handles product.deleted events', async () => {
        const productEvent = {
          id: 'evt_123',
          type: 'product.deleted',
          data: { object: { id: 'prod_123' } }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(productEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(deleteProduct).toHaveBeenCalledWith('prod_123');
      });
    });

    describe('Price Events', () => {
      it('handles price.created events', async () => {
        const priceEvent = {
          id: 'evt_123',
          type: 'price.created',
          data: {
            object: {
              id: 'price_123',
              unit_amount: 1000,
              currency: 'usd'
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(priceEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(upsertPrice).toHaveBeenCalledWith(priceEvent.data.object);
      });

      it('handles price.deleted events', async () => {
        const priceEvent = {
          id: 'evt_123',
          type: 'price.deleted',
          data: { object: { id: 'price_123' } }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(priceEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(deletePrice).toHaveBeenCalledWith('price_123');
      });
    });

    describe('Checkout Events', () => {
      it('handles checkout.session.completed for subscriptions', async () => {
        const checkoutEvent = {
          id: 'evt_123',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              mode: 'subscription',
              subscription: 'sub_123',
              customer: 'cus_123',
              amount_total: 1000,
              currency: 'usd',
              metadata: { supabase_user_id: 'user_123' }
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(checkoutEvent as any);
        mockStripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_123',
          items: {
            data: [{
              price: {
                id: 'price_123',
                unit_amount: 1000,
                recurring: { interval: 'month' },
                product: { id: 'prod_123', name: 'Test Product', metadata: { features: 'feature1,feature2' } }
              }
            }]
          },
          current_period_end: 1234567890
        } as any);

        mockSupabase.single.mockResolvedValue({
          data: { email: 'test@example.com' },
          error: null
        });

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(manageSubscriptionStatusChange).toHaveBeenCalledWith('sub_123', 'cus_123', true);
        expect(sendSubscriptionConfirmationEmail).toHaveBeenCalled();
      });

      it('skips non-subscription checkout sessions', async () => {
        const checkoutEvent = {
          id: 'evt_123',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              mode: 'payment',
              payment_intent: 'pi_123'
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(checkoutEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(manageSubscriptionStatusChange).not.toHaveBeenCalled();
      });
    });

    describe('Subscription Events', () => {
      it('handles customer.subscription.created', async () => {
        const subscriptionEvent = {
          id: 'evt_123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_123',
              customer: 'cus_123',
              status: 'active'
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(subscriptionEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(manageSubscriptionStatusChange).toHaveBeenCalledWith('sub_123', 'cus_123');
      });

      it('handles customer.subscription.deleted with audit logging', async () => {
        const subscriptionEvent = {
          id: 'evt_123',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_123',
              customer: 'cus_123'
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(subscriptionEvent as any);
        mockSupabase.single.mockResolvedValue({
          data: { id: 'user_123' },
          error: null
        });

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(manageSubscriptionStatusChange).toHaveBeenCalled();
        expect(require('../../../auth/supabase').createAuditLog).toHaveBeenCalledWith(
          'user_123',
          'billing.subscription_cancelled',
          'subscription',
          'sub_123'
        );
      });
    });

    describe('Invoice Events', () => {
      it('handles invoice.payment_succeeded', async () => {
        const invoiceEvent = {
          id: 'evt_123',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_123',
              subscription: 'sub_123',
              customer: 'cus_123',
              amount_paid: 1000,
              currency: 'usd',
              metadata: { supabase_user_id: 'user_123' }
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(invoiceEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(manageSubscriptionStatusChange).toHaveBeenCalledWith('sub_123', 'cus_123');
        expect(require('../../../auth/supabase').trackUsage).toHaveBeenCalledWith(
          'user_123',
          'payment_succeeded',
          10, // $10.00
          {
            invoiceId: 'in_123',
            currency: 'usd'
          }
        );
      });

      it('handles invoice.payment_failed with email notification', async () => {
        const invoiceEvent = {
          id: 'evt_123',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_123',
              customer: 'cus_123',
              amount_due: 1000,
              payment_intent: 'pi_123',
              last_finalization_error: { message: 'Card declined' }
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(invoiceEvent as any);
        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: 'user_123' }, error: null })
          .mockResolvedValueOnce({ data: { email: 'test@example.com' }, error: null });

        mockStripe.paymentIntents.retrieve.mockResolvedValue({
          payment_method: { card: { last4: '4242' } }
        } as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(sendPaymentFailedEmail).toHaveBeenCalledWith(
          'user_123',
          'test@example.com',
          expect.objectContaining({
            amount: '$10',
            lastFourDigits: '4242',
            failureReason: 'Card declined'
          })
        );
      });
    });

    describe('Customer Events', () => {
      it('handles customer.updated', async () => {
        const customerEvent = {
          id: 'evt_123',
          type: 'customer.updated',
          data: {
            object: {
              id: 'cus_123',
              metadata: { supabase_user_id: 'user_123' },
              address: {
                line1: '123 Main St',
                city: 'San Francisco',
                state: 'CA',
                postal_code: '94105',
                country: 'US'
              }
            }
          }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(customerEvent as any);

        await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(mockSupabase.update).toHaveBeenCalledWith({
          billing_address: customerEvent.data.object.address
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('handles billing service errors gracefully', async () => {
      const productEvent = {
        id: 'evt_123',
        type: 'product.created',
        data: { object: { id: 'prod_123' } }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(productEvent as any);
      (upsertProduct as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send({});

      // Should return 200 to prevent Stripe retries
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true, error: 'Processing error' });
    });

    it('handles email service failures', async () => {
      const checkoutEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_123',
            customer: 'cus_123',
            metadata: { supabase_user_id: 'user_123' }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(checkoutEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: { data: [{ price: { product: {} } }] }
      } as any);
      mockSupabase.single.mockResolvedValue({
        data: { email: 'test@example.com' },
        error: null
      });

      (sendSubscriptionConfirmationEmail as jest.Mock).mockRejectedValue(new Error('Email failed'));

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send({});

      // Should still process successfully
      expect(response.status).toBe(200);
      expect(manageSubscriptionStatusChange).toHaveBeenCalled();
    });

    it('handles database connection failures', async () => {
      const productEvent = {
        id: 'evt_123',
        type: 'product.created',
        data: { object: { id: 'prod_123' } }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(productEvent as any);
      require('../../../auth/supabase').createServiceClient = jest.fn().mockReturnValue(null);

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send({});

      expect(response.status).toBe(200);
    });
  });

  describe('Event Filtering', () => {
    it('processes only relevant events', async () => {
      const relevantEvents = [
        'product.created', 'product.updated', 'product.deleted',
        'price.created', 'price.updated', 'price.deleted',
        'checkout.session.completed',
        'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
        'invoice.payment_succeeded', 'invoice.payment_failed',
        'customer.updated'
      ];

      for (const eventType of relevantEvents) {
        const event = {
          id: 'evt_123',
          type: eventType,
          data: { object: { id: 'test_123' } }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(event as any);

        const response = await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(response.status).toBe(200);
      }
    });

    it('ignores irrelevant events', async () => {
      const irrelevantEvents = [
        'account.updated',
        'balance.available',
        'charge.succeeded',
        'payout.paid'
      ];

      for (const eventType of irrelevantEvents) {
        const event = {
          id: 'evt_123',
          type: eventType,
          data: { object: { id: 'test_123' } }
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(event as any);

        const response = await request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ received: true });
      }
    });
  });

  describe('Health Check', () => {
    it('returns health status with proper configuration', async () => {
      const response = await request(app).get('/webhooks/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        stripe: 'configured',
        timestamp: expect.any(String)
      });
    });

    it('indicates misconfiguration', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const response = await request(app).get('/webhooks/health');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(false);
      expect(response.body.stripe).toBe('not configured');

      // Restore
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });
  });

  describe('Test Endpoint (Development)', () => {
    it('accepts test webhooks in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/webhooks/test')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true, test: true });

      process.env.NODE_ENV = originalEnv;
    });

    it('rejects test webhooks in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app).post('/webhooks/test');

      expect(response.status).toBe(404);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Performance Tests', () => {
    it('handles high-volume webhook events', async () => {
      const events = Array(50).fill(null).map((_, i) => ({
        id: `evt_${i}`,
        type: 'product.created',
        data: { object: { id: `prod_${i}` } }
      }));

      mockStripe.webhooks.constructEvent.mockImplementation(() => events[0]);

      const promises = events.map(() =>
        request(app)
          .post('/webhooks/stripe')
          .set('stripe-signature', 'valid_sig')
          .send({})
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.status === 200)).toBe(true);
    });

    it('processes webhooks within time limits', async () => {
      const productEvent = {
        id: 'evt_123',
        type: 'product.created',
        data: { object: { id: 'prod_123' } }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(productEvent as any);

      const startTime = Date.now();
      await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'valid_sig')
        .send({});
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});