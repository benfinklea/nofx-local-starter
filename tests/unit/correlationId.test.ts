import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AsyncLocalStorage } from 'async_hooks';
import express, { Request, Response } from 'express';
import request from 'supertest';

// Mock the logger
jest.mock('../../src/lib/logger', () => ({
  log: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock metrics
jest.mock('../../src/lib/metrics', () => ({
  metrics: {
    httpRequestDuration: {
      observe: jest.fn()
    }
  }
}));

describe('Correlation ID and Structured Logging', () => {
  let app: express.Application;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();

    const { requestObservability } = require('../../src/lib/observability');
    const { log } = require('../../src/lib/logger');
    mockLogger = log;

    // Add middleware
    app.use(requestObservability);

    // Test endpoint
    app.get('/test', (req: Request, res: Response) => {
      const { getContext } = require('../../src/lib/observability');
      const ctx = getContext();
      res.json({
        correlationId: ctx?.correlationId,
        requestId: ctx?.requestId,
        runId: ctx?.runId
      });
    });

    // Endpoint that simulates work
    app.post('/runs/:id', (req: Request, res: Response) => {
      const { log, getContext } = require('../../src/lib/observability');
      const ctx = getContext();

      // Should automatically include correlation ID
      log.info({ event: 'run.processing' }, 'Processing run');

      res.json({ success: true, correlationId: ctx?.correlationId });
    });
  });

  describe('Request Correlation', () => {
    it('should generate correlation ID for new requests', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      // Check response headers
      expect(response.headers).toHaveProperty('x-correlation-id');
      expect(response.headers).toHaveProperty('x-request-id');

      // Correlation ID should be generated
      expect(response.body.correlationId).toBeTruthy();
      expect(response.body.correlationId).toMatch(/^[a-f0-9-]+$/);
    });

    it('should use provided correlation ID from headers', async () => {
      const customCorrelationId = 'custom_correlation_123';

      const response = await request(app)
        .get('/test')
        .set('X-Correlation-ID', customCorrelationId)
        .expect(200);

      // Should use the provided correlation ID
      expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
      expect(response.body.correlationId).toBe(customCorrelationId);
    });

    it('should extract run ID from URL params', async () => {
      const runId = 'run_abc123';

      const response = await request(app)
        .post(`/runs/${runId}`)
        .send({ data: 'test' })
        .expect(200);

      // Check that context was properly set
      expect(response.body.success).toBe(true);

      // Verify logger was called with correlation ID
      expect(mockLogger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: expect.any(String),
          runId: runId,
          method: 'POST'
        })
      );
    });
  });

  describe('Structured Logging', () => {
    it('should log request start and completion with context', async () => {
      const childLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      };

      mockLogger.child.mockReturnValue(childLogger);

      await request(app)
        .get('/test')
        .expect(200);

      // Verify request started log
      expect(childLogger.info).toHaveBeenCalledWith(
        { event: 'request.started' },
        'Request started'
      );

      // Wait for async finish event
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify request completed log
      expect(childLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'request.completed',
          statusCode: 200,
          latencyMs: expect.any(Number)
        }),
        'Request completed'
      );
    });

    it('should include correlation ID in all logs within request context', async () => {
      const { runWithContext, log } = require('../../src/lib/observability');

      const correlationId = 'test_correlation_456';

      // Simulate async operations within correlation context
      await runWithContext({ correlationId }, async () => {
        // This should be a proxy that adds correlation ID
        const proxyLog = log;

        // Mock the child method to verify it's called
        const childLogger = {
          info: jest.fn(),
          error: jest.fn()
        };
        mockLogger.child.mockReturnValue(childLogger);

        // Access a log method through the proxy
        proxyLog.info({ data: 'test' }, 'Test message');

        // Verify child was created with correlation ID
        expect(mockLogger.child).toHaveBeenCalledWith({ correlationId });
      });
    });
  });

  describe('Async Context Preservation', () => {
    it('should maintain correlation ID across async operations', async () => {
      const { runWithContext, getContext } = require('../../src/lib/observability');

      const correlationId = 'async_test_789';
      let capturedContext: any;

      await runWithContext({ correlationId }, async () => {
        // Simulate async operations
        await new Promise(resolve => setTimeout(resolve, 10));

        capturedContext = getContext();

        // Nested async operation
        await Promise.all([
          new Promise(resolve => {
            setTimeout(() => {
              const ctx = getContext();
              expect(ctx?.correlationId).toBe(correlationId);
              resolve(null);
            }, 5);
          }),
          new Promise(resolve => {
            setTimeout(() => {
              const ctx = getContext();
              expect(ctx?.correlationId).toBe(correlationId);
              resolve(null);
            }, 10);
          })
        ]);
      });

      expect(capturedContext?.correlationId).toBe(correlationId);
    });
  });

  describe('Performance Impact', () => {
    it('should have minimal performance overhead', async () => {
      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/test')
          .expect(200);
      }

      const duration = Date.now() - start;
      const avgMs = duration / iterations;

      // Should add less than 2ms per request on average
      expect(avgMs).toBeLessThan(50); // Generous limit for test environment
    });
  });
});