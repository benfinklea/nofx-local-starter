import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import {
  idempotency,
  initializeIdempotencyCache,
  cleanupExpiredCache,
  isIdempotentReplay,
  getIdempotencyKey,
  IdempotentRequest
} from '../../src/lib/middleware/idempotency';

// Mock observability
jest.mock('../../src/lib/observability', () => ({
  getContext: jest.fn(() => ({
    correlationId: 'test-correlation-123',
    requestId: 'test-request-456'
  })),
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock database
const mockQuery = jest.fn();
jest.mock('../../src/lib/db', () => ({
  query: mockQuery
}));

describe('Idempotency Middleware', () => {
  let app: Express;
  let testIdempotencyKey: string;

  beforeAll(async () => {
    // Mock successful table creation
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await initializeIdempotencyCache();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    testIdempotencyKey = `test_${randomUUID()}`;

    // Reset mock implementations
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('Middleware Setup', () => {
    it('should skip non-POST/PUT/PATCH methods', async () => {
      app.use(idempotency());
      app.get('/test', (req, res) => res.json({ method: 'GET' }));

      await request(app)
        .get('/test')
        .expect(200)
        .expect({ method: 'GET' });

      // Should not query cache for GET requests
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
    });

    it('should process POST requests with idempotency key', async () => {
      app.use(idempotency());
      app.post('/test', (req: IdempotentRequest, res) => {
        res.json({
          hasKey: !!req.idempotencyKey,
          key: req.idempotencyKey
        });
      });

      const response = await request(app)
        .post('/test')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send({ data: 'test' })
        .expect(200);

      expect(response.body.hasKey).toBe(true);
      expect(response.body.key).toBe(testIdempotencyKey);

      // Should query cache
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['local', testIdempotencyKey, 'POST', '/test'])
      );
    });

    it('should skip processing when no idempotency key provided', async () => {
      app.use(idempotency());
      app.post('/test', (req: IdempotentRequest, res) => {
        res.json({ hasKey: !!req.idempotencyKey });
      });

      const response = await request(app)
        .post('/test')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body.hasKey).toBe(false);
    });
  });

  describe('Key Validation', () => {
    it('should reject empty idempotency key', async () => {
      app.use(idempotency());
      app.post('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', '')
        .send({ data: 'test' })
        .expect(400)
        .expect((res) => {
          expect(res.body.title).toBe('Invalid Idempotency Key');
          expect(res.body.detail).toContain('cannot be empty');
        });
    });

    it('should reject keys that are too long', async () => {
      app.use(idempotency({ keyMaxLength: 50 }));
      app.post('/test', (req, res) => res.json({ success: true }));

      const longKey = 'a'.repeat(51);

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', longKey)
        .send({ data: 'test' })
        .expect(400)
        .expect((res) => {
          expect(res.body.detail).toContain('cannot exceed 50 characters');
        });
    });

    it('should reject keys with insufficient entropy', async () => {
      app.use(idempotency());
      app.post('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', 'short')
        .send({ data: 'test' })
        .expect(400)
        .expect((res) => {
          expect(res.body.detail).toContain('at least 8 characters');
        });
    });

    it('should reject keys with invalid characters', async () => {
      app.use(idempotency());
      app.post('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', 'invalid@key!')
        .send({ data: 'test' })
        .expect(400)
        .expect((res) => {
          expect(res.body.detail).toContain('invalid characters');
        });
    });

    it('should accept valid keys', async () => {
      app.use(idempotency());
      app.post('/test', (req, res) => res.json({ success: true }));

      const validKeys = [
        'valid_key_123',
        'another-valid-key',
        'UPPERCASE_KEY',
        'mixed_Case-Key123'
      ];

      for (const key of validKeys) {
        await request(app)
          .post('/test')
          .set('X-Idempotency-Key', key)
          .send({ data: 'test' })
          .expect(200);
      }
    });

    it('should skip validation when configured', async () => {
      app.use(idempotency({ skipValidation: true }));
      app.post('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', 'x')  // Too short normally
        .send({ data: 'test' })
        .expect(200);
    });
  });

  describe('Response Caching', () => {
    it('should cache successful responses', async () => {
      app.use(idempotency());
      app.post('/test', (req, res) => {
        res.status(201).json({ id: 'resource_123', created: true });
      });

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send({ data: 'test' })
        .expect(201);

      // Should cache the response
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO nofx.idempotency_cache'),
        expect.arrayContaining([
          'local',
          testIdempotencyKey,
          'POST',
          '/test',
          201,
          expect.any(Object),
          { id: 'resource_123', created: true }
        ])
      );
    });

    it('should cache client errors but not server errors', async () => {
      app.use(idempotency());
      app.post('/test-400', (req, res) => {
        res.status(400).json({ error: 'Bad Request' });
      });
      app.post('/test-500', (req, res) => {
        res.status(500).json({ error: 'Internal Error' });
      });

      // 400 should be cached
      await request(app)
        .post('/test-400')
        .set('X-Idempotency-Key', `${testIdempotencyKey}_400`)
        .send({ data: 'test' })
        .expect(400);

      // 500 should not be cached
      await request(app)
        .post('/test-500')
        .set('X-Idempotency-Key', `${testIdempotencyKey}_500`)
        .send({ data: 'test' })
        .expect(500);

      const cacheCalls = mockQuery.mock.calls.filter(call =>
        call[0] && call[0].includes('INSERT INTO nofx.idempotency_cache')
      );

      // Should have cached the 400 but not the 500
      expect(cacheCalls).toHaveLength(1);
      expect(cacheCalls[0][1]).toContain(`${testIdempotencyKey}_400`);
    });
  });

  describe('Response Replay', () => {
    it('should replay cached responses', async () => {
      // Mock cached response
      const cachedResponse = {
        status: 201,
        headers: { 'content-type': 'application/json' },
        body: { id: 'cached_resource', created: true },
        created_at: '2025-01-01T00:00:00Z'
      };

      mockQuery.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return Promise.resolve({ rows: [cachedResponse] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      app.use(idempotency());
      app.post('/test', (req, res) => {
        res.status(201).json({ id: 'new_resource', created: true });
      });

      const response = await request(app)
        .post('/test')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send({ data: 'test' })
        .expect(201);

      expect(response.body).toEqual(cachedResponse.body);
      expect(response.headers['x-idempotency-replayed']).toBe('true');
      expect(response.headers['x-idempotency-original-date']).toBe(cachedResponse.created_at);
    });

    it('should not cache responses when replaying', async () => {
      // Mock cached response
      const cachedResponse = {
        status: 200,
        headers: {},
        body: { replayed: true },
        created_at: '2025-01-01T00:00:00Z'
      };

      mockQuery.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return Promise.resolve({ rows: [cachedResponse] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      app.use(idempotency());
      app.post('/test', (req, res) => {
        res.json({ original: true });
      });

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send({ data: 'test' })
        .expect(200);

      // Should not attempt to cache when replaying
      const insertCalls = mockQuery.mock.calls.filter(call =>
        call[0] && call[0].includes('INSERT INTO nofx.idempotency_cache')
      );
      expect(insertCalls).toHaveLength(0);
    });
  });

  describe('Key Generation', () => {
    it('should generate keys when enabled and none provided', async () => {
      app.use(idempotency({ generateKey: true }));
      app.post('/test', (req: IdempotentRequest, res) => {
        res.json({
          hasKey: !!req.idempotencyKey,
          keyPrefix: req.idempotencyKey?.startsWith('auto_')
        });
      });

      const response = await request(app)
        .post('/test')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body.hasKey).toBe(true);
      expect(response.body.keyPrefix).toBe(true);
    });

    it('should not generate keys when disabled', async () => {
      app.use(idempotency({ generateKey: false }));
      app.post('/test', (req: IdempotentRequest, res) => {
        res.json({ hasKey: !!req.idempotencyKey });
      });

      const response = await request(app)
        .post('/test')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body.hasKey).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('should identify replay requests', () => {
      const replayReq = { isReplay: true } as IdempotentRequest;
      const normalReq = {} as IdempotentRequest;

      expect(isIdempotentReplay(replayReq)).toBe(true);
      expect(isIdempotentReplay(normalReq)).toBe(false);
    });

    it('should extract idempotency keys', () => {
      const reqWithKey = { idempotencyKey: 'test_key' } as IdempotentRequest;
      const reqWithoutKey = {} as IdempotentRequest;

      expect(getIdempotencyKey(reqWithKey)).toBe('test_key');
      expect(getIdempotencyKey(reqWithoutKey)).toBeUndefined();
    });
  });

  describe('Custom Headers', () => {
    it('should accept custom header names', async () => {
      app.use(idempotency({ keyHeader: 'custom-idempotency-header' }));
      app.post('/test', (req: IdempotentRequest, res) => {
        res.json({ key: req.idempotencyKey });
      });

      const response = await request(app)
        .post('/test')
        .set('Custom-Idempotency-Header', testIdempotencyKey)
        .send({ data: 'test' })
        .expect(200);

      expect(response.body.key).toBe(testIdempotencyKey);
    });
  });

  describe('Error Handling', () => {
    it('should continue processing when cache fails', async () => {
      // Mock cache failure
      mockQuery.mockRejectedValue(new Error('Database error'));

      app.use(idempotency());
      app.post('/test', (req, res) => {
        res.json({ processed: true });
      });

      await request(app)
        .post('/test')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send({ data: 'test' })
        .expect(200)
        .expect({ processed: true });
    });
  });

  describe('Cache Management', () => {
    it('should clean up expired entries', async () => {
      mockQuery.mockResolvedValue({ rowCount: 5 });

      const deletedCount = await cleanupExpiredCache();

      expect(deletedCount).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM nofx.idempotency_cache WHERE expires_at < now()'
      );
    });

    it('should handle cleanup failures gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const deletedCount = await cleanupExpiredCache();

      expect(deletedCount).toBe(0);
    });
  });
});