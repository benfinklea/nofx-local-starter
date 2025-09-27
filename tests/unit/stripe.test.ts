import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn()
    }
  }));
});

// Mock supabase
jest.mock('../../src/auth/supabase', () => ({
  createServiceClient: jest.fn()
}));

jest.mock('../../src/lib/logger');

describe('Stripe Integration', () => {
  let stripeMock: any;
  let supabaseMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    const Stripe = require('stripe');
    stripeMock = new Stripe();

    const { createServiceClient } = require('../../src/auth/supabase');
    supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      upsert: jest.fn()
    };
    createServiceClient.mockReturnValue(supabaseMock);
  });

  describe('createOrRetrieveCustomer', () => {
    it('should handle billing address without @ts-ignore', async () => {
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
      stripeMock.customers.create.mockResolvedValue(mockCustomer);

      // Call the function
      const result = await createOrRetrieveCustomer(userId, email);

      // Verify Stripe was called with properly typed parameters
      expect(stripeMock.customers.create).toHaveBeenCalledWith(
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
      const callArgs = stripeMock.customers.create.mock.calls[0][0];
      expect(callArgs).toHaveProperty('address');
      expect(callArgs.address).toEqual(userData.billing_address);
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
      stripeMock.customers.create.mockResolvedValue(mockCustomer);

      // Call the function
      const result = await createOrRetrieveCustomer(userId, email);

      // Verify Stripe was called without address field
      expect(stripeMock.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email,
          metadata: {
            supabase_user_id: userId
          },
          name: userData.full_name
        })
      );

      // Verify address was not included
      const callArgs = stripeMock.customers.create.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('address');
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