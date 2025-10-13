/**
 * Comprehensive test suite for SessionManagementService
 * Coverage target: 95%+
 */

import Stripe from 'stripe';
import { SessionManagementService } from '../SessionManagementService';
import { CustomerManagementService } from '../CustomerManagementService';

// Mock dependencies
const mockCreateServiceClient = jest.fn();
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('../../../auth/supabase', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

jest.mock('../../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('SessionManagementService', () => {
  let service: SessionManagementService;
  let mockStripe: jest.Mocked<Stripe>;
  let mockCustomerService: jest.Mocked<CustomerManagementService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe = {
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
    } as any;
    mockCustomerService = {
      createOrRetrieveCustomer: jest.fn(),
    } as any;
    service = new SessionManagementService(mockStripe, mockCustomerService);

    // Reset supabase mocks to return 'this' for chaining
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);

    mockCreateServiceClient.mockReturnValue(mockSupabase);
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      const userId = 'user_123';
      const priceId = 'price_123';
      const successUrl = 'https://example.com/success';
      const cancelUrl = 'https://example.com/cancel';
      const customerId = 'cus_123';
      const sessionUrl = 'https://checkout.stripe.com/session_123';

      mockCustomerService.createOrRetrieveCustomer.mockResolvedValue(customerId);
      (mockStripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
        url: sessionUrl,
      } as Stripe.Checkout.Session);

      const result = await service.createCheckoutSession(
        userId,
        priceId,
        successUrl,
        cancelUrl
      );

      expect(result).toBe(sessionUrl);
      expect(mockCustomerService.createOrRetrieveCustomer).toHaveBeenCalledWith(userId);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            supabase_user_id: userId,
          },
          trial_period_days: 14,
        },
      });
    });

    it('should return null if customer creation fails', async () => {
      mockCustomerService.createOrRetrieveCustomer.mockResolvedValue(null);

      const result = await service.createCheckoutSession(
        'user_123',
        'price_123',
        'https://example.com/success',
        'https://example.com/cancel'
      );

      expect(result).toBeNull();
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('should handle Stripe API errors', async () => {
      mockCustomerService.createOrRetrieveCustomer.mockResolvedValue('cus_123');
      (mockStripe.checkout.sessions.create as jest.Mock).mockRejectedValue(
        new Error('Stripe API error')
      );

      const result = await service.createCheckoutSession(
        'user_123',
        'price_123',
        'https://example.com/success',
        'https://example.com/cancel'
      );

      expect(result).toBeNull();
    });

    it('should handle session without URL', async () => {
      mockCustomerService.createOrRetrieveCustomer.mockResolvedValue('cus_123');
      (mockStripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
        url: null,
      } as any);

      const result = await service.createCheckoutSession(
        'user_123',
        'price_123',
        'https://example.com/success',
        'https://example.com/cancel'
      );

      expect(result).toBeNull();
    });

    it('should pass correct metadata to subscription', async () => {
      const userId = 'user_special_123';
      mockCustomerService.createOrRetrieveCustomer.mockResolvedValue('cus_123');
      (mockStripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
        url: 'https://checkout.stripe.com/session',
      } as Stripe.Checkout.Session);

      await service.createCheckoutSession(
        userId,
        'price_123',
        'https://example.com/success',
        'https://example.com/cancel'
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: {
            metadata: {
              supabase_user_id: userId,
            },
            trial_period_days: 14,
          },
        })
      );
    });

    it('should create sessions with different price IDs', async () => {
      mockCustomerService.createOrRetrieveCustomer.mockResolvedValue('cus_123');
      (mockStripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
        url: 'https://checkout.stripe.com/session',
      } as Stripe.Checkout.Session);

      const priceIds = ['price_monthly', 'price_yearly', 'price_enterprise'];

      for (const priceId of priceIds) {
        await service.createCheckoutSession(
          'user_123',
          priceId,
          'https://example.com/success',
          'https://example.com/cancel'
        );

        expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            line_items: [{ price: priceId, quantity: 1 }],
          })
        );
      }
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session successfully', async () => {
      const userId = 'user_123';
      const returnUrl = 'https://example.com/return';
      const customerId = 'cus_123';
      const portalUrl = 'https://billing.stripe.com/session_123';

      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: customerId },
        error: null,
      });

      (mockStripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
        url: portalUrl,
      } as Stripe.BillingPortal.Session);

      const result = await service.createPortalSession(userId, returnUrl);

      expect(result).toBe(portalUrl);
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(mockSupabase.select).toHaveBeenCalledWith('stripe_customer_id');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', userId);
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        return_url: returnUrl,
      });
    });

    it('should return null if supabase client is null', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      const result = await service.createPortalSession(
        'user_123',
        'https://example.com/return'
      );

      expect(result).toBeNull();
      expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it('should return null if customer not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.createPortalSession(
        'user_nonexistent',
        'https://example.com/return'
      );

      expect(result).toBeNull();
      expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it('should return null if customer has no stripe_customer_id', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: null },
        error: null,
      });

      const result = await service.createPortalSession(
        'user_123',
        'https://example.com/return'
      );

      expect(result).toBeNull();
      expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it('should handle Stripe API errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_123' },
        error: null,
      });

      (mockStripe.billingPortal.sessions.create as jest.Mock).mockRejectedValue(
        new Error('Stripe API error')
      );

      const result = await service.createPortalSession(
        'user_123',
        'https://example.com/return'
      );

      expect(result).toBeNull();
    });

    it('should handle database query errors', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database error'));

      const result = await service.createPortalSession(
        'user_123',
        'https://example.com/return'
      );

      expect(result).toBeNull();
    });

    it('should handle session without URL', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_123' },
        error: null,
      });

      (mockStripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
        url: null,
      } as any);

      const result = await service.createPortalSession(
        'user_123',
        'https://example.com/return'
      );

      expect(result).toBeNull();
    });

    it('should create portal sessions for different users', async () => {
      (mockStripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
        url: 'https://billing.stripe.com/session',
      } as Stripe.BillingPortal.Session);

      const users = ['user_1', 'user_2', 'user_3'];

      for (const userId of users) {
        mockSupabase.single.mockResolvedValue({
          data: { stripe_customer_id: `cus_${userId}` },
          error: null,
        });

        await service.createPortalSession(userId, 'https://example.com/return');

        expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
          customer: `cus_${userId}`,
          return_url: 'https://example.com/return',
        });
      }
    });
  });
});
