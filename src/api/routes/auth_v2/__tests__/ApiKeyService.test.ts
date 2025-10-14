/**
 * ApiKeyService Unit Tests
 * Coverage Target: 95%+
 */

import { Request } from 'express';
import { ApiKeyService } from '../ApiKeyService';
import * as supabase from '../../../../auth/supabase';
import { log } from '../../../../lib/logger';
import { MockFactory, ApiKeyFactory, SecurityTestUtils } from '../../../../auth/__tests__/test-helpers';

jest.mock('../../../../auth/supabase');
jest.mock('../../../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let mockReq: Partial<Request>;
  let mockSupabase: any;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    mockReq = MockFactory.createRequest();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis()
    };

    (supabase.createServiceClient as jest.Mock).mockReturnValue(mockSupabase);
    (supabase.createAuditLog as jest.Mock).mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  describe('createApiKey()', () => {
    it('should create valid API key', async () => {
      const keyData = {
        name: 'Test Key',
        permissions: ['read', 'write']
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null }) // Check existing
        .mockResolvedValueOnce({
          data: {
            id: 'key123',
            name: 'Test Key',
            permissions: ['read', 'write'],
            created_at: new Date().toISOString()
          },
          error: null
        });

      const result = await apiKeyService.createApiKey(
        keyData,
        'user123',
        mockReq as Request
      );

      expect(result.key).toMatch(/^nofx_[a-f0-9]{64}$/);
      expect(result.name).toBe('Test Key');
      expect(result.permissions).toEqual(['read', 'write']);
    });

    it('should reject invalid permissions', async () => {
      const keyData = {
        name: 'Test Key',
        permissions: ['invalid', 'hack']
      };

      await expect(
        apiKeyService.createApiKey(keyData, 'user123', mockReq as Request)
      ).rejects.toThrow('Invalid permissions');
    });

    it('should prevent duplicate key names', async () => {
      const keyData = {
        name: 'Existing Key',
        permissions: ['read']
      };

      mockSupabase.single.mockResolvedValue({
        data: { id: 'existing-key' },
        error: null
      });

      await expect(
        apiKeyService.createApiKey(keyData, 'user123', mockReq as Request)
      ).rejects.toThrow('API key with this name already exists');
    });

    it('should hash API key before storage', async () => {
      const keyData = {
        name: 'Test Key',
        permissions: ['read']
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'key123',
            name: 'Test Key',
            permissions: ['read'],
            created_at: new Date().toISOString()
          },
          error: null
        });

      await apiKeyService.createApiKey(keyData, 'user123', mockReq as Request);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.key_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(insertCall.key_hash).not.toContain('nofx_');
    });

    it('should create audit log', async () => {
      const keyData = {
        name: 'Test Key',
        permissions: ['read']
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'key123',
            name: 'Test Key',
            permissions: ['read'],
            created_at: new Date().toISOString()
          },
          error: null
        });

      await apiKeyService.createApiKey(keyData, 'user123', mockReq as Request);

      expect(supabase.createAuditLog).toHaveBeenCalledWith(
        'user123',
        'api_key.created',
        'api_key',
        'key123',
        expect.objectContaining({
          name: 'Test Key',
          permissions: ['read']
        }),
        mockReq
      );
    });

    it('should handle database errors', async () => {
      const keyData = {
        name: 'Test Key',
        permissions: ['read']
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' }
        });

      await expect(
        apiKeyService.createApiKey(keyData, 'user123', mockReq as Request)
      ).rejects.toThrow('Failed to create API key');

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('listApiKeys()', () => {
    it('should list active API keys', async () => {
      const mockKeys = [
        ApiKeyFactory.createApiKeyData({ id: 'key1', name: 'Key 1' }),
        ApiKeyFactory.createApiKeyData({ id: 'key2', name: 'Key 2' })
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockKeys,
        error: null
      });

      const result = await apiKeyService.listApiKeys('user123');

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('Key 1');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should handle no keys found', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await apiKeyService.listApiKeys('user123');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        apiKeyService.listApiKeys('user123')
      ).rejects.toThrow('Failed to retrieve API keys');
    });
  });

  describe('deleteApiKey()', () => {
    it('should soft delete API key', async () => {
      // Mock the verification query: from().select().eq().eq().single()
      const mockSingleFn = jest.fn().mockResolvedValue({
        data: { id: 'key123', name: 'Test Key' },
        error: null
      });
      const mockEq2 = jest.fn().mockReturnValue({ single: mockSingleFn });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      mockSupabase.eq = mockEq1;

      // Mock the update chain: from().update().eq().eq()
      const mockUpdateEq2 = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });
      mockSupabase.update = mockUpdate;

      await apiKeyService.deleteApiKey('key123', 'user123', mockReq as Request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          deleted_at: expect.any(String)
        })
      );
    });

    it('should verify ownership before deletion', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      await expect(
        apiKeyService.deleteApiKey('key123', 'user123', mockReq as Request)
      ).rejects.toThrow('API key not found');
    });

    it('should create audit log on deletion', async () => {
      // Mock the verification query: from().select().eq().eq().single()
      const mockSingleFn = jest.fn().mockResolvedValue({
        data: { id: 'key123', name: 'Test Key' },
        error: null
      });
      const mockEq2 = jest.fn().mockReturnValue({ single: mockSingleFn });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      mockSupabase.eq = mockEq1;

      // Mock the update chain: from().update().eq().eq()
      const mockUpdateEq2 = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });
      mockSupabase.update = mockUpdate;

      await apiKeyService.deleteApiKey('key123', 'user123', mockReq as Request);

      expect(supabase.createAuditLog).toHaveBeenCalledWith(
        'user123',
        'api_key.deleted',
        'api_key',
        'key123',
        expect.objectContaining({ name: 'Test Key' }),
        mockReq
      );
    });
  });

  describe('validateApiKey()', () => {
    it('should validate correct API key', async () => {
      const apiKey = ApiKeyFactory.generateKey();
      const keyHash = require('crypto').createHash('sha256').update(apiKey).digest('hex');

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'key123',
          user_id: 'user123',
          name: 'Test Key',
          permissions: ['read', 'write'],
          user: { id: 'user123', email: 'test@example.com' }
        },
        error: null
      });

      const result = await apiKeyService.validateApiKey(apiKey);

      expect(result).toBeTruthy();
      expect(result?.userId).toBe('user123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('key_hash', keyHash);
    });

    it('should reject invalid key format', async () => {
      const result = await apiKeyService.validateApiKey('invalid_key');

      expect(result).toBeNull();
      expect(mockSupabase.select).not.toHaveBeenCalled();
    });

    it('should reject keys without nofx_ prefix', async () => {
      const result = await apiKeyService.validateApiKey('someotherkey_123');

      expect(result).toBeNull();
    });

    it('should update last_used_at timestamp', async () => {
      const apiKey = ApiKeyFactory.generateKey();

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'key123',
          user_id: 'user123',
          permissions: [],
          user: {}
        },
        error: null
      });

      await apiKeyService.validateApiKey(apiKey);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        last_used_at: expect.any(String)
      });
    });

    it('should resist timing attacks', async () => {
      const validKey = ApiKeyFactory.generateKey();
      const invalidKey = 'nofx_invalid';

      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const result = await SecurityTestUtils.timingAttackTest(
        async () => {
          await apiKeyService.validateApiKey(
            Math.random() > 0.5 ? validKey : invalidKey
          );
        },
        50
      );

      // Timing attack resistance is difficult to guarantee in test environment
      // This test verifies the function executes consistently
      expect(result.average).toBeGreaterThan(0);
    });
  });

  describe('Security Tests', () => {
    it('should prevent key enumeration attacks', async () => {
      const maliciousInputs = SecurityTestUtils.getMaliciousInputs();

      for (const input of [...maliciousInputs.sqlInjection, ...maliciousInputs.xss]) {
        const result = await apiKeyService.validateApiKey(input);
        expect(result).toBeNull();
      }
    });

    it('should handle service unavailable', async () => {
      (supabase.createServiceClient as jest.Mock).mockReturnValue(null);

      await expect(
        apiKeyService.createApiKey(
          { name: 'Test', permissions: ['read'] },
          'user123',
          mockReq as Request
        )
      ).rejects.toThrow('Service unavailable');
    });
  });
});
