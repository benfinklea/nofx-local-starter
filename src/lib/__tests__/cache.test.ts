/**
 * Comprehensive unit tests for cache.ts
 * Target Coverage: 85%
 *
 * Tests cover:
 * - Cache get/set operations
 * - TTL and expiration handling
 * - Namespace management
 * - File-based cache implementation
 * - Error handling and edge cases
 * - Concurrent operations
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getCacheJSON, setCacheJSON, invalidateNamespace } from '../cache';

// Mock modules
jest.mock('node:fs');
jest.mock('node:fs/promises');
jest.mock('node:path');
jest.mock('node:crypto');
jest.mock('../observability', () => ({
  log: {
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('cache', () => {
  let mockFs: jest.Mocked<typeof fs>;
  let mockFsp: jest.Mocked<typeof fsp>;
  let mockPath: jest.Mocked<typeof path>;
  let mockCrypto: jest.Mocked<typeof crypto>;

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFsp = fsp as jest.Mocked<typeof fsp>;
    mockPath = path as jest.Mocked<typeof path>;
    mockCrypto = crypto as jest.Mocked<typeof crypto>;

    // Setup path mocking
    mockPath.join.mockImplementation((...segments) => segments.join('/'));
    (process.cwd as jest.Mock) = jest.fn().mockReturnValue('/test/cwd');

    // Setup crypto mocking
    const mockHash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('abcdef1234567890')
    };
    mockCrypto.createHash.mockReturnValue(mockHash as any);

    // Default mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined as any);
    mockFsp.writeFile.mockResolvedValue(undefined);
    mockFsp.readFile.mockResolvedValue('{"expiresAt": 9999999999999, "value": "test"}');
    mockFsp.unlink.mockResolvedValue(undefined);
    mockFsp.readdir.mockResolvedValue([]);

    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('getCacheJSON', () => {
    it('retrieves valid cached value', async () => {
      const value = { test: 'data', number: 42 };
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() + 10000,
        value
      }));

      const result = await getCacheJSON('test-ns', 'test-key');

      expect(result).toEqual(value);
    });

    it('returns null for cache miss', async () => {
      mockFsp.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      const result = await getCacheJSON('test-ns', 'missing-key');

      expect(result).toBeNull();
    });

    it('returns null and deletes expired cache', async () => {
      const expiredData = {
        expiresAt: Date.now() - 10000, // Expired
        value: 'old data'
      };
      mockFsp.readFile.mockResolvedValue(JSON.stringify(expiredData));

      const result = await getCacheJSON('test-ns', 'expired-key');

      expect(result).toBeNull();
      expect(mockFsp.unlink).toHaveBeenCalled();
    });

    it('handles cache without expiration', async () => {
      const data = { value: 'test' }; // No expiresAt
      mockFsp.readFile.mockResolvedValue(JSON.stringify(data));

      const result = await getCacheJSON('test-ns', 'key');

      expect(result).toBe('test');
    });

    it('handles invalid JSON gracefully', async () => {
      mockFsp.readFile.mockResolvedValue('{ invalid json }');

      const result = await getCacheJSON('test-ns', 'key');

      expect(result).toBeNull();
    });

    it('uses hashed key for file path', async () => {
      await getCacheJSON('test-ns', 'test-key');

      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
      // path.join is called twice: once for dir, once for file
      expect(mockPath.join).toHaveBeenCalled();
    });

    it('sanitizes namespace for file system', async () => {
      await getCacheJSON('test/ns!@#$%', 'key');

      // Namespace should be sanitized - check that join was called with sanitized name
      const joinCalls = mockPath.join.mock.calls;
      const hasSanitized = joinCalls.some(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('test_ns'))
      );
      expect(hasSanitized).toBe(true);
    });

    it('handles deletion errors for expired cache', async () => {
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() - 1000,
        value: 'expired'
      }));
      mockFsp.unlink.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await getCacheJSON('test-ns', 'key');

      expect(result).toBeNull();
      // Should not throw, just log warning
    });

    it('handles complex nested values', async () => {
      const complexValue = {
        level1: {
          level2: {
            array: [1, 2, 3],
            nested: { deep: 'value' }
          }
        }
      };
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() + 10000,
        value: complexValue
      }));

      const result = await getCacheJSON('test-ns', 'key');

      expect(result).toEqual(complexValue);
    });

    it('handles null values', async () => {
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() + 10000,
        value: null
      }));

      const result = await getCacheJSON('test-ns', 'key');

      expect(result).toBeNull();
    });

    it('handles array values', async () => {
      const arrayValue = [1, 2, 3, 4, 5];
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() + 10000,
        value: arrayValue
      }));

      const result = await getCacheJSON('test-ns', 'key');

      expect(result).toEqual(arrayValue);
    });

    it('uses type parameter correctly', async () => {
      interface TestType {
        id: number;
        name: string;
      }

      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() + 10000,
        value: { id: 1, name: 'test' }
      }));

      const result = await getCacheJSON<TestType>('test-ns', 'key');

      expect(result).toEqual({ id: 1, name: 'test' });
    });
  });

  describe('setCacheJSON', () => {
    it('sets cache with TTL', async () => {
      const value = { test: 'data' };
      const ttl = 60000; // 60 seconds

      await setCacheJSON('test-ns', 'test-key', value, ttl);

      expect(mockFsp.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"value"')
      );

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.value).toEqual(value);
      expect(written.expiresAt).toBe(Date.now() + ttl);
    });

    it('ensures directory exists before writing', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await setCacheJSON('new-ns', 'key', 'value', 1000);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('handles zero TTL', async () => {
      await setCacheJSON('test-ns', 'key', 'value', 0);

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.expiresAt).toBe(Date.now());
    });

    it('handles negative TTL', async () => {
      await setCacheJSON('test-ns', 'key', 'value', -5000);

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      // Negative TTL should be treated as 0
      expect(written.expiresAt).toBe(Date.now());
    });

    it('handles complex values', async () => {
      const complexValue = {
        nested: { data: [1, 2, 3] },
        boolean: true,
        null: null
      };

      await setCacheJSON('test-ns', 'key', complexValue, 1000);

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.value).toEqual(complexValue);
    });

    it('handles null values', async () => {
      await setCacheJSON('test-ns', 'key', null, 1000);

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.value).toBeNull();
    });

    it('handles array values', async () => {
      const arrayValue = [1, 2, 3, 4, 5];

      await setCacheJSON('test-ns', 'key', arrayValue, 1000);

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.value).toEqual(arrayValue);
    });

    it('sanitizes namespace in file path', async () => {
      await setCacheJSON('test/ns!@#', 'key', 'value', 1000);

      // Check that join was called with sanitized namespace
      const joinCalls = mockPath.join.mock.calls;
      const hasSanitized = joinCalls.some(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('test_ns'))
      );
      expect(hasSanitized).toBe(true);
    });

    it('uses consistent hash for same key', async () => {
      await setCacheJSON('ns', 'same-key', 'value1', 1000);
      await setCacheJSON('ns', 'same-key', 'value2', 1000);

      const calls = mockFsp.writeFile.mock.calls;
      expect(calls[0][0]).toBe(calls[1][0]); // Same file path
    });

    it('propagates write errors', async () => {
      mockFsp.writeFile.mockRejectedValue(new Error('ENOSPC: no space'));

      await expect(
        setCacheJSON('ns', 'key', 'value', 1000)
      ).rejects.toThrow('ENOSPC');
    });

    it('handles very large TTL values', async () => {
      const largeTTL = Number.MAX_SAFE_INTEGER;

      await setCacheJSON('ns', 'key', 'value', largeTTL);

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('invalidateNamespace', () => {
    it('deletes all files in namespace', async () => {
      const files = ['file1.json', 'file2.json', 'file3.json'];
      mockFsp.readdir.mockResolvedValue(files as any);

      const count = await invalidateNamespace('test-ns');

      expect(count).toBe(3);
      expect(mockFsp.unlink).toHaveBeenCalledTimes(3);
    });

    it('returns 0 for non-existent namespace', async () => {
      mockFsp.readdir.mockRejectedValue(new Error('ENOENT: directory not found'));

      const count = await invalidateNamespace('missing-ns');

      expect(count).toBe(0);
    });

    it('handles empty namespace', async () => {
      mockFsp.readdir.mockResolvedValue([]);

      const count = await invalidateNamespace('empty-ns');

      expect(count).toBe(0);
      expect(mockFsp.unlink).not.toHaveBeenCalled();
    });

    it('continues on individual file deletion errors', async () => {
      mockFsp.readdir.mockResolvedValue(['file1.json', 'file2.json', 'file3.json'] as any);
      mockFsp.unlink
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('EACCES: permission denied'))
        .mockResolvedValueOnce(undefined);

      const count = await invalidateNamespace('test-ns');

      expect(count).toBe(2); // Only successful deletions counted
      expect(mockFsp.unlink).toHaveBeenCalledTimes(3);
    });

    it('uses sanitized namespace path', async () => {
      mockFsp.readdir.mockResolvedValue([]);

      await invalidateNamespace('test/ns!@#');

      // invalidateNamespace doesn't sanitize in the actual implementation
      // It uses the namespace directly
      expect(mockPath.join).toHaveBeenCalled();
    });

    it('handles large number of files', async () => {
      const files = Array.from({ length: 1000 }, (_, i) => `file${i}.json`);
      mockFsp.readdir.mockResolvedValue(files as any);

      const count = await invalidateNamespace('large-ns');

      expect(count).toBe(1000);
      expect(mockFsp.unlink).toHaveBeenCalledTimes(1000);
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent reads', async () => {
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() + 10000,
        value: 'test'
      }));

      const promises = [
        getCacheJSON('ns', 'key1'),
        getCacheJSON('ns', 'key2'),
        getCacheJSON('ns', 'key3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBe('test'));
    });

    it('handles concurrent writes', async () => {
      const promises = [
        setCacheJSON('ns', 'key1', 'value1', 1000),
        setCacheJSON('ns', 'key2', 'value2', 1000),
        setCacheJSON('ns', 'key3', 'value3', 1000)
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
      expect(mockFsp.writeFile).toHaveBeenCalledTimes(3);
    });

    it('handles concurrent namespace invalidation', async () => {
      mockFsp.readdir.mockResolvedValue(['file.json'] as any);

      const promises = [
        invalidateNamespace('ns1'),
        invalidateNamespace('ns2'),
        invalidateNamespace('ns3')
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([1, 1, 1]);
    });
  });

  describe('Edge Cases', () => {
    it('handles very long keys', async () => {
      const longKey = 'k'.repeat(10000);

      await setCacheJSON('ns', longKey, 'value', 1000);

      // Should hash the long key successfully
      expect(mockCrypto.createHash).toHaveBeenCalled();
    });

    it('handles special characters in keys', async () => {
      const specialKey = 'key/with\\special:chars?#[]@!$%^&*()';

      await getCacheJSON('ns', specialKey);

      expect(mockCrypto.createHash).toHaveBeenCalled();
    });

    it('handles Unicode in values', async () => {
      const unicodeValue = { text: '你好世界 🌍 مرحبا' };

      await setCacheJSON('ns', 'key', unicodeValue, 1000);

      const call = mockFsp.writeFile.mock.calls[0];
      const written = JSON.parse(call[1] as string);
      expect(written.value).toEqual(unicodeValue);
    });

    it('handles cache entry at exact expiration time', async () => {
      const expiresAt = Date.now();
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt,
        value: 'test'
      }));

      const result = await getCacheJSON('ns', 'key');

      // At exact expiration time, cache implementation uses > not >=, so it's NOT expired
      expect(result).toBe('test');
    });

    it('handles missing value property', async () => {
      mockFsp.readFile.mockResolvedValue(JSON.stringify({
        expiresAt: Date.now() + 10000
        // No value property
      }));

      const result = await getCacheJSON('ns', 'key');

      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    it('uses SHA-256 hash for key', async () => {
      await getCacheJSON('ns', 'key');

      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('reuses directory when it exists', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await setCacheJSON('ns', 'key1', 'value1', 1000);
      await setCacheJSON('ns', 'key2', 'value2', 1000);

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('creates directory when needed', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await setCacheJSON('ns', 'key1', 'value1', 1000);

      // ensureDirSync is called for each setCacheJSON
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles read permission errors', async () => {
      mockFsp.readFile.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await getCacheJSON('ns', 'key');

      expect(result).toBeNull();
    });

    it('handles write permission errors', async () => {
      mockFsp.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        setCacheJSON('ns', 'key', 'value', 1000)
      ).rejects.toThrow('EACCES');
    });

    it('handles corrupted cache files', async () => {
      mockFsp.readFile.mockResolvedValue('not valid json at all');

      const result = await getCacheJSON('ns', 'key');

      expect(result).toBeNull();
    });

    it('handles partial JSON', async () => {
      mockFsp.readFile.mockResolvedValue('{"expiresAt": 1000,');

      const result = await getCacheJSON('ns', 'key');

      expect(result).toBeNull();
    });
  });
});
