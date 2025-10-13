/**
 * Comprehensive test suite for src/billing/stripe.ts
 * Tests all Stripe integration functionality before refactoring
 */

import Stripe from 'stripe';

// Create mock Stripe instance BEFORE imports
const mockedStripe = {
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
};

// Mock Stripe constructor - jest.mock is hoisted so this mockedStripe is available
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
  }));
});

import {
  toDateTime,
  getTrialEnd,
  createOrRetrieveCustomer,
  upsertProduct,
  upsertPrice,
  manageSubscriptionStatusChange,
  deleteProduct,
  deletePrice,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  resumeSubscription,
  stripe
} from '../stripe';

// Create a properly structured mock that returns fresh instances for each call
const createMockSupabase = () => {
  const mockSingle = jest.fn();
  const mockEq = jest.fn();
  const mockSelect = jest.fn();
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn();
  const mockUpsert = jest.fn();
  const mockFrom = jest.fn();

  // Reset the mock structure
  const resetMocks = () => {
    mockSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    mockEq.mockImplementation(() => ({
      single: mockSingle,
      // Also handle update().eq() and delete().eq() promises
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve)
    }));
    mockSelect.mockImplementation(() => ({
      eq: mockEq
    }));
    mockUpdate.mockImplementation(() => ({
      eq: mockEq
    }));
    mockDelete.mockImplementation(() => ({
      eq: mockEq
    }));
    mockUpsert.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      upsert: mockUpsert,
      update: mockUpdate,
      delete: mockDelete
    }));
  };

  resetMocks();

  return {
    from: mockFrom,
    _mocks: {
      single: mockSingle,
      eq: mockEq,
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
      upsert: mockUpsert,
      from: mockFrom
    },
    _reset: resetMocks
  };
};

const mockSupabase = createMockSupabase();

