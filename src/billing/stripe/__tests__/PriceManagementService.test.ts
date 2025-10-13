/**
 * Comprehensive test suite for PriceManagementService
 * Coverage target: 95%+
 */

import Stripe from 'stripe';
import { PriceManagementService } from '../PriceManagementService';

// Mock dependencies
const mockCreateServiceClient = jest.fn();
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  upsert: jest.fn(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
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

describe('PriceManagementService', () => {
  let service: PriceManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PriceManagementService();

    // Reset supabase mocks to return 'this' for chaining
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.delete.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);

    mockCreateServiceClient.mockReturnValue(mockSupabase);
  });

  describe('upsertPrice', () => {
    it('should sync recurring price to database', async () => {
      const price: any = {
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
        metadata: { key: 'value' },
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertPrice(price);

      expect(mockSupabase.from).toHaveBeenCalledWith('prices');
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
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
        metadata: { key: 'value' },
      });
    });

    it('should sync one-time price to database', async () => {
      const price: any = {
        id: 'price_456',
        product: { id: 'prod_123' },
        active: true,
        unit_amount: 5000,
        currency: 'usd',
        type: 'one_time',
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertPrice(price);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'price_456',
          product_id: 'prod_123',
          type: 'one_time',
          interval: null,
          interval_count: null,
          trial_period_days: null,
        })
      );
    });

    it('should handle price without unit_amount', async () => {
      const price: any = {
        id: 'price_789',
        product: 'prod_123',
        active: true,
        currency: 'usd',
        type: 'one_time',
        unit_amount: null,
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertPrice(price);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          unit_amount: 0,
        })
      );
    });

    it('should handle price without nickname', async () => {
      const price: any = {
        id: 'price_no_nickname',
        product: 'prod_123',
        active: true,
        unit_amount: 1000,
        currency: 'usd',
        type: 'one_time',
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertPrice(price);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
        })
      );
    });

    it('should handle yearly recurring price', async () => {
      const price: any = {
        id: 'price_yearly',
        product: 'prod_123',
        active: true,
        nickname: 'Yearly Plan',
        unit_amount: 20000,
        currency: 'usd',
        type: 'recurring',
        recurring: {
          interval: 'year',
          interval_count: 1,
          trial_period_days: 30,
        },
        metadata: { plan_type: 'yearly' },
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertPrice(price);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          interval: 'year',
          interval_count: 1,
          trial_period_days: 30,
        })
      );
    });

    it('should return early if supabase client is null', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      const price: any = { id: 'price_123', product: 'prod_123' };

      await service.upsertPrice(price);

      expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('should handle upsert errors gracefully', async () => {
      const price: any = {
        id: 'price_error',
        product: 'prod_123',
        active: true,
        unit_amount: 1000,
        currency: 'usd',
        type: 'one_time',
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed' },
      });

      await expect(service.upsertPrice(price)).resolves.toBeUndefined();
    });

    it('should handle exception during upsert', async () => {
      const price: any = {
        id: 'price_exception',
        product: 'prod_123',
        active: true,
        unit_amount: 1000,
        currency: 'usd',
        type: 'one_time',
        metadata: {},
      };

      mockSupabase.upsert.mockRejectedValue(new Error('Database error'));

      await expect(service.upsertPrice(price)).resolves.toBeUndefined();
    });

    it('should handle different currencies', async () => {
      const currencies = ['usd', 'eur', 'gbp', 'jpy'];

      for (const currency of currencies) {
        const price: any = {
          id: `price_${currency}`,
          product: 'prod_123',
          active: true,
          unit_amount: 1000,
          currency,
          type: 'one_time',
          metadata: {},
        };

        mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

        await service.upsertPrice(price);

        expect(mockSupabase.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ currency })
        );
      }
    });
  });

  describe('deletePrice', () => {
    it('should delete price from database', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.eq.mockReturnValue({ ...mockSupabase, eq: mockEq } as any);
      mockSupabase.delete.mockResolvedValue({ data: {}, error: null });

      await service.deletePrice('price_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('prices');
      expect(mockSupabase.delete).toHaveBeenCalled();
    });

    it('should return early if supabase client is null', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      await service.deletePrice('price_123');

      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', async () => {
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(service.deletePrice('price_123')).resolves.toBeUndefined();
    });

    it('should handle exception during delete', async () => {
      mockSupabase.eq.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.deletePrice('price_123')).resolves.toBeUndefined();
    });

    it('should handle multiple deletions', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.eq.mockReturnValue({ ...mockSupabase, eq: mockEq } as any);
      mockSupabase.delete.mockResolvedValue({ data: {}, error: null });

      await service.deletePrice('price_1');
      await service.deletePrice('price_2');
      await service.deletePrice('price_3');

      expect(mockSupabase.from).toHaveBeenCalledTimes(3);
    });
  });
});
