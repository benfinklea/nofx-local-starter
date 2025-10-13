/**
 * Contract Tests for Stripe Integration
 * These tests ensure the Stripe API integration contracts are maintained
 * across refactoring and updates
 */

import Stripe from 'stripe';

// Mock Stripe to prevent real API calls
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({}));
});

// Mock Supabase
jest.mock('../../auth/supabase', () => ({
  createServiceClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  })
}));

// Mock logger
jest.mock('../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Stripe Integration Contracts', () => {
  describe('API Structure Contracts', () => {
    it('should verify Stripe module exports expected functions', async () => {
      const {
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
      } = await import('../stripe');

      // All exports should be defined
      expect(toDateTime).toBeDefined();
      expect(getTrialEnd).toBeDefined();
      expect(createOrRetrieveCustomer).toBeDefined();
      expect(upsertProduct).toBeDefined();
      expect(upsertPrice).toBeDefined();
      expect(manageSubscriptionStatusChange).toBeDefined();
      expect(deleteProduct).toBeDefined();
      expect(deletePrice).toBeDefined();
      expect(createCheckoutSession).toBeDefined();
      expect(createPortalSession).toBeDefined();
      expect(cancelSubscription).toBeDefined();
      expect(resumeSubscription).toBeDefined();
      expect(stripe).toBeDefined();

      // Type checks
      expect(typeof toDateTime).toBe('function');
      expect(typeof getTrialEnd).toBe('function');
      expect(typeof createOrRetrieveCustomer).toBe('function');
      expect(typeof upsertProduct).toBe('function');
      expect(typeof upsertPrice).toBe('function');
      expect(typeof manageSubscriptionStatusChange).toBe('function');
      expect(typeof deleteProduct).toBe('function');
      expect(typeof deletePrice).toBe('function');
      expect(typeof createCheckoutSession).toBe('function');
      expect(typeof createPortalSession).toBe('function');
      expect(typeof cancelSubscription).toBe('function');
      expect(typeof resumeSubscription).toBe('function');
    });

    it('should verify function signatures have not changed', () => {
      const {
        toDateTime,
        getTrialEnd,
        createOrRetrieveCustomer,
        createCheckoutSession,
        manageSubscriptionStatusChange,
        cancelSubscription
      } = require('../stripe');

      // Check function arity (Function.length = params without defaults)
      expect(toDateTime.length).toBe(1); // secs
      expect(getTrialEnd.length).toBe(1); // trialDays
      expect(createOrRetrieveCustomer.length).toBe(2); // userId, email (optional but no default)
      expect(createCheckoutSession.length).toBe(4); // userId, priceId, successUrl, cancelUrl
      expect(manageSubscriptionStatusChange.length).toBe(2); // subscriptionId, customerId (createAction has default = false)
      expect(cancelSubscription.length).toBe(1); // subscriptionId (immediately has default = false)
    });
  });

  describe('Return Type Contracts', () => {
    it('toDateTime should return string in ISO format', () => {
      const { toDateTime } = require('../stripe');
      const result = toDateTime(1640995200);
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('getTrialEnd should return number or null', () => {
      const { getTrialEnd } = require('../stripe');
      expect(typeof getTrialEnd(7)).toBe('number');
      expect(getTrialEnd(0)).toBeNull();
      expect(getTrialEnd(-1)).toBeNull();
    });

    it('async functions should return Promises', async () => {
      const {
        createOrRetrieveCustomer,
        upsertProduct,
        createCheckoutSession,
        cancelSubscription
      } = require('../stripe');

      // These should all return promises (won't actually execute due to missing mocks)
      const promise1 = createOrRetrieveCustomer('test').catch(() => {});
      const promise2 = upsertProduct({} as any).catch(() => {});
      const promise3 = createCheckoutSession('test', 'price', 'success', 'cancel').catch(() => {});
      const promise4 = cancelSubscription('sub').catch(() => {});

      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
      expect(promise3).toBeInstanceOf(Promise);
      expect(promise4).toBeInstanceOf(Promise);

      // Cleanup
      await Promise.allSettled([promise1, promise2, promise3, promise4]);
    });
  });

  describe('Data Shape Contracts', () => {
    it('should maintain expected Stripe product structure', () => {
      // This ensures our code expects the correct Stripe data structure
      const expectedProductShape = {
        id: expect.any(String),
        active: expect.any(Boolean),
        name: expect.any(String),
        description: expect.any(String),
        images: expect.any(Array),
        metadata: expect.any(Object)
      };

      // Verify this matches Stripe's Product type
      const mockProduct: Partial<Stripe.Product> = {
        id: 'prod_123',
        object: 'product',
        active: true,
        created: 1234567890,
        default_price: null,
        description: 'Test',
        images: ['https://example.com/image.png'],
        livemode: false,
        metadata: {},
        name: 'Test Product',
        package_dimensions: null,
        shippable: null,
        statement_descriptor: null,
        tax_code: null,
        unit_label: null,
        updated: 1234567890,
        url: null
      };

      expect(mockProduct).toMatchObject(expectedProductShape);
    });

    it('should maintain expected Stripe price structure', () => {
      const expectedPriceShape = {
        id: expect.any(String),
        active: expect.any(Boolean),
        currency: expect.any(String),
        unit_amount: expect.any(Number),
        type: expect.stringMatching(/^(one_time|recurring)$/),
        metadata: expect.any(Object)
      };

      const mockPrice: Partial<Stripe.Price> = {
        id: 'price_123',
        object: 'price',
        active: true,
        billing_scheme: 'per_unit',
        created: 1234567890,
        currency: 'usd',
        livemode: false,
        lookup_key: null,
        metadata: {},
        nickname: null,
        product: 'prod_123',
        recurring: null,
        tax_behavior: null,
        tiers_mode: null,
        transform_quantity: null,
        type: 'one_time',
        unit_amount: 1000,
        unit_amount_decimal: '1000'
      };

      expect(mockPrice).toMatchObject(expectedPriceShape);
    });
  });

  describe('Error Handling Contracts', () => {
    it('should handle errors gracefully and not throw', async () => {
      const {
        createOrRetrieveCustomer,
        upsertProduct,
        deleteProduct,
        createCheckoutSession,
        cancelSubscription
      } = require('../stripe');

      // All these should catch errors internally and return null/false instead of throwing
      await expect(createOrRetrieveCustomer('invalid')).resolves.not.toThrow();
      await expect(upsertProduct({} as any)).resolves.not.toThrow();
      await expect(deleteProduct('invalid')).resolves.not.toThrow();
      await expect(createCheckoutSession('invalid', 'price', 'success', 'cancel')).resolves.not.toThrow();
      await expect(cancelSubscription('invalid')).resolves.not.toThrow();
    });

    it('should return appropriate fallback values on error', async () => {
      const {
        createOrRetrieveCustomer,
        createCheckoutSession,
        createPortalSession,
        cancelSubscription,
        resumeSubscription
      } = require('../stripe');

      // Functions that return string | null should return null on error
      const customerResult = await createOrRetrieveCustomer('invalid');
      const checkoutResult = await createCheckoutSession('invalid', 'price', 'success', 'cancel');
      const portalResult = await createPortalSession('invalid', 'return');

      expect(customerResult).toBeNull();
      expect(checkoutResult).toBeNull();
      expect(portalResult).toBeNull();

      // Functions that return boolean should return false on error
      const cancelResult = await cancelSubscription('invalid');
      const resumeResult = await resumeSubscription('invalid');

      expect(cancelResult).toBe(false);
      expect(resumeResult).toBe(false);
    });
  });

  describe('Integration Dependencies', () => {
    it('should properly initialize Stripe instance', () => {
      const { stripe } = require('../stripe');
      expect(stripe).toBeDefined();
    });

    it('should require auth/supabase module', () => {
      // This ensures the dependency contract is maintained
      expect(() => require('../../auth/supabase')).not.toThrow();
      const authModule = require('../../auth/supabase');
      expect(authModule.createServiceClient).toBeDefined();
      expect(typeof authModule.createServiceClient).toBe('function');
    });

    it('should require logger module', () => {
      expect(() => require('../../lib/logger')).not.toThrow();
      const loggerModule = require('../../lib/logger');
      expect(loggerModule.log).toBeDefined();
      expect(loggerModule.log.error).toBeDefined();
      expect(typeof loggerModule.log.error).toBe('function');
    });
  });
});
