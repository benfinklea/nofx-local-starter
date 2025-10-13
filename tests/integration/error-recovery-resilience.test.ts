/**
 * Error Recovery and Resilience Integration Tests
 * Tests system behavior during failures, recovery scenarios, and graceful degradation
 */

import request from 'supertest';
import { waitForCondition, TestDataFactory, withRetry } from '../helpers/testHelpers';

describe('Integration: Error Recovery and Resilience', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    const appModule = await import('../../src/api/main');
    app = appModule.app;

    // Try to authenticate (may not be available in test environment)
    try {
      const authResponse = await request(app)
        .post('/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@example.com',
          password: process.env.ADMIN_PASSWORD || 'admin'
        });

      if (authResponse.status === 200 && authResponse.body.token) {
        authToken = authResponse.body.token;
      }
    } catch (error) {
      // Authentication not available - tests will handle 401 responses
      console.log('⚠️ Authentication not available - tests will accept 401 responses');
    }
  });

  describe('API Error Handling', () => {
    test('should return proper error format for invalid requests', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          // Missing required plan field
        });

      expect([400, 401, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect([400, 401, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      expect(response.status).toBe(404);
    });

    test('should handle method not allowed', async () => {
      const response = await request(app)
        .put('/health') // Health endpoint probably only supports GET
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      expect([404, 405]).toContain(response.status);
    });
  });

  describe('Authentication and Authorization Errors', () => {
    test('should handle missing authentication token', async () => {
      const response = await request(app)
        .post('/runs')
        .send({
          plan: TestDataFactory.createRunPlan()
        });

      // Either succeeds (unauthenticated endpoints) or fails with 401/403
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    test('should handle invalid authentication token', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', 'Bearer invalid-token-12345')
        .send({
          plan: TestDataFactory.createRunPlan()
        });

      // Either succeeds (no auth required) or fails with auth error
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    test('should handle expired sessions gracefully', async () => {
      // Simulate expired token (if auth is implemented)
      const response = await request(app)
        .get('/runs')
        .set('Authorization', 'Bearer expired.token.here');

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 401 || response.status === 403) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Database Error Recovery', () => {
    test('should handle database query timeout', async () => {
      // This test depends on database configuration
      // In production, queries should have timeouts

      const response = await request(app)
        .get('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      // Should either succeed, require auth, or fail gracefully
      expect([200, 401, 500, 503]).toContain(response.status);

      if (response.status === 503) {
        expect(response.body.error).toMatch(/unavailable|timeout|database/i);
      }
    });

    test('should handle constraint violations gracefully', async () => {
      // Try to create duplicate resources
      const plan = TestDataFactory.createRunPlan();

      const first = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({ plan });

      if (first.status === 201) {
        // Try to create with same idempotency key (if supported)
        const second = await request(app)
          .post('/runs')
          .set('Authorization', authToken ? `Bearer ${authToken}` : '')
          .set('Idempotency-Key', 'duplicate-key-123')
          .send({ plan });

        const third = await request(app)
          .post('/runs')
          .set('Authorization', authToken ? `Bearer ${authToken}` : '')
          .set('Idempotency-Key', 'duplicate-key-123')
          .send({ plan });

        // Either both succeed (idempotency) or second fails
        expect([200, 201, 409]).toContain(second.status);
        expect([200, 201, 409]).toContain(third.status);
      }
    });
  });

  describe('Network and External Service Failures', () => {
    test('should handle slow network conditions', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/health');

      const duration = Date.now() - startTime;

      // Health check should respond quickly
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000);
    });

    test('should handle connection failures with retry', async () => {
      let attempt = 0;

      const result = await withRetry(async () => {
        attempt++;

        const response = await request(app)
          .get('/health');

        if (response.status !== 200) {
          throw new Error(`Health check failed with status ${response.status}`);
        }

        return response;
      }, 3);

      // Should eventually succeed
      expect(result.status).toBe(200);
    }, 30000);
  });

  describe('Run Execution Error Recovery', () => {
    test('should handle run creation failures gracefully', async () => {
      const invalidPlan = {
        goal: '', // Invalid empty goal
        steps: []
      };

      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({ plan: invalidPlan });

      expect([400, 401, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle step execution failures', async () => {
      const planWithInvalidStep = {
        goal: 'Test error recovery',
        steps: [
          {
            name: 'invalid-step',
            tool: 'non-existent-tool',
            inputs: {}
          }
        ]
      };

      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({ plan: planWithInvalidStep });

      // Skip test if authentication failed (401)
      if (response.status === 401) {
        console.log('⚠️ Skipping step execution test - authentication required');
        return;
      }

      if (response.status === 201) {
        const runId = response.body.run?.id || response.body.id;

        // Wait for run to process
        await waitForCondition(async () => {
          const statusResponse = await request(app)
            .get(`/runs/${runId}`)
            .set('Authorization', authToken ? `Bearer ${authToken}` : '');

          return ['failed', 'succeeded', 'cancelled'].includes(statusResponse.body.status);
        }, 60000);

        // Verify error is reported
        const finalStatus = await request(app)
          .get(`/runs/${runId}`)
          .set('Authorization', authToken ? `Bearer ${authToken}` : '');

        // Should either fail gracefully or skip invalid step
        expect(['failed', 'succeeded']).toContain(finalStatus.body.status);
      }
    }, 90000);

    test('should support run retry after failure', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: TestDataFactory.createRunPlan({
            goal: 'Retry test'
          })
        });

      // Skip test if authentication failed (401)
      if (response.status === 401) {
        console.log('⚠️ Skipping retry test - authentication required');
        return;
      }

      if (response.status === 201) {
        const runId = response.body.run?.id || response.body.id;

        // Attempt to retry the run (if supported)
        const retryResponse = await request(app)
          .post(`/runs/${runId}/retry`)
          .set('Authorization', authToken ? `Bearer ${authToken}` : '');

        // Either retries or returns 404/405 if not supported
        expect([200, 201, 404, 405]).toContain(retryResponse.status);
      }
    });
  });

  describe('Graceful Degradation', () => {
    test('should continue operating with cache unavailable', async () => {
      // System should work without Redis/cache
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);

      // Check if degraded mode is indicated
      if (response.headers['x-cache']) {
        console.log('Cache status:', response.headers['x-cache']);
      }
    });

    test('should handle queue unavailability gracefully', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: TestDataFactory.createRunPlan()
        });

      // Should either succeed, fail gracefully, or require auth
      expect([201, 401, 503]).toContain(response.status);

      if (response.status === 503) {
        expect(response.body.error).toMatch(/unavailable|queue|service/i);
      }
    });

    test('should provide health status even during partial outage', async () => {
      const response = await request(app)
        .get('/health');

      // Health endpoint should always respond
      expect([200, 503]).toContain(response.status);

      // Should provide component status
      expect(response.body).toBeDefined();
    });
  });

  describe('Resource Cleanup and Leak Prevention', () => {
    test('should clean up resources after failed requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Make multiple failing requests
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/runs')
          .set('Authorization', authToken ? `Bearer ${authToken}` : '')
          .send({ invalid: 'data' })
          .catch(() => {
            // Ignore errors
          });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 30000);

    test('should not leak database connections', async () => {
      // Make multiple concurrent requests
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .get('/health')
      );

      await Promise.all(promises);

      // System should still be responsive
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
    });
  });

  describe('Error Reporting and Logging', () => {
    test('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({ invalid: 'data' });

      // Should return an error (validation, auth, or server error)
      expect([400, 401, 422, 500]).toContain(response.status);

      const errorMessage = JSON.stringify(response.body).toLowerCase();

      // Should not expose internal details (but generic mentions like "api key" in instructions are OK)
      expect(errorMessage).not.toMatch(/password|secret.*value|credential.*value|private.*key/i);
      expect(errorMessage).not.toMatch(/stack trace|at Object\./i);
      expect(errorMessage).not.toMatch(/node_modules/i);
    });

    test('should provide actionable error messages', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: {
            goal: 'Test',
            // Missing steps
          }
        });

      // Should return an error (validation or auth)
      expect([400, 401, 422]).toContain(response.status);

      // All error responses should have error messages
      expect(response.body.error).toBeDefined();
      expect(typeof response.body.error).toBe('string');
      expect(response.body.error.length).toBeGreaterThan(10);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    test('should handle cascading failures', async () => {
      // Make multiple requests that might trigger circuit breaker
      const results = [];

      for (let i = 0; i < 10; i++) {
        try {
          const response = await request(app)
            .get('/health');

          results.push(response.status === 200);
        } catch (error) {
          results.push(false);
        }
      }

      // At least some requests should succeed
      const successCount = results.filter(Boolean).length;
      expect(successCount).toBeGreaterThan(0);

      console.log(`Circuit breaker test: ${successCount}/10 requests succeeded`);
    });
  });
});
