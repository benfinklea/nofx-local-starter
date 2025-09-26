/**
 * Comprehensive Security Tests
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/api/main';
import { pool } from '../src/lib/db';

describe('Security Tests', () => {
  // Clean up after tests
  afterAll(async () => {
    await pool.end();
  });

  describe('SQL Injection Protection', () => {
    it('should reject SQL injection in query parameters', async () => {
      const response = await request(app)
        .get('/api/runs')
        .query({ projectId: "'; DROP TABLE users; --" })
        .expect(400);

      expect(response.body.error).toContain('Invalid input');
    });

    it('should reject SQL injection in path parameters', async () => {
      const response = await request(app)
        .get("/api/runs/'; DELETE FROM runs; --")
        .expect(400);

      expect(response.body.error).toContain('Invalid input');
    });

    it('should safely handle parameterized queries', async () => {
      const maliciousId = "'; DROP TABLE runs; --";
      const { query } = require('../src/lib/db');

      // This should not execute the DROP TABLE
      const result = await query(
        'SELECT * FROM nofx.run WHERE id = $1',
        [maliciousId]
      );

      expect(result.rows).toHaveLength(0);

      // Verify table still exists
      const tableCheck = await query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'run')"
      );
      expect(tableCheck.rows[0].exists).toBe(true);
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize script tags in request body', async () => {
      const response = await request(app)
        .post('/api/runs/preview')
        .send({
          standard: {
            prompt: '<script>alert("XSS")</script>Test prompt'
          }
        })
        .expect(400);

      // Script tags should be removed
      expect(response.body).not.toContain('<script>');
    });

    it('should sanitize javascript: protocol', async () => {
      const response = await request(app)
        .post('/api/runs/preview')
        .send({
          standard: {
            prompt: 'Test <a href="javascript:alert(1)">click</a>'
          }
        });

      expect(response.text).not.toContain('javascript:');
    });

    it('should sanitize event handlers', async () => {
      const response = await request(app)
        .post('/api/runs/preview')
        .send({
          standard: {
            prompt: '<div onclick="alert(1)">Test</div>'
          }
        });

      expect(response.text).not.toContain('onclick=');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/runs')
        .send({ plan: { steps: [], goal: 'test' } })
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject requests with invalid JWT', async () => {
      const response = await request(app)
        .get('/api/runs')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject requests with expired JWT', async () => {
      // Create an expired JWT
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

      const response = await request(app)
        .get('/api/runs')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      const requests = [];

      // Make 6 requests (limit is 5)
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password' })
        );
      }

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toContain('Too many requests');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health');

      // Check critical security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include CSP header', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should not expose sensitive headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/runs/preview')
        .send({ standard: {} })
        .expect(400);

      expect(response.body.error).toContain('Validation');
    });

    it('should validate field types', async () => {
      const response = await request(app)
        .post('/api/runs/preview')
        .send({
          standard: {
            prompt: 123, // Should be string
            quality: 'yes' // Should be boolean
          }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate UUIDs', async () => {
      const response = await request(app)
        .get('/api/runs/not-a-uuid')
        .expect(400);

      expect(response.body.error).toContain('Invalid');
    });

    it('should validate enum values', async () => {
      const response = await request(app)
        .patch('/api/steps/123')
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('CORS Protection', () => {
    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil.com');

      expect(response.headers['access-control-allow-origin']).not.toBe('https://evil.com');
    });

    it('should allow requests from authorized origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('Error Handling', () => {
    it('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.stack).toBeUndefined();
      expect(response.body.error).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle database errors gracefully', async () => {
      // Force a database error by closing the pool
      const tempPool = pool;
      await pool.end();

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.database.status).toBe('error');

      // Restore pool
      Object.assign(pool, tempPool);
    });
  });

  describe('Authorization', () => {
    it('should prevent users from accessing other users data', async () => {
      // Mock authenticated user
      const userToken = 'valid-user-token';
      const otherUserId = 'other-user-id';

      const response = await request(app)
        .get(`/api/runs/${otherUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error).toContain('Access denied');
    });

    it('should allow admins to access all data', async () => {
      // Mock admin token
      const adminToken = 'valid-admin-token';

      const response = await request(app)
        .get('/api/runs')
        .set('Authorization', `Bearer ${adminToken}`);

      // Admin should get results
      expect(response.status).toBeLessThan(400);
    });
  });

  describe('Payload Size Limits', () => {
    it('should reject oversized payloads', async () => {
      const largePayload = {
        plan: {
          steps: Array(10000).fill({ tool: 'test', name: 'step' }),
          goal: 'x'.repeat(1000000)
        }
      };

      const response = await request(app)
        .post('/api/runs')
        .send(largePayload)
        .expect(413);

      expect(response.body.error).toContain('too large');
    });
  });
});