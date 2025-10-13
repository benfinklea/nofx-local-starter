/**
 * Comprehensive test suite for ProductManagementService
 * Coverage target: 95%+
 */

import Stripe from 'stripe';
import { ProductManagementService } from '../ProductManagementService';

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

describe('ProductManagementService', () => {
  let service: ProductManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductManagementService();

    // Reset supabase mocks to return 'this' for chaining
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.delete.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);

    mockCreateServiceClient.mockReturnValue(mockSupabase);
  });

  describe('upsertProduct', () => {
    it('should sync product with all fields to database', async () => {
      const product: any = {
        id: 'prod_123',
        active: true,
        name: 'Test Product',
        description: 'A test product',
        images: ['https://example.com/image.png'],
        metadata: { key: 'value' },
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertProduct(product);

      expect(mockSupabase.from).toHaveBeenCalledWith('products');
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        id: 'prod_123',
        active: true,
        name: 'Test Product',
        description: 'A test product',
        image: 'https://example.com/image.png',
        metadata: { key: 'value' },
      });
    });

    it('should handle product without image', async () => {
      const product: any = {
        id: 'prod_no_image',
        active: true,
        name: 'No Image Product',
        description: 'Product without image',
        images: [],
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertProduct(product);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          image: null,
        })
      );
    });

    it('should handle product without description', async () => {
      const product: any = {
        id: 'prod_no_desc',
        active: true,
        name: 'No Description Product',
        images: [],
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertProduct(product);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: undefined,
        })
      );
    });

    it('should handle inactive product', async () => {
      const product: any = {
        id: 'prod_inactive',
        active: false,
        name: 'Inactive Product',
        images: [],
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertProduct(product);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
        })
      );
    });

    it('should handle product with multiple images (use first)', async () => {
      const product: any = {
        id: 'prod_multi_img',
        active: true,
        name: 'Multi Image Product',
        images: [
          'https://example.com/image1.png',
          'https://example.com/image2.png',
          'https://example.com/image3.png',
        ],
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertProduct(product);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          image: 'https://example.com/image1.png',
        })
      );
    });

    it('should return early if supabase client is null', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      const product: any = { id: 'prod_123', name: 'Test' };

      await service.upsertProduct(product);

      expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('should handle upsert errors gracefully', async () => {
      const product: any = {
        id: 'prod_error',
        active: true,
        name: 'Error Product',
        images: [],
        metadata: {},
      };

      mockSupabase.upsert.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed' },
      });

      await expect(service.upsertProduct(product)).resolves.toBeUndefined();
    });

    it('should handle exception during upsert', async () => {
      const product: any = {
        id: 'prod_exception',
        active: true,
        name: 'Exception Product',
        images: [],
        metadata: {},
      };

      mockSupabase.upsert.mockRejectedValue(new Error('Database error'));

      await expect(service.upsertProduct(product)).resolves.toBeUndefined();
    });

    it('should handle product with complex metadata', async () => {
      const product: any = {
        id: 'prod_meta',
        active: true,
        name: 'Metadata Product',
        images: [],
        metadata: {
          category: 'premium',
          features: ['feature1', 'feature2'],
          pricing_tier: 'enterprise',
        },
      };

      mockSupabase.upsert.mockResolvedValue({ data: {}, error: null });

      await service.upsertProduct(product);

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            category: 'premium',
            features: ['feature1', 'feature2'],
            pricing_tier: 'enterprise',
          },
        })
      );
    });
  });

  describe('deleteProduct', () => {
    it('should delete product from database', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.eq.mockReturnValue({ ...mockSupabase, eq: mockEq } as any);
      mockSupabase.delete.mockResolvedValue({ data: {}, error: null });

      await service.deleteProduct('prod_123');

      expect(mockSupabase.from).toHaveBeenCalledWith('products');
      expect(mockSupabase.delete).toHaveBeenCalled();
    });

    it('should return early if supabase client is null', async () => {
      mockCreateServiceClient.mockReturnValue(null);

      await service.deleteProduct('prod_123');

      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', async () => {
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(service.deleteProduct('prod_123')).resolves.toBeUndefined();
    });

    it('should handle exception during delete', async () => {
      mockSupabase.eq.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.deleteProduct('prod_123')).resolves.toBeUndefined();
    });

    it('should handle multiple deletions', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.eq.mockReturnValue({ ...mockSupabase, eq: mockEq } as any);
      mockSupabase.delete.mockResolvedValue({ data: {}, error: null });

      await service.deleteProduct('prod_1');
      await service.deleteProduct('prod_2');
      await service.deleteProduct('prod_3');

      expect(mockSupabase.from).toHaveBeenCalledTimes(3);
    });
  });
});
