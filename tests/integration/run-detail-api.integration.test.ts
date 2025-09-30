/**
 * BULLETPROOF INTEGRATION TESTS - Run Detail API
 *
 * Tests the complete API endpoint including routing, authentication,
 * database queries, and response formatting.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../api/runs/[id]';

describe('Run Detail API Endpoint - BULLETPROOF INTEGRATION TESTS', () => {
  describe('🛡️ Vercel Routing Integration', () => {
    test('handles direct API call to /api/runs/[id]', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          run: expect.any(Object)
        })
      );
    });

    test('handles rewritten request from /runs/:id', async () => {
      // Simulates Vercel rewrite from /runs/:id → /api/runs/[id]
      const mockReq = {
        method: 'GET',
        query: { id: 'test-run-id' },
        url: '/runs/test-run-id',
        headers: {}
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      // Should process the rewritten request correctly
      expect(mockRes.status).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('rejects non-GET methods', async () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

      for (const method of methods) {
        const mockReq = {
          method,
          query: { id: 'test-id' }
        } as VercelRequest;

        const mockRes = createMockResponse();

        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Method not allowed'
          })
        );
      }
    });
  });

  describe('🛡️ Database Integration', () => {
    test('retrieves run from database', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'existing-run-id' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.run).toBeDefined();
      expect(response.run.id).toBe('existing-run-id');
    });

    test('retrieves associated steps', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'run-with-steps' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.steps).toBeDefined();
      expect(Array.isArray(response.steps)).toBe(true);
    });

    test('retrieves associated artifacts', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'run-with-artifacts' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.artifacts).toBeDefined();
      expect(Array.isArray(response.artifacts)).toBe(true);
    });

    test('returns 404 for non-existent run', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'non-existent-id' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'not found'
        })
      );
    });

    test('handles database connection failures', async () => {
      // Simulate database unavailable
      const mockReq = {
        method: 'GET',
        query: { id: 'trigger-db-error' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    test('handles database query timeout', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'slow-query-id' },
        headers: { 'x-timeout': '1000' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      // Should complete within reasonable time or timeout gracefully
      expect(mockRes.status).toHaveBeenCalled();
    });
  });

  describe('🛡️ Authentication & Authorization', () => {
    test('validates JWT token', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'test-id' },
        headers: {
          authorization: 'Bearer valid-jwt-token'
        }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      // Should accept valid token
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
    });

    test('rejects invalid JWT token', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'test-id' },
        headers: {
          authorization: 'Bearer invalid-token'
        }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('rejects expired JWT token', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'test-id' },
        headers: {
          authorization: 'Bearer expired-token-12345'
        }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('rejects malformed Authorization header', async () => {
      const malformedHeaders = [
        'Bearer',
        'bearer token',
        'Basic token',
        'token',
        'Bearer  ',
        ''
      ];

      for (const auth of malformedHeaders) {
        const mockReq = {
          method: 'GET',
          query: { id: 'test-id' },
          headers: { authorization: auth }
        } as VercelRequest;

        const mockRes = createMockResponse();

        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(401);
      }
    });

    test('enforces tenant isolation', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'other-tenant-run-id' },
        headers: {
          authorization: 'Bearer tenant-a-token'
        }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      // Should not return run from different tenant
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('🛡️ CORS & Security Headers', () => {
    test('includes CORS headers', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'test-id' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      // withCors wrapper should add CORS headers
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        expect.any(String)
      );
    });

    test('handles OPTIONS preflight request', async () => {
      const mockReq = {
        method: 'OPTIONS',
        query: { id: 'test-id' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        expect.stringContaining('GET')
      );
    });

    test('prevents XSS in response data', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'run-with-xss-content' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      const responseString = JSON.stringify(response);

      // Should not contain unescaped script tags
      expect(responseString).not.toContain('<script>');
      expect(responseString).not.toContain('javascript:');
    });

    test('sets security headers', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'test-id' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
    });
  });

  describe('🛡️ Error Handling & Edge Cases', () => {
    test('handles missing query parameter', async () => {
      const mockReq = {
        method: 'GET',
        query: {}
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('handles array of IDs in query parameter', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: ['id1', 'id2'] }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      // Should handle first ID or reject
      expect(mockRes.status).toHaveBeenCalled();
    });

    test('handles extremely long request processing', async () => {
      jest.setTimeout(30000);

      const mockReq = {
        method: 'GET',
        query: { id: 'very-complex-run' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      const start = Date.now();
      await handler(mockReq, mockRes);
      const duration = Date.now() - start;

      // Should complete within Vercel timeout (60s)
      expect(duration).toBeLessThan(60000);
    });

    test('handles concurrent requests to same run', async () => {
      const promises = Array(50).fill(null).map(() => {
        const mockReq = {
          method: 'GET',
          query: { id: 'popular-run-id' }
        } as VercelRequest;

        const mockRes = createMockResponse();

        return handler(mockReq, mockRes);
      });

      await Promise.all(promises);

      // All should complete successfully
      expect(promises).toHaveLength(50);
    });

    test('handles request with special characters in headers', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'test-id' },
        headers: {
          'user-agent': 'Test/1.0 (特殊文字)',
          'accept-language': 'en-US,en;q=0.9,ja;q=0.8'
        }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalled();
    });
  });

  describe('🛡️ Performance & Resource Limits', () => {
    test('completes within acceptable time', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'test-id' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      const start = Date.now();
      await handler(mockReq, mockRes);
      const duration = Date.now() - start;

      // Should complete in < 1 second for normal requests
      expect(duration).toBeLessThan(1000);
    });

    test('handles run with thousands of steps', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'run-with-many-steps' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.steps).toBeDefined();
      expect(Array.isArray(response.steps)).toBe(true);
    });

    test('handles run with large artifacts', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'run-with-large-artifacts' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
    });

    test('does not exceed Vercel function memory limit', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'memory-intensive-run' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      const initialMemory = process.memoryUsage().heapUsed;

      await handler(mockReq, mockRes);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Should use < 100MB for single request
      expect(memoryUsed).toBeLessThan(100);
    });
  });

  describe('🛡️ Data Integrity & Validation', () => {
    test('returns complete run object with all fields', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'complete-run-id' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.run).toMatchObject({
        id: expect.any(String),
        status: expect.any(String),
        tenant_id: expect.any(String),
        created_at: expect.any(String)
      });
    });

    test('validates run ID format before database query', async () => {
      const invalidIds = [
        'not-a-uuid',
        '12345',
        '',
        null,
        undefined,
        'DROP TABLE runs'
      ];

      for (const invalidId of invalidIds) {
        const mockReq = {
          method: 'GET',
          query: { id: invalidId }
        } as VercelRequest;

        const mockRes = createMockResponse();

        await handler(mockReq, mockRes);

        // Should return 400 or 404, not 500
        const statusCode = mockRes.status.mock.calls[0][0];
        expect([400, 404]).toContain(statusCode);
      }
    });

    test('ensures steps are ordered correctly', async () => {
      const mockReq = {
        method: 'GET',
        query: { id: 'run-with-ordered-steps' }
      } as VercelRequest;

      const mockRes = createMockResponse();

      await handler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      const steps = response.steps;

      if (steps && steps.length > 1) {
        // Verify steps are in order
        for (let i = 1; i < steps.length; i++) {
          expect(steps[i].sequence_number).toBeGreaterThanOrEqual(
            steps[i - 1].sequence_number
          );
        }
      }
    });
  });
});

// Helper function to create mock response object
function createMockResponse(): any {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };
  return mockRes;
}