// Mock logger
jest.mock('../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock auth module
jest.mock('../../auth/supabase', () => ({
  createServiceClient: () => mockSupabase,
}));

describe('Stripe Utilities Tests', () => {
  // Get reference to the mocked stripe instance
  const mockedStripe = stripe as unknown as typeof mockedStripe;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Supabase mocks
    mockSupabase._reset();
  });

  describe('Date Utilities', () => {
    describe('toDateTime', () => {
      it('should convert Unix timestamp to ISO string', () => {
        const timestamp = 1640995200; // 2022-01-01 00:00:00 UTC
        const result = toDateTime(timestamp);
        expect(result).toBe('2022-01-01T00:00:00.000Z');
      });

      it('should handle zero timestamp', () => {
        const result = toDateTime(0);
        expect(result).toBe('1970-01-01T00:00:00.000Z');
      });

      it('should handle negative timestamp', () => {
        const result = toDateTime(-86400); // One day before epoch
        expect(result).toBe('1969-12-31T00:00:00.000Z');
      });
    });

    describe('getTrialEnd', () => {
      it('should calculate trial end date', () => {
        const trialDays = 7;
        const result = getTrialEnd(trialDays);

        expect(result).toBeGreaterThan(Math.floor(Date.now() / 1000));
        expect(typeof result).toBe('number');
      });

      it('should return null for zero trial days', () => {
        expect(getTrialEnd(0)).toBeNull();
      });

      it('should return null for negative trial days', () => {
        expect(getTrialEnd(-5)).toBeNull();
      });

      it('should return null for undefined trial days', () => {
        expect(getTrialEnd(undefined as any)).toBeNull();
      });
    });
  });

  describe('Customer Management', () => {
    describe('createOrRetrieveCustomer', () => {
      it('should return existing customer ID', async () => {
        const existingCustomerId = 'cus_existing123';
        mockSupabase._mocks.single.mockResolvedValueOnce({
          data: { stripe_customer_id: existingCustomerId },
          error: null
        });

        const result = await createOrRetrieveCustomer('user123');
        expect(result).toBe(existingCustomerId);
      });

      it('should create new customer when none exists', async () => {
        const newCustomerId = 'cus_new123';
        const userId = 'user123';
        const email = 'test@example.com';

        // Mock existing customer check - not found
        mockSupabase._mocks.single
          .mockResolvedValueOnce({ data: null, error: null })
          // Mock user data fetch
          .mockResolvedValueOnce({
            data: {
              email: 'user@example.com',
              full_name: 'Test User',
              billing_address: { city: 'Test City' }
            },
            error: null
          });

        mockedStripe.customers.create.mockResolvedValue({
          id: newCustomerId,
        });

        mockSupabase._mocks.upsert.mockResolvedValueOnce({ data: null, error: null });

        const result = await createOrRetrieveCustomer(userId, email);

        expect(mockedStripe.customers.create).toHaveBeenCalledWith({
          email: email,
          metadata: { supabase_user_id: userId },
          name: 'Test User',
          address: { city: 'Test City' }
        });
        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith({
          id: userId,
          stripe_customer_id: newCustomerId
        });
        expect(result).toBe(newCustomerId);
      });

      it('should handle errors gracefully', async () => {
        mockSupabase._mocks.single.mockRejectedValue(new Error('Database error'));

        const result = await createOrRetrieveCustomer('user123');
        expect(result).toBeNull();
      });

      it('should handle missing supabase client', async () => {
        jest.doMock('../../auth/supabase', () => ({
          createServiceClient: () => null,
        }));

        const result = await createOrRetrieveCustomer('user123');
        expect(result).toBeNull();
      });
    });
  });

  describe('Product Management', () => {
    describe('upsertProduct', () => {
      it('should sync product to database', async () => {
        const product = {
          id: 'prod_123',
          active: true,
          name: 'Test Product',
          description: 'A test product',
          images: ['https://example.com/image.png'],
          metadata: { key: 'value' },
        } as unknown as Stripe.Product;

        await upsertProduct(product);

        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith({
          id: 'prod_123',
          active: true,
          name: 'Test Product',
          description: 'A test product',
          image: 'https://example.com/image.png',
          metadata: { key: 'value' }
        });
      });

      it('should handle product without image', async () => {
        const product = {
          id: 'prod_123',
          active: true,
          name: 'Test Product',
          description: 'A test product',
          images: [],
          metadata: {},
        } as unknown as Stripe.Product;

        await upsertProduct(product);

        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith({
          id: 'prod_123',
          active: true,
          name: 'Test Product',
          description: 'A test product',
          image: null,
          metadata: {}
        });
      });

      it('should handle database errors', async () => {
        const product = {
          id: 'prod_123',
          active: true,
          name: 'Test Product',
        } as unknown as Stripe.Product;

        mockSupabase._mocks.upsert.mockResolvedValue({ error: new Error('DB error') });

        await expect(upsertProduct(product)).resolves.not.toThrow();
      });

      it('should handle missing supabase client', async () => {
        jest.doMock('../../auth/supabase', () => ({
          createServiceClient: () => null,
        }));

        const product = {
          id: 'prod_123',
          active: true,
          name: 'Test Product',
        } as unknown as Stripe.Product;

        await expect(upsertProduct(product)).resolves.not.toThrow();
      });
    });

    describe('deleteProduct', () => {
      it('should delete product from database', async () => {
        await deleteProduct('prod_123');

        expect(mockSupabase._mocks.eq).toHaveBeenCalledWith('id', 'prod_123');
      });

      it('should handle database errors gracefully', async () => {
        mockSupabase._mocks.eq.mockResolvedValue({ error: new Error('DB error') });

        await expect(deleteProduct('prod_123')).resolves.not.toThrow();
      });
    });
  });

  describe('Price Management', () => {
    describe('upsertPrice', () => {
      it('should sync recurring price to database', async () => {
        const price = {
          id: 'price_123',
          product: 'prod_123',
          active: true,
          nickname: 'Monthly Plan',
          unit_amount: 2000,
          currency: 'usd',
          type: 'recurring',
          recurring: {
            interval: 'month',
            interval_count: 1,
            trial_period_days: 7,
          },
          metadata: { key: 'value' }
        } as unknown as Stripe.Price;

        await upsertPrice(price);

        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith({
          id: 'price_123',
          product_id: 'prod_123',
          active: true,
          description: 'Monthly Plan',
          unit_amount: 2000,
          currency: 'usd',
          type: 'recurring',
          interval: 'month',
          interval_count: 1,
          trial_period_days: 7,
          metadata: { key: 'value' }
        });
      });

      it('should sync one-time price to database', async () => {
        const price = {
          id: 'price_456',
          product: { id: 'prod_123' } as Stripe.Product,
          active: true,
          unit_amount: 5000,
          currency: 'usd',
          type: 'one_time',
          metadata: {}
        } as unknown as Stripe.Price;

        await upsertPrice(price);

        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith({
          id: 'price_456',
          product_id: 'prod_123',
          active: true,
          description: null,
          unit_amount: 5000,
          currency: 'usd',
          type: 'one_time',
          interval: null,
          interval_count: null,
          trial_period_days: null,
          metadata: {}
        });
      });

      it('should handle price without unit_amount', async () => {
        const price = {
          id: 'price_789',
          product: 'prod_123',
          active: true,
          currency: 'usd',
          type: 'one_time',
          unit_amount: null,
        } as unknown as Stripe.Price;

        await upsertPrice(price);

        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            unit_amount: 0,
          })
        );
      });
    });

    describe('deletePrice', () => {
      it('should delete price from database', async () => {
        await deletePrice('price_123');

        expect(mockSupabase._mocks.eq).toHaveBeenCalledWith('id', 'price_123');
      });
    });
  });

  describe('Subscription Management', () => {
    describe('manageSubscriptionStatusChange', () => {
      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        metadata: { key: 'value' },
        cancel_at_period_end: false,
        created: 1640995200,
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        ended_at: null,
        cancel_at: null,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
        items: {
          data: [{
            price: { id: 'price_123' },
            quantity: 1
          }]
        },
        default_payment_method: {
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025
          }
        }
      };

      it('should sync subscription to database', async () => {
        const customerId = 'cus_123';
        const subscriptionId = 'sub_123';

        mockSupabase._mocks.single.mockResolvedValue({
          data: { id: 'user123' },
          error: null
        });

        mockedStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

        await manageSubscriptionStatusChange(subscriptionId, customerId);

        expect(mockedStripe.subscriptions.retrieve).toHaveBeenCalledWith(
          subscriptionId,
          { expand: ['default_payment_method', 'items.data.price.product'] }
        );

        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith({
          id: 'sub_123',
          user_id: 'user123',
          status: 'active',
          metadata: { key: 'value' },
          price_id: 'price_123',
          quantity: 1,
          cancel_at_period_end: false,
          created: '2022-01-01T00:00:00.000Z',
          current_period_start: '2022-01-01T00:00:00.000Z',
          current_period_end: '2022-02-01T00:00:00.000Z',
          ended_at: null,
          cancel_at: null,
          canceled_at: null,
          trial_start: null,
          trial_end: null
        });
      });

      it('should update user payment method', async () => {
        const customerId = 'cus_123';
        const subscriptionId = 'sub_123';

        mockSupabase._mocks.single.mockResolvedValue({
          data: { id: 'user123' }
        });

        mockedStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

        await manageSubscriptionStatusChange(subscriptionId, customerId);

        expect(mockSupabase._mocks.update).toHaveBeenCalledWith({
          payment_method: {
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2025
            }
          }
        });
      });

      it('should handle customer not found', async () => {
        mockSupabase._mocks.single.mockResolvedValue({ data: null });

        await expect(
          manageSubscriptionStatusChange('sub_123', 'cus_nonexistent')
        ).resolves.not.toThrow();
      });

      it('should handle missing subscription items', async () => {
        const customerId = 'cus_123';
        const subscriptionId = 'sub_123';

        mockSupabase._mocks.single.mockResolvedValue({
          data: { id: 'user123' }
        });

        const subscriptionWithoutItems = {
          ...mockSubscription,
          items: { data: [] }
        };

        mockedStripe.subscriptions.retrieve.mockResolvedValue(subscriptionWithoutItems);

        await manageSubscriptionStatusChange(subscriptionId, customerId);

        expect(mockSupabase._mocks.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            price_id: undefined,
            quantity: 1
          })
        );
      });
    });

    describe('cancelSubscription', () => {
      it('should cancel subscription immediately', async () => {
        const subscriptionId = 'sub_123';

        mockedStripe.subscriptions.cancel.mockResolvedValue({
          status: 'canceled'
        });

        const result = await cancelSubscription(subscriptionId, true);

        expect(mockedStripe.subscriptions.cancel).toHaveBeenCalledWith(subscriptionId);
        expect(result).toBe(true);
      });

      it('should cancel subscription at period end', async () => {
        const subscriptionId = 'sub_123';

        mockedStripe.subscriptions.update.mockResolvedValue({
          cancel_at_period_end: true
        });

        const result = await cancelSubscription(subscriptionId, false);

        expect(mockedStripe.subscriptions.update).toHaveBeenCalledWith(
          subscriptionId,
          { cancel_at_period_end: true }
        );
        expect(result).toBe(true);
      });

      it('should handle cancellation errors', async () => {
        const subscriptionId = 'sub_123';

        mockedStripe.subscriptions.update.mockRejectedValue(new Error('Stripe error'));

        const result = await cancelSubscription(subscriptionId);
        expect(result).toBe(false);
      });
    });

    describe('resumeSubscription', () => {
      it('should resume subscription', async () => {
        const subscriptionId = 'sub_123';

        mockedStripe.subscriptions.update.mockResolvedValue({
          cancel_at_period_end: false
        });

        const result = await resumeSubscription(subscriptionId);

        expect(mockedStripe.subscriptions.update).toHaveBeenCalledWith(
          subscriptionId,
          { cancel_at_period_end: false }
        );
        expect(result).toBe(true);
      });

      it('should handle resume errors', async () => {
        const subscriptionId = 'sub_123';

        mockedStripe.subscriptions.update.mockRejectedValue(new Error('Stripe error'));

        const result = await resumeSubscription(subscriptionId);
        expect(result).toBe(false);
      });
    });
  });

  describe('Checkout and Portal', () => {
    describe('createCheckoutSession', () => {
      it('should create checkout session with customer', async () => {
        const sessionUrl = 'https://checkout.stripe.com/session';
        const userId = 'user123';
        const priceId = 'price_123';

        // Mock customer creation
        mockSupabase._mocks.single.mockResolvedValueOnce({
          data: { stripe_customer_id: 'cus_123' }
        });

        mockedStripe.checkout.sessions.create.mockResolvedValue({
          id: 'cs_123',
          url: sessionUrl
        });

        const result = await createCheckoutSession(
          userId,
          priceId,
          'https://example.com/success',
          'https://example.com/cancel'
        );

        expect(mockedStripe.checkout.sessions.create).toHaveBeenCalledWith({
          customer: 'cus_123',
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{
            price: priceId,
            quantity: 1
          }],
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
          allow_promotion_codes: true,
          subscription_data: {
            metadata: {
              supabase_user_id: userId
            },
            trial_period_days: 14
          }
        });

        expect(result).toBe(sessionUrl);
      });

      it('should handle customer creation failure', async () => {
        const userId = 'user123';
        const priceId = 'price_123';

        // Mock customer creation failure
        mockSupabase._mocks.single.mockResolvedValue({ data: null });
        mockSupabase._mocks.single.mockResolvedValue({ data: null });

        const result = await createCheckoutSession(
          userId,
          priceId,
          'https://example.com/success',
          'https://example.com/cancel'
        );

        expect(result).toBeNull();
      });

      it('should handle checkout session creation errors', async () => {
        // Mock customer exists
        mockSupabase._mocks.single.mockResolvedValue({
          data: { stripe_customer_id: 'cus_123' }
        });

        mockedStripe.checkout.sessions.create.mockRejectedValue(new Error('Stripe error'));

        const result = await createCheckoutSession(
          'user123',
          'price_123',
          'https://example.com/success',
          'https://example.com/cancel'
        );

        expect(result).toBeNull();
      });
    });

    describe('createPortalSession', () => {
      it('should create portal session', async () => {
        const userId = 'user123';
        const returnUrl = 'https://example.com/return';
        const customerId = 'cus_123';

        mockSupabase._mocks.single.mockResolvedValue({
          data: { stripe_customer_id: customerId }
        });

        mockedStripe.billingPortal.sessions.create.mockResolvedValue({
          url: 'https://billing.stripe.com/session'
        });

        const result = await createPortalSession(userId, returnUrl);

        expect(mockedStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
          customer: customerId,
          return_url: returnUrl
        });

        expect(result).toBe('https://billing.stripe.com/session');
      });

      it('should handle customer not found', async () => {
        mockSupabase._mocks.single.mockResolvedValue({ data: null });

        const result = await createPortalSession('user123', 'https://example.com');
        expect(result).toBeNull();
      });

      it('should handle portal session creation errors', async () => {
        mockSupabase._mocks.single.mockResolvedValue({
          data: { stripe_customer_id: 'cus_123' }
        });

        mockedStripe.billingPortal.sessions.create.mockRejectedValue(new Error('Stripe error'));

        const result = await createPortalSession('user123', 'https://example.com');
        expect(result).toBeNull();
      });
    });
  });

  describe('Stripe Instance', () => {
    it('should export Stripe instance', () => {
      expect(stripe).toBeDefined();
    });
  });
});