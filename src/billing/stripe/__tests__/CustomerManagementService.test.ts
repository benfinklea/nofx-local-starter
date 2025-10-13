/**
 * Comprehensive test suite for CustomerManagementService
 * Coverage target: 95%+
 */

import Stripe from 'stripe';
import { CustomerManagementService } from '../CustomerManagementService';

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

describe('CustomerManagementService', () => {
  let service: CustomerManagementService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockCreate = jest.fn();
    const mockRetrieve = jest.fn();
    const mockUpdate = jest.fn();
    const mockDel = jest.fn();

    mockStripe = {
      customers: {
        create: mockCreate,
        retrieve: mockRetrieve,
        update: mockUpdate,
        del: mockDel,
      },
    } as any;
    service = new CustomerManagementService(mockStripe);

    // Reset supabase mocks to return 'this' for chaining
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);

    mockCreateServiceClient.mockReturnValue(mockSupabase);
  });

  describe('createOrRetrieveCustomer', () => {
    it('should return existing customer ID if found', async () => {
      const userId = 'user_123';
      const existingCustomerId = 'cus_existing123';

      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: existingCustomerId },
        error: null,
      });

      const result = await service.createOrRetrieveCustomer(userId);

      expect(result).toBe(existingCustomerId);
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(mockSupabase.select).toHaveBeenCalledWith('stripe_customer_id');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', userId);
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new customer when none exists', async () => {
      const userId = 'user_new123';
      const email = 'test@example.com';
      const newCustomerId = 'cus_new123';

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: userId,
            email,
            full_name: 'Test User',
            billing_address: { city: 'Test City' },
          },
          error: null,
        });

      (mockStripe.customers.create as jest.Mock).mockResolvedValue({
        id: newCustomerId,
        email,
      } as Stripe.Customer);

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      const result = await service.createOrRetrieveCustomer(userId, email);

      expect(result).toBe(newCustomerId);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email,
        metadata: { supabase_user_id: userId },
        name: 'Test User',
        address: { city: 'Test City' },
      });
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        id: userId,
        stripe_customer_id: newCustomerId,
      });
    });

    it('should use provided email over user data email', async () => {
      const userId = 'user_123';
      const providedEmail = 'provided@example.com';
      const userDataEmail = 'userdata@example.com';
      const newCustomerId = 'cus_123';

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: userId, email: userDataEmail },
          error: null,
        });

      (mockStripe.customers.create as jest.Mock).mockResolvedValue({
        id: newCustomerId,
        email: providedEmail,
      } as Stripe.Customer);

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.createOrRetrieveCustomer(userId, providedEmail);

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: providedEmail })
      );
    });

    it('should handle customer creation without optional fields', async () => {
      const userId = 'user_minimal';
      const newCustomerId = 'cus_minimal';

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: userId },
          error: null,
        });

      (mockStripe.customers.create as jest.Mock).mockResolvedValue({
        id: newCustomerId,
      } as Stripe.Customer);

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      const result = await service.createOrRetrieveCustomer(userId);

      expect(result).toBe(newCustomerId);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: undefined,
        metadata: { supabase_user_id: userId },
        name: undefined,
        address: undefined,
      });
    });

    it('should return null when supabase client creation fails', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      const result = await service.createOrRetrieveCustomer('user_123');

      expect(result).toBeNull();
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should handle database query errors gracefully', async () => {
      const userId = 'user_error';

      mockSupabase.single.mockRejectedValue(new Error('Database error'));

      const result = await service.createOrRetrieveCustomer(userId);

      expect(result).toBeNull();
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should handle Stripe API errors gracefully', async () => {
      const userId = 'user_stripe_error';

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: userId }, error: null });

      (mockStripe.customers.create as jest.Mock).mockRejectedValue(
        new Error('Stripe API error')
      );

      const result = await service.createOrRetrieveCustomer(userId);

      expect(result).toBeNull();
    });

    it('should handle database upsert errors gracefully', async () => {
      const userId = 'user_upsert_error';
      const newCustomerId = 'cus_123';

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: userId }, error: null });

      (mockStripe.customers.create as jest.Mock).mockResolvedValue({
        id: newCustomerId,
      } as Stripe.Customer);

      mockSupabase.upsert.mockRejectedValue(new Error('Upsert failed'));

      const result = await service.createOrRetrieveCustomer(userId);

      // Should still return null due to error in upsert
      expect(result).toBeNull();
    });

    it('should handle empty user ID', async () => {
      const result = await service.createOrRetrieveCustomer('');

      expect(result).toBeNull();
    });

    it('should handle special characters in metadata', async () => {
      const userId = 'user_<script>alert("xss")</script>';
      const newCustomerId = 'cus_123';

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: userId }, error: null });

      (mockStripe.customers.create as jest.Mock).mockResolvedValue({
        id: newCustomerId,
      } as Stripe.Customer);

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.createOrRetrieveCustomer(userId);

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { supabase_user_id: userId },
        })
      );
    });

    it('should handle concurrent requests for same user', async () => {
      const userId = 'user_concurrent';
      const customerId = 'cus_concurrent';

      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: customerId },
        error: null,
      });

      const results = await Promise.all([
        service.createOrRetrieveCustomer(userId),
        service.createOrRetrieveCustomer(userId),
        service.createOrRetrieveCustomer(userId),
      ]);

      expect(results).toEqual([customerId, customerId, customerId]);
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });
  });
});
