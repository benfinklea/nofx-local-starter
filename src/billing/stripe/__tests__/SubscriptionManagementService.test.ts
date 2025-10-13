/**
 * Comprehensive test suite for SubscriptionManagementService
 * Coverage target: 95%+
 */

import Stripe from 'stripe';
import { SubscriptionManagementService } from '../SubscriptionManagementService';

// Mock dependencies
const mockCreateServiceClient = jest.fn();
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  upsert: jest.fn(),
  update: jest.fn().mockReturnThis(),
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

describe('SubscriptionManagementService', () => {
  let service: SubscriptionManagementService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe = {
      subscriptions: {
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
        create: jest.fn(),
      },
    } as any;
    service = new SubscriptionManagementService(mockStripe);

    // Reset supabase mocks to return 'this' for chaining
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);

    mockCreateServiceClient.mockReturnValue(mockSupabase);
  });

  describe('manageSubscriptionStatusChange', () => {
    const mockSubscription: any = {
      id: 'sub_123',
      status: 'active',
      metadata: { key: 'value' },
      items: {
        data: [
          {
            price: { id: 'price_123' },
            quantity: 1,
          },
        ],
      },
      cancel_at_period_end: false,
      created: 1640995200,
      current_period_start: 1640995200,
      current_period_end: 1643587200,
      ended_at: null,
      cancel_at: null,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      default_payment_method: null,
    };

    it('should sync subscription to database successfully', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription);

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.manageSubscriptionStatusChange('sub_123', customerId);

      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123', {
        expand: ['default_payment_method', 'items.data.price.product'],
      });
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });

    it('should handle create action flag', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription);
      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.manageSubscriptionStatusChange('sub_123', customerId, true);

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalled();
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });

    it('should return early if supabase client is null', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      await service.manageSubscriptionStatusChange('sub_123', 'cus_123');

      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it('should return early if customer not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.manageSubscriptionStatusChange('sub_123', 'cus_nonexistent');

      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it('should handle subscription with payment method', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      const subWithPayment = {
        ...mockSubscription,
        default_payment_method: {
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
          },
        },
      };

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(subWithPayment);
      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });
      mockSupabase.update.mockResolvedValue({ data: {}, error: null });

      await service.manageSubscriptionStatusChange('sub_123', customerId);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_method: {
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
          },
        },
      });
    });

    it('should handle subscription with null payment method card', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      const subWithPayment = {
        ...mockSubscription,
        default_payment_method: {
          type: 'card',
          card: null,
        },
      };

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(subWithPayment);
      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });
      mockSupabase.update.mockResolvedValue({ data: {}, error: null });

      await service.manageSubscriptionStatusChange('sub_123', customerId);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_method: {
          type: 'card',
          card: null,
        },
      });
    });

    it('should handle subscription upsert errors', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription);
      mockSupabase.upsert.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed' },
      });

      // Should not throw
      await expect(
        service.manageSubscriptionStatusChange('sub_123', customerId)
      ).resolves.toBeUndefined();
    });

    it('should handle Stripe API errors', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockRejectedValue(
        new Error('Stripe API error')
      );

      await expect(
        service.manageSubscriptionStatusChange('sub_123', customerId)
      ).resolves.toBeUndefined();
    });

    it('should handle subscription with trial period', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      const subWithTrial = {
        ...mockSubscription,
        status: 'trialing',
        trial_start: 1640995200,
        trial_end: 1642204800,
      };

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(subWithTrial);
      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.manageSubscriptionStatusChange('sub_123', customerId);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'trialing',
          trial_start: expect.any(String),
          trial_end: expect.any(String),
        })
      );
    });

    it('should handle canceled subscription', async () => {
      const customerId = 'cus_123';
      const userId = 'user_123';

      const canceledSub = {
        ...mockSubscription,
        status: 'canceled',
        canceled_at: 1642204800,
        ended_at: 1642204800,
      };

      mockSupabase.single.mockResolvedValue({
        data: { id: userId },
        error: null,
      });

      (mockStripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(canceledSub);
      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.manageSubscriptionStatusChange('sub_123', customerId);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
          canceled_at: expect.any(String),
          ended_at: expect.any(String),
        })
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately', async () => {
      (mockStripe.subscriptions.cancel as jest.Mock).mockResolvedValue({} as Stripe.Subscription);

      const result = await service.cancelSubscription('sub_123', true);

      expect(result).toBe(true);
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it('should cancel subscription at period end', async () => {
      (mockStripe.subscriptions.update as jest.Mock).mockResolvedValue({} as Stripe.Subscription);

      const result = await service.cancelSubscription('sub_123', false);

      expect(result).toBe(true);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
      expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('should default to cancel at period end', async () => {
      (mockStripe.subscriptions.update as jest.Mock).mockResolvedValue({} as Stripe.Subscription);

      const result = await service.cancelSubscription('sub_123');

      expect(result).toBe(true);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
    });

    it('should handle cancellation errors', async () => {
      (mockStripe.subscriptions.cancel as jest.Mock).mockRejectedValue(
        new Error('Cancellation failed')
      );

      const result = await service.cancelSubscription('sub_123', true);

      expect(result).toBe(false);
    });

    it('should handle update errors for period end cancellation', async () => {
      (mockStripe.subscriptions.update as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );

      const result = await service.cancelSubscription('sub_123', false);

      expect(result).toBe(false);
    });
  });

  describe('resumeSubscription', () => {
    it('should resume subscription successfully', async () => {
      (mockStripe.subscriptions.update as jest.Mock).mockResolvedValue({} as Stripe.Subscription);

      const result = await service.resumeSubscription('sub_123');

      expect(result).toBe(true);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      });
    });

    it('should handle resume errors', async () => {
      (mockStripe.subscriptions.update as jest.Mock).mockRejectedValue(
        new Error('Resume failed')
      );

      const result = await service.resumeSubscription('sub_123');

      expect(result).toBe(false);
    });

    it('should handle multiple resume calls', async () => {
      (mockStripe.subscriptions.update as jest.Mock).mockResolvedValue({} as Stripe.Subscription);

      const results = await Promise.all([
        service.resumeSubscription('sub_1'),
        service.resumeSubscription('sub_2'),
        service.resumeSubscription('sub_3'),
      ]);

      expect(results).toEqual([true, true, true]);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledTimes(3);
    });
  });
});
