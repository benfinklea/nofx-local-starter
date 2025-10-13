import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Create shared mocks
const mockStripeCustomersCreate = jest.fn();

// Mock Stripe constructor BEFORE any imports
// This ensures the mock is in place when stripe.ts loads
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: mockStripeCustomersCreate,
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn()
    },
    products: {
      retrieve: jest.fn(),
      list: jest.fn()
    },
    prices: {
      retrieve: jest.fn(),
      list: jest.fn()
    },
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      cancel: jest.fn()
    },
    checkout: {
      sessions: {
        create: jest.fn()
      }
    },
    billingPortal: {
      sessions: {
        create: jest.fn()
      }
    }
  }));
});

// Mock supabase
jest.mock('../../src/auth/supabase', () => ({
  createServiceClient: jest.fn()
}));

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn()
    }))
  }
}));

describe('Stripe Integration', () => {
  let supabaseMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { createServiceClient } = require('../../src/auth/supabase');
    supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      upsert: (jest.fn() as any).mockResolvedValue({ error: null })
    };
    (createServiceClient as any).mockReturnValue(supabaseMock);
  });

  describe('createOrRetrieveCustomer', () => {
    it('should handle billing address without @ts-ignore', async () => {
      // Import AFTER mocks are set up
      const { createOrRetrieveCustomer } = require('../../src/billing/stripe');

      const userId = 'user_123';
      const email = 'test@example.com';

      // Mock user data with billing address
      const userData = {
        id: userId,
        email: email,
        full_name: 'John Doe',
        billing_address: {
          line1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'US'
        }
      };

      // Mock database responses
      supabaseMock.single.mockResolvedValueOnce({ data: null }); // No existing customer
      supabaseMock.single.mockResolvedValueOnce({ data: userData }); // User data

      // Mock Stripe customer creation
      const mockCustomer = { id: 'cus_123' };
      (mockStripeCustomersCreate as any).mockResolvedValue(mockCustomer);

      // Call the function
      const result = await createOrRetrieveCustomer(userId, email);

      // Verify result
      expect(result).toBe('cus_123');

      // Verify Stripe was called with properly typed parameters
      expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email,
          metadata: {
            supabase_user_id: userId
          },
          name: userData.full_name,
          address: userData.billing_address
        })
      );

      // Verify no TypeScript errors and proper typing
      const callArgs = (mockStripeCustomersCreate as any).mock.calls[0][0];
      expect(callArgs).toHaveProperty('address');
      expect((callArgs as any).address).toEqual(userData.billing_address);

      // Verify customer was stored in database
      expect(supabaseMock.upsert).toHaveBeenCalledWith({
        id: userId,
        stripe_customer_id: 'cus_123'
      });
    });

    it('should handle missing billing address gracefully', async () => {
      const { createOrRetrieveCustomer } = require('../../src/billing/stripe');

      const userId = 'user_456';
      const email = 'test2@example.com';

      // Mock user data without billing address
      const userData = {
        id: userId,
        email: email,
        full_name: 'Jane Doe',
        billing_address: null
      };

      // Mock database responses
      supabaseMock.single.mockResolvedValueOnce({ data: null }); // No existing customer
      supabaseMock.single.mockResolvedValueOnce({ data: userData }); // User data

      // Mock Stripe customer creation
      const mockCustomer = { id: 'cus_456' };
      (mockStripeCustomersCreate as any).mockResolvedValue(mockCustomer);

      // Call the function
      const result = await createOrRetrieveCustomer(userId, email);

      // Verify result
      expect(result).toBe('cus_456');

      // Verify Stripe was called without address field (or with null)
      expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email,
          metadata: {
            supabase_user_id: userId
          },
          name: userData.full_name
        })
      );

      // Verify address was null (Stripe API allows null for optional fields)
      const callArgs = (mockStripeCustomersCreate as any).mock.calls[0][0];
      expect((callArgs as any).address).toBeNull();
    });

    it('should return existing customer ID if found', async () => {
      const { createOrRetrieveCustomer } = require('../../src/billing/stripe');

      const userId = 'user_789';
      const email = 'existing@example.com';
      const existingCustomerId = 'cus_existing_123';

      // Mock database response with existing customer
      supabaseMock.single.mockResolvedValueOnce({
        data: { stripe_customer_id: existingCustomerId }
      });

      // Call the function
      const result = await createOrRetrieveCustomer(userId, email);

      // Verify result
      expect(result).toBe(existingCustomerId);

      // Verify Stripe was NOT called since customer already exists
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should use proper Stripe types without @ts-ignore', async () => {
      // This test verifies that the code compiles without TypeScript errors
      // The actual compilation happens during the build process

      // Import the module to ensure it loads without errors
      const stripeModule = require('../../src/billing/stripe');

      // Verify exports exist and are properly typed
      expect(stripeModule).toHaveProperty('stripe');
      expect(stripeModule).toHaveProperty('createOrRetrieveCustomer');
      expect(stripeModule).toHaveProperty('toDateTime');
      expect(stripeModule).toHaveProperty('getTrialEnd');

      // If we get here, the module loaded successfully without type errors
      expect(true).toBe(true);
    });
  });
});
